"""測試環境設定。必須在任何 get_settings() 呼叫之前完成，所以放在 import app 之前。"""

import os

TEST_JWT_SECRET = "test-only-jwt-secret-with-at-least-32-bytes"

os.environ["APP_ENV"] = "test"
os.environ["JWT_SECRET"] = TEST_JWT_SECRET
os.environ.pop("APP_FIXED_NOW", None)
os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://unset@localhost:1/unset_test")

from app.core.config import Settings

# 所有經過 get_settings() 的程式（app、alembic、cli）都改連測試資料庫。
_test_database_url = Settings().test_database_url
if _test_database_url:
    os.environ["DATABASE_URL"] = _test_database_url
