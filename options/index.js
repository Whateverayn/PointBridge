document.addEventListener('DOMContentLoaded', async () => {
    const gasUrlInput = document.getElementById('gasUrl');
    const saveBtn = document.getElementById('saveBtn');
    const status = document.getElementById('status');

    const autoSendCheckbox = document.getElementById('autoSend');

    // Load saved settings
    const { gasUrl, autoSend } = await chrome.storage.local.get(['gasUrl', 'autoSend']);
    if (gasUrl) {
        gasUrlInput.value = gasUrl;
    }
    if (autoSend) {
        autoSendCheckbox.checked = autoSend;
    }

    // Save settings
    saveBtn.addEventListener('click', async () => {
        const url = gasUrlInput.value.trim();
        const isAutoSend = autoSendCheckbox.checked;

        if (!url) {
            showStatus("URLのインプットがリクワイアされています.", "var(--danger-color)");
            status.style.color = "var(--danger-color)";
            return;
        }

        if (!url.startsWith('https://script.google.com/')) {
            showStatus("ウォーニング: ターゲットURLがGASではないポッシビリティがあります.", "var(--danger-color)");
            // Allow saving anyway but warn
        }

        try {
            await chrome.storage.local.set({
                gasUrl: url,
                autoSend: isAutoSend
            });
            showStatus("コンフィグレーションのセーブは完了されました.", "var(--success-color)");
        } catch (e) {
            showStatus("セーブ・プロセス中に, アンエクスペクテッド・エラーがオカーしました.", "var(--danger-color)");
            console.error(e);
        }
    });

    function showStatus(text, color) {
        status.textContent = text;
        status.style.color = color || "var(--text-color)";
        setTimeout(() => {
            status.textContent = 'レディ';
        }, 3000);
    }
});
