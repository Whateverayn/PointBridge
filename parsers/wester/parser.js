import { Parser } from '../interface.js';

export class WesterParser extends Parser {
    constructor() {
        super();
        this.siteId = 'wester';
    }

    isApplicable(url) {
        return url.includes('pointref_search.do');
    }

    getColumns() {
        return [
            { header: "デイト", key: "date" },
            { header: "サービス", key: "service" },
            { header: "ディテール", key: "description" },
            { header: "ゲイン", key: "amount", style: "text-align: right;" }
        ];
    }

    parse(document) {
        const transactions = [];
        const tables = document.querySelectorAll('.detailTableWrap table');

        tables.forEach((table) => {
            // Structure: 2nd row (tr) has the data.
            // 0: Date, 1: Place, 2: Content, 3: Point, 4: Note, 5: Breakdown
            const rows = table.querySelectorAll('tr');
            if (rows.length < 2) return;

            const cells = rows[1].querySelectorAll('td');
            if (cells.length < 4) return;

            const dateStr = cells[0].textContent.trim();
            const place = cells[1].textContent.trim();
            const description = cells[2].textContent.trim();
            const amountStr = cells[3].textContent.trim();

            // Parse amount: "180 P" -> 180, "-1,200 P" -> -1200
            const amount = parseInt(amountStr.replace(/,/g, '').replace(' P', ''), 10);

            // Rule: Collect all transactions needed (both gain and loss/cancellation)
            // Identify if it's a cancellation based on keywords
            const isCancellation = amount < 0 && (description.includes('【取消】') || description.includes('取消'));

            // Filter: Include if Positive OR Cancelled. Exclude mere usage (negative w/o cancel flag)
            if (amount > 0 || isCancellation) {
                transactions.push({
                    site: this.siteId,
                    date: dateStr,
                    service: place,
                    description: description,
                    amount: amount,
                    isCancellation: isCancellation
                });
            }
        });

        return transactions;
    }
}
