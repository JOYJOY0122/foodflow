# 技術查證審查：ARCHITECTURE-SPINE.md

- **審查對象：** `ARCHITECTURE-SPINE.md` 的 Stack 與技術性主張
- **審查日期：** 2026-11-05
- **審查方式：** 查 PyPI JSON、npm registry、官方文件，並在隔離環境以主幹列出的確切版本安裝、實測
- **未讀文件：** `prds/`、`use-cases/`（依指示）；主幹未修改

## 判定

**版本選型可用，但主幹需修正後才適合定稿。** Stack 列出的版本全部存在，彼此相容，沒有需要換版本的項目。問題集中在三處：安裝規格不完整、幾條規則照字面實作會出錯、部分規則無法被宣稱的工具檢查到。

| 嚴重度 | 數量 | 編號 |
| --- | --- | --- |
| 高 | 3 | T1、T2、T3 |
| 中 | 8 | T4～T11 |
| 低 | 9 | T12～T20 |

嚴重度定義：

- **高：** 不修就無法啟動，或會產生資料錯誤、違反主幹自身規則。
- **中：** 開發或 demo 時一定會遇到，或宣稱的保護實際無效。
- **低：** 有明確修法，影響範圍小，或只在特定條件下發生。

## 查證範圍與限制

下列項目**沒有實際執行**，結論僅來自 metadata、文件或原始碼，定稿前請在骨架階段跑一次：

| 未執行項目 | 原因 | 替代查證方式 |
| --- | --- | --- |
| 真實 PostgreSQL 上的列鎖、`pg_dump`、`pg_restore`、`postgres:17-alpine` 容器 | 本機 Docker daemon 未啟動；我不去啟動使用者環境。改用下載的可攜式 Postgres 時，執行外部二進位檔的動作被權限系統拒絕，因此未再嘗試其他繞法 | ORM 行為以 SQLAlchemy 2.1.8 搭配內建 SQLite 實測；SQL 以 Postgres 方言編譯；其餘查 PG 17 官方文件與原始碼；映像以 Docker Hub API 確認 |
| Node 24 上的 `vite build`、`vitest run` | 同屬執行下載二進位檔，所以 Node 24 zip 下載後未執行 | 查 `engines`、`peerDependencies`。`tsc`、ESLint、`openapi-typescript` 在本機 Node 20.17 實跑，其中 ESLint 10 的 `engines` 要求 ≥ 20.19，結果可參考但不是受支援組合 |

標記說明：**[實測]** 為實際執行重現；**[文件]** 為官方文件或 registry；**[編譯]** 為只產生 SQL、未送進資料庫。

## 高嚴重度

### T1 — `psycopg` 未指定 extras，Windows 上無法載入 [實測]

- **嚴重度：** 高
- **位置：** Stack 表 `psycopg 3.3.8`
- **來源：** https://www.psycopg.org/psycopg3/docs/basic/install.html 、 https://pypi.org/pypi/psycopg/3.3.8/json
- **問題：** 純 `psycopg` 需要系統已有 libpq。Python 3.13、Windows 上實測結果：

  ```text
  ImportError: no pq wrapper available.
  - couldn't import psycopg 'c' implementation: No module named 'psycopg_c'
  - couldn't import psycopg 'binary' implementation: No module named 'psycopg_binary'
  - couldn't import psycopg 'python' implementation: libpq library not found
  ```

- **修法：** Stack 改為 `psycopg[binary] 3.3.8`。`psycopg_binary-3.3.8-cp313-cp313-win_amd64.whl` 存在，安裝後可正常載入。

### T2 — AD-7 的 `FOR UPDATE` 取得鎖後，ORM 仍可能讀到舊值 [實測，ORM 層]

