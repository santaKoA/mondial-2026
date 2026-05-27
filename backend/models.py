from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from database import Base


class Team(Base):
    __tablename__ = "teams"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    flag = Column(String, nullable=False, default="🏳")
    group_name = Column(String, nullable=True)


class Match(Base):
    __tablename__ = "matches"
    id = Column(Integer, primary_key=True, index=True)
    home_team_id = Column(Integer, ForeignKey("teams.id"), nullable=True)
    away_team_id = Column(Integer, ForeignKey("teams.id"), nullable=True)
    stage = Column(String, nullable=False)
    group_name = Column(String, nullable=True)
    match_number = Column(Integer, nullable=False, unique=True)
    scheduled_at = Column(DateTime, nullable=False)
    home_score = Column(Integer, nullable=True)
    away_score = Column(Integer, nullable=True)
    status = Column(String, nullable=False, default="upcoming")

    home_team = relationship("Team", foreign_keys=[home_team_id])
    away_team = relationship("Team", foreign_keys=[away_team_id])


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    is_admin = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    predictions = relationship("Prediction", back_populates="user")
    special_predictions = relationship("SpecialPrediction", back_populates="user")


class Prediction(Base):
    __tablename__ = "predictions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    match_id = Column(Integer, ForeignKey("matches.id"), nullable=False)
    home_score = Column(Integer, nullable=False)
    away_score = Column(Integer, nullable=False)
    points = Column(Integer, nullable=True)
    submitted_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="predictions")
    match = relationship("Match")

    __table_args__ = (UniqueConstraint("user_id", "match_id"),)


class SpecialPrediction(Base):
    __tablename__ = "special_predictions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    prediction_type = Column(String, nullable=False)  # 'winner' or 'top_scorer'
    value = Column(String, nullable=False)
    points = Column(Integer, nullable=False, default=0)
    submitted_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="special_predictions")

    __table_args__ = (UniqueConstraint("user_id", "prediction_type"),)
