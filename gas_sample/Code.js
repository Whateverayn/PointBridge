/**
 * PointBridge GAS Server
 * 
 * Firefoxアドオン「PointBridge」から送信されたポイント履歴データを受信し, 
 * スプレッドシートに保存するスクリプトです.
 * 
 * 仕様:
 * 1. POSTリクエストを受け取る (doPost)
 * 2. サイトID (site) ごとにシートを分ける (なければ作成)
 * 3. シートのヘッダは初回作成時にデータのキーから自動生成する
 * 4. 全データの値を結合したキーで重複をチェックし, 新規のみ追記する
 */

function doPost(e) {
    try {
        // 1. データ受信・パース
        const jsonString = e.postData.contents;
        const data = JSON.parse(jsonString);

        // 配列でない場合はエラー
        if (!Array.isArray(data)) {
            throw new Error("Invalid format: Payload must be an array.");
        }

        const ss = SpreadsheetApp.getActiveSpreadsheet();
        let totalAdded = 0;

        // 2. サイトごとの既存データ（シグネチャ）を読み込む
        // データに含まれるサイトIDを特定
        const sites = [...new Set(data.map(d => d.site || 'unknown'))];

        const siteSignatures = {}; // site -> Set(signature)
        const siteHeaders = {};    // site -> Array(header)
        const siteSheets = {};     // site -> Sheet Object

        // 事前準備: 各サイトのシートと既存データをロード
        sites.forEach(siteId => {
            let sheet = ss.getSheetByName(siteId);
            let headers = [];

            // このサイトIDに該当するデータのサンプルを探してキーを取得
            const sampleForSite = data.find(d => (d.site || 'unknown') === siteId);
            const dataKeys = Object.keys(sampleForSite).filter(k => k !== 'site');

            if (!sheet) {
                // シートがない場合は作成 (書き込みは後で)
                sheet = ss.insertSheet(siteId);
                headers = [...dataKeys, "ImportedAt"];
                sheet.appendRow(headers);
                sheet.setFrozenRows(1);
                sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
            } else {
                const lastCol = sheet.getLastColumn();
                if (lastCol > 0) {
                    headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
                } else {
                    headers = [...dataKeys, "ImportedAt"];
                    sheet.appendRow(headers);
                }
            }

            siteSheets[siteId] = sheet;
            siteHeaders[siteId] = headers;

            // 既存シグネチャ読み込み
            // データ行がある場合のみ取得 (1行目はヘッダ)
            const lastRow = sheet.getLastRow();
            const sigs = new Set();

            if (lastRow > 1) {
                const existingData = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
                const headerMap = {};
                headers.forEach((h, i) => { headerMap[h] = i; });

                for (let i = 1; i < existingData.length; i++) {
                    const row = existingData[i];
                    const signature = createSignature(row, headerMap, dataKeys);
                    sigs.add(signature);
                }
            }
            siteSignatures[siteId] = sigs;
        });

        const results = []; // 各行のステータス: { status: 'added' | 'skipped' }
        const rowsToAdd = {}; // site -> Array(row)

        // 3. 全データを元の順序でチェック
        data.forEach(item => {
            const siteId = item.site || 'unknown';
            const sigs = siteSignatures[siteId];
            const headers = siteHeaders[siteId];

            // シグネチャ生成用キー（このアイテムの情報）
            const keys = Object.keys(item).filter(k => k !== 'site');
            const itemSignature = createItemSignature(item, keys);

            if (!sigs.has(itemSignature)) {
                // 新規データ
                results.push({ status: 'added' });

                // 同一リクエスト内での重複防止のためセットに追加
                sigs.add(itemSignature);

                // 行データ作成
                const rowData = headers.map(header => {
                    if (header === 'ImportedAt') return new Date();
                    return item[header] !== undefined ? item[header] : "";
                });

                if (!rowsToAdd[siteId]) rowsToAdd[siteId] = [];
                rowsToAdd[siteId].push(rowData);
                totalAdded++;
            } else {
                // 重複データ
                results.push({ status: 'skipped' });
            }
        });

        // 4. 書き込み (サイトごとにまとめて)
        for (const siteId in rowsToAdd) {
            const newRows = rowsToAdd[siteId];
            if (newRows.length > 0) {
                const sheet = siteSheets[siteId];
                sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, newRows[0].length).setValues(newRows);
            }
        }

        return ContentService.createTextOutput(JSON.stringify({
            status: "success",
            message: `${totalAdded} items added.`,
            addedCount: totalAdded,
            results: results
        })).setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        return ContentService.createTextOutput(JSON.stringify({
            status: "error",
            message: error.toString()
        })).setMimeType(ContentService.MimeType.JSON);
    }
}

/**
 * 値の正規化（重複チェック用）
 */
function normalizeValue(val) {
    if (val instanceof Date) {
        return Utilities.formatDate(val, Session.getScriptTimeZone(), "yyyy/MM/dd");
    }
    if (typeof val === 'number') {
        return val.toString();
    }
    if (typeof val === 'string') {
        // 日付文字列の揺らぎ吸収 (2026-01-01 -> 2026/01/01)
        if (val.match(/^\d{4}-\d{2}-\d{2}$/)) {
            return val.replace(/-/g, '/');
        }
        return val.trim();
    }
    return String(val);
}

/**
 * 既存行(Array)からシグネチャを生成
 */
function createSignature(row, headerMap, keys) {
    const parts = keys.map(k => {
        const idx = headerMap[k];
        if (idx === undefined) return "";
        return normalizeValue(row[idx]);
    });
    return JSON.stringify(parts);
}

/**
 * 送信アイテム(Object)からシグネチャを生成
 */
function createItemSignature(item, keys) {
    const parts = keys.map(k => {
        return normalizeValue(item[k]);
    });
    return JSON.stringify(parts);
}
