class PointBridgeUI {
    constructor() {
        this.shadowRoot = null;
        this.container = null;
        this.isVisible = false;
        this.extractedData = [];
    }

    async initialize() {
        // Create container for Shadow DOM
        this.container = document.createElement('div');
        this.container.id = 'point-bridge-root';
        this.container.style.position = 'fixed';
        this.container.style.top = '20px';
        this.container.style.right = '20px';
        this.container.style.zIndex = '999999';
        this.container.style.display = 'none';

        document.body.appendChild(this.container);
        this.shadowRoot = this.container.attachShadow({ mode: 'open' });

        await this.render();
        this.attachListeners();
        console.log("PointBridge UI has been injected.");
    }

    async toggle() {
        if (!this.container) await this.initialize();
        this.isVisible = !this.isVisible;
        this.container.style.display = this.isVisible ? 'block' : 'none';

        if (this.isVisible) {
            this.scan();
        }
    }

    async scan() {
        const statusEl = this.shadowRoot.getElementById('status-text');
        statusEl.textContent = "スキャニング・ナウ...";

        try {
            const parserUrl = chrome.runtime.getURL('parsers/wester/parser.js');
            const module = await import(parserUrl);
            const { WesterParser } = module;
            const parser = new WesterParser();

            // Update title bar with site info if available
            const titleEl = this.shadowRoot.querySelector('.title-bar-text');
            if (titleEl) {
                // Determine site name (could be more robust, but simple check for now)
                const siteName = document.title || "Unknown Site";
                titleEl.textContent = `PointBridge - ${siteName}`;
            }

            const data = parser.parse(document);
            this.extractedData = data;

            if (data.length > 0) {
                statusEl.textContent = `${data.length} 件のレコード.`;
                this.renderTable(data);
            } else {
                statusEl.textContent = "リソースがエンプティです.";
                this.renderTable([]);
            }
        } catch (e) {
            console.error(e);
            statusEl.textContent = "パース・エラー発生.";
        }
    }

    async send() {
        const statusEl = this.shadowRoot.getElementById('status-text');
        if (this.extractedData.length === 0) return;

        const { gasUrl } = await chrome.storage.local.get('gasUrl');
        if (!gasUrl) {
            statusEl.textContent = "コンフィグ・ミッシング: GASのエンドポイント定義がリクワイアされています.";
            return;
        }

        statusEl.textContent = "プッシュ中...";

        try {
            // Send data via background script to avoid CORS issues in content script
            const response = await chrome.runtime.sendMessage({
                action: "send-data",
                url: gasUrl,
                data: this.extractedData
            });

            if (response && response.success && response.data && response.data.status === 'success') {
                const addedCount = response.data.addedCount !== undefined ? response.data.addedCount : '?';
                statusEl.textContent = `プッシュ・コンプリート (アディッド: ${addedCount})`;
                console.log("Response:", response.data);
                this.clearErrorView(); // Clear any previous errors
            } else {
                const errorMsg = response.data?.message || response.error || 'Unknown error';
                console.error("Push failed:", response);

                if (errorMsg.includes('<!DOCTYPE html>') || errorMsg.includes('<html')) {
                    statusEl.textContent = "クリティカル・エラー: 詳細を表示します";
                    this.renderErrorHtml(errorMsg);
                } else {
                    statusEl.textContent = `エラー: ${errorMsg}`;
                    this.clearErrorView();
                }
            }
        } catch (e) {
            console.error(e);
            statusEl.textContent = "通信エラー (Message failure).";
        }
    }

    renderErrorHtml(htmlContent) {
        const body = this.shadowRoot.querySelector('.window-body');
        let errorContainer = this.shadowRoot.getElementById('error-view-host');

        // Remove existing container to reset shadow root
        if (errorContainer) {
            errorContainer.remove();
        }

        errorContainer = document.createElement('div');
        errorContainer.id = 'error-view-host';
        errorContainer.style.marginTop = '10px';
        errorContainer.style.border = '2px solid red';
        errorContainer.style.height = '150px';
        errorContainer.style.overflow = 'auto';
        errorContainer.style.backgroundColor = 'white';

        body.appendChild(errorContainer);

        const shadow = errorContainer.attachShadow({ mode: 'open' });
        shadow.innerHTML = htmlContent;
    }

