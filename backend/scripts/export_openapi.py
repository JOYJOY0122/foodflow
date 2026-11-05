"""不連資料庫輸出 app.openapi()（AD-16）。

用法：uv run python scripts/export_openapi.py <輸出路徑>；未指定路徑時輸出到 stdout。
前端以 `npm run gen:api` 呼叫。
"""

import json
import os
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

# 匯出不連線，也不簽發 token，所以不要求開發者先有 .env。
os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://unused@localhost/unused")
os.environ.setdefault("JWT_SECRET", "openapi-export-placeholder-not-a-real-secret")

from app.main import create_app  # noqa: E402


def main() -> None:
    schema = create_app().openapi()
    document = json.dumps(schema, ensure_ascii=False, indent=2) + "\n"
    if len(sys.argv) > 1:
        output = Path(sys.argv[1])
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(document, encoding="utf-8")
    else:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stdout.write(document)


if __name__ == "__main__":
    main()
