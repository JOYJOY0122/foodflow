"""AD-6：記憶體版 UnitOfWork，供 Service 單元測試使用。

與 SqlAlchemyUnitOfWork 跑同一份契約測試（tests/integration/test_uow_contract.py）：
正常結束 commit、例外時 rollback 並原樣丟出、巢狀使用丟 RuntimeError。

附掛 FakeStockLedger 時，交易結束（commit 或 rollback）都會釋放列鎖，與真實 Session 相同。

限制：rollback 只記次數並釋放鎖，不會撤銷已寫進 FakeStockLedger 的批次與異動。
測試失敗路徑時請斷言 `uow.rollbacks == 1`、`uow.commits == 0`，不要斷言 fake 資料已還原。

    ledger = FakeStockLedger()
    uow = FakeUnitOfWork(ledger)
    service = IssueService(uow=uow, ledger=ledger, ...)
"""

from collections.abc import Iterator
from contextlib import contextmanager

from app.core.uow import UnitOfWork
from tests.fakes.fake_stock_ledger import FakeStockLedger


class FakeUnitOfWork(UnitOfWork):
    def __init__(self, ledger: FakeStockLedger | None = None) -> None:
        self.ledger = ledger
        self.commits = 0
        self.rollbacks = 0
        self._active = False

    @property
    def active(self) -> bool:
        """是否在 transaction() 區塊內，可用來斷言某段程式在交易內執行。"""
        return self._active

    @contextmanager
    def transaction(self) -> Iterator[None]:
        if self._active:
            raise RuntimeError("UnitOfWork.transaction() 不可巢狀使用")
        self._active = True
        try:
            yield
        except BaseException:
            self.rollbacks += 1
            raise
        else:
            self.commits += 1
        finally:
            self._active = False
            if self.ledger is not None:
                self.ledger.end_transaction()