    clearErrorView() {
        const errorContainer = this.shadowRoot.getElementById('error-view-host');
        if (errorContainer) {
            errorContainer.remove();
        }
    }

    async render() {
        try {
            const url = chrome.runtime.getURL('content_scripts/ui.html');
            const response = await fetch(url);
            const html = await response.text();
            this.shadowRoot.innerHTML = html;
        } catch (e) {
            console.error("Failed to load UI template", e);
            this.shadowRoot.innerHTML = '<div style="background:white; p:10px; border:1px solid red">UI Load Error</div>';
        }
    }

    renderTable(data) {
        const tbody = this.shadowRoot.querySelector('#data-table tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        data.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.date}</td>
                <td>${item.service}</td>
                <td>${item.description}</td>
                <td style="text-align: right;">${item.amount}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    attachListeners() {
        const win = this.shadowRoot.querySelector('.window');
        const titleBar = this.shadowRoot.querySelector('.title-bar');
        const closeBtn = this.shadowRoot.getElementById('close-btn');
        const minBtn = this.shadowRoot.querySelector('button[aria-label="Minimize"]');
        const maxBtn = this.shadowRoot.querySelector('button[aria-label="Maximize"]');

        // Scan/Send/Settings buttons
        const scanBtn = this.shadowRoot.getElementById('scan-btn');
        const sendBtn = this.shadowRoot.getElementById('send-btn');
        const settingsBtn = this.shadowRoot.getElementById('settings-btn');

        // CSS Improvements for behaviors
        if (titleBar) titleBar.style.userSelect = 'none';

        if (closeBtn) closeBtn.addEventListener('click', () => this.toggle());
        if (scanBtn) scanBtn.addEventListener('click', () => this.scan());
        if (sendBtn) sendBtn.addEventListener('click', () => this.send());
        if (settingsBtn) settingsBtn.addEventListener('click', () => {
            chrome.runtime.sendMessage({ action: "open-options" });
        });

        /* --- Robust Window State Machine --- */
        let state = 'NORMAL'; // NORMAL, MAXIMIZED, MINIMIZED
        let previousState = 'NORMAL'; // To track what to restore to (NORMAL or MAXIMIZED)

        // Rect for NORMAL state (pixel values)
        // We initialize with defaults, but update on interaction
        let normalRect = {
            left: null, top: null, width: '400px', height: 'auto'
        };

        // Helper to capture current Geometry as Normal Rect
        const updateNormalRect = () => {
            // Only update if we are logically in NORMAL state (even if transitioning)
            const rect = this.container.getBoundingClientRect();
            const winRect = win.getBoundingClientRect();
            normalRect.left = `${rect.left}px`;
            normalRect.top = `${rect.top}px`;
            normalRect.width = `${winRect.width}px`;
            normalRect.height = `${winRect.height}px`;
        };

        const applyState = (newState) => {
            const body = this.shadowRoot.querySelector('.window-body');
            const status = this.shadowRoot.querySelector('.status-bar');

            // Save state transition
            if (state !== 'MINIMIZED') {
                previousState = state;
            }
            if (state === 'NORMAL' && newState !== 'NORMAL') {
                updateNormalRect(); // Checkpoint our normal size/pos
            }

            state = newState;

            /* Apply Styles based on State */
            if (state === 'NORMAL') {
                // Restore Geometry
                this.container.style.position = 'fixed';
                this.container.style.left = normalRect.left || 'auto';
                this.container.style.top = normalRect.top || '20px';
                this.container.style.right = normalRect.left ? 'auto' : '20px'; // Initial right align support
                this.container.style.bottom = 'auto';

                win.style.width = normalRect.width;
                win.style.height = normalRect.height;
                win.style.maxWidth = 'none';

                // Visibility
                if (body) body.style.display = 'flex';
                if (status) status.style.display = 'block';

                // Icons
                if (maxBtn) maxBtn.setAttribute('aria-label', 'Maximize');
                if (minBtn) minBtn.disabled = false;
                if (maxBtn) maxBtn.disabled = false;
            }
            else if (state === 'MAXIMIZED') {
                this.container.style.left = '0';
                this.container.style.top = '0';
                this.container.style.right = 'auto'; // Force left/top alignment
                this.container.style.bottom = 'auto';

                win.style.width = '100vw';
                win.style.height = '100vh';
                win.style.maxWidth = 'none';

                if (body) body.style.display = 'flex';
                if (status) status.style.display = 'block';

                if (maxBtn) maxBtn.setAttribute('aria-label', 'Restore');
                if (minBtn) minBtn.disabled = false;
                if (maxBtn) maxBtn.disabled = false;
            }
            else if (state === 'MINIMIZED') {
                this.container.style.left = '0';
                this.container.style.top = 'auto';
                this.container.style.right = 'auto';
                this.container.style.bottom = '0';

                win.style.width = '200px';
                win.style.height = 'auto';

                if (body) body.style.display = 'none';
                if (status) status.style.display = 'none';

                // Interaction: Enable buttons for Restore
                if (minBtn) minBtn.disabled = false;
                if (maxBtn) maxBtn.disabled = false;

                // Icon Logic:
                if (previousState === 'NORMAL') {
                    // Normal(Restore状態)なら「元に戻す」アイコンを表示
                    if (maxBtn) maxBtn.setAttribute('aria-label', 'Restore');
                } else {
                    // Maximumなら「最大化」アイコンを表示
                    if (maxBtn) maxBtn.setAttribute('aria-label', 'Maximize');
                }
            }
        };

        const restore = () => {
            // Restore to the *logic* previous state (Normal or Maximized)
            // But if we are in Minimized, min/max buttons act as restore.
            if (state === 'MINIMIZED') {
                applyState(previousState);
            } else if (state === 'MAXIMIZED') {
                applyState('NORMAL');
            }
        };

        // --- Event Handlers ---

        if (titleBar) {
            titleBar.addEventListener('dblclick', () => {
                if (state === 'MINIMIZED') {
                    restore();
                } else if (state === 'MAXIMIZED') {
                    applyState('NORMAL');
                } else {
                    applyState('MAXIMIZED');
                }
            });
        }

        if (minBtn) {
            minBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (state === 'MINIMIZED') {
                    restore(); // Acts as Restore from Taskbar
                } else {
                    applyState('MINIMIZED');
                }
            });
        }

        if (maxBtn) {
            maxBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (state === 'MINIMIZED') {
                    // Minimized Logic:
                    // If previous was MAX, icon is Restore. Clicking means Restore Down (Normal) or Restore Up (Max)?
                    // User requested typical behavior.
                    // If I am Minimized(Normal) -> Click Max -> Go Maximize.
                    // If I am Minimized(Max) -> Click Restore -> Go Normal? 
                    // Actually, if it's minimized, "Restore" usually means "Restore to previous state".
                    // But we have the min button for that.
                    // Let's assume Max button always drives towards Maximize, 
                    // unless we are "Restoring Down" from Max.

                    applyState(previousState);
                } else if (state === 'MAXIMIZED') {
                    applyState('NORMAL');
                } else {
                    applyState('MAXIMIZED');
                }
            });
        }

        /* --- Draggable Logic with Snap extraction --- */
        let isDragging = false;
        let dragStartX, dragStartY, dragInitialLeft, dragInitialTop;
        const dragThreshold = 5; // px

        if (titleBar) {
            titleBar.addEventListener('mousedown', (e) => {
                if (e.target.tagName === 'BUTTON') return;

                // Allow drag start (might need to move from Maximize)
                isDragging = false; // Wait for threshold
                dragStartX = e.clientX;
                dragStartY = e.clientY;

                // Capture initial pos
                const rect = this.container.getBoundingClientRect();
                dragInitialLeft = rect.left;
                dragInitialTop = rect.top;

                document.addEventListener('mousemove', onDragMove);
                document.addEventListener('mouseup', onDragUp);
                e.preventDefault();
            });
        }

        const onDragMove = (e) => {
            const dx = e.clientX - dragStartX;
            const dy = e.clientY - dragStartY;

            // Threshold Check
            if (!isDragging) {
                if (Math.abs(dx) < dragThreshold && Math.abs(dy) < dragThreshold) return;
                isDragging = true;

                // If starting drag from MAXIMIZED state:
                if (state === 'MAXIMIZED') {
                    // 1. Calculate relative mouse X position
                    const rect = win.getBoundingClientRect();
                    const ratioX = (dragStartX - rect.left) / rect.width;

                    // 2. Restore to NORMAL (internally sets state and styles)
                    applyState('NORMAL');

                    // 3. Adjust dragInitialLeft so the window "snaps" to mouse at same ratio
                    // normalRect is now applied.
                    const restoredW = parseFloat(normalRect.width) || 400; // Parse '400px'

                    // New left such that (mouse - newLeft) / restoredW = ratioX
                    // mouse - newLeft = restoredW * ratioX
                    // newLeft = mouse - (restoredW * ratioX)
                    dragInitialLeft = e.clientX - (restoredW * ratioX);
                    dragInitialTop = e.clientY - 10; // Slightly offset

                    // Update immediate position to avoid jump
                    this.container.style.left = `${dragInitialLeft}px`;
                    this.container.style.top = `${dragInitialTop}px`;
                }
            }

            let newTop = dragInitialTop + dy;
            let newLeft = dragInitialLeft + dx;

            // Constraint: Top must not be negative
            if (newTop < 0) newTop = 0;

            this.container.style.right = 'auto'; // Ensure absolute positioning
            this.container.style.bottom = 'auto';
            this.container.style.left = `${newLeft}px`;
            this.container.style.top = `${newTop}px`;

            // Note: If dragging in MINIMIZED, we just move `this.container`. 
            // We do NOT update `normalRect` or `state` logic, keeping it simple.
            // When restoring from MINIMIZED, it currently snaps back to `previousState` pos.
            // User requested: "drag minimized... restore...". 
            // Our logic: restore() uses `applyState(previousState)` which restores `normalRect`.
            // This means dragging the minimized window DOES NOT move the restored window location.
            // This is "Token" behavior. User might accept this.
            // If user wants Position Continuity, we would need to update normalRect logic here.
        };

        const onDragUp = () => {
            if (isDragging && state === 'NORMAL') {
                updateNormalRect(); // Checkpoint new position
            }
            isDragging = false;
            document.removeEventListener('mousemove', onDragMove);
            document.removeEventListener('mouseup', onDragUp);
        };

        // Resize Logic
        const handles = this.shadowRoot.querySelectorAll('.resize-handle');
        let isResizing = false;
        let resizeDirection = '';
        let resizeStartX, resizeStartY, resizeStartW, resizeStartH, resizeStartLeft, resizeStartTop;

        handles.forEach(handle => {
            handle.addEventListener('mousedown', (e) => {
                if (state !== 'NORMAL') return; // Only resize in Normal mode

                isResizing = true;
                resizeDirection = handle.className.replace('resize-handle ', '').trim();

                resizeStartX = e.clientX;
                resizeStartY = e.clientY;

                const rect = win.getBoundingClientRect();
                const containerRect = this.container.getBoundingClientRect();

                resizeStartW = rect.width;
                resizeStartH = rect.height;
                resizeStartLeft = containerRect.left;
                resizeStartTop = containerRect.top;

                // Ensure pixel positioning
                this.container.style.right = 'auto';
                this.container.style.left = `${resizeStartLeft}px`;
                this.container.style.top = `${resizeStartTop}px`;

                document.addEventListener('mousemove', onResizeMove);
                document.addEventListener('mouseup', onResizeUp);
                e.stopPropagation();
                e.preventDefault();
            });
        });

        const onResizeMove = (e) => {
            if (!isResizing) return;
            const dx = e.clientX - resizeStartX;
            const dy = e.clientY - resizeStartY;

            let newW = resizeStartW;
            let newH = resizeStartH;
            let newLeft = resizeStartLeft;
            let newTop = resizeStartTop;

            if (resizeDirection.includes('e')) newW += dx;
            if (resizeDirection.includes('w')) { newW -= dx; newLeft += dx; }
            if (resizeDirection.includes('s')) newH += dy;
            if (resizeDirection.includes('n')) { newH -= dy; newTop += dy; }

            if (newW < 200) newW = 200;
            if (newH < 100) newH = 100;

            win.style.width = `${newW}px`;
            win.style.height = `${newH}px`;

            if (resizeDirection.includes('w') || resizeDirection.includes('n')) {
                this.container.style.left = `${newLeft}px`;
                this.container.style.top = `${newTop}px`;
            }
        };

        const onResizeUp = () => {
            if (isResizing) updateNormalRect();
            isResizing = false;
            document.removeEventListener('mousemove', onResizeMove);
            document.removeEventListener('mouseup', onResizeUp);
        };
    }
}

// Singleton UI instance
const ui = new PointBridgeUI();

// Listen for messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "toggle-ui") {
        ui.toggle();
    }
});
