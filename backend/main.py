import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from database import Base, engine, SessionLocal
from routers import auth, matches, predictions, leaderboard, special_predictions, admin
from services import results_sync
from config import settings
import seed_data


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(results_sync.polling_loop())
    yield
    task.cancel()


app = FastAPI(title="Mundial 2026 Predictions", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(matches.router)
app.include_router(predictions.router)
app.include_router(leaderboard.router)
app.include_router(special_predictions.router)
app.include_router(admin.router)


@app.on_event("startup")  # noqa: deprecation — kept alongside lifespan for DB migration
def startup():
    Base.metadata.create_all(bind=engine)
    with engine.connect() as conn:
        # Simple column additions
        for ddl in [
            "ALTER TABLE league_groups ADD COLUMN owner_id INTEGER REFERENCES users(id)",
            "ALTER TABLE users ADD COLUMN password_hash TEXT",
        ]:
            try:
                conn.execute(text(ddl))
                conn.commit()
            except Exception:
                pass  # column already exists

        # Per-group user identity: recreate users table with (name, group_id) uniqueness
        cols = [r[1] for r in conn.execute(text("PRAGMA table_info(users)")).fetchall()]
        if 'group_id' not in cols:
            conn.execute(text("""
                CREATE TABLE users_new (
                    id INTEGER NOT NULL PRIMARY KEY,
                    name VARCHAR NOT NULL,
                    password_hash VARCHAR,
                    is_admin BOOLEAN NOT NULL DEFAULT 0,
                    group_id INTEGER REFERENCES league_groups(id),
                    created_at DATETIME,
                    UNIQUE (name, group_id)
                )
            """))
            conn.execute(text("""
                INSERT INTO users_new (id, name, password_hash, is_admin, group_id, created_at)
                SELECT u.id, u.name, u.password_hash, u.is_admin,
                    (SELECT ug.group_id FROM user_groups ug
                     WHERE ug.user_id = u.id ORDER BY ug.joined_at LIMIT 1),
                    u.created_at
                FROM users u
            """))
            conn.execute(text("DROP TABLE users"))
            conn.execute(text("ALTER TABLE users_new RENAME TO users"))
            conn.commit()
    db = SessionLocal()
    try:
        seed_data.seed(db)
        import models as _m
        # Migrate old data: Qatar in Group A (2022 seed) or old team names (קוריאה הדרומית / שוודיה / נורווגיה)
        needs_reseed = (
            db.query(_m.Team).filter_by(name="קטאר", group_name="A").first() or
            db.query(_m.Team).filter_by(name="קוריאה הדרומית").first() or
            db.query(_m.Team).filter_by(name="שוודיה").first() or
            db.query(_m.Team).filter_by(name="נורווגיה").first()
        )
        if needs_reseed:
            db.query(_m.SpecialPrediction).delete()
            db.query(_m.Prediction).delete()
            db.query(_m.Match).delete()
            db.query(_m.Team).delete()
            db.commit()
            seed_data.seed(db)
    finally:
        db.close()


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/config")
def config():
    return {"tournament_start": settings.TOURNAMENT_START}
