"""One-time migration: clears teams/matches/predictions and reseeds with real 2026 data."""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from database import SessionLocal
import models
import seed_data

def run():
    db = SessionLocal()
    try:
        print("Deleting special predictions...")
        db.query(models.SpecialPrediction).delete()
        print("Deleting predictions...")
        db.query(models.Prediction).delete()
        print("Deleting matches...")
        db.query(models.Match).delete()
        print("Deleting teams...")
        db.query(models.Team).delete()
        db.commit()

        print("Reseeding with FIFA 2026 data...")
        seed_data.seed(db)
        print("Done.")

        db.close()
        db2 = SessionLocal()
        teams = db2.query(models.Team).count()
        matches = db2.query(models.Match).count()
        users = db2.query(models.User).count()
        print(f"Teams: {teams}, Matches: {matches}, Users (kept): {users}")
        db2.close()
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
        raise

if __name__ == "__main__":
    run()
