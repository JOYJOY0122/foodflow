from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_session
from app.modules.health.repository_sqlalchemy import SqlAlchemyHealthRepository
from app.modules.health.service import HealthService


def build_health_service(session: Session) -> HealthService:
    return HealthService(SqlAlchemyHealthRepository(session))


def get_health_service(session: Session = Depends(get_session)) -> HealthService:
    return build_health_service(session)
