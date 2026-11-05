"""AD-6：交易邊界。Service 以 `with self._uow.transaction():` 包住全部工作。"""

from abc import ABC, abstractmethod
from collections.abc import Iterator
from contextlib import AbstractContextManager, contextmanager

from sqlalchemy.orm import Session


class UnitOfWork(ABC):
    @abstractmethod
    def transaction(self) -> AbstractContextManager[None]:
        """區塊正常結束時 commit，發生例外時 rollback，巢狀使用時丟例外。"""


class SqlAlchemyUnitOfWork(UnitOfWork):
    def __init__(self, session: Session) -> None:
        self._session = session
        self._active = False

    @contextmanager
    def transaction(self) -> Iterator[None]:
        if self._active:
            raise RuntimeError("UnitOfWork.transaction() 不可巢狀使用")
        self._active = True
        try:
            yield
            self._session.commit()
        except BaseException:
            self._session.rollback()
            raise
        finally:
            self._active = False
