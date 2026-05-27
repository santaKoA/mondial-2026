from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from config import settings
import models

# Real FIFA World Cup 2026 groups (draw result December 2025)
GROUPS: dict[str, list[tuple[str, str]]] = {
    "A": [("מקסיקו", "🇲🇽"), ("קוריאה הדרומית", "🇰🇷"), ("צ'כיה", "🇨🇿"), ("דרום אפריקה", "🇿🇦")],
    "B": [("קנדה", "🇨🇦"), ("קטאר", "🇶🇦"), ("שווייץ", "🇨🇭"), ("בוסניה והרצגובינה", "🇧🇦")],
    "C": [("ברזיל", "🇧🇷"), ("האיטי", "🇭🇹"), ("סקוטלנד", "🏴󠁧󠁢󠁳󠁣󠁴󠁿"), ("מרוקו", "🇲🇦")],
    "D": [("ארה\"ב", "🇺🇸"), ("פרגוואי", "🇵🇾"), ("אוסטרליה", "🇦🇺"), ("טורקיה", "🇹🇷")],
    "E": [("גרמניה", "🇩🇪"), ("חוף השנהב", "🇨🇮"), ("אקוודור", "🇪🇨"), ("קוראסאו", "🇨🇼")],
    "F": [("הולנד", "🇳🇱"), ("יפן", "🇯🇵"), ("שוודיה", "🇸🇪"), ("תוניסיה", "🇹🇳")],
    "G": [("בלגיה", "🇧🇪"), ("מצרים", "🇪🇬"), ("איראן", "🇮🇷"), ("ניו זילנד", "🇳🇿")],
    "H": [("ספרד", "🇪🇸"), ("ערב הסעודית", "🇸🇦"), ("אורוגוואי", "🇺🇾"), ("כף ורדה", "🇨🇻")],
    "I": [("צרפת", "🇫🇷"), ("סנגל", "🇸🇳"), ("נורווגיה", "🇳🇴"), ("עיראק", "🇮🇶")],
    "J": [("ארגנטינה", "🇦🇷"), ("אלג'יריה", "🇩🇿"), ("אוסטריה", "🇦🇹"), ("ירדן", "🇯🇴")],
    "K": [("פורטוגל", "🇵🇹"), ("קונגו ד.ר.", "🇨🇩"), ("אוזבקיסטן", "🇺🇿"), ("קולומביה", "🇨🇴")],
    "L": [("אנגליה", "🏴󠁧󠁢󠁥󠁮󠁧󠁿"), ("קרואטיה", "🇭🇷"), ("פנמה", "🇵🇦"), ("גאנה", "🇬🇭")],
}

