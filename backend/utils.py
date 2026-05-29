from datetime import datetime, timezone
from config import settings


def tournament_started() -> bool:
    """Returns True if the tournament has already started (first match kick-off)."""
    start = datetime.fromisoformat(settings.TOURNAMENT_START).replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc) >= start
