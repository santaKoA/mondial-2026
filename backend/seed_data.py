from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from config import settings
import models
import secrets

GROUPS: dict[str, list[tuple[str, str]]] = {
    "A": [("קטאר", "🇶🇦"), ("הולנד", "🇳🇱"), ("סנגל", "🇸🇳"), ("אקוודור", "🇪🇨")],
    "B": [("אנגליה", "🏴󠁧󠁢󠁥󠁮󠁧󠁿"), ("ארה\"ב", "🇺🇸"), ("טורקיה", "🇹🇷"), ("איראן", "🇮🇷")],
    "C": [("ארגנטינה", "🇦🇷"), ("מקסיקו", "🇲🇽"), ("פולין", "🇵🇱"), ("ערב הסעודית", "🇸🇦")],
    "D": [("צרפת", "🇫🇷"), ("דנמרק", "🇩🇰"), ("אוסטרליה", "🇦🇺"), ("תוניסיה", "🇹🇳")],
    "E": [("ספרד", "🇪🇸"), ("גרמניה", "🇩🇪"), ("יפן", "🇯🇵"), ("קוסטה ריקה", "🇨🇷")],
    "F": [("בלגיה", "🇧🇪"), ("קנדה", "🇨🇦"), ("מרוקו", "🇲🇦"), ("קרואטיה", "🇭🇷")],
    "G": [("ברזיל", "🇧🇷"), ("שווייץ", "🇨🇭"), ("קמרון", "🇨🇲"), ("סרביה", "🇷🇸")],
    "H": [("פורטוגל", "🇵🇹"), ("אורוגוואי", "🇺🇾"), ("קוריאה הדרומית", "🇰🇷"), ("גאנה", "🇬🇭")],
    "I": [("קולומביה", "🇨🇴"), ("סקוטלנד", "🏴󠁧󠁢󠁳󠁣󠁴󠁿"), ("מצרים", "🇪🇬"), ("ג'מייקה", "🇯🇲")],
    "J": [("נורווגיה", "🇳🇴"), ("פנמה", "🇵🇦"), ("ניגריה", "🇳🇬"), ("צ'כיה", "🇨🇿")],
    "K": [("אוסטריה", "🇦🇹"), ("חוף השנהב", "🇨🇮"), ("אוזבקיסטן", "🇺🇿"), ("ירדן", "🇯🇴")],
    "L": [("דרום אפריקה", "🇿🇦"), ("אלג'יריה", "🇩🇿"), ("קונגו", "🇨🇩"), ("עיראק", "🇮🇶")],
}

MATCHDAY_PAIRS = [
    [(0, 3), (1, 2)],
    [(0, 1), (2, 3)],
    [(0, 2), (1, 3)],
]

KNOCKOUT_STAGES = [
    ("round_of_32", 16, datetime(2026, 7, 1, 17, 0, tzinfo=timezone.utc), timedelta(hours=3)),
    ("round_of_16", 8, datetime(2026, 7, 5, 17, 0, tzinfo=timezone.utc), timedelta(hours=3)),
    ("quarter_final", 4, datetime(2026, 7, 11, 17, 0, tzinfo=timezone.utc), timedelta(hours=5)),
    ("semi_final", 2, datetime(2026, 7, 15, 17, 0, tzinfo=timezone.utc), timedelta(hours=24)),
    ("third_place", 1, datetime(2026, 7, 18, 17, 0, tzinfo=timezone.utc), timedelta(hours=0)),
    ("final", 1, datetime(2026, 7, 19, 20, 0, tzinfo=timezone.utc), timedelta(hours=0)),
]


def seed(db: Session):
    # Ensure default group exists (idempotent)
    default_group = db.query(models.Group).filter(
        models.Group.code == settings.GROUP_CODE
    ).first()
    if not default_group:
        default_group = models.Group(name="קבוצה ראשית", code=settings.GROUP_CODE)
        db.add(default_group)
        db.flush()

    if db.query(models.Team).count() > 0:
        return

    team_map: dict[str, models.Team] = {}
    for group_name, teams in GROUPS.items():
        for name, flag in teams:
            team = models.Team(name=name, flag=flag, group_name=group_name)
            db.add(team)
            db.flush()
            team_map[name] = team

    match_number = 1
    group_names = list(GROUPS.keys())

    for matchday_idx, pairs in enumerate(MATCHDAY_PAIRS):
        for group_idx, group_name in enumerate(group_names):
            teams_in_group = GROUPS[group_name]
            day_offset = group_idx // 3 + matchday_idx * 5
            base_time = datetime(2026, 6, 11, 17, 0, tzinfo=timezone.utc) + timedelta(days=day_offset)

            for pair_idx, (t1, t2) in enumerate(pairs):
                home_name = teams_in_group[t1][0]
                away_name = teams_in_group[t2][0]
                scheduled = base_time + timedelta(hours=pair_idx * 3)

                match = models.Match(
                    home_team_id=team_map[home_name].id,
                    away_team_id=team_map[away_name].id,
                    stage="group",
                    group_name=group_name,
                    match_number=match_number,
                    scheduled_at=scheduled,
                )
                db.add(match)
                match_number += 1

    for stage, count, base_time, interval in KNOCKOUT_STAGES:
        for i in range(count):
            scheduled = base_time + interval * i
            match = models.Match(
                home_team_id=None,
                away_team_id=None,
                stage=stage,
                group_name=None,
                match_number=match_number,
                scheduled_at=scheduled,
            )
            db.add(match)
            match_number += 1

    db.commit()
