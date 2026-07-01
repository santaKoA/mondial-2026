"""
Fills round-of-32 bracket slots based on completed group standings.
Called automatically after every group match is finalized.
"""
import logging
from sqlalchemy.orm import Session
from database import SessionLocal
import models

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Bracket mapping: (group, position) -> (match_id, 'home'|'away')
# Position 1=winner, 2=runner-up
# Match IDs 73-88 are in ESPN schedule order (same order they were seeded)
# ---------------------------------------------------------------------------
BRACKET_SLOTS: dict[tuple, tuple] = {
    # Match 73: 2A vs 2B
    ('A', 2): (73, 'home'),
    ('B', 2): (73, 'away'),
    # Match 74: 1C vs 2F
    ('C', 1): (74, 'home'),
    ('F', 2): (74, 'away'),
    # Match 75: 1E vs 3rd(A/B/C/D/F)
    ('E', 1): (75, 'home'),
    # Match 76: 1F vs 2C
    ('F', 1): (76, 'home'),
    ('C', 2): (76, 'away'),
    # Match 77: 2E vs 2I
    ('E', 2): (77, 'home'),
    ('I', 2): (77, 'away'),
    # Match 78: 1I vs 3rd(C/D/F/G/H)
    ('I', 1): (78, 'home'),
    # Match 79: 1A vs 3rd(C/E/F/H/I)
    ('A', 1): (79, 'home'),
    # Match 80: 1L vs 3rd(E/H/I/J/K)
    ('L', 1): (80, 'home'),
    # Match 81: 1G vs 3rd(A/E/H/I/J)
    ('G', 1): (81, 'home'),
    # Match 82: 1D vs 3rd(B/E/F/I/J)
    ('D', 1): (82, 'home'),
    # Match 83: 1H vs 2J
    ('H', 1): (83, 'home'),
    ('J', 2): (83, 'away'),
    # Match 84: 2K vs 2L
    ('K', 2): (84, 'home'),
    ('L', 2): (84, 'away'),
    # Match 85: 1B vs 3rd(E/F/G/I/J)
    ('B', 1): (85, 'home'),
    # Match 86: 2D vs 2G
    ('D', 2): (86, 'home'),
    ('G', 2): (86, 'away'),
    # Match 87: 1J vs 2H
    ('J', 1): (87, 'home'),
    ('H', 2): (87, 'away'),
    # Match 88: 1K vs 3rd(D/E/I/J/L)
    ('K', 1): (88, 'home'),
}

# Third-place slots: match_id -> eligible groups pool
THIRD_PLACE_SLOTS: list[tuple] = [
    (75, {'A', 'B', 'C', 'D', 'F'}),
    (78, {'C', 'D', 'F', 'G', 'H'}),
    (79, {'C', 'E', 'F', 'H', 'I'}),
    (80, {'E', 'H', 'I', 'J', 'K'}),
    (81, {'A', 'E', 'H', 'I', 'J'}),
    (82, {'B', 'E', 'F', 'I', 'J'}),
    (85, {'E', 'F', 'G', 'I', 'J'}),
    (88, {'D', 'E', 'I', 'J', 'L'}),
]


def _standing_key(row: dict) -> tuple:
    """Sort key: higher is better."""
    return (row['pts'], row['gd'], row['gf'])


def compute_group_standings(db: Session, group_name: str) -> list[dict]:
    """
    Returns teams in this group sorted by standing (best first).
    Each dict: {team_id, pts, gd, gf, played}
    """
    matches = db.query(models.Match).filter(
        models.Match.group_name == group_name,
        models.Match.stage == 'group',
        models.Match.is_test == False,
        models.Match.home_team_id.isnot(None),
    ).all()

    stats: dict[int, dict] = {}

    def _init(tid):
        if tid not in stats:
            stats[tid] = {'team_id': tid, 'pts': 0, 'gd': 0, 'gf': 0, 'played': 0}

    for m in matches:
        if m.status != 'finished' or m.home_score is None:
            continue
        h, a = m.home_team_id, m.away_team_id
        hs, as_ = m.home_score, m.away_score
        _init(h); _init(a)
        stats[h]['played'] += 1
        stats[a]['played'] += 1
        stats[h]['gf'] += hs; stats[h]['gd'] += hs - as_
        stats[a]['gf'] += as_; stats[a]['gd'] += as_ - hs
        if hs > as_:
            stats[h]['pts'] += 3
        elif hs == as_:
            stats[h]['pts'] += 1; stats[a]['pts'] += 1
        else:
            stats[a]['pts'] += 3

    # Add teams that haven't played yet (0 stats)
    all_teams = db.query(models.Match).filter(
        models.Match.group_name == group_name,
        models.Match.stage == 'group',
        models.Match.is_test == False,
        models.Match.home_team_id.isnot(None),
    ).all()
    for m in all_teams:
        _init(m.home_team_id); _init(m.away_team_id)

    return sorted(stats.values(), key=_standing_key, reverse=True)


