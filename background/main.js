// Background Service Worker

const MENU_ID = "point-bridge-start";

chrome.runtime.onInstalled.addListener(() => {
    console.log("PointBridge Installed.");

    chrome.contextMenus.create({
        id: MENU_ID,
        title: "ラウンチ PointBridge",
        contexts: ["page", "selection"],
        documentUrlPatterns: [
            "*://clubj.jr-odekake.net/*",
            "*://icoca.jr-odekake.net/*"
        ]
    });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === MENU_ID) {
        if (tab && tab.id) {
            chrome.tabs.sendMessage(tab.id, { action: "toggle-ui" }).catch(err => {
                console.warn("Could not send message to tab. Content script might not be loaded.", err);
            });
        }
    }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "open-options") {
        chrome.runtime.openOptionsPage();
    }

    if (request.action === "send-data") {
        (async () => {
            try {
                const response = await fetch(request.url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain' },
                    body: JSON.stringify(request.data)
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const responseText = await response.text();
                let responseData;
                try {
                    responseData = JSON.parse(responseText);
                } catch (e) {
                    // Fallback if not JSON
                    responseData = { message: responseText };
                }

                sendResponse({ success: true, data: responseData });
            } catch (error) {
                console.error("Fetch error:", error);
                sendResponse({ success: false, error: error.toString() });
            }
        })();
        return true; // Keep channel open for async response
    }
});
