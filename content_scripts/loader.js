(async () => {
    console.log("PointBridge Loader: Loaded.");

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

    let parserInstance = null;

    for (const p of parsers) {
        try {
            const module = await import(p.url);
            const ParserClass = module[p.className];
            const parser = new ParserClass();

            if (parser.isApplicable(window.location.href)) {
                parserInstance = parser;
                console.log(`PointBridge Loader: ${p.className} initialized.`);
                break; // Stop after finding the first applicable parser
            }
        } catch (e) {
            console.debug(`PointBridge Loader: Skipped ${p.name} parser (not applicable or failed load).`, e);
        }
    }

    if (!parserInstance) {
        console.log("PointBridge Loader: No applicable parser found for this page.");
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