# Official FIFA 2026 group stage schedule — all times UTC (ET+4)
# Format: (home, away, group, datetime_utc)
GROUP_MATCHES = [
    # Group A
    ("מקסיקו",          "דרום אפריקה",        "A", datetime(2026, 6, 11, 19, 0, tzinfo=timezone.utc)),
    ("קוריאה הדרומית",  "צ'כיה",              "A", datetime(2026, 6, 12,  2, 0, tzinfo=timezone.utc)),
    ("צ'כיה",           "דרום אפריקה",        "A", datetime(2026, 6, 18, 16, 0, tzinfo=timezone.utc)),
    ("מקסיקו",          "קוריאה הדרומית",     "A", datetime(2026, 6, 19,  1, 0, tzinfo=timezone.utc)),
    ("מקסיקו",          "צ'כיה",              "A", datetime(2026, 6, 24, 16, 0, tzinfo=timezone.utc)),
    ("קוריאה הדרומית",  "דרום אפריקה",        "A", datetime(2026, 6, 24, 19, 0, tzinfo=timezone.utc)),
    # Group B
    ("קנדה",            "בוסניה והרצגובינה",  "B", datetime(2026, 6, 12, 19, 0, tzinfo=timezone.utc)),
    ("קטאר",            "שווייץ",             "B", datetime(2026, 6, 14,  1, 0, tzinfo=timezone.utc)),
    ("שווייץ",          "בוסניה והרצגובינה",  "B", datetime(2026, 6, 18, 19, 0, tzinfo=timezone.utc)),
    ("קנדה",            "קטאר",               "B", datetime(2026, 6, 18, 22, 0, tzinfo=timezone.utc)),
    ("קנדה",            "שווייץ",             "B", datetime(2026, 6, 24, 22, 0, tzinfo=timezone.utc)),
    ("בוסניה והרצגובינה", "קטאר",             "B", datetime(2026, 6, 25,  1, 0, tzinfo=timezone.utc)),
    # Group C
    ("ברזיל",           "מרוקו",              "C", datetime(2026, 6, 13, 16, 0, tzinfo=timezone.utc)),
    ("האיטי",           "סקוטלנד",            "C", datetime(2026, 6, 13, 19, 0, tzinfo=timezone.utc)),
    ("ברזיל",           "האיטי",              "C", datetime(2026, 6, 19, 16, 0, tzinfo=timezone.utc)),
    ("סקוטלנד",         "מרוקו",              "C", datetime(2026, 6, 19, 19, 0, tzinfo=timezone.utc)),
    ("סקוטלנד",         "ברזיל",              "C", datetime(2026, 6, 24, 16, 0, tzinfo=timezone.utc)),
    ("מרוקו",           "האיטי",              "C", datetime(2026, 6, 24, 19, 0, tzinfo=timezone.utc)),
    # Group D
    ("ארה\"ב",          "פרגוואי",            "D", datetime(2026, 6, 13,  1, 0, tzinfo=timezone.utc)),
    ("אוסטרליה",        "טורקיה",             "D", datetime(2026, 6, 13, 22, 0, tzinfo=timezone.utc)),
    ("טורקיה",          "פרגוואי",            "D", datetime(2026, 6, 19, 22, 0, tzinfo=timezone.utc)),
    ("ארה\"ב",          "אוסטרליה",           "D", datetime(2026, 6, 20,  1, 0, tzinfo=timezone.utc)),
    ("פרגוואי",         "אוסטרליה",           "D", datetime(2026, 6, 25, 19, 0, tzinfo=timezone.utc)),
    ("ארה\"ב",          "טורקיה",             "D", datetime(2026, 6, 26,  2, 0, tzinfo=timezone.utc)),
    # Group E
    ("גרמניה",          "קוראסאו",            "E", datetime(2026, 6, 14, 16, 0, tzinfo=timezone.utc)),
    ("חוף השנהב",       "אקוודור",            "E", datetime(2026, 6, 14, 19, 0, tzinfo=timezone.utc)),
    ("גרמניה",          "חוף השנהב",          "E", datetime(2026, 6, 20, 16, 0, tzinfo=timezone.utc)),
    ("אקוודור",         "קוראסאו",            "E", datetime(2026, 6, 20, 19, 0, tzinfo=timezone.utc)),
    ("אקוודור",         "גרמניה",             "E", datetime(2026, 6, 25, 16, 0, tzinfo=timezone.utc)),
    ("קוראסאו",         "חוף השנהב",          "E", datetime(2026, 6, 25, 19, 0, tzinfo=timezone.utc)),
    # Group F
    ("הולנד",           "יפן",                "F", datetime(2026, 6, 14, 22, 0, tzinfo=timezone.utc)),
    ("שוודיה",          "תוניסיה",            "F", datetime(2026, 6, 15,  1, 0, tzinfo=timezone.utc)),
    ("הולנד",           "שוודיה",             "F", datetime(2026, 6, 20, 22, 0, tzinfo=timezone.utc)),
    ("תוניסיה",         "יפן",                "F", datetime(2026, 6, 21,  1, 0, tzinfo=timezone.utc)),
    ("תוניסיה",         "הולנד",              "F", datetime(2026, 6, 25, 22, 0, tzinfo=timezone.utc)),
    ("יפן",             "שוודיה",             "F", datetime(2026, 6, 26,  1, 0, tzinfo=timezone.utc)),
    # Group G
    ("בלגיה",           "מצרים",              "G", datetime(2026, 6, 15, 22, 0, tzinfo=timezone.utc)),
    ("איראן",           "ניו זילנד",          "G", datetime(2026, 6, 16,  1, 0, tzinfo=timezone.utc)),
    ("בלגיה",           "איראן",              "G", datetime(2026, 6, 21, 22, 0, tzinfo=timezone.utc)),
    ("ניו זילנד",       "מצרים",              "G", datetime(2026, 6, 22,  1, 0, tzinfo=timezone.utc)),
    ("ניו זילנד",       "בלגיה",              "G", datetime(2026, 6, 26, 22, 0, tzinfo=timezone.utc)),
    ("מצרים",           "איראן",              "G", datetime(2026, 6, 27,  1, 0, tzinfo=timezone.utc)),
    # Group H
    ("ספרד",            "כף ורדה",            "H", datetime(2026, 6, 15, 16, 0, tzinfo=timezone.utc)),
    ("ערב הסעודית",     "אורוגוואי",          "H", datetime(2026, 6, 15, 19, 0, tzinfo=timezone.utc)),
    ("ספרד",            "ערב הסעודית",        "H", datetime(2026, 6, 21, 16, 0, tzinfo=timezone.utc)),
    ("אורוגוואי",       "כף ורדה",            "H", datetime(2026, 6, 21, 19, 0, tzinfo=timezone.utc)),
    ("אורוגוואי",       "ספרד",               "H", datetime(2026, 6, 26, 16, 0, tzinfo=timezone.utc)),
    ("כף ורדה",         "ערב הסעודית",        "H", datetime(2026, 6, 26, 19, 0, tzinfo=timezone.utc)),
    # Group I
    ("צרפת",            "סנגל",               "I", datetime(2026, 6, 16, 16, 0, tzinfo=timezone.utc)),
    ("עיראק",           "נורווגיה",           "I", datetime(2026, 6, 16, 19, 0, tzinfo=timezone.utc)),
    ("צרפת",            "עיראק",              "I", datetime(2026, 6, 22, 16, 0, tzinfo=timezone.utc)),
    ("נורווגיה",        "סנגל",               "I", datetime(2026, 6, 22, 19, 0, tzinfo=timezone.utc)),
    ("נורווגיה",        "צרפת",               "I", datetime(2026, 6, 26, 16, 0, tzinfo=timezone.utc)),
    ("סנגל",            "עיראק",              "I", datetime(2026, 6, 26, 19, 0, tzinfo=timezone.utc)),
    # Group J
    ("ארגנטינה",        "אלג'יריה",           "J", datetime(2026, 6, 16, 22, 0, tzinfo=timezone.utc)),
    ("אוסטריה",         "ירדן",               "J", datetime(2026, 6, 17,  1, 0, tzinfo=timezone.utc)),
    ("ארגנטינה",        "אוסטריה",            "J", datetime(2026, 6, 22, 22, 0, tzinfo=timezone.utc)),
    ("ירדן",            "אלג'יריה",           "J", datetime(2026, 6, 23,  1, 0, tzinfo=timezone.utc)),
    ("ירדן",            "ארגנטינה",           "J", datetime(2026, 6, 27, 22, 0, tzinfo=timezone.utc)),
    ("אלג'יריה",        "אוסטריה",            "J", datetime(2026, 6, 28,  1, 0, tzinfo=timezone.utc)),
    # Group K
    ("פורטוגל",         "קונגו ד.ר.",         "K", datetime(2026, 6, 17, 22, 0, tzinfo=timezone.utc)),
    ("אוזבקיסטן",       "קולומביה",           "K", datetime(2026, 6, 18,  1, 0, tzinfo=timezone.utc)),
    ("פורטוגל",         "אוזבקיסטן",         "K", datetime(2026, 6, 23, 22, 0, tzinfo=timezone.utc)),
    ("קולומביה",        "קונגו ד.ר.",         "K", datetime(2026, 6, 24,  1, 0, tzinfo=timezone.utc)),
    ("קולומביה",        "פורטוגל",            "K", datetime(2026, 6, 27, 16, 0, tzinfo=timezone.utc)),
    ("קונגו ד.ר.",      "אוזבקיסטן",         "K", datetime(2026, 6, 27, 19, 0, tzinfo=timezone.utc)),
    # Group L
    ("אנגליה",          "קרואטיה",            "L", datetime(2026, 6, 17, 16, 0, tzinfo=timezone.utc)),
    ("גאנה",            "פנמה",               "L", datetime(2026, 6, 17, 19, 0, tzinfo=timezone.utc)),
    ("אנגליה",          "גאנה",               "L", datetime(2026, 6, 23, 16, 0, tzinfo=timezone.utc)),
    ("פנמה",            "קרואטיה",            "L", datetime(2026, 6, 23, 19, 0, tzinfo=timezone.utc)),
    ("פנמה",            "אנגליה",             "L", datetime(2026, 6, 27, 16, 0, tzinfo=timezone.utc)),
    ("קרואטיה",         "גאנה",               "L", datetime(2026, 6, 27, 19, 0, tzinfo=timezone.utc)),
]