- **嚴重度：** 高（直接違反 AD-7 與 NFR-02，可能超領）
- **位置：** AD-3、AD-6、AD-7、AD-8
- **來源：** https://docs.sqlalchemy.org/en/21/orm/queryguide/api.html （Populate Existing）
- **問題：** AD-7 要求所有檢查都在取得鎖之後進行，也明確預期「鎖定前可能有讀取」。但只要同一個 Session 已載入過該批次，`select(...).with_for_update()` 雖然會鎖列，SQLAlchemy 預設**不會**把新資料寫回 identity map 內的物件。官方文件說明預設是 "the row is not applied to the object"。AD-6 規定請求共用 Session，因此這個情況確實會發生。實測（資料庫的實際值為 3）：

  ```text
  select + with_for_update，無 populate_existing -> ORM 看到 10.000（同一物件），DB 實際 3
  加上 populate_existing=True                    -> ORM 看到最新值
  session.get(Batch, 1, with_for_update=True)    -> ORM 看到最新值
  ```

  結果是餘量檢查用舊值通過，`remaining_quantity` 再被寫成錯誤值。SQLite 會忽略 `FOR UPDATE`，但此處驗證的是 identity map 行為，與資料庫無關。併發情境仍須依主幹在真實 PostgreSQL 上補整合測試。
- **修法：** 在 AD-7 增加一條規則，並由 Repository 提供單一入口：

  ```python
  select(InventoryBatch).where(...).order_by(InventoryBatch.id)
      .with_for_update().execution_options(populate_existing=True)
  ```

  `populate_existing` 會覆蓋未 flush 的變更，因此不可關閉 Session 的 autoflush。整合測試要涵蓋「先讀後鎖」的路徑。

### T3 — 只用 `Decimal` 型別達不到 AD-9 的 API 契約 [實測]

- **嚴重度：** 高（AD-9 的多項宣稱不成立，且會寫入產生的前端型別）
- **位置：** AD-9、AD-16
- **來源：** https://docs.pydantic.dev/latest/concepts/conversion_table/ ，實測版本 pydantic 2.14.2、fastapi 0.162.0
- **已確認正確：** Pydantic v2 JSON 模式確實把 `Decimal` 序列化成字串；`response_model` 路徑也輸出字串。
- **問題：** 以 `Annotated[Decimal, Field(max_digits=12, decimal_places=3)]` 實作時：

  | 輸入或情境 | 實際結果 | 違反 |
  | --- | --- | --- |
  | JSON 數字 `12.5` | 接受，回 `"12.5"` | 「API 以字串傳輸」 |
  | `"1.2340"`（四位小數） | 接受 | 「超過三位小數回 422」 |
  | `"1e2"` | 接受，回 `"1E+2"` | 格式 |
  | `" 1.5 "`、`"1_000"` | 接受 | 格式 |
  | 新增後未重讀的 `Decimal("12.5")` | flush、commit 後仍是 `12.5`，回 `"12.5"`（`expire_on_commit=False`） | 範例 `"12.500"` |

  另外，產生的 `schema.d.ts` 中，請求欄位型別是 `q: number | string`，回應才是 `string`，前端因此可以合法送出數字。
- **修法：** 在 `core/types.py` 定義嚴格型別。以下形態已實測，上述輸入全部回 422，`"12.5"` 輸出 `"12.500"`，請求與回應的 OpenAPI 都只有 `string`。實作時請補上允許負值的 `quantity_delta` 版本，以及 `Money` 版本：

  ```python
  _RE = re.compile(r"^\d{1,9}(\.\d{1,3})?$")
  def _parse(v):
      if isinstance(v, Decimal): return v
      if isinstance(v, str) and _RE.fullmatch(v): return Decimal(v)
      raise ValueError("數量須為字串，最多三位小數")
  Quantity = Annotated[Decimal, BeforeValidator(_parse),
      PlainSerializer(lambda v: f"{v:.3f}", return_type=str, when_used="json"),
      WithJsonSchema({"type": "string", "pattern": _RE.pattern})]
  ```

## 中嚴重度

