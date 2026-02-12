document.addEventListener('DOMContentLoaded', async () => {
    const gasUrlInput = document.getElementById('gasUrl');
    const saveBtn = document.getElementById('saveBtn');
    const status = document.getElementById('status');

    const autoSendCheckbox = document.getElementById('autoSend');
    const includePontaManagementCheckbox = document.getElementById('includePontaManagement');
    const includeVPointInvestmentCheckbox = document.getElementById('includeVPointInvestment');

    // Load saved settings
    const storedData = await chrome.storage.local.get(['gasUrl', 'autoSend', 'includePontaManagement', 'includeVPointInvestment']);
    const initialSettings = {
        gasUrl: storedData.gasUrl || '',
        autoSend: !!storedData.autoSend,
        includePontaManagement: !!storedData.includePontaManagement,
        includeVPointInvestment: !!storedData.includeVPointInvestment
    };

    if (initialSettings.gasUrl) {
        gasUrlInput.value = initialSettings.gasUrl;
    }
    autoSendCheckbox.checked = initialSettings.autoSend;
    includePontaManagementCheckbox.checked = initialSettings.includePontaManagement;
    includeVPointInvestmentCheckbox.checked = initialSettings.includeVPointInvestment;

    // Check for changes
    function updateButtonState() {
        const currentGasUrl = gasUrlInput.value.trim();
        const currentAutoSend = autoSendCheckbox.checked;
        const currentIncludePontaManagement = includePontaManagementCheckbox.checked;
        const currentIncludeVPointInvestment = includeVPointInvestmentCheckbox.checked;

        const hasChanges = (currentGasUrl !== initialSettings.gasUrl) ||
            (currentAutoSend !== initialSettings.autoSend) ||
            (currentIncludePontaManagement !== initialSettings.includePontaManagement) ||
            (currentIncludeVPointInvestment !== initialSettings.includeVPointInvestment);

        saveBtn.disabled = !hasChanges;

        if (hasChanges) {
            status.textContent = "アンセーブド・チェンジがあります. セーブ・プリーズ.";
            status.style.color = "blue";
        } else {
            status.textContent = "レディ";
            status.style.color = "var(--text-color)";
        }
    }

    gasUrlInput.addEventListener('input', updateButtonState);
    autoSendCheckbox.addEventListener('change', updateButtonState);
    includePontaManagementCheckbox.addEventListener('change', updateButtonState);
    includeVPointInvestmentCheckbox.addEventListener('change', updateButtonState);

    // Save settings
    saveBtn.addEventListener('click', async () => {
        const url = gasUrlInput.value.trim();
        const isAutoSend = autoSendCheckbox.checked;
        const isIncludePontaManagement = includePontaManagementCheckbox.checked;
        const isIncludeVPointInvestment = includeVPointInvestmentCheckbox.checked;

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
                autoSend: isAutoSend,
                includePontaManagement: isIncludePontaManagement,
                includeVPointInvestment: isIncludeVPointInvestment
            });

            // Update initial settings on save
            initialSettings.gasUrl = url;
            initialSettings.autoSend = isAutoSend;
            initialSettings.includePontaManagement = isIncludePontaManagement;
            initialSettings.includeVPointInvestment = isIncludeVPointInvestment;
            updateButtonState();

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
