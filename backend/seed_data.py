from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from config import settings
import models

# Real FIFA World Cup 2026 groups (draw result December 2025)
GROUPS: dict[str, list[tuple[str, str]]] = {
    "A": [("מקסיקו", "🇲🇽"), ("דרום קוריאה", "🇰🇷"), ("צ'כיה", "🇨🇿"), ("דרום אפריקה", "🇿🇦")],
    "B": [("קנדה", "🇨🇦"), ("קטאר", "🇶🇦"), ("שווייץ", "🇨🇭"), ("בוסניה והרצגובינה", "🇧🇦")],
    "C": [("ברזיל", "🇧🇷"), ("האיטי", "🇭🇹"), ("סקוטלנד", "🏴󠁧󠁢󠁳󠁣󠁴󠁿"), ("מרוקו", "🇲🇦")],
    "D": [("ארה\"ב", "🇺🇸"), ("פראגוואי", "🇵🇾"), ("אוסטרליה", "🇦🇺"), ("טורקיה", "🇹🇷")],
    "E": [("גרמניה", "🇩🇪"), ("חוף השנהב", "🇨🇮"), ("אקוודור", "🇪🇨"), ("קוראסאו", "🇨🇼")],
    "F": [("הולנד", "🇳🇱"), ("יפן", "🇯🇵"), ("שבדיה", "🇸🇪"), ("טוניסיה", "🇹🇳")],
    "G": [("בלגיה", "🇧🇪"), ("מצרים", "🇪🇬"), ("איראן", "🇮🇷"), ("ניו זילנד", "🇳🇿")],
    "H": [("ספרד", "🇪🇸"), ("ערב הסעודית", "🇸🇦"), ("אורוגוואי", "🇺🇾"), ("כף ורדה", "🇨🇻")],
    "I": [("צרפת", "🇫🇷"), ("סנגל", "🇸🇳"), ("נורבגיה", "🇳🇴"), ("עיראק", "🇮🇶")],
    "J": [("ארגנטינה", "🇦🇷"), ("אלג'יריה", "🇩🇿"), ("אוסטריה", "🇦🇹"), ("ירדן", "🇯🇴")],
    "K": [("פורטוגל", "🇵🇹"), ("קונגו הדמוקרטית", "🇨🇩"), ("אוזבקיסטן", "🇺🇿"), ("קולומביה", "🇨🇴")],
    "L": [("אנגליה", "🏴󠁧󠁢󠁥󠁮󠁧󠁿"), ("קרואטיה", "🇭🇷"), ("פנמה", "🇵🇦"), ("גאנה", "🇬🇭")],
}