### T4 — AD-16 的錯誤處理器碰到 `Decimal` 會 500 或變成浮點數 [實測]

- **嚴重度：** 中
- **位置：** AD-7（`details` 帶最新可用量）、AD-9、AD-16
- **來源：** https://fastapi.tiangolo.com/tutorial/encoder/ ，實測 fastapi 0.162.0
- **問題：** AD-9 的字串保證只涵蓋經 `response_model` 的路徑。錯誤回應有兩條路徑會出事：
  - `JSONResponse({"available": Decimal("1.5")})` 丟 `TypeError: Object of type Decimal is not JSON serializable`。
  - 改用 `jsonable_encoder` 則得到 `{'a': 12.5}`，變成浮點數，違反 AD-9。
  - 422 處理器若直接傳 `exc.errors()`，帶 `ge=0` 的欄位收到 `"-1"` 時，`ctx` 含 `Decimal`，實測變成 500。
- **修法：** AD-16 規定 `DomainError.details` 中的 Decimal 一律先轉字串，例如 `jsonable_encoder(details, custom_encoder={Decimal: lambda v: f"{v:.3f}"})`（已實測，得 `'2.500'`）。422 處理器只取 `loc` 與 `msg` 組成 `fields`，不要傳整個 `errors()`。

### T5 — Stack 表漏列實作必需的前端套件 [實測＋文件]

- **嚴重度：** 中
- **位置：** Stack 表；AD-8 明文要求使用 `uuid`，表中卻沒有
- **來源：** https://mantine.dev/guides/vite/ 、 https://registry.npmjs.org/@mantine/core 、 https://registry.npmjs.org/@vitejs/plugin-react 、 https://registry.npmjs.org/@types/react
- **問題：** 只安裝表列套件時，npm 會自動帶入 `react-dom`、`@mantine/hooks` 這兩個 peer，但版本沒有被直接鎖定，也不會安裝下表其他套件。

  | 套件 | 版本 | 需要的原因 |
  | --- | --- | --- |
  | `react-dom` | 19.3.1 | `createRoot`；Mantine 必要 peer。其 peer 為 `react ^19.3.1`，兩者應同版 |
  | `@mantine/hooks` | 9.7.5 | `@mantine/core` 的 peer 為**精確** 9.7.5 |
  | `@vitejs/plugin-react` | 6.2.1 | Vite 的 React 外掛，peer 為 `vite ^8.0.0` |
  | `uuid` | 14.0.3 | AD-8。自帶型別，不要裝已棄用的 `@types/uuid` |
  | `@types/react`、`@types/react-dom` | 19.3.0 | `tsc`（主幹的 CI 項目）需要 |
  | `postcss`、`postcss-preset-mantine`、`postcss-simple-vars` | 8.5.32、1.18.0、7.0.1 | Mantine 官方 Vite 指南的安裝步驟，需另建 `postcss.config.cjs` |
  | `typescript-eslint`、`@eslint/js` | 8.72.1、10.0.1 | AD-17 的 ESLint 要檢查 TypeScript 就需要 parser |

  依功能才需要：
  - 使用 Mantine 日期元件時，加 `@mantine/dates` 9.7.5 與其必要 peer `dayjs`（1.11.23）。到期日欄位很可能用到，建議現在就決定。
  - 寫前端元件測試時，加 `jsdom` 或 `happy-dom`。它們是 Vitest 的選用 peer。
- **修法：** 把上表併入 Stack 表。全部套件一起安裝時，registry 解析沒有 peer 衝突（實測）。

### T6 — `no-restricted-imports` 擋不到 `fetch` [實測]

