- source_spec: `_bmad-output/implementation-artifacts/spec-chore-seed-demo.md`
  summary: seed-demo --reset 除了 APP_ENV=production 之外沒有其他防護，也沒有顯示目標資料庫。
  evidence: APP_ENV 預設為 development，所以 DATABASE_URL 指向真實資料庫且未設 APP_ENV 時會直接清空；測試的 conftest 有 _test 名稱防護，CLI 沒有。
- source_spec: `_bmad-output/implementation-artifacts/spec-chore-seed-demo.md`
  summary: seed-demo 只有 RECEIPT 異動，沒有領用、報廢、盤點調整與位置變更的歷史。
  evidence: 需求只要求進貨單與批次；異動查詢與報廢損失畫面完成後，demo 時要現場操作才有資料。
