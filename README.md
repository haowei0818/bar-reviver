# Bar Reviver 點單記事

員工用手機記錄每桌點了哪些調酒。規格書見 Claude Docs「Bar Reviver 點餐記事系統 — 技術規格書 v1」。

## 本機試用（不需 Firebase）

    npm install
    npm run dev

沒有 `.env.local` 時自動進入「試用模式」，資料只存在這台裝置的瀏覽器。

## 接上 Firebase（多支手機共用）

1. 到 Firebase 主控台建立專案，新增一個「網頁」應用程式。
2. 在專案裡建立 Firestore 資料庫（地區建議 asia-east1 台灣）。
3. 把 `.env.example` 複製成 `.env.local`，填入網頁應用程式設定裡的四個值。
4. 部署：

       npx firebase login
       npx firebase use --add          # 選剛建立的專案
       npm run build
       npx firebase deploy --only hosting,firestore:rules

5. 打開部署好的網址 → 「網址」→「產生專屬網址」，把帶 `?k=` 的網址傳給員工。

> `firestore.rules` 允許任何人讀寫，符合規格「不設權限」的決策。專屬網址只是「不容易被猜到」，不等於帳號密碼。

## 功能（T1–T8）

| Ticket | 功能 | 驗收方式 |
| --- | --- | --- |
| T1 | 29 桌總覽、選酒、同酒累加 | 自動測試 + 截圖 |
| T2 | 每杯備註（快速鍵＋文字、拆杯）、數量 ±、桌備註 | 自動測試 + 截圖 |
| T3 | 多裝置即時同步；本機模式可跨分頁 | 邏輯已測；兩支手機實測需 Firebase |
| T4 | 清桌確認、歷史、還原 | 自動測試 + 截圖 |
| T5 | 結束營業（輸入「結束」）、10 分鐘復原、18 小時提醒、保留 7 個營業日 | 自動測試 + 截圖 |
| T6 | 酒單後台：新增、改名、改價、排序、上下架 | 自動測試 + 截圖 |
| T7 | 離線可記、連線補傳、離線狀態提示、清桌後補傳標示「離線補傳」 | 邏輯已測；飛航模式實測需 Firebase |
| T8 | 專屬亂碼網址、更換後舊網址失效 | 自動測試 + 截圖 |

## 測試

    npm test

## 架構

- `src/domain/` 純邏輯，不依賴框架與資料庫：`session`（桌次、備註）、`bar`（整店狀態、清桌、營業日）、`menu`（酒單與後台）、`access`（專屬網址）
- `src/data/` 資料層：`BarRepo` 介面；`commands.ts` 把領域規則接到任何儲存端；`localRepo`（試用模式）與 `firestoreRepo`（雲端，判斷邏輯在 `firestoreMapping.ts`）
- `src/ui/` 畫面，只依賴 `BarRepo`
