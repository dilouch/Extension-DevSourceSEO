// Module de configuration des raccourcis clavier dans l'onglet Paramètres
(() => {
    let ctx = null;

    const renderShortcutConfig = () => {
        const container = document.getElementById('shortcut-config-container');
        if (!container) return;

        chrome.storage.local.get(['v2.settings.captureShortcut'], (result) => {
            const shortcut = result['v2.settings.captureShortcut'] || { ctrl: true, shift: true, key: 'x' };

            const html = `
                <div class="shortcut-section">
                    <div class="card">
                        <div class="card-header">
                            <h3>⌨️ Raccourci clavier personnalisé</h3>
                        </div>
                        <p class="panel-note" style="margin-bottom:12px;">Configure la touche pour ouvrir rapidement la capture d'écran.</p>

                        <div class="shortcut-config" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin-bottom:12px;">
                            <label class="shortcut-modifier" style="display:flex;align-items:center;gap:6px;padding:8px;border:1px solid var(--border);border-radius:4px;cursor:pointer;">
                                <input type="checkbox" id="shortcut-ctrl" ${shortcut.ctrl ? 'checked' : ''} style="width:16px;height:16px;cursor:pointer;">
                                <span style="font-size:12px;font-weight:500;">Ctrl</span>
                            </label>
                            <label class="shortcut-modifier" style="display:flex;align-items:center;gap:6px;padding:8px;border:1px solid var(--border);border-radius:4px;cursor:pointer;">
                                <input type="checkbox" id="shortcut-shift" ${shortcut.shift ? 'checked' : ''} style="width:16px;height:16px;cursor:pointer;">
                                <span style="font-size:12px;font-weight:500;">Shift</span>
                            </label>
                            <label class="shortcut-modifier" style="display:flex;align-items:center;gap:6px;padding:8px;border:1px solid var(--border);border-radius:4px;cursor:pointer;">
                                <input type="checkbox" id="shortcut-alt" ${shortcut.alt ? 'checked' : ''} style="width:16px;height:16px;cursor:pointer;">
                                <span style="font-size:12px;font-weight:500;">Alt</span>
                            </label>
                            <label class="shortcut-modifier" style="display:flex;align-items:center;gap:6px;padding:8px;border:1px solid var(--border);border-radius:4px;cursor:pointer;">
                                <input type="checkbox" id="shortcut-meta" ${shortcut.meta ? 'checked' : ''} style="width:16px;height:16px;cursor:pointer;">
                                <span style="font-size:12px;font-weight:500;">Meta</span>
                            </label>
                        </div>

                        <div style="margin-bottom:12px;">
                            <label style="display:block;font-weight:bold;font-size:12px;margin-bottom:4px;">Touche:</label>
                            <input type="text" id="shortcut-key" maxlength="1" value="${shortcut.key.toUpperCase()}" placeholder="X" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:4px;font-size:14px;text-align:center;text-transform:uppercase;" />
                            <p style="font-size:11px;color:var(--text-secondary);margin-top:4px;">Une lettre ou un chiffre</p>
                        </div>

                        <div style="display:flex;gap:8px;margin-bottom:12px;">
                            <button id="btn-save-shortcut" class="btn btn-primary" style="flex:1;">💾 Enregistrer</button>
                            <button id="btn-reset-shortcut" class="btn btn-secondary" style="flex:1;">↺ Réinitialiser</button>
                        </div>

                        <div id="shortcut-preview" style="padding:8px;background:var(--bg-secondary);border-radius:4px;font-size:12px;font-family:monospace;text-align:center;color:var(--text-secondary);">
                            Aperçu: <strong id="shortcut-display">Ctrl + Shift + X</strong>
                        </div>
                    </div>
                </div>
            `;

            container.innerHTML = html;

            // Binding
            const displayEl = document.getElementById('shortcut-display');
            const updateDisplay = () => {
                const mods = [];
                if (document.getElementById('shortcut-ctrl').checked) mods.push('Ctrl');
                if (document.getElementById('shortcut-shift').checked) mods.push('Shift');
                if (document.getElementById('shortcut-alt').checked) mods.push('Alt');
                if (document.getElementById('shortcut-meta').checked) {
                    const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform);
                    mods.push(isMac ? 'Cmd' : 'Meta');
                }
                const key = String(document.getElementById('shortcut-key').value || 'X').toUpperCase();
                displayEl.textContent = mods.length ? `${mods.join(' + ')} + ${key}` : key;
            };

            document.getElementById('shortcut-ctrl')?.addEventListener('change', updateDisplay);
            document.getElementById('shortcut-shift')?.addEventListener('change', updateDisplay);
            document.getElementById('shortcut-alt')?.addEventListener('change', updateDisplay);
            document.getElementById('shortcut-meta')?.addEventListener('change', updateDisplay);
            document.getElementById('shortcut-key')?.addEventListener('input', updateDisplay);

            document.getElementById('btn-save-shortcut')?.addEventListener('click', () => {
                const newShortcut = {
                    ctrl: Boolean(document.getElementById('shortcut-ctrl').checked),
                    shift: Boolean(document.getElementById('shortcut-shift').checked),
                    alt: Boolean(document.getElementById('shortcut-alt').checked),
                    meta: Boolean(document.getElementById('shortcut-meta').checked),
                    key: String(document.getElementById('shortcut-key').value || 'X').toLowerCase()
                };

                chrome.storage.local.set({ 'v2.settings.captureShortcut': newShortcut }, () => {
                    ctx.setStatus('✓ Raccourci sauvegardé');
                    // Notifier les content scripts
                    chrome.tabs.query({}, (tabs) => {
                        tabs.forEach(tab => {
                            chrome.tabs.sendMessage(tab.id, {
                                type: 'UPDATE_SHORTCUT',
                                shortcut: newShortcut
                            }).catch(() => {});
                        });
                    });
                });
            });

            document.getElementById('btn-reset-shortcut')?.addEventListener('click', () => {
                const defaultShortcut = { ctrl: true, shift: true, key: 'x' };
                chrome.storage.local.set({ 'v2.settings.captureShortcut': defaultShortcut }, () => {
                    ctx.setStatus('↺ Raccourci réinitialisé');
                    renderShortcutConfig();
                });
            });
        });
    };

    function init(context) {
        ctx = context;
        setTimeout(renderShortcutConfig, 100);
    }

    globalThis.PopupShortcutsV2 = Object.freeze({ init, renderShortcutConfig });
})();
