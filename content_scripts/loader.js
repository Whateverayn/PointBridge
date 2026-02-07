(async () => {
    // console.log("PointBridge Loader: Loaded.");

    // Dynamic import to use ES modules
    // Generic Parser Loader
    const parsers = [
        {
            name: 'Wester',
            url: chrome.runtime.getURL('parsers/wester/parser.js'),
            className: 'WesterParser'
        },
        {
            name: 'Rakuten',
            url: chrome.runtime.getURL('parsers/rakuten/parser.js'),
            className: 'RakutenParser'
        }
    ];

    // Static loading to avoid "Unsafe call to import" warning
    let parserInstance = null;
    const currentUrl = window.location.href;

    try {
        // Wester
        if (currentUrl.includes('icoca.jr-odekake.net')) {
            const module = await import(chrome.runtime.getURL('parsers/wester/parser.js'));
            const p = new module.WesterParser();
            if (p.isApplicable(currentUrl)) parserInstance = p;
        }
        // Rakuten
        else if (currentUrl.includes('point.rakuten.co.jp')) {
            const module = await import(chrome.runtime.getURL('parsers/rakuten/parser.js'));
            const p = new module.RakutenParser();
            if (p.isApplicable(currentUrl)) parserInstance = p;
        }
    } catch (e) {
        // console.error(e);
    }

    if (!parserInstance) {
        // console.log("PointBridge Loader: No applicable parser found for this page.");
    }

    // Listen for messages from Popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "scan") {
            if (!parserInstance) {
                sendResponse({ success: false, error: "Parser not initialized or not applicable." });
                return true;
            }

            try {
                const data = parserInstance.parse(document);
                sendResponse({ success: true, data: data });
            } catch (e) {
                console.error(e);
                sendResponse({ success: false, error: e.toString() });
            }
            return true; // Keep channel open for sendResponse
        }
    });
})();
