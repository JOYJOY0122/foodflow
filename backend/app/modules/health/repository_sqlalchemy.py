import logging

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.modules.health.repository import HealthRepository

logger = logging.getLogger(__name__)


class SqlAlchemyHealthRepository(HealthRepository):
    def __init__(self, session: Session) -> None:
        self._session = session

    def is_database_available(self) -> bool:
        try:
            self._session.execute(select(1))
        except SQLAlchemyError as exc:
            # 例外訊息可能含連線資訊，只記錄類型。
            logger.warning("資料庫健康檢查失敗：%s", type(exc).__name__)
            return False
        return True
