-- 只在資料目錄為空時執行。既有 volume 請改手動執行：
--   docker compose exec db psql -U foodflow -c "CREATE DATABASE foodflow_test"
CREATE DATABASE foodflow_test;
