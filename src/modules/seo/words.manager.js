const WordToolsManager = {
    // Liste des mots à ignorer pour le Laboratoire
    stopWords: new Set(['le', 'la', 'les', 'de', 'du', 'des', 'un', 'une', 'et', 'est', 'en', 'que', 'qui', 'dans', 'pour', 'sur', 'par', 'avec', 'sans', 'ce', 'ces', 'son', 'sa', 'ses', 'a', 'à', 'the', 'of', 'and', 'to', 'in', 'is', 'you', 'that', 'it', 'he', 'was', 'for', 'on', 'are', 'as', 'with', 'his', 'they', 'I', 'at', 'be', 'this', 'have', 'from', 'je', 'tu', 'nous', 'vous', 'il', 'elle', 'ils', 'elles', 'mais', 'ou', 'donc', 'car', 'pas', 'plus', 'ne', 'se', 'au', 'aux', 'cette', 'cet', 'mon', 'ton', 'notre', 'votre', 'leur', 'leurs', 'comme', 'si', 'tout', 'tous', 'toute', 'toutes']),
    
    init: function() {
        const container = document.getElementById('tab-words');
        if (!container) return;

        // On vide le conteneur et on prépare les deux sections
        container.innerHTML = `
            <div id="words-top-section"></div>
            <div id="words-lab-section" style="margin-top:25px;"></div>
        `;

        this.renderLabInterface(document.getElementById('words-lab-section'));
        this.attachLabListeners();
        
        // Si des données existent déjà, on les affiche
        if (window.lastData) {
            this.renderTopWords(window.lastData);
            if (window.lastData.textContent) {
                const textarea = document.getElementById('wt-input');
                if (textarea) textarea.value = window.lastData.textContent;
                this.analyzeGlobal(window.lastData.textContent);
            }
        }
    },

    // --- TON CODE D'ORIGINE (PARTIE HAUT) ---
    renderTopWords: function(data) {
        const topSection = document.getElementById('words-top-section');
        if (!topSection) return;

        const esc = (str) => String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[m]));
        const words = Array.isArray(data.words) ? data.words : [];
        const topWords = words.slice(0, 30);

        const grid = topWords.length
            ? `<div class="words-frequent-grid">${topWords.map((item) => `
                <div class="words-frequent-item" title="${esc(item.word)} (${Number(item.count || 0)})">
                    <span class="words-frequent-text">${esc(item.word)}</span>
                    <span class="words-frequent-count">${Number(item.count || 0)}</span>
                </div>
            `).join('')}</div>`
            : '<div class="hint">Pas assez de contenu texte.</div>';

        const totalWords = Number(data.wordCount || 0);
        topSection.innerHTML = `
            <div class="words-frequent-panel">
                <div class="words-frequent-head">
                    <h3>Mots Fréquents</h3>
                    <div class="btn-row">
                        <button id="words-copy-btn" class="btn btn-secondary">📋 Copier</button>
                        <button id="words-export-btn" class="btn btn-secondary">📊 CSV</button>
                    </div>
                </div>
                ${grid}
                <div class="words-total" style="margin-top:14px; padding:10px 14px; background:var(--color-bg-soft, #f0f3f1); border-radius:8px; display:flex; justify-content:space-between; align-items:center; font-size:13px;">
                    <strong>Total de mots sur la page</strong>
                    <span style="font-size:18px; font-weight:800; color:var(--color-accent, #12272B);">${totalWords.toLocaleString('fr-FR')}</span>
                </div>
            </div>
        `;

        // Listeners pour Copier / CSV
        topSection.querySelector('#words-copy-btn')?.addEventListener('click', async () => {
            const text = topWords.map((item, idx) => `${idx + 1}. ${item.word} (${Number(item.count || 0)})`).join('\n');
            navigator.clipboard.writeText(text);
        });

        topSection.querySelector('#words-export-btn')?.addEventListener('click', () => {
            const csv = ['"#","Mot","Occurrences"', ...topWords.map((item, idx) => `"${idx + 1}","${String(item.word || '').replace(/"/g, '""')}","${Number(item.count || 0)}"`)].join('\n');
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = 'mots-cles.csv'; a.click();
        });
    },

    // --- LE LABORATOIRE (PARTIE BAS) ---
    renderLabInterface: function(container) {
        const css = `
            <style>
                .wt-section { background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 15px; font-family: 'DM Sans', sans-serif; }
                .wt-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 2px solid #f1fd0d; padding-bottom: 5px; }
                .wt-title { font-size: 14px; font-weight: 700; text-transform: uppercase; margin: 0; color: #12272b; }
                .wt-textarea { width: 100%; height: 120px; padding: 10px; border: 1px solid #1a3638; border-radius: 6px; font-size: 13px; margin-bottom: 15px; box-sizing: border-box; }
                .wt-stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 15px; }
                .wt-stat-box { background: #f4f7f6; padding: 8px; border-radius: 6px; text-align: center; border: 1px solid #eee; }
                .wt-stat-val { font-size: 16px; font-weight: 700; color: #12272b; display: block; }
                .wt-stat-lbl { font-size: 9px; color: #666; text-transform: uppercase; }
                .wt-extra-infos { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
                .wt-info-card { background: #fff; border: 1px solid #abd8d8; padding: 8px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; font-size: 12px; }
            </style>
        `;
        container.innerHTML = css + `
            <div class="wt-section">
                <div class="wt-header"><h3 class="wt-title">🧪 Laboratoire & Contacts</h3></div>
                <textarea id="wt-input" class="wt-textarea" placeholder="Analysez un texte ici..."></textarea>
                <div class="wt-stats-grid">
                    <div class="wt-stat-box"><span class="wt-stat-val" id="wt-words">0</span><span class="wt-stat-lbl">Mots</span></div>
                    <div class="wt-stat-box"><span class="wt-stat-val" id="wt-chars">0</span><span class="wt-stat-lbl">Caract.</span></div>
                    <div class="wt-stat-box"><span class="wt-stat-val" id="wt-sentences">0</span><span class="wt-stat-lbl">Phrases</span></div>
                    <div class="wt-stat-box"><span class="wt-stat-val" id="wt-time">0m</span><span class="wt-stat-lbl">Lecture</span></div>
                </div>
                <div class="wt-extra-infos">
                    <div class="wt-info-card"><span>📧 Emails</span><strong id="wt-email-count">0</strong></div>
                    <div class="wt-info-card"><span>📞 Tél</span><strong id="wt-phone-count">0</strong></div>
                </div>
            </div>
        `;
    },

    attachLabListeners: function() {
        const textarea = document.getElementById('wt-input');
        textarea?.addEventListener('input', () => this.analyzeGlobal(textarea.value));
    },

    analyzeGlobal: function(text) {
        if (!text) text = '';
        const words = text.match(/\S+/g) || [];
        document.getElementById('wt-words').textContent = words.length;
        document.getElementById('wt-chars').textContent = text.length;
        document.getElementById('wt-sentences').textContent = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
        document.getElementById('wt-time').textContent = Math.ceil(words.length / 200) + ' min';
        document.getElementById('wt-email-count').textContent = (text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi) || []).length;
        document.getElementById('wt-phone-count').textContent = (text.match(/(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}/g) || []).length;
    }
};