- **嚴重度：** 中（AD-17 宣稱的保護對 `fetch` 無效）
- **位置：** AD-17
- **來源：** https://eslint.org/docs/latest/rules/no-restricted-imports 、 https://eslint.org/docs/latest/rules/no-restricted-globals
- **問題：** `fetch` 是全域函式，不是 import。元件內寫 `fetch("/x")`，只開 `no-restricted-imports` 時 ESLint 結束碼為 0。
- **修法：** 對 `components/`、`pages/`、`hooks.ts`、`api.ts` 加上 `no-restricted-globals: ["error", "fetch"]`（實測可抓到），僅 `shared/api/client.ts` 例外。`window.fetch(...)` 此規則抓不到，實測未回報，需另加 `no-restricted-properties` 或 `no-restricted-syntax`。

### T7 — 主幹沒有強制 Node 版本，本機目前就不符合 [實測]

- **嚴重度：** 中
- **位置：** Stack 註記「全組需使用 Node 24」
- **來源：** https://registry.npmjs.org/vite 、 https://registry.npmjs.org/vitest 、 https://registry.npmjs.org/react-router 、 https://registry.npmjs.org/@rolldown/binding-win32-x64-msvc
- **問題：** 主幹的版本要求正確，但只寫在文字裡。本機實際是 Node 20.17.0、Python 3.11.9。npm 對 `engines` 不符只發出 `EBADENGINE` 警告，安裝照樣成功，之後才以誤導的訊息失敗：

  ```text
  vite build -> Error: Cannot find native binding. npm has a bug related to optional dependencies...
  ```

  實際原因不是訊息所指的 npm bug：`@rolldown/binding-win32-x64-msvc` 要求 Node `^20.19.0 || >=22.12.0`，在 20.17 上被略過，`node_modules/@rolldown/` 內沒有該 binding。組員很容易照訊息反覆重裝。
- **修法：** repo 根目錄加入 `.nvmrc`（內容 `24`）；`frontend/package.json` 加 `engines`，再搭配 `.npmrc` 的 `engine-strict=true`；`backend/` 加 `.python-version`（`3.13`）與 `requires-python`。Windows 組員切換 Node 版本需要 nvm-windows 或 fnm，CONTRIBUTING 應註明。

### T8 — 主幹未規定同步端點，`async def` 會阻塞整個服務 [文件]

- **嚴重度：** 中
- **位置：** AD-6、AD-7、AD-15
- **來源：** https://fastapi.tiangolo.com/async/
- **問題：** AD-6 的 `with self._uow.transaction():` 代表整條鏈是同步 Session，但主幹沒有明文。官方文件說明 `def` 端點在外部 threadpool 執行，而同步 I/O 寫在 `async def` 內會阻塞伺服器。本系統的列鎖可能等待，一旦有人寫 `async def`，等鎖期間整個 event loop 都會停住，併發測試的結果也會失真。
- **已確認正確：** `def` 端點與依賴、`Depends` 同請求快取同一實例、`dependency_overrides` 可替換巢狀依賴，實測皆成立。C5 的做法可行。
- **修法：** 在 AD-6 增加一句：「路由與依賴一律用 `def`，不使用 `async def`，也不使用 async 版 SQLAlchemy。」可在 CI 以 `grep` 檢查 `app/modules` 內沒有 `async def`，或在 code review 檢查。

### T9 — demo 模式的同源機制沒有定義，平板也連不上預設的 dev server [文件]

- **嚴重度：** 中
- **位置：** AD-15、Structural Seed「環境」段
- **來源：** https://vite.dev/config/server-options 、 https://vite.dev/config/preview-options
- **問題：**
  - AD-15 只定義開發環境由 Vite proxy 維持同源。主幹又允許以「建置後的靜態檔」執行，但沒有說由誰提供靜態檔、誰轉送 `/api`。主幹不開 CORS，直接分開跑會讓 API 請求全部失敗。
  - `server.host` 預設為 `localhost`，AD-8 提到的平板無法連線。IP 位址則預設在 `allowedHosts` 內，沒有問題。
  - 若由 FastAPI 提供靜態檔，React Router 的深層路徑重新整理需要 fallback 回 `index.html`。
