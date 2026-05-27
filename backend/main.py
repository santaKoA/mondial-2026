from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import Base, engine, SessionLocal
from routers import auth, matches, predictions, leaderboard, special_predictions, admin
import seed_data

app = FastAPI(title="Mundial 2026 Predictions")

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


@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_data.seed(db)
    finally:
        db.close()


@app.get("/api/health")
def health():
    return {"status": "ok"}
