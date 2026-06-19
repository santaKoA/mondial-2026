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
