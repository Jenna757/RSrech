# RS Technologies 網站管理

管理入口：`/admin/`。支援客戶留言、待處理／跟進中／已完成狀態、中英文頁面文案、服務介紹及企業社會責任內容。現有圖片和版面以原始碼維護。

## Cloudflare 部署

- Worker：rsrech
- D1：rsrech-cms，binding 為 DB。資料表由程式首次使用時建立。
- 根目錄：`/`，build command 留空，deploy command：`npx wrangler deploy`。
- GitHub main 更新後自動部署。
- 在 Worker Settings → Variables and Secrets 設定 **Secret** `ADMIN_PASSWORD`，使用至少 16 字元的獨立強密碼。不要寫入 GitHub。
- 設定密碼後開啟 `/admin/` 登入。會話 8 小時到期。登出撤銷當前會話。
- 更換 ADMIN_PASSWORD 後，若需立即撤銷所有已登入會話，在 D1 Console 執行 `DELETE FROM sessions;`。

## 操作

客戶於官網提交表單後，留言保存於 D1。管理中心可分頁檢視及標記狀態；沒有實體刪除留言功能。內容修改按「儲存並發布」即保存，新訪客載入最新資料；若有其他管理員先儲存，舊版本會被拒絕避免覆蓋。

表單只保存留言，未配置自動郵件通知。固定知識問答內容仍由程式維護。圖片、聯絡連結與版面結構不在第一版編輯器範圍內。

## 驗證

`npm test` 使用本機 SQLite 驗證留言、登入／登出、未授權存取、跨站要求、CSRF、內容持久化和版本衝突。實際部署後再驗證表單與管理中心。

Cloudflare D1、Workers 動態請求受各自方案配額限制。部署不會清除 D1 中的留言或內容。
