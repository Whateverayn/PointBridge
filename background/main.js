// Background Service Worker

const MENU_ID = "point-bridge-start";

chrome.runtime.onInstalled.addListener(() => {
    // console.log("PointBridge Installed.");

    chrome.contextMenus.create({
        id: MENU_ID,
        title: "ラウンチ PointBridge",
        contexts: ["page", "selection"],
        documentUrlPatterns: [
            "*://icoca.jr-odekake.net/pc/pointref_search.do*",
            "*://point.rakuten.co.jp/history/*"
        ]
    });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === MENU_ID) {
        if (tab && tab.id) {
            // Helper function to send toggle command
            const sendToggle = async () => {
                try {
                    await chrome.tabs.sendMessage(tab.id, { action: "toggle-ui" });
                    return true;
                } catch (e) {
                    return false;
                }
            };

            // Attempt 1: Try sending message (Fast path if already injected)
            const success = await sendToggle();

            if (!success) {
                // console.debug("PointBridge: Content script not ready. Injecting...");
                try {
                    // Inject Scripts
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: ["content_scripts/loader.js", "content_scripts/ui.js"]
                    });

                    // Attempt 2: Send message again after injection
                    // Give a tiny buffer for evaluation if needed, though executeScript awaits completion
                    await sendToggle();
                    // console.debug("PointBridge: Injected and toggled.");
                } catch (err) {
                    console.error("PointBridge: Injection failed.", err);
                }
            }
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