def _set_team(db: Session, match_id: int, side: str, team_id: int):
    """Set home or away team on a knockout match if not already set."""
    m = db.query(models.Match).filter(models.Match.id == match_id).first()
    if not m:
        return
    if side == 'home' and m.home_team_id != team_id:
        m.home_team_id = team_id
        logger.info(f"Bracket: set match {match_id} home → team {team_id}")
    elif side == 'away' and m.away_team_id != team_id:
        m.away_team_id = team_id
        logger.info(f"Bracket: set match {match_id} away → team {team_id}")


def fill_bracket_for_group(group_name: str):
    """
    Called after a group match finishes.
    Fills winner/runner-up slots if group is complete (all 6 matches done).
    Also triggers 3rd-place filling if all 12 groups are done.
    """
    db = SessionLocal()
    try:
        # Check if all 6 group matches are finished
        group_matches = db.query(models.Match).filter(
            models.Match.group_name == group_name,
            models.Match.stage == 'group',
            models.Match.is_test == False,
            models.Match.home_team_id.isnot(None),
        ).all()

        total = len(group_matches)
        done = sum(1 for m in group_matches if m.status == 'finished')

        if total < 6 or done < 6:
            logger.info(f"Group {group_name}: {done}/{total} done, bracket not filled yet")
            return

        standings = compute_group_standings(db, group_name)
        if len(standings) < 2:
            return

        winner_id = standings[0]['team_id']
        runner_up_id = standings[1]['team_id']

        # Fill winner slot
        slot = BRACKET_SLOTS.get((group_name, 1))
        if slot:
            _set_team(db, slot[0], slot[1], winner_id)

        # Fill runner-up slot
        slot = BRACKET_SLOTS.get((group_name, 2))
        if slot:
            _set_team(db, slot[0], slot[1], runner_up_id)

        db.commit()
        logger.info(f"Group {group_name} complete — bracket slots filled")

        # Check if ALL groups are done → fill 3rd-place slots
        all_groups = ['A','B','C','D','E','F','G','H','I','J','K','L']
        all_done = all(
            db.query(models.Match).filter(
                models.Match.group_name == g,
                models.Match.stage == 'group',
                models.Match.is_test == False,
                models.Match.status == 'finished',
            ).count() >= 6
            for g in all_groups
        )
        if all_done:
            _fill_third_place_slots(db)
            db.commit()

    finally:
        db.close()


def _fill_third_place_slots(db: Session):
    """
    After all 12 groups are complete, assign the 8 best 3rd-place teams
    to their respective round-of-32 slots.
    """
    all_groups = ['A','B','C','D','E','F','G','H','I','J','K','L']
    third_place_teams = []

    for g in all_groups:
        standings = compute_group_standings(db, g)
        if len(standings) >= 3:
            t = standings[2]
            t['group'] = g
            third_place_teams.append(t)

    # Sort best → worst
    third_place_teams.sort(key=_standing_key, reverse=True)
    qualifying = third_place_teams[:8]
    qualifying_groups = {t['group'] for t in qualifying}

    logger.info(f"3rd-place qualifiers from groups: {qualifying_groups}")

    # Assign each qualifying 3rd-place team to a slot
    # Each slot has a pool of eligible groups; assign the best available team
    assigned_groups: set[str] = set()

    for match_id, pool in THIRD_PLACE_SLOTS:
        eligible = [t for t in qualifying if t['group'] in pool and t['group'] not in assigned_groups]
        if not eligible:
            continue
        best = max(eligible, key=_standing_key)
        _set_team(db, match_id, 'away', best['team_id'])
        assigned_groups.add(best['group'])
        logger.info(f"3rd-place slot match {match_id}: group {best['group']} team {best['team_id']}")


