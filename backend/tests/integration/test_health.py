from collections.abc import Iterator

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.db import create_db_engine, create_session_factory
from app.core.dependencies import get_session
from app.main import create_app


def test_health_ok_when_database_is_reachable() -> None:
    response = TestClient(create_app()).get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}


def test_health_degraded_without_leaking_details_when_database_is_down() -> None:
    # 連到沒有服務的 port；這個密碼與主機不可以出現在回應中。
    engine = create_db_engine(
        "postgresql+psycopg://secret_user:secret_password@127.0.0.1:1/nowhere", connect_timeout=1
    )

    def unreachable_session() -> Iterator[Session]:
        with create_session_factory(engine)() as session:
            yield session

    app = create_app()
    app.dependency_overrides[get_session] = unreachable_session

    response = TestClient(app).get("/health")

    assert response.status_code == 503
    assert response.json() == {"status": "degraded", "database": "unavailable"}
    engine.dispose()
