(async () => {
    console.log("PointBridge Loader: Loaded.");

    // Dynamic import to use ES modules
    const westerUrl = chrome.runtime.getURL('parsers/wester/parser.js');

    let parserInstance = null;

    try {
        const module = await import(westerUrl);
        const { WesterParser } = module;
        const parser = new WesterParser();

        if (parser.isApplicable(window.location.href)) {
            parserInstance = parser;
            console.log("PointBridge Loader: WesterParser initialized.");
        }
    } catch (e) {
        console.error("PointBridge Loader: Failed to load parser.", e);
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