# Official FIFA 2026 group stage schedule — times in Israel (UTC+3 in summer) converted to UTC
# Format: (home, away, group, datetime_utc)
GROUP_MATCHES = [
    # --- Matchday 1 ---
    ("מקסיקו",             "דרום אפריקה",        "A", datetime(2026, 6, 11, 19,  0, tzinfo=timezone.utc)),  # 22:00 IL
    ("דרום קוריאה",        "צ'כיה",              "A", datetime(2026, 6, 12,  2,  0, tzinfo=timezone.utc)),  # 05:00 IL
    ("קנדה",               "בוסניה והרצגובינה",  "B", datetime(2026, 6, 12, 19,  0, tzinfo=timezone.utc)),  # 22:00 IL
    ("ארה\"ב",             "פראגוואי",           "D", datetime(2026, 6, 13,  1,  0, tzinfo=timezone.utc)),  # 04:00 IL
    ("קטאר",               "שווייץ",             "B", datetime(2026, 6, 13, 19,  0, tzinfo=timezone.utc)),  # 22:00 IL
    ("ברזיל",              "מרוקו",              "C", datetime(2026, 6, 13, 22,  0, tzinfo=timezone.utc)),  # 01:00 IL (+1d)
    ("האיטי",              "סקוטלנד",            "C", datetime(2026, 6, 14,  1,  0, tzinfo=timezone.utc)),  # 04:00 IL
    ("אוסטרליה",           "טורקיה",             "D", datetime(2026, 6, 14,  4,  0, tzinfo=timezone.utc)),  # 07:00 IL
    ("גרמניה",             "קוראסאו",            "E", datetime(2026, 6, 14, 17,  0, tzinfo=timezone.utc)),  # 20:00 IL
    ("הולנד",              "יפן",                "F", datetime(2026, 6, 14, 20,  0, tzinfo=timezone.utc)),  # 23:00 IL
    ("חוף השנהב",          "אקוודור",            "E", datetime(2026, 6, 14, 23,  0, tzinfo=timezone.utc)),  # 02:00 IL (+1d)
    ("שבדיה",              "טוניסיה",            "F", datetime(2026, 6, 15,  2,  0, tzinfo=timezone.utc)),  # 05:00 IL
    ("ספרד",               "כף ורדה",            "H", datetime(2026, 6, 15, 16,  0, tzinfo=timezone.utc)),  # 19:00 IL
    ("בלגיה",              "מצרים",              "G", datetime(2026, 6, 15, 19,  0, tzinfo=timezone.utc)),  # 22:00 IL
    ("ערב הסעודית",        "אורוגוואי",          "H", datetime(2026, 6, 15, 22,  0, tzinfo=timezone.utc)),  # 01:00 IL (+1d)
    ("איראן",              "ניו זילנד",          "G", datetime(2026, 6, 16,  1,  0, tzinfo=timezone.utc)),  # 04:00 IL
    ("צרפת",               "סנגל",               "I", datetime(2026, 6, 16, 19,  0, tzinfo=timezone.utc)),  # 22:00 IL
    ("עיראק",              "נורבגיה",            "I", datetime(2026, 6, 16, 22,  0, tzinfo=timezone.utc)),  # 01:00 IL (+1d)
    ("ארגנטינה",           "אלג'יריה",           "J", datetime(2026, 6, 17,  1,  0, tzinfo=timezone.utc)),  # 04:00 IL
    ("אוסטריה",            "ירדן",               "J", datetime(2026, 6, 17,  4,  0, tzinfo=timezone.utc)),  # 07:00 IL
    ("פורטוגל",            "קונגו הדמוקרטית",    "K", datetime(2026, 6, 17, 17,  0, tzinfo=timezone.utc)),  # 20:00 IL
    ("אנגליה",             "קרואטיה",            "L", datetime(2026, 6, 17, 20,  0, tzinfo=timezone.utc)),  # 23:00 IL
    ("גאנה",               "פנמה",               "L", datetime(2026, 6, 17, 23,  0, tzinfo=timezone.utc)),  # 02:00 IL (+1d)
    ("אוזבקיסטן",          "קולומביה",           "K", datetime(2026, 6, 18,  2,  0, tzinfo=timezone.utc)),  # 05:00 IL
    # --- Matchday 2 ---
    ("צ'כיה",              "דרום אפריקה",        "A", datetime(2026, 6, 18, 16,  0, tzinfo=timezone.utc)),  # 19:00 IL
    ("שווייץ",             "בוסניה והרצגובינה",  "B", datetime(2026, 6, 18, 19,  0, tzinfo=timezone.utc)),  # 22:00 IL
    ("קנדה",               "קטאר",               "B", datetime(2026, 6, 18, 22,  0, tzinfo=timezone.utc)),  # 01:00 IL (+1d)
    ("מקסיקו",             "דרום קוריאה",        "A", datetime(2026, 6, 19,  1,  0, tzinfo=timezone.utc)),  # 04:00 IL
    ("ארה\"ב",             "אוסטרליה",           "D", datetime(2026, 6, 19, 19,  0, tzinfo=timezone.utc)),  # 22:00 IL
    ("סקוטלנד",            "מרוקו",              "C", datetime(2026, 6, 19, 22,  0, tzinfo=timezone.utc)),  # 01:00 IL (+1d)
    ("ברזיל",              "האיטי",              "C", datetime(2026, 6, 20,  0, 30, tzinfo=timezone.utc)),  # 03:30 IL
    ("טורקיה",             "פראגוואי",           "D", datetime(2026, 6, 20,  3,  0, tzinfo=timezone.utc)),  # 06:00 IL
    ("הולנד",              "שבדיה",              "F", datetime(2026, 6, 20, 17,  0, tzinfo=timezone.utc)),  # 20:00 IL
    ("גרמניה",             "חוף השנהב",          "E", datetime(2026, 6, 20, 20,  0, tzinfo=timezone.utc)),  # 23:00 IL
    ("אקוודור",            "קוראסאו",            "E", datetime(2026, 6, 21,  0,  0, tzinfo=timezone.utc)),  # 03:00 IL
    ("טוניסיה",            "יפן",                "F", datetime(2026, 6, 21,  4,  0, tzinfo=timezone.utc)),  # 07:00 IL
    ("ספרד",               "ערב הסעודית",        "H", datetime(2026, 6, 21, 16,  0, tzinfo=timezone.utc)),  # 19:00 IL
    ("בלגיה",              "איראן",              "G", datetime(2026, 6, 21, 19,  0, tzinfo=timezone.utc)),  # 22:00 IL
    ("אורוגוואי",          "כף ורדה",            "H", datetime(2026, 6, 21, 22,  0, tzinfo=timezone.utc)),  # 01:00 IL (+1d)
    ("ניו זילנד",          "מצרים",              "G", datetime(2026, 6, 22,  1,  0, tzinfo=timezone.utc)),  # 04:00 IL
    ("ארגנטינה",           "אוסטריה",            "J", datetime(2026, 6, 22, 17,  0, tzinfo=timezone.utc)),  # 20:00 IL
    ("צרפת",               "עיראק",              "I", datetime(2026, 6, 22, 21,  0, tzinfo=timezone.utc)),  # 00:00 IL (+1d)
    ("נורבגיה",            "סנגל",               "I", datetime(2026, 6, 23,  0,  0, tzinfo=timezone.utc)),  # 03:00 IL
    ("ירדן",               "אלג'יריה",           "J", datetime(2026, 6, 23,  3,  0, tzinfo=timezone.utc)),  # 06:00 IL
    ("פורטוגל",            "אוזבקיסטן",          "K", datetime(2026, 6, 23, 17,  0, tzinfo=timezone.utc)),  # 20:00 IL
    ("אנגליה",             "גאנה",               "L", datetime(2026, 6, 23, 20,  0, tzinfo=timezone.utc)),  # 23:00 IL
    ("פנמה",               "קרואטיה",            "L", datetime(2026, 6, 23, 23,  0, tzinfo=timezone.utc)),  # 02:00 IL (+1d)
    ("קולומביה",           "קונגו הדמוקרטית",    "K", datetime(2026, 6, 24,  2,  0, tzinfo=timezone.utc)),  # 05:00 IL
    # --- Matchday 3 (simultaneous pairs) ---
    ("שווייץ",             "קנדה",               "B", datetime(2026, 6, 24, 19,  0, tzinfo=timezone.utc)),  # 22:00 IL
    ("בוסניה והרצגובינה",  "קטאר",               "B", datetime(2026, 6, 24, 19,  0, tzinfo=timezone.utc)),  # 22:00 IL
    ("סקוטלנד",            "ברזיל",              "C", datetime(2026, 6, 24, 22,  0, tzinfo=timezone.utc)),  # 01:00 IL (+1d)
    ("מרוקו",              "האיטי",              "C", datetime(2026, 6, 24, 22,  0, tzinfo=timezone.utc)),  # 01:00 IL (+1d)
    ("צ'כיה",              "מקסיקו",             "A", datetime(2026, 6, 25,  1,  0, tzinfo=timezone.utc)),  # 04:00 IL
    ("דרום אפריקה",        "דרום קוריאה",        "A", datetime(2026, 6, 25,  1,  0, tzinfo=timezone.utc)),  # 04:00 IL
    ("אקוודור",            "גרמניה",             "E", datetime(2026, 6, 25, 20,  0, tzinfo=timezone.utc)),  # 23:00 IL
    ("קוראסאו",            "חוף השנהב",          "E", datetime(2026, 6, 25, 20,  0, tzinfo=timezone.utc)),  # 23:00 IL
    ("יפן",                "שבדיה",              "F", datetime(2026, 6, 25, 23,  0, tzinfo=timezone.utc)),  # 02:00 IL (+1d)
    ("טוניסיה",            "הולנד",              "F", datetime(2026, 6, 25, 23,  0, tzinfo=timezone.utc)),  # 02:00 IL (+1d)
    ("טורקיה",             "ארה\"ב",             "D", datetime(2026, 6, 26,  2,  0, tzinfo=timezone.utc)),  # 05:00 IL
    ("פראגוואי",           "אוסטרליה",           "D", datetime(2026, 6, 26,  2,  0, tzinfo=timezone.utc)),  # 05:00 IL
    ("נורבגיה",            "צרפת",               "I", datetime(2026, 6, 26, 19,  0, tzinfo=timezone.utc)),  # 22:00 IL
    ("סנגל",               "עיראק",              "I", datetime(2026, 6, 26, 19,  0, tzinfo=timezone.utc)),  # 22:00 IL
    ("אורוגוואי",          "ספרד",               "H", datetime(2026, 6, 27,  0,  0, tzinfo=timezone.utc)),  # 03:00 IL
    ("כף ורדה",            "ערב הסעודית",        "H", datetime(2026, 6, 27,  0,  0, tzinfo=timezone.utc)),  # 03:00 IL
    ("ניו זילנד",          "בלגיה",              "G", datetime(2026, 6, 27,  3,  0, tzinfo=timezone.utc)),  # 06:00 IL
    ("מצרים",              "איראן",              "G", datetime(2026, 6, 27,  3,  0, tzinfo=timezone.utc)),  # 06:00 IL
    ("פנמה",               "אנגליה",             "L", datetime(2026, 6, 27, 21,  0, tzinfo=timezone.utc)),  # 00:00 IL (+1d)
    ("קרואטיה",            "גאנה",               "L", datetime(2026, 6, 27, 21,  0, tzinfo=timezone.utc)),  # 00:00 IL (+1d)
    ("קולומביה",           "פורטוגל",            "K", datetime(2026, 6, 27, 23, 30, tzinfo=timezone.utc)),  # 02:30 IL (+1d)
    ("קונגו הדמוקרטית",    "אוזבקיסטן",          "K", datetime(2026, 6, 27, 23, 30, tzinfo=timezone.utc)),  # 02:30 IL (+1d)
    ("ירדן",               "ארגנטינה",           "J", datetime(2026, 6, 28,  2,  0, tzinfo=timezone.utc)),  # 05:00 IL
    ("אלג'יריה",           "אוסטריה",            "J", datetime(2026, 6, 28,  2,  0, tzinfo=timezone.utc)),  # 05:00 IL
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
