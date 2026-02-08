import { Parser } from '../interface.js';

export class PontaParser extends Parser {
    constructor(options) {
        super();
        this.siteId = 'Ponta';
        this.options = options || {};
    }

    isApplicable(url) {
        return url.includes('point-portal.auone.jp/point/history');
    }

    parse(document) {
        const transactions = [];

        // Prioritize Modal List (Full History) if it exists and has content
        let listContainer = document.querySelector('.point-history-slideup-modal__container .point-list__list');

        // If not found (modal not opened yet), fallback to Recent History
        if (!listContainer) {
            listContainer = document.querySelector('.container__recently-history .point-list__list');
        }

        if (!listContainer) {
            // Last resort: try generic selector but this might cause duplication if both exist and we didn't catch it above
            // But with above logic, we should be safe.
            return [];
        }

        const dateGroups = listContainer.querySelectorAll(':scope > li'); // Direct children only assignment

        dateGroups.forEach(group => {
            const dateText = group.querySelector('.point-list__date')?.textContent.trim();
            // dateText format: "2月8日" -> We need to treat this carefully. 
            // The site seems to show current year implicitly.
            // For now, let's keep it as string or try to append current year?
            // Existing parsers might expect a specific format. 
            // Let's stick to the string "M月D日" for now or convert if needed.
            // However, typical spreadsheet format prefers YYYY/MM/DD.
            // Let's assume current year for now, but handle year boundary if needed?
            // Given the requirement "extract what is valid", let's use a helper to format date.

            const items = group.querySelectorAll('ul > li.point-list__item');

            items.forEach(item => {
                const description = item.querySelector('.point-list__detail')?.textContent.trim();
                const pointText = item.querySelector('.point-list__point')?.textContent.trim();

                // Point text format: "+1P", "-100P", "100P"
                // We need to parse this to integer.
                let amount = 0;
                if (pointText) {
                    const cleanPoint = pointText.replace(/P$/, '').replace(/,/g, '');
                    amount = parseInt(cleanPoint, 10);
                }

                // Initial Filtering Rules (Phase 1)
                // 1. "Gain" only (positive amount).
                //    However, user said: "Include au PAY Point Management addition (negative) if preference is ON".
                //    "Ignore case": Exclude au PAY Point Management (add/pull).
                //    "Gained points only" is the general rule.

                // Rule A: Generally exclude negative amounts (Spending use)
                // However, "au PAY ポイント運用" addition is negative (spending points to add to management).
                // Pulling is positive.

                const isManagement = description?.includes('ａｕ　ＰＡＹ　ポイント運用');

                // Logic update based on preference
                if (isManagement) {
                    // specific filtering for Management
                    // If preference is explicitly enabled, we INCLUDE even if it might be negative (investment addition).
                    // If preference is disabled (default), we skip.
                    if (!this.options.includePontaManagement) {
                        return; // Skip
                    }
                    // If preference is enabled, we fall through to be included (even if negative)
                }

                // General Rule: Extract gained points only.
                // Usually this means amount > 0.
                if (amount <= 0) {
                    // If it is management AI AND we want to include it, we skip this check.
                    if (!(isManagement && this.options.includePontaManagement)) {
                        return; // Skip spending/loss
                    }
                }

                transactions.push({
                    site: this.siteId,
                    date: this.formatDate(dateText),
                    description: this.normalizeText(description),
                    amount: amount,
                    isCancellation: false // No clear cancellation flag in HTML yet, assuming false
                });
            });
        });

        return transactions;
    }

    formatDate(dateString) {
        // Input: "2月8日"
        // Output: "202X/02/08"
        // Heuristic: Use current year. 
        if (!dateString) return "";

        const now = new Date();
        const currentYear = now.getFullYear();

        const match = dateString.match(/(\d+)月(\d+)日/);
        if (match) {
            const month = match[1].padStart(2, '0');
            const day = match[2].padStart(2, '0');
            return `${currentYear}/${month}/${day}`;
        }
        return dateString;
    }

    normalizeText(text) {
        if (!text) return "";
        let normalized = text
            .replace(/[！-～]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
            .replace(/　/g, " ")
            .replace(/、/g, ", ")
            .replace(/\s+/g, " ");

        // Add space before '(' if not present (and not at start)
        normalized = normalized.replace(/([^\s])\(/g, "$1 (");

        // Remove space before ')'
        normalized = normalized.replace(/\s+\)/g, ")");

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
