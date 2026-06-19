from pydantic import BaseModel, Field
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
    score_90_home: Optional[int] = None
    score_90_away: Optional[int] = None
    status: str
    my_prediction: Optional["PredictionOut"] = None

    model_config = {"from_attributes": True}


class PredictionIn(BaseModel):
    home_score: int = Field(ge=0, le=99)
    away_score: int = Field(ge=0, le=99)


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
    exact_count: int = 0
    direction_count: int = 0
    winner_pick: Optional[str] = None
    top_scorer_pick: Optional[str] = None
    created_at: Optional[datetime] = None
    group_names: list[str] = []

    model_config = {"from_attributes": True}


class JoinRequest(BaseModel):
    name: str
    code: str
    password: str


class RegisterIn(BaseModel):
    name: str
    password: str


class LoginIn(BaseModel):
    name: str
    password: str


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
    member_names: list[str] = []

    model_config = {"from_attributes": True}


class GroupCreateIn(BaseModel):
    name: str


class GroupCreatePublicIn(BaseModel):
    user_name: str
    group_name: str
    password: str


class GroupPredictionOut(BaseModel):
    user_name: str
    home_score: Optional[int]
    away_score: Optional[int]
    points: Optional[int]


class JoinGroupByCodeIn(BaseModel):
    code: str


class ChangePasswordIn(BaseModel):
    old_password: str
    new_password: str


class ResetPasswordIn(BaseModel):
    new_password: str


class TestMatchCreate(BaseModel):
    fixture_id: int
    stage: str = "group"
    api_season: int = 2026


class TestMatchOut(BaseModel):
    id: int
    match_number: int
    test_home_name: Optional[str]
    test_home_flag: Optional[str]
    test_away_name: Optional[str]
    test_away_flag: Optional[str]
    scheduled_at: datetime
    stage: str
    status: str
    home_score: Optional[int]
    away_score: Optional[int]
    api_fixture_id: Optional[int]
    api_league_id: Optional[int]
    api_season: Optional[int]

    model_config = {"from_attributes": True}
