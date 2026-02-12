// Background Service Worker

const MENU_ID = "point-bridge-start";

// Supported sites for action click
const SUPPORTED_URLS = [
    "*://icoca.jr-odekake.net/pc/pointref_search.do*",
    "*://point.rakuten.co.jp/history/*",
    "https://www.point-portal.auone.jp/point/history*",
    "https://mypage.tsite.jp/*"
];

chrome.runtime.onInstalled.addListener(() => {
    // console.log("PointBridge Installed.");

    chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({
            id: MENU_ID,
            title: "ラウンチ PointBridge",
            contexts: ["page", "selection"],
            documentUrlPatterns: SUPPORTED_URLS
        });
    });
});

// Shared logic to inject/toggle UI
const toggleUI = async (tab) => {
    if (!tab || !tab.id) return;

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
        try {
            // Inject Scripts
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ["content_scripts/loader.js", "content_scripts/ui.js"]
            });

            // Attempt 2: Send message again after injection
            await sendToggle();
        } catch (err) {
            console.error("PointBridge: Injection failed.", err);
        }
    }
};

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === MENU_ID) {
        await toggleUI(tab);
    }
});

// Browser Action (Icon Click) Handler
chrome.action.onClicked.addListener(async (tab) => {
    // Check if current URL matches supported patterns
    const isSupported = SUPPORTED_URLS.some(pattern => {
        // Simple wildcard-to-regex conversion for checking
        // Note: activeTab permission logic handles the permission side,
        // this check is just for UX decision (Toggle vs Options)
        const regexStr = pattern
            .replace(/\./g, '\\.')
            .replace(/\*/g, '.*');
        const regex = new RegExp(`^${regexStr}$`);
        return regex.test(tab.url);
    });

    if (isSupported) {
        await toggleUI(tab);
    } else {
        chrome.runtime.openOptionsPage();
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