- **修法：** 明定 demo 方式，二選一：
  - `vite preview --host`：`preview.proxy` 預設沿用 `server.proxy`，設定最少。
  - FastAPI 掛載 `dist/` 並加 SPA fallback。

  另外在 Vite 設定寫 `server.host: true`。

### T10 — `foodflow_test` 不會自動建立 [文件]

- **嚴重度：** 中
- **位置：** Structural Seed「測試使用同一容器的 `foodflow_test` 資料庫」、Consistency Conventions「測試」
- **來源：** https://hub.docker.com/_/postgres
- **問題：** `POSTGRES_DB` 只建立一個預設資料庫。`/docker-entrypoint-initdb.d` 內的腳本只在資料目錄為空時執行，因此已經有 volume 的組員加入腳本後也不會生效。主幹沒有說明建立方式。
- **修法：** 掛載 `.sql` 初始化腳本建立 `foodflow_test`，並在 CONTRIBUTING 註明既有環境要 `docker compose down -v` 或手動 `CREATE DATABASE`。使用 `.sql` 可避開 Windows 上 `.sh` 的 CRLF 問題。

### T11 — 產生的前端型別與 AD-16 的錯誤格式不符 [實測]

- **嚴重度：** 中
- **位置：** AD-16
- **來源：** https://fastapi.tiangolo.com/advanced/additional-responses/ ，實測 fastapi 0.162.0＋openapi-typescript 7.13.0
- **問題：** AD-16 把 422 改成統一格式，並規定型別不可手寫。但 FastAPI 預設的 OpenAPI 仍宣告 `HTTPValidationError`，`schema.d.ts` 因此描述了實際不會出現的回應，也沒有 `DomainError` 的格式。前端若依產生的型別處理錯誤，會寫錯。
- **修法：** 定義 `ErrorResponse` schema，在 `APIRouter(responses={422: {"model": ErrorResponse}, 409: ...})` 宣告。實測後 OpenAPI 的 422 指向新 schema，`HTTPValidationError` 從 components 消失。

## 低嚴重度

### T12 — `httpx` 已被 Starlette TestClient 棄用，應改 `httpx2` [實測]

- **嚴重度：** 低
- **來源：** https://pypi.org/pypi/httpx2/json ；`starlette` 1.10.0 的 `testclient.py`（`fastapi` 0.162.0 解析出的版本）
- **問題：** `httpx` 0.28.1 目前可用，但會出現 `StarletteDeprecationWarning: Using httpx with starlette.testclient is deprecated`。pytest 開 `-W error` 時在 collection 階段就失敗。
- **修法：** Stack 改列 `httpx2 2.16.0`。實測安裝後 `-W error` 通過。

### T13 — `pwdlib` 必須明確寫 extras [實測]

- **嚴重度：** 低（錯誤訊息清楚，容易修）
- **來源：** https://pypi.org/pypi/pwdlib/0.3.1/json
- **問題：** Stack 表寫「pwdlib（argon2）」不是可安裝的規格。只裝 `pwdlib` 時，`PasswordHash.recommended()` 丟 `HasherNotAvailable`。
- **修法：** 改寫成 `pwdlib[argon2]`。實測 `PasswordHash.recommended()` 與 `PasswordHash((Argon2Hasher(),))` 都可正常雜湊與驗證，輸出為 argon2id。

### T14 — `id BIGINT IDENTITY` 需要明確宣告 `Identity()` [編譯]

- **嚴重度：** 低
- **位置：** AD-19
- **來源：** https://docs.sqlalchemy.org/en/21/dialects/postgresql.html
- **問題：** 依一般寫法產生的 DDL 與主幹不符：

  ```text
  mapped_column(primary_key=True)                        -> id SERIAL
  mapped_column(BigInteger, primary_key=True)            -> id BIGSERIAL
  mapped_column(BigInteger, Identity(), primary_key=True) -> id BIGINT GENERATED BY DEFAULT AS IDENTITY
  ```

