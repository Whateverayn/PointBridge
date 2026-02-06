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

        // 2. サイトごとにグルーピング
        const groupedData = {};
        data.forEach(item => {
            const site = item.site || 'unknown';
            if (!groupedData[site]) groupedData[site] = [];
            groupedData[site].push(item);
        });

        // 3. サイトごとに処理
        for (const siteId in groupedData) {
            const items = groupedData[siteId];
            if (items.length === 0) continue;

            // データのキーを取得 (site以外)
            const sampleItem = items[0];
            const dataKeys = Object.keys(sampleItem).filter(k => k !== 'site');

            let sheet = ss.getSheetByName(siteId);
            let headers = [];

            // シート作成またはヘッダ取得
            if (!sheet) {
                sheet = ss.insertSheet(siteId);
                // ヘッダ作成: データのキー + 管理用カラム
                headers = [...dataKeys, "ImportedAt"];
                sheet.appendRow(headers);
                sheet.setFrozenRows(1);
                sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
            } else {
                // 既存シートのヘッダ読み込み
                const lastCol = sheet.getLastColumn();
                if (lastCol > 0) {
                    headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
                } else {
                    // シートはあるがヘッダがない場合
                    headers = [...dataKeys, "ImportedAt"];
                    sheet.appendRow(headers);
                }
            }

            // 重複チェックの準備
            // 既存データの全行を取得
            const existingData = sheet.getDataRange().getValues(); // 1行目(ヘッダ)含む
            const existingSignatures = new Set();

            // ヘッダ名 -> 列インデックス のマップ
            const headerMap = {};
            headers.forEach((h, i) => { headerMap[h] = i; });

            // 重複判定に使うキー（データのキーすべて）に基づき, 既存データのシグネチャを作成
            for (let i = 1; i < existingData.length; i++) {
                const row = existingData[i];
                const signature = createSignature(row, headerMap, dataKeys);
                existingSignatures.add(signature);
            }

            // 新規行の作成
            const newRows = [];
            items.forEach(item => {
                // アイテムからシグネチャ生成 (比較用)
                const itemSignature = createItemSignature(item, dataKeys);

                if (!existingSignatures.has(itemSignature)) {
                    // シートのヘッダ順に合わせて行データを作成
                    const rowData = headers.map(header => {
                        if (header === 'ImportedAt') return new Date();
                        return item[header] !== undefined ? item[header] : "";
                        // シートにあってデータにないカラムは空文字
                    });
                    newRows.push(rowData);

                    // 同一リクエスト内の重複も排除
                    existingSignatures.add(itemSignature);
                }
            });

            // 書き込み
            if (newRows.length > 0) {
                sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, newRows[0].length).setValues(newRows);
                totalAdded += newRows.length;
            }
        }

        return ContentService.createTextOutput(JSON.stringify({
            status: "success",
            message: `${totalAdded} items added.`,
            addedCount: totalAdded
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
