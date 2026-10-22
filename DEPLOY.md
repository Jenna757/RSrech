# Cloudflare Workers 部署

本專案包含靜態官網及 Worker 後台，不再是純靜態 Pages。

- Worker 名稱：`rsrech`
- GitHub production branch：`main`
- Root directory：`/`
- Build command：留空
- Deploy command：`npx wrangler deploy`
- `wrangler.jsonc` 指定後台入口、靜態目錄及 D1 binding。
- 管理入口：`https://rsrech.developer-99e.workers.dev/admin/`

設定管理員密碼及使用說明見 [ADMIN.md](ADMIN.md)。請勿使用純靜態拖放部署覆蓋後台程式。