# ---------------------------------------------------------------------------
# Knockout bracket advancement: winner of match X → slot in match Y
# (match_id_source) -> (match_id_dest, 'home'|'away')
# ---------------------------------------------------------------------------
KNOCKOUT_ADVANCEMENT: dict[int, tuple[int, str]] = {
    # R32 → R16  (ESPN bracket confirmed Jun 30 2026)
    73: (89, 'home'), 76: (89, 'away'),   # Canada + Morocco → R16 89
    75: (90, 'home'), 78: (90, 'away'),   # Paraguay + France/Sweden → R16 90
    74: (91, 'home'), 77: (91, 'away'),   # Brazil + Ivory Coast/Norway → R16 91
    79: (92, 'home'), 80: (92, 'away'),   # Mexico/Ecuador + England/Congo → R16 92
    84: (93, 'home'), 83: (93, 'away'),   # Portugal/Croatia + Spain/Austria → R16 93
    82: (94, 'home'), 81: (94, 'away'),   # USA/Bosnia + Belgium/Senegal → R16 94
    86: (95, 'home'), 88: (95, 'away'),   # Australia/Egypt + Colombia/Ghana → R16 95
    87: (96, 'home'), 85: (96, 'away'),   # Argentina + Switzerland/Algeria → R16 96
    # R16 → QF
    89: (97, 'home'), 90: (97, 'away'),
    91: (99, 'home'), 92: (99, 'away'),
    93: (98, 'home'), 94: (98, 'away'),
    95: (100, 'home'), 96: (100, 'away'),
    # QF → SF  (left bracket: 97+99 → SF101; right bracket: 98+100 → SF102)
    97: (101, 'home'), 99: (101, 'away'),
    98: (102, 'home'), 100: (102, 'away'),
    # SF → Final
    101: (104, 'home'), 102: (104, 'away'),
}
# Losers of SF go to 3rd place match
SF_LOSER_SLOTS: dict[int, tuple[int, str]] = {
    101: (103, 'home'),
    102: (103, 'away'),
}


def advance_knockout_winner(match_id: int, home_score: int, away_score: int, winner_side: str | None = None):
    """
    Called after a knockout match finishes.
    Advances the winner to the next bracket slot.
    For SF losers, also fills the 3rd place match.
    winner_side: 'home'|'away' from ESPN's winner flag (handles penalty draws).
    Falls back to score comparison if not provided.
    """
    slot = KNOCKOUT_ADVANCEMENT.get(match_id)
    if not slot:
        return

    db = SessionLocal()
    try:
        match = db.query(models.Match).filter(models.Match.id == match_id).first()
        if not match:
            return

        if winner_side == 'home':
            winner_id = match.home_team_id
            loser_id = match.away_team_id
        elif winner_side == 'away':
            winner_id = match.away_team_id
            loser_id = match.home_team_id
        elif home_score > away_score:
            winner_id = match.home_team_id
            loser_id = match.away_team_id
        elif away_score > home_score:
            winner_id = match.away_team_id
            loser_id = match.home_team_id
        else:
            return  # can't determine winner

        dest_match_id, side = slot
        _set_team(db, dest_match_id, side, winner_id)
        logger.info(f"Knockout advance: match {match_id} winner team {winner_id} → match {dest_match_id} {side}")

        # SF loser → 3rd place
        loser_slot = SF_LOSER_SLOTS.get(match_id)
        if loser_slot and loser_id:
            _set_team(db, loser_slot[0], loser_slot[1], loser_id)
            logger.info(f"3rd place: match {match_id} loser team {loser_id} → match {loser_slot[0]} {loser_slot[1]}")

        db.commit()
    finally:
        db.close()


