import { Parser } from '../interface.js';

export class VPointParser extends Parser {
    constructor(options) {
        super();
        this.siteId = 'VPoint';
        this.options = options || {};
    }

    isApplicable(url) {
        return url.includes('mypage.tsite.jp') || url.includes('vpoint.jp');
    }

    parse(document) {
        const transactions = [];
        const items = document.querySelectorAll('ul > li.list__one');

        items.forEach(item => {
            const dateText = item.querySelector('.list__one__date')?.textContent.trim();
            const description = item.querySelector('.list__one__contents--name')?.textContent.trim();
            const pointText = item.querySelector('.list__one__contents--point')?.textContent.trim();

            if (!dateText || !description || !pointText) return;

            // Description Filtering
            // 1. Exclude "Store Limited" (ストア限定)
            if (description.includes('ストア限定')) {
                return;
            }

            // Amount Parsing
            // Format example: "16", "+90", "-50"
            // We need to handle comma if present
            const cleanPoint = pointText.replace(/,/g, '');
            let amount = parseInt(cleanPoint, 10);

            if (isNaN(amount)) return;

            // Logic for Negative Amounts / Investment
            // Rule: Generally exclude negative (spending).
            // Exception: If it is "V Point Investment" (Vポイント運用) AND option is enabled.
            // Note: Actual description text for investment needs verification. 
            // Based on user request, we match "Vポイント運用" pattern.

            // Assuming "Vポイント運用" or similar string is in description for investment.
            // We'll look for "運用" or specific keywords. 
            // As per user request: "Vポイント運用については...含めるかどうか選べるようにします"

            const isInvestment = description.includes('Ｖポイント運用') || description.includes('Vポイント運用');

            if (isInvestment) {
                if (!this.options.includeVPointInvestment) {
                    return; // Option OFF -> Skip
                }
                // Option ON -> Include (even if negative)
            } else {
                // Regular transaction
                // Rule: "In principle, only additions (+P) are counted."
                if (amount <= 0) {
                    return;
                }
            }

            // Normalization
            const normalizedDesc = this.normalizeText(description);
            const formattedDate = this.formatDate(dateText);

            transactions.push({
                site: this.siteId,
                date: formattedDate,
                description: normalizedDesc,
                amount: amount,
                isCancellation: false // No logic for cancellation yet
            });
        });

        return transactions;
    }

    formatDate(dateString) {
        // Input: "2025/06/27" or "2025/06/27\n..."
        // Or sometimes "2月8日" if standard changes?
        // The HTML sample shows "2025/06/27".

        // Simple trimming first
        let cleanDate = dateString.split('\n')[0].trim();

        // Check if YYYY/MM/DD
        if (cleanDate.match(/^\d{4}\/\d{2}\/\d{2}$/)) {
            return cleanDate;
        }

        // If it comes as "MM/DD" or "M月D日", use current year?
        // Sample HTML has <p class="list__one__date">2025/06/27...</p>
        // Use Regex to extract YYYY/MM/DD just in case
        const match = cleanDate.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
        if (match) {
            const y = match[1];
            const m = match[2].padStart(2, '0');
            const d = match[3].padStart(2, '0');
            return `${y}/${m}/${d}`;
        }

        return cleanDate;
    }

    normalizeText(text) {
        if (!text) return "";
        let normalized = text
            .replace(/[！-～]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
            .replace(/　/g, " ")
            .replace(/\s+/g, " ");
        return normalized.trim();
    }

    getColumns() {
        return [
            { header: "デイト", key: "date" },
            { header: "ディテール", key: "description" },
            { header: "ゲイン", key: "amount", style: "text-align: right;" }
        ];
    }
}