- **修法：** 在 `app/db/` 提供共用的主鍵型別或 mixin。若要禁止手動寫入 id，使用 `Identity(always=True)`。

### T15 — `lazy="raise"` 沒有全域預設，且 `joinedload` 不能直接搭配鎖 [實測＋編譯＋原始碼]

- **嚴重度：** 低
- **位置：** AD-3、AD-7
- **來源：** https://docs.sqlalchemy.org/en/21/orm/queryguide/relationships.html 、 https://github.com/postgres/postgres/blob/REL_17_STABLE/src/backend/optimizer/plan/initsplan.c
- **已確認正確：** `lazy="raise"` 存在，存取未載入的關聯丟 `InvalidRequestError`。
- **問題：**
  - AD-3 寫「relationship 預設 `lazy="raise"`」，但文件未提供全域設定，`relationship.lazy` 的預設值是 `"select"`，漏寫就會靜默延遲載入。
  - 可為空的外鍵加 `joinedload` 再 `with_for_update()`，會編譯成 `LEFT OUTER JOIN ... FOR UPDATE`。PG 原始碼中對應的錯誤是 `FOR UPDATE cannot be applied to the nullable side of an outer join`。此錯誤未在真實 PG 上執行。
- **修法：** 加一個測試走訪所有 mapper，檢查每個 relationship 的 `lazy` 都是 `raise`。鎖定查詢改用 `selectinload`，或寫 `with_for_update(of=Model)`。

### T16 — `pg_restore` 只能讀封存格式；腳本要注意版本與 TTY [文件]

- **嚴重度：** 低
- **位置：** Structural Seed「備份與還原」、NFR-06
- **來源：** https://www.postgresql.org/docs/17/app-pgdump.html 、 https://www.postgresql.org/docs/17/app-pgrestore.html 、 https://docs.docker.com/reference/cli/docker/compose/exec/
- **已確認正確：** `pg_dump`、`pg_restore` 的組合可行。
- **問題：** `pg_restore` 不接受純 SQL 傾印；`pg_dump` 無法傾印比自身主版本新的伺服器；`docker compose exec` 預設配置 TTY，不適合把二進位資料經 stdout 導出。
- **修法：** 腳本在容器內執行 `pg_dump -Fc -f /tmp/foodflow.dump`，再用 `docker compose cp` 取出，這樣同時避開 TTY 與主機版本問題。還原用 `pg_restore --clean --if-exists --no-owner`。`.gitattributes` 設 `*.sh text eol=lf`。此腳本流程未實跑，需在 T10 的環境驗證。

### T17 — JWT 的 `sub` 必須是字串 [實測]

- **嚴重度：** 低
- **位置：** AD-15「內含 `employee.id`」
- **來源：** https://pypi.org/project/PyJWT/2.15.1/ ，實測 PyJWT 2.15.1
- **問題：** 把整數 id 放進 `sub`，編碼成功，解碼時丟 `InvalidSubjectError: Subject must be a string`，表現為每個請求都 401。另外金鑰短於 32 bytes 時會出現長度不足的警告。
- **修法：** AD-15 寫明 `sub=str(employee.id)`；`.env.example` 註明 JWT 金鑰至少 32 bytes。

### T18 — TS 版本的理由不完整；React Router 舊套件名會靜默裝錯 [實測＋文件]

- **嚴重度：** 低
- **來源：** https://registry.npmjs.org/typescript-eslint 、 https://registry.npmjs.org/openapi-typescript 、 https://reactrouter.com/upgrading/v7 、 https://registry.npmjs.org/react-router-dom
- **問題：**
  - 主幹只說 `openapi-typescript` 限制了 TS。`typescript-eslint` 8.72.1 的 peer 也是 `>=4.8.4 <6.1.0`，因此即使換掉 openapi-typescript 也不能上 TS 7。npm 上 `typescript` 的 latest 是 7.0.2，沒指定版本就會裝到它，實測 `ERESOLVE`。
  - v8 已移除 `react-router-dom`。npm 上它的 latest 仍是 7.18.5，並依賴 `react-router` 7.18.5。在已裝 v8 的專案加裝時，dry-run 沒有報衝突，可能並存兩個主版本。