KNOCKOUT_STAGES = [
    ("round_of_32",  16, datetime(2026, 7,  1, 17, 0, tzinfo=timezone.utc), timedelta(hours=3)),
    ("round_of_16",   8, datetime(2026, 7,  5, 17, 0, tzinfo=timezone.utc), timedelta(hours=3)),
    ("quarter_final", 4, datetime(2026, 7, 11, 17, 0, tzinfo=timezone.utc), timedelta(hours=5)),
    ("semi_final",    2, datetime(2026, 7, 15, 17, 0, tzinfo=timezone.utc), timedelta(hours=24)),
    ("third_place",   1, datetime(2026, 7, 18, 17, 0, tzinfo=timezone.utc), timedelta(hours=0)),
    ("final",         1, datetime(2026, 7, 19, 19, 0, tzinfo=timezone.utc), timedelta(hours=0)),
]


def seed(db: Session):
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
    for home_name, away_name, group_name, scheduled_at in GROUP_MATCHES:
        match = models.Match(
            home_team_id=team_map[home_name].id,
            away_team_id=team_map[away_name].id,
            stage="group",
            group_name=group_name,
            match_number=match_number,
            scheduled_at=scheduled_at,
        )
        db.add(match)
        match_number += 1

    for stage, count, base_time, interval in KNOCKOUT_STAGES:
        for i in range(count):
            match = models.Match(
                home_team_id=None,
                away_team_id=None,
                stage=stage,
                group_name=None,
                match_number=match_number,
                scheduled_at=base_time + interval * i,
            )
            db.add(match)
            match_number += 1

    db.commit()
