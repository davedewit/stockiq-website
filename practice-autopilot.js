// AI autopilot for the practice portfolio (dashboard). FAKE MONEY ONLY: no real trade is ever placed.
// This file is only the controls and the activity list. The decisions are made by the stockiq-ai-trader
// Lambda on a schedule (or "Check in now"), which writes its practice buys and sells into the same
// practice portfolio that practice-portfolio.js shows. Shown only to users that Lambda allows.
(function () {
    const API = 'https://qy6s553i647agmxthtecc24fje0zskms.lambda-url.us-east-1.on.aws/';
    const BTN = 'background: #007bff; color: #fff; border: none; border-radius: 6px; padding: 8px 14px; font-size: 0.9rem; cursor: pointer; white-space: nowrap;';
    const BTN2 = 'background: none; color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 6px; padding: 8px 14px; font-size: 0.9rem; cursor: pointer; white-space: nowrap;';
    const FIELD = 'padding: 8px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); font-size: 16px;';

    let data = null, draft = null, working = '', notice = null, showAll = false;
    const userId = () => { const u = localStorage.getItem('userId'); return u && u !== 'anonymous' ? u : null; };
    const box = () => document.getElementById('practice-autopilot');
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const usd0 = (n) => '$' + Math.round(n).toLocaleString('en-US');
    const when = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); };

    async function api(action, extra) {
        const res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ action, userId: userId() }, extra || {})) });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || 'The autopilot could not be reached');
        return body;
    }

    // What a risk level means, in words, from the numbers the Lambda sends
    function riskText(level) {
        const r = data.options.risk[String(level)];
        if (!r) return '';
        return `${r.name}: spreads the budget over up to ${r.positions} holdings, looks at the top ${r.top} of each screener, sells a holding at ${r.stop}% or +${r.take}%`
            + (r.crypto > 0 ? `, up to ${Math.round(r.crypto * 100)}% of the budget in coins.` : ', no coins.');
    }
    function statusText() {
        const s = data.settings, last = data.state && data.state.lastRun;
        if (!s.enabled) return 'Off. Nothing is bought or sold automatically.';
        const stocks = s.screeners.some(k => (data.options.screeners[k] || {}).kind === 'stock');
        const next = last ? new Date(new Date(last).getTime() + s.everyHours * 3600000) : null;
        return 'On. ' + (last ? `Last check-in ${when(last)}; next from about ${when(next)}.` : 'First check-in at the next hourly check.')
            + (stocks ? ' Stock screeners are checked on weekdays during US market hours.' : '');
    }

    function render() {
        const el = box();
        if (!el) return;
        if (!data || !data.allowed) { el.innerHTML = ''; return; }
        const d = draft, o = data.options;
        const select = (id, list, value, label) => `<select id="${id}" style="${FIELD}">${list.map(v => `<option value="${v}" ${v === value ? 'selected' : ''}>${label(v)}</option>`).join('')}</select>`;
        const icons = { buy: '🟢', sell: '🔴', note: 'ℹ️' };
        const log = (data.log || []).slice().reverse();
        const shown = showAll ? log : log.slice(0, 8);
        const dirty = JSON.stringify(draft) !== JSON.stringify(data.settings);
        el.innerHTML = `
            <div style="margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--border-color);">
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap;">
                    <h3 style="margin: 0; color: var(--text-primary); font-size: 1.1rem;">🤖 AI autopilot <span style="font-size: 0.7em; font-weight: normal; color: var(--text-secondary);">fake money, an experiment to watch</span></h3>
                    <label style="display: flex; align-items: center; gap: 8px; color: var(--text-primary); cursor: pointer;"><input id="ap-enabled" type="checkbox" ${d.enabled ? 'checked' : ''} style="width: 18px; height: 18px;"> Switched on</label>
                </div>
                <p style="color: var(--text-secondary); font-size: 0.85rem; margin: 8px 0 12px;">An AI model makes practice buys and sells for you from the latest results of the screeners you choose, inside the limits you set here. It uses the practice portfolio above. Nothing here is advice, and past screener results have not shown a reliable edge.</p>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px 20px; color: var(--text-primary); font-size: 0.9rem;">
                    <div style="grid-column: 1 / -1;">
                        <div style="display: flex; justify-content: space-between;"><strong>Risk level</strong><span style="color: var(--text-secondary); font-size: 0.8rem;">Cautious ← → Adventurous</span></div>
                        <input id="ap-risk" type="range" min="1" max="5" step="1" value="${d.risk}" style="width: 100%;">
                        <div id="ap-risk-text" style="color: var(--text-secondary); font-size: 0.85rem;">${esc(riskText(d.risk))}</div>
                    </div>
                    <div><strong>Budget for the AI</strong><div style="display: flex; align-items: center; gap: 6px; margin-top: 4px;">$ <input id="ap-budget" type="number" min="100" step="500" value="${d.budgetUsd}" style="${FIELD} width: 110px;"> spread over <input id="ap-period" type="number" min="1" max="90" step="1" value="${d.periodDays}" style="${FIELD} width: 64px;"> days</div></div>
                    <div><strong>Checks in</strong><div style="margin-top: 4px;">${select('ap-every', o.everyHours, d.everyHours, v => v === 24 ? 'once a day' : v === 12 ? 'twice a day' : `every ${v} hours`)}</div></div>
                    <div><strong>Keeps a holding at most</strong><div style="margin-top: 4px;">${select('ap-hold', o.holdDays, d.maxHoldDays, v => `${v} days`)}</div></div>
                    <div style="grid-column: 1 / -1;"><strong>Screeners it buys from</strong>
                        <div style="display: flex; gap: 6px 16px; flex-wrap: wrap; margin-top: 4px;">${Object.keys(o.screeners).map(k => `<label style="cursor: pointer; white-space: nowrap;"><input type="checkbox" data-ap-screener="${esc(k)}" ${d.screeners.includes(k) ? 'checked' : ''}> ${esc(o.screeners[k].name)}</label>`).join('')}</div>
                    </div>
                </div>
                <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-top: 14px;">
                    <button data-ap="save" style="${dirty ? BTN : BTN2}" ${working ? 'disabled' : ''}>${working === 'save' ? 'Saving…' : 'Save settings'}</button>
                    <button data-ap="run" style="${BTN2}" ${working || !data.settings.enabled ? 'disabled' : ''} title="${data.settings.enabled ? 'Runs one check-in now instead of waiting for the next one' : 'Switch it on and save first'}">${working === 'run' ? 'Checking in… (about 30 seconds)' : 'Check in now'}</button>
                    <span id="ap-status" style="color: var(--text-secondary); font-size: 0.85rem;">${esc(statusText())}</span>
                </div>
                <div id="ap-notice" style="min-height: 1.2em; font-size: 0.85rem; margin-top: 6px; color: ${notice && notice.bad ? '#ef4444' : 'var(--text-secondary)'};">${notice ? esc(notice.text) : ''}</div>
                ${log.length ? `<div style="margin-top: 10px;"><strong style="color: var(--text-primary); font-size: 0.9rem;">What it has done</strong>
                    ${shown.map(e => `<div style="padding: 7px 0; border-bottom: 1px solid var(--border-color); font-size: 0.85rem; color: var(--text-secondary);"><span style="white-space: nowrap;">${icons[e.type] || ''} ${esc(when(e.t))}</span> ${e.type === 'buy' ? `<strong style="color: var(--text-primary);">Bought ${esc(e.symbol)}</strong> with ${usd0(e.usd)}. ` : e.type === 'sell' ? `<strong style="color: var(--text-primary);">Sold ${esc(e.symbol)}</strong>. ` : ''}${esc(e.text)}</div>`).join('')}
                    ${log.length > shown.length ? `<a href="#" data-ap="more" style="font-size: 0.85rem;">Show all ${log.length}</a>` : ''}</div>` : ''}
            </div>`;
    }

    function readDraft() {
        const v = (id) => document.getElementById(id);
        if (!v('ap-risk')) return;
        draft = {
            enabled: !!v('ap-enabled').checked, risk: parseInt(v('ap-risk').value, 10) || 3,
            budgetUsd: parseFloat(v('ap-budget').value) || 0, periodDays: parseInt(v('ap-period').value, 10) || 1,
            everyHours: parseInt(v('ap-every').value, 10), maxHoldDays: parseInt(v('ap-hold').value, 10),
            screeners: Array.from(document.querySelectorAll('[data-ap-screener]')).filter(c => c.checked).map(c => c.getAttribute('data-ap-screener')).sort()
        };
    }
    function take(result) { data = result; draft = JSON.parse(JSON.stringify(result.settings)); }

    async function load() {
        if (!userId() || !box()) return;
        try { const r = await api('get'); if (r.allowed) take(r); else data = r; } catch (e) { data = null; }
        render();
    }
    async function act(kind, task) {
        if (working) return;
        readDraft(); working = kind; notice = null; render();
        try { await task(); } catch (e) { notice = { text: e.message, bad: true }; }
        working = ''; render();
    }

    document.addEventListener('click', (e) => {
        const t = e.target.closest && e.target.closest('[data-ap]');
        if (!t || !data) return;
        if (t.tagName === 'A') e.preventDefault();
        const action = t.getAttribute('data-ap');
        if (action === 'more') { readDraft(); showAll = true; render(); }
        else if (action === 'save') {
            act('save', async () => {
                if (!draft.screeners.length) throw new Error('Choose at least one screener');
                if (!(draft.budgetUsd >= 100)) throw new Error('The budget must be at least $100');
                const turningOn = draft.enabled && !data.settings.enabled;
                take(await api('save', { settings: draft }));
                notice = { text: turningOn ? 'Autopilot switched on. Press "Check in now" to see its first choices, or wait for the next check-in.' : 'Settings saved.' };
            });
        } else if (action === 'run') {
            act('run', async () => {
                const r = await api('run');
                take(r);
                const s = r.summary || {};
                notice = { text: s.conflict ? 'The portfolio was being changed at the same time, so nothing was traded. Try again.' : `Checked in: ${s.bought || 0} bought, ${s.sold || 0} sold. Details are listed below.` };
                if (window.practicePortfolio && window.practicePortfolio.reload) window.practicePortfolio.reload();
            });
        }
    });
    document.addEventListener('input', (e) => {
        if (!e.target || !data || !data.allowed) return;
        if (e.target.id === 'ap-risk') { const line = document.getElementById('ap-risk-text'); if (line) line.textContent = riskText(parseInt(e.target.value, 10)); }
    });

    window.practiceAutopilot = { reload: load };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load); else load();
})();
