import { Parser } from '../interface.js';

export class RakutenParser extends Parser {
    constructor() {
        super();
        this.siteName = "RakutenPoint";
    }

    isApplicable(url) {
        return url.includes("point.rakuten.co.jp/history");
    }

    getColumns() {
        return [
            { header: "ポステッド", key: "date" },
            { header: "トランザク", key: "usage_date" },
            { header: "サービス", key: "service" },
            { header: "ディテール", key: "description" },
            { header: "ゲイン", key: "amount", style: "text-align: right;", formatter: (val) => val.toLocaleString() }
        ];
    }

    parse(document) {
        const rows = document.querySelectorAll('table.history-table tbody tr');
        console.log(`PointBridge Parser: Found ${rows.length} rows in document.`);
        const transactions = [];

        rows.forEach(row => {
            // Header skip or spacer skip
            if (row.querySelector('th')) return;

            // Filter Logic:
            // 1. Must NOT have 'use' class.
            // 2. Action text must contain "獲得".

            // 2. Action text check
            const actionEl = row.querySelector('.action');
            if (!actionEl) return;
            const actionText = actionEl.textContent.trim();

            // Strict Filter: Must be "get" class AND Action must contain "獲得"
            // Note: Sometimes class might be missing? Let's check class first.
            const isGetClass = row.classList.contains('get');
            const isAcquisitionAction = actionText.includes('獲得');

            // If it's a usage or other type, skip.
            // Using logic: Accept if (isGetClass AND isAcquisitionAction)
            // This excludes "利用", "追加完了", "チャージ" (usually not 'get'), "引き出し"
            if (!isGetClass || !isAcquisitionAction) {
                return;
            }

            // Exclude "Expected Points" (獲得予定ポイント)
            // Just in case "獲得予定" matches "獲得".
            if (actionText.includes('予定')) {
                return;
            }

            // Data Extraction
            const dateEl = row.querySelector('.date');
            const serviceEl = row.querySelector('.service');
            const detailEl = row.querySelector('.detail'); // .detail contains .date (usage date) and text
            const pointEl = row.querySelector('.point');

            if (!dateEl || !pointEl || !detailEl) return;

            // Date Cleaning: "2026<br>02/06" -> "2026-02-06"
            // textContent might be "202602/06" if <br> is ignored?
            // innerHTML is safer for <br> replacement
            let dateText = dateEl.innerHTML.replace('<br>', '/').replace(/\s/g, '');
            // Now "2026/02/06"
            let grantDate = dateText.split('/').join('-'); // "2026-02-06"

            // Usage Date Extraction from detail
            // Look for <div class="date">[2026/02/05]</div>
            const usageDateEl = detailEl.querySelector('.date');
            let usageDate = grantDate; // Default to grantDate
            if (usageDateEl) {
                const udText = usageDateEl.textContent.trim(); // "[2026/02/05]"
                const match = udText.match(/\[(\d{4}\/\d{2}\/\d{2})\]/);
                if (match && match[1]) {
                    usageDate = match[1].split('/').join('-');
                }
            }

            let service = "";
            if (serviceEl) {
                const serviceClone = serviceEl.cloneNode(true);
                const subLink = serviceClone.querySelector('.sub-link');
                if (subLink) {
                    subLink.remove();
                }
                service = serviceClone.textContent.trim();
            }

            // Description Cleaning
            // Standardize on using a clone to avoid modifying the live DOM
            // Remove the .data block (contains usage date and rank up info) as user requested to cut off after date.
            // Actually, the date is inside .data. The user wants the description text *before* the date.
            // HTML structure: Text Node (Description) -> <div class="data">...</div>
            // So extracting textContent of .detail *after removing .data* should leave just the description.

            let description = "";
            if (detailEl) {
                const detailClone = detailEl.cloneNode(true);
                const dataDiv = detailClone.querySelector('.data');
                // We've already extracted usageDate from the live DOM, so we can safely remove this from the clone
                // to get a clean description.
                if (dataDiv) {
                    dataDiv.remove();
                }
                description = detailClone.textContent.trim();
                description = description.replace(/\s+/g, ' '); // Normalize spaces
            }

            let amountStr = pointEl.textContent.trim();
            // Store as valid number for GAS/spreadsheets (remove commas)
            let amount = parseInt(amountStr.replace(/,/g, ''), 10);

            transactions.push({
                site: this.siteName,
                date: grantDate,       // 付与日 (Primary for display)
                usage_date: usageDate, // 利用日 (Real transaction date)
                service: service,
                description: description,
                amount: amount,
                action: actionText
            });
        });

        return transactions;
    }
}
