# 食序 FoodFlow

餐飲食材庫存與效期預警系統，第 17 組軟體工程期末專案。需求見 [docs/srs.md](docs/srs.md)，協作規則見 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 開發環境需求

| 工具 | 版本 | 用途 |
| --- | --- | --- |
| Python | 3.13 | 後端 |
| uv | 最新版 | 安裝 Python、管理後端套件 |
| Node.js | 24 LTS | 前端 |
| Docker（含 Docker Compose） | 最新版 | 執行 PostgreSQL 17 |

確認版本：

```bash
uv run python --version
uv --version
node --version
docker --version
docker compose version
```

注意事項：

- **Node 版本：** 不可使用 Node 20。在 Node 20.17 上執行 `vite build` 會出現 `Cannot find native binding`，原因是 Node 版本，不要反覆重裝套件。Windows 可用 nvm-windows 或 fnm 切換版本。
- **Docker：** 啟動資料庫前，要先開啟 Docker Desktop。
- **Python：** 可用 `uv python install 3.13` 安裝。
