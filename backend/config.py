from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    GROUP_CODE: str = "mondial2026"
    ADMIN_CODE: str = "admin2026"
    SECRET_KEY: str = "change-this-secret"
    DATABASE_URL: str = "sqlite:///./mondial.db"
    TOURNAMENT_START: str = "2026-06-11T19:00:00"  # 22:00 Israel time (UTC+3)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_DAYS: int = 90
    FOOTBALL_API_KEY: str = ""

    model_config = {"env_file": ".env"}


settings = Settings()
