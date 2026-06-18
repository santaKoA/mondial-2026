STAGE_POINTS = {
    "group": {"exact": 3, "direction": 1},
    "round_of_32": {"exact": 5, "direction": 3},
    "round_of_16": {"exact": 5, "direction": 3},
    "quarter_final": {"exact": 6, "direction": 4},
    "semi_final": {"exact": 10, "direction": 5},
    "third_place": {"exact": 10, "direction": 5},
    "final": {"exact": 15, "direction": 8},
}


def get_direction(home: int, away: int) -> str:
    if home > away:
        return "home"
    if away > home:
        return "away"
    return "draw"


def calculate_points(stage: str, actual_home: int, actual_away: int, pred_home: int, pred_away: int) -> int:
    pts = STAGE_POINTS.get(stage, STAGE_POINTS["group"])

    if actual_home == pred_home and actual_away == pred_away:
        return pts["exact"]

    if get_direction(actual_home, actual_away) == get_direction(pred_home, pred_away):
        return pts["direction"]

    return 0
