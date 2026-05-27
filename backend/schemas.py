from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class TeamOut(BaseModel):
    id: int
    name: str
    flag: str
    group_name: Optional[str]

    model_config = {"from_attributes": True}


class MatchOut(BaseModel):
    id: int
    match_number: int
    stage: str
    group_name: Optional[str]
    scheduled_at: datetime
    home_team: Optional[TeamOut]
    away_team: Optional[TeamOut]
    home_score: Optional[int]
    away_score: Optional[int]
    status: str
    my_prediction: Optional["PredictionOut"] = None

    model_config = {"from_attributes": True}


class PredictionIn(BaseModel):
    home_score: int
    away_score: int


class PredictionOut(BaseModel):
    id: int
    match_id: int
    home_score: int
    away_score: int
    points: Optional[int]
    submitted_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UserOut(BaseModel):
    id: int
    name: str
    is_admin: bool
    total_points: int = 0
    prediction_count: int = 0

    model_config = {"from_attributes": True}


class JoinRequest(BaseModel):
    name: str
    code: str


class TokenResponse(BaseModel):
    token: str
    user: UserOut
    group: Optional["GroupOut"] = None


class SpecialPredictionIn(BaseModel):
    prediction_type: str  # 'winner' or 'top_scorer'
    value: str


class SpecialPredictionOut(BaseModel):
    id: int
    prediction_type: str
    value: str
    points: int
    submitted_at: datetime

    model_config = {"from_attributes": True}


class MatchResultIn(BaseModel):
    home_score: int
    away_score: int


class SpecialResultIn(BaseModel):
    prediction_type: str
    correct_value: str
    points_awarded: int


class GroupOut(BaseModel):
    id: int
    name: str
    code: str
    member_count: int = 0
    owner_id: Optional[int] = None

    model_config = {"from_attributes": True}


class GroupCreateIn(BaseModel):
    name: str


class GroupCreatePublicIn(BaseModel):
    user_name: str
    group_name: str