- **修法：** Stack 註記補上 `typescript-eslint`。AD-17 補一句：「只用 `react-router`，不安裝 `react-router-dom`。」

### T19 — 時區資料只靠間接相依；應鎖定完整相依樹 [文件]

- **嚴重度：** 低
- **位置：** AD-10、C4
- **來源：** https://docs.python.org/3/library/zoneinfo.html 、 https://pypi.org/pypi/psycopg/3.3.8/json 、 https://pypi.org/pypi/fastapi/0.162.0/json
- **問題：**
  - Windows 沒有 IANA 時區資料，缺 `tzdata` 時 `ZoneInfo("Asia/Taipei")` 會丟 `ZoneInfoNotFoundError`。目前能運作，只因 `psycopg` 在 win32 間接帶入 `tzdata`；C4 換驅動就可能消失。
  - FastAPI 只宣告 `starlette>=0.46.0`，沒有上限，主幹也沒有提到鎖定檔。
- **修法：** `pyproject.toml` 直接宣告 `tzdata`。提交 `uv.lock` 與 `package-lock.json`，CI 使用 `uv sync --locked` 與 `npm ci`。

### T20 — 其他小項 [實測]

- **嚴重度：** 低
- **來源：** https://registry.npmjs.org/eslint-plugin-react ；`npm audit`
- **問題與修法：**
  - **CI 清單缺項：** Deferred 的 CI 清單沒有 ESLint，但 AD-17 依賴 ESLint。請補上。
  - **`tsconfig` 的 `lib`：** `skipLibCheck: false` 搭配 `lib: ES2022` 時，`@mantine/hooks` 的型別檔報 `TS2552: Cannot find name 'ReadonlySetLike'`。使用 `skipLibCheck: true` 或 `lib` 含 `ESNext`。
  - **`eslint-plugin-react`：** 7.37.5 的 peer 只到 ESLint `^9.7`，不支援 ESLint 10，不要加入。`eslint-plugin-react-hooks` 7.1.1 與 `eslint-plugin-react-refresh` 0.5.7 支援 ESLint 10。
  - **`npm audit`：** 顯示 moderate（`minimatch`，經由 ESLint 與 openapi-typescript，都是開發工具）。不要執行 `npm audit fix --force`，它會把 ESLint 降到 4.0.0、openapi-typescript 降到 6.7.6。

## 查證後正確的項目

### 版本與相容性

Stack 全部版本都存在，皆未 yanked 或 deprecated。

| 組合 | 查證結果 |
| --- | --- |
| 全部 Python 套件 × Python 3.13 | `requires_python` 皆符合，`uv pip install` 解析成功；`pydantic-settings`、`SQLAlchemy` 要求 ≥ 3.11 |
| Alembic 1.20.1 × SQLAlchemy 2.1.8 | 要求 `SQLAlchemy>=2.0` |
| FastAPI 0.162.0 × Pydantic 2.14.2 | 要求 `pydantic>=2.9.0` |
| `@mantine/*` 9.7.5 × React 19.3.1 | peer `^19.2.0` |
| `@tanstack/react-query` 5.105.3 × React | peer `^18 \|\| ^19` |
| `react-router` 8.5.1 × React、Node 24 | peer `>=19.2.7`；engines `>=22.22.0`，主幹敘述正確 |
| `@vitejs/plugin-react` 6.2.1 × Vite 8 | peer `^8.0.0` |
| Vitest 5.1.0 × Vite 8、Node 24 | peer `^6.4.0 \|\| ^7.0.0 \|\| ^8.0.0`；engines 不含 Node 20，主幹敘述正確 |
| openapi-typescript 7.13.0 × TS 5.9.3 | peer `^5.x`，實測可產生型別 |
| typescript-eslint 8.72.1 × TS 5.9、ESLint 10 | peer `typescript <6.1.0`、`eslint ^10.0.0` 皆涵蓋，實測可執行 |
| Node 24 LTS | 仍為 LTS，EOL 2028-04-30；已於 2026-10 進入維護期，Node 26 成為 Active LTS，但主幹選擇仍受支援 |
| PostgreSQL 17 | 最新 17.11，EOL 2029-11-08 |
| `postgres:17-alpine` | Docker Hub 存在，含 amd64、arm64，更新於 2026-10-26 |

