document.addEventListener('DOMContentLoaded', async () => {
    const gasUrlInput = document.getElementById('gasUrl');
    const saveBtn = document.getElementById('saveBtn');
    const status = document.getElementById('status');

    // Load saved URL
    const { gasUrl } = await chrome.storage.local.get('gasUrl');
    if (gasUrl) {
        gasUrlInput.value = gasUrl;
    }

    // Save URL
    saveBtn.addEventListener('click', async () => {
        const url = gasUrlInput.value.trim();

        if (!url) {
            status.textContent = "URLのインプットがリクワイアされています.";
            status.style.color = "var(--danger-color)";
            return;
        }

        if (!url.startsWith('https://script.google.com/')) {
            showStatus("ウォーニング: ターゲットURLがGASではないポッシビリティがあります.", "var(--danger-color)");
            // Allow saving anyway but warn
        }

        try {
            await chrome.storage.local.set({ gasUrl: url });
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