async def backfill_knockout_advancements():
    """
    Called once at startup (async). Clears all unstarted R16+ bracket slots,
    then re-fills them from finished R32+ matches. This corrects any previously
    wrong placements caused by an outdated KNOCKOUT_ADVANCEMENT mapping.
    For penalty/ET draws (equal score) re-queries ESPN to get the winner flag.
    """
    import httpx
    from datetime import timedelta

    ESPN_URL = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard"

    db = SessionLocal()
    try:
        # Clear all R16+ slots (match IDs 89–104) so stale wrong placements are replaced.
        # R16 matches haven't started yet — safe to wipe.
        for m in db.query(models.Match).filter(
            models.Match.id >= 89, models.Match.id <= 104
        ).all():
            if m.status != 'finished':
                m.home_team_id = None
                m.away_team_id = None
        db.commit()
        logger.info("Backfill: cleared unstarted knockout slots (IDs 89-104)")

        team_names: dict[int, str] = {t.id: t.name for t in db.query(models.Team).all()}

        # Build reverse map: Hebrew name → team id
        name_to_id: dict[str, int] = {v: k for k, v in team_names.items()}

        # Import here to avoid circular imports
        from services.results_sync import _to_hebrew

        for src_id, (dest_id, side) in KNOCKOUT_ADVANCEMENT.items():
            src = db.query(models.Match).filter(models.Match.id == src_id).first()
            if not src or src.status != 'finished':
                continue
            dest = db.query(models.Match).filter(models.Match.id == dest_id).first()
            if not dest:
                continue
            # Skip if slot already filled (e.g. live match already has teams)
            already_filled = dest.home_team_id if side == 'home' else dest.away_team_id
            if already_filled is not None:
                continue

            hs, as_ = src.home_score, src.away_score
            winner_id = loser_id = None

            if hs is not None and as_ is not None and hs != as_:
                # Clear winner from score
                if hs > as_:
                    winner_id, loser_id = src.home_team_id, src.away_team_id
                else:
                    winner_id, loser_id = src.away_team_id, src.home_team_id
            else:
                # Draw (ET/pens) — ask ESPN who won
                dates = set()
                d = src.scheduled_at
                for delta in (-1, 0, 1):
                    dates.add((d + timedelta(days=delta)).strftime("%Y%m%d"))
                try:
                    async with httpx.AsyncClient(timeout=15) as client:
                        for date_str in dates:
                            resp = await client.get(f"{ESPN_URL}?dates={date_str}")
                            if resp.status_code != 200:
                                continue
                            for e in resp.json().get("events", []):
                                comp = e.get("competitions", [{}])[0]
                                state = comp.get("status", {}).get("type", {}).get("state")
                                if state != "post":
                                    continue
                                competitors = comp.get("competitors", [])
                                home_c = next((c for c in competitors if c.get("homeAway") == "home"), None)
                                away_c = next((c for c in competitors if c.get("homeAway") == "away"), None)
                                if not home_c or not away_c:
                                    continue
                                h_heb = _to_hebrew(home_c.get("team", {}).get("displayName", ""))
                                a_heb = _to_hebrew(away_c.get("team", {}).get("displayName", ""))
                                if (name_to_id.get(h_heb) == src.home_team_id and
                                        name_to_id.get(a_heb) == src.away_team_id):
                                    if home_c.get("winner"):
                                        winner_id, loser_id = src.home_team_id, src.away_team_id
                                    elif away_c.get("winner"):
                                        winner_id, loser_id = src.away_team_id, src.home_team_id
                                    break
                            if winner_id:
                                break
                except Exception as exc:
                    logger.warning(f"Backfill ESPN query failed for match {src_id}: {exc}")

            if not winner_id:
                logger.warning(f"Backfill: could not determine winner of match {src_id}, skipping")
                continue

            _set_team(db, dest_id, side, winner_id)
            logger.info(f"Backfill: match {src_id} winner team {winner_id} → match {dest_id} {side}")

            loser_slot = SF_LOSER_SLOTS.get(src_id)
            if loser_slot and loser_id:
                dest3 = db.query(models.Match).filter(models.Match.id == loser_slot[0]).first()
                slot_filled = (dest3.home_team_id if loser_slot[1] == 'home' else dest3.away_team_id) if dest3 else None
                if dest3 and slot_filled is None:
                    _set_team(db, loser_slot[0], loser_slot[1], loser_id)

        db.commit()
        logger.info("Backfill knockout advancements complete")
    finally:
        db.close()