### 技術主張

| 主張 | 結論 | 依據 |
| --- | --- | --- |
| SQLAlchemy 2.1 支援 `with_for_update`、`order_by` 組合 | 正確（需加 T2 的修正） | 編譯出 `ORDER BY batch.id FOR UPDATE` |
| psycopg3 驅動 URL | 正確。`postgresql+psycopg://` 可用；2.1 起 `postgresql://` 預設也是 psycopg，官方仍建議明寫 | 實測＋ https://docs.sqlalchemy.org/en/21/changelog/migration_21.html |
| `FOR UPDATE` 與 `ORDER BY id` | 正確。PG 的亂序警告只發生在排序欄位被更新時，`id` 不變，不受影響 | https://www.postgresql.org/docs/17/sql-select.html |
| Pydantic v2 JSON 模式把 Decimal 序列化為字串 | 正確（範圍見 T3、T4） | 實測 |
| `NaN`、`Infinity` 拒絕；超過 9 位整數拒絕 | 正確，`max_digits=12` 搭配 `decimal_places=3` 會檢查整數位數 | 實測 |
| import-linter forbidden contract 與「僅檢查直接 import」 | 正確，但設定有條件，見下方 | 實測 import-linter 2.15 |
| React Router 8 宣告式與不使用 loader 的路由 | 正確。`BrowserRouter` 與不帶 loader 的 `createBrowserRouter` 都可通過 `tsc`；`RouterProvider` 可從 `react-router` 與 `react-router/dom` 匯入。未在瀏覽器實跑 | https://reactrouter.com/start/modes |
| `crypto.randomUUID` 只在安全環境可用 | 正確，`uuid` 14 內部用 `crypto.getRandomValues`，非安全環境可用 | https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID 、 https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues |

### import-linter 的正確設定

下列設定已實測：直接 `import sqlalchemy.orm` 會被抓到；`service → app.db.models → sqlalchemy`（AD-3 允許）與 `router → dependencies → repository_sqlalchemy` 都通過。

```toml
[tool.importlinter]
root_package = "app"
include_external_packages = true   # 缺少時工具直接報錯

[[tool.importlinter.contracts]]
name = "service 不可直接 import fastapi、sqlalchemy"
type = "forbidden"
source_modules = ["app.modules.*.service"]
forbidden_modules = ["fastapi", "sqlalchemy"]
allow_indirect_imports = true      # 必要，否則上述合法路徑全部判定違規
```

來源：https://import-linter.readthedocs.io/en/stable/contract_types/forbidden/ 、 https://import-linter.readthedocs.io/en/stable/contract_types/

建議把 `allow_indirect_imports = true` 與 `include_external_packages = true` 寫進 AD-1。主幹「僅檢查直接 import」的敘述正確，但沒有點出這兩個設定是必要條件。

## 建議的主幹修改順序

1. 修正 Stack 表：T1、T5、T12、T13。
2. 修正規則：T2（AD-7）、T3 與 T4（AD-9、AD-16）、T8（AD-6）、T6（AD-17）。
3. 補環境定義：T7、T9、T10。
4. 其餘項目在骨架階段處理。
5. 骨架完成後，在 Node 24 與真實 PostgreSQL 17 上跑一次「查證範圍與限制」列出的未執行項目。
