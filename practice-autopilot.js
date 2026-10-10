// AI autopilot for the practice portfolio (dashboard). FAKE MONEY ONLY: no real trade is ever placed.
// This file is only the controls and what the autopilot reports. The decisions are made by the stockiq-ai-trader
// Lambda on a schedule (or "Check in now"), which writes its practice buys and sells into the same practice
// portfolio that practice-portfolio.js shows. Shown only to users that Lambda allows.
// How the controls behave: the On/Off switch saves straight away; every other change waits for "Save changes"
// (the button turns blue and says so), because changing the budget restarts how it is spread over the days.
(function () {
    const API = 'https://qy6s553i647agmxthtecc24fje0zskms.lambda-url.us-east-1.on.aws/';
    const CSS = `
        #practice-autopilot .ap-wrap { margin-top: 20px; padding-top: 18px; border-top: 1px solid var(--border-color); color: var(--text-primary); font-size: 0.9rem; }
        #practice-autopilot .ap-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
        #practice-autopilot .ap-head h3 { margin: 0; font-size: 1.15rem; color: var(--text-primary); }
        #practice-autopilot .ap-sub { font-size: 0.8rem; font-weight: normal; color: var(--text-secondary); }
        #practice-autopilot .ap-switch { display: inline-flex; align-items: center; gap: 10px; cursor: pointer; font-weight: 600; position: relative; }
        #practice-autopilot .ap-switch input { position: absolute; opacity: 0; width: 46px; height: 26px; margin: 0; cursor: pointer; right: 0; }
        #practice-autopilot .ap-track { width: 46px; height: 26px; border-radius: 13px; background: #9ca3af; position: relative; transition: background 0.15s; flex: none; }
        #practice-autopilot .ap-track::after { content: ''; position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.3); transition: left 0.15s; }
        #practice-autopilot .ap-switch input:checked + .ap-track { background: #22c55e; }
        #practice-autopilot .ap-switch input:checked + .ap-track::after { left: 23px; }
        #practice-autopilot .ap-switch input:focus-visible + .ap-track { outline: 2px solid #007bff; outline-offset: 2px; }
        #practice-autopilot .ap-intro { color: var(--text-secondary); font-size: 0.85rem; line-height: 1.5; margin: 8px 0 0; }
        #practice-autopilot .ap-status { margin-top: 12px; padding: 10px 12px; border-radius: 8px; background: var(--bg-secondary); border-left: 4px solid #9ca3af; color: var(--text-secondary); font-size: 0.85rem; line-height: 1.55; }
        #practice-autopilot .ap-status.on { border-left-color: #22c55e; }
        #practice-autopilot .ap-status strong { color: var(--text-primary); }
        #practice-autopilot .ap-card { border: 1px solid var(--border-color); border-radius: 8px; padding: 14px 16px; margin-top: 12px; }
        #practice-autopilot .ap-label { font-weight: 600; display: block; margin-bottom: 6px; color: var(--text-primary); }
        #practice-autopilot .ap-help { color: var(--text-secondary); font-size: 0.82rem; line-height: 1.45; margin-top: 6px; }
        #practice-autopilot .ap-risk { width: 100%; margin: 0; accent-color: #007bff; }
        #practice-autopilot .ap-levels { display: flex; font-size: 0.78rem; color: var(--text-secondary); margin-top: 2px; }
        #practice-autopilot .ap-levels span { flex: 1; text-align: center; cursor: pointer; padding: 2px 0; }
        #practice-autopilot .ap-levels span:first-child { text-align: left; }
        #practice-autopilot .ap-levels span:last-child { text-align: right; }
        #practice-autopilot .ap-levels span.now { color: var(--text-primary); font-weight: 700; }
        #practice-autopilot .ap-fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 14px 18px; }
        #practice-autopilot .ap-input { display: flex; align-items: center; gap: 8px; color: var(--text-secondary); white-space: nowrap; }
        #practice-autopilot .ap-input input, #practice-autopilot .ap-input select { flex: 1; min-width: 0; width: 100%; box-sizing: border-box; padding: 9px 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); font-size: 16px; }
        #practice-autopilot .ap-group { display: grid; grid-template-columns: 150px 1fr; gap: 6px 12px; align-items: start; padding: 9px 0; border-top: 1px solid var(--border-color); }
        #practice-autopilot .ap-group.first { border-top: none; padding-top: 2px; }
        #practice-autopilot .ap-group-name { color: var(--text-secondary); padding-top: 6px; }
        #practice-autopilot .ap-chips { display: flex; flex-wrap: wrap; gap: 6px 8px; }
        #practice-autopilot .ap-chip { display: inline-flex; align-items: center; gap: 6px; padding: 5px 11px; border: 1px solid var(--border-color); border-radius: 16px; cursor: pointer; white-space: nowrap; user-select: none; color: var(--text-primary); }
        #practice-autopilot .ap-chip:has(input:checked) { border-color: #007bff; background: rgba(0, 123, 255, 0.12); }
        #practice-autopilot .ap-chip input { margin: 0; }
        #practice-autopilot .ap-chip small { color: var(--text-secondary); }
        #practice-autopilot .ap-actions { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin-top: 14px; }
        #practice-autopilot .ap-btn { border-radius: 6px; padding: 9px 16px; font-size: 0.9rem; cursor: pointer; white-space: nowrap; border: 1px solid var(--border-color); background: none; color: var(--text-primary); }
        #practice-autopilot .ap-btn.primary { background: #007bff; border-color: #007bff; color: #fff; }
        #practice-autopilot .ap-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        #practice-autopilot .ap-dirty { color: #d97706; font-size: 0.85rem; }
        #practice-autopilot .ap-note { margin-top: 10px; padding: 9px 12px; border-radius: 6px; font-size: 0.85rem; color: var(--text-primary); }
        #practice-autopilot .ap-note.good { background: rgba(34, 197, 94, 0.12); border: 1px solid rgba(34, 197, 94, 0.4); }
        #practice-autopilot .ap-note.bad { background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.4); }
        #practice-autopilot .ap-section { margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--border-color); font-size: 0.85rem; color: var(--text-secondary); }
        #practice-autopilot .ap-section h4 { margin: 0 0 6px; font-size: 0.95rem; color: var(--text-primary); }
        #practice-autopilot .ap-log { padding: 8px 0; border-bottom: 1px solid var(--border-color); line-height: 1.45; }
        #practice-autopilot .ap-log time { white-space: nowrap; margin-right: 6px; }
        @media (max-width: 640px) { #practice-autopilot .ap-group { grid-template-columns: 1fr; } #practice-autopilot .ap-group-name { padding-top: 0; } #practice-autopilot .ap-chip { white-space: normal; } #practice-autopilot .ap-input { white-space: normal; } }
    `;

    let data = null, draft = null, working = '', notice = null, showAll = false;
    const userId = () => { const u = localStorage.getItem('userId'); return u && u !== 'anonymous' ? u : null; };
    const box = () => document.getElementById('practice-autopilot');
    const byId = (id) => document.getElementById(id);
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const usd0 = (n) => '$' + Math.round(n).toLocaleString('en-US');
    const when = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); };
    const day = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); };
    const pc = (n) => (n === null || n === undefined) ? '–' : (n >= 0 ? '+' : '') + n.toFixed(1) + '%';
    const tint = (n) => (n === null || n === undefined) ? 'var(--text-secondary)' : n >= 0 ? '#22c55e' : '#ef4444';
    const everyText = (v) => v === 24 ? 'once a day' : v === 12 ? 'twice a day' : `every ${v} hours`;
    const isDirty = () => !!data && !!draft && JSON.stringify(draft) !== JSON.stringify(data.settings);

    function ensureStyle() {
        if (!document.head || !document.createElement || byId('ap-style')) return;
        const style = document.createElement('style');
        style.id = 'ap-style'; style.textContent = CSS;
        document.head.appendChild(style);
    }

    async function api(action, extra) {
        const res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ action, userId: userId() }, extra || {})) });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || 'The autopilot could not be reached');
        return body;
    }

    // ---------------------------------------------------------------- wording, from the numbers the Lambda sends
    function riskText(level) {
        const r = data.options.risk[String(level)];
        if (!r) return '';
        return `${r.name}: spreads the budget over up to ${r.positions} holdings, looks at the top ${r.top} of each screener, sells a holding at ${r.stop}% or +${r.take}%`
            + (r.crypto > 0 ? `, up to ${Math.round(r.crypto * 100)}% of the budget in coins.` : ', no coins.');
    }
    // What the budget settings mean in practice
    function planText(d) {
        const r = data.options.risk[String(d.risk)];
        if (!r || !(d.budgetUsd > 0) || !(d.periodDays > 0)) return '';
        const cash = data.practiceCash || 100000;
        return `Up to ${r.positions} holdings of about ${usd0(d.budgetUsd / r.positions)} each, bought a few at a time: the whole ${usd0(d.budgetUsd)} is in use after about ${d.periodDays} day${d.periodDays === 1 ? '' : 's'}. Money from a sale is used again.`
            + (d.budgetUsd > cash ? ` The practice portfolio starts with ${usd0(cash)}, so it can never invest more than the cash that is left.` : '');
    }
    function statusText() {
        const s = data.settings, last = data.state && data.state.lastRun;
        if (!s.enabled) return 'Off. Nothing is bought or sold automatically.';
        const r = data.options.risk[String(s.risk)] || {};
        const holding = data.holding ? ` Holding ${data.holding.count} of up to ${r.positions}: ${usd0(data.holding.investedUsd)} of the ${usd0(s.budgetUsd)} budget is invested.` : '';
        const next = data.nextCheck && data.nextCheck.at
            ? ` Next check-in about ${when(data.nextCheck.at)}, when the ${data.nextCheck.markets.join(' and ')} market${data.nextCheck.markets.length > 1 ? 's are' : ' is'} open.`
            : (data.nextCheck === null ? ' No check-in is due in the next ten days.' : '');
        return 'On.' + holding + (last ? ` Last check-in ${when(last)}.` : (next ? '' : ' First check-in at the next hourly check.')) + next;
    }
    // The line beside the buttons: what to do next
    function hintText(dirty, on) {
        return dirty ? 'You have changes that are not saved yet.' : on ? '' : 'Use the switch at the top right to turn it on.';
    }
    function screenerGroups(all) {
        const groups = [];
        Object.keys(all).forEach(k => { const g = all[k].group || 'Screeners'; let row = groups.find(x => x[0] === g); if (!row) groups.push(row = [g, []]); row[1].push(k); });
        return groups;
    }

    // ---------------------------------------------------------------- "How it is doing": its own closed trades
    function recordHtml() {
        const c = data.scorecard, need = data.minSample || 8;
        if (!c || !c.n) return `<div class="ap-section"><h4>How it is doing</h4><div>Nothing it bought has been sold yet. Each sale is recorded here with its result against the S&amp;P 500 over the same days, and the autopilot uses that record at later check-ins.</div></div>`;
        const cell = 'padding: 4px 8px; text-align: right; white-space: nowrap;';
        const row = (g) => `<tr><td style="padding: 4px 8px 4px 0; color: var(--text-primary);">${esc(g.label)}</td><td style="${cell}">${g.n}</td><td style="${cell} color: ${tint(g.avg)};">${pc(g.avg)}</td><td style="${cell} color: ${tint(g.vs)};">${pc(g.vs)}</td><td style="${cell}">${g.judged ? g.beat + ' of ' + g.judged : '–'}</td></tr>`;
        const section = (title, list) => list && list.length ? `<tr><td colspan="5" style="padding: 8px 0 2px; color: var(--text-secondary);">${title}</td></tr>` + list.map(row).join('') : '';
        const g = c.groups || {};
        const lessons = data.lessons && data.lessons.items && data.lessons.items.length ? `<div style="margin-top: 10px;"><strong style="color: var(--text-primary); font-size: 0.9rem;">What it has noted from its record</strong> <span style="font-size: 0.8rem;">(written by the AI model on ${esc(day(data.lessons.at))} from ${data.lessons.n} closed trades)</span><ul style="margin: 4px 0 0 18px; padding: 0;">${data.lessons.items.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '';
        return `<div class="ap-section"><h4>How it is doing</h4>
            <div>${c.n} closed trade${c.n === 1 ? '' : 's'}: average <span style="color: ${tint(c.avg)}; font-weight: 600;">${pc(c.avg)}</span>${c.vs !== null ? `, <span style="color: ${tint(c.vs)}; font-weight: 600;">${pc(c.vs)}</span> against the S&amp;P 500 over the same days, ahead in ${c.beat} of ${c.judged}` : ''}.${c.n < need ? ` Fewer than ${need} trades: too few to conclude anything yet.` : ''}</div>
            <details style="margin-top: 6px;"><summary style="cursor: pointer; color: var(--text-primary);">Breakdown</summary><div style="overflow-x: auto;"><table style="border-collapse: collapse; font-size: 0.85rem;">
                <tr><td></td><td style="${cell}">Trades</td><td style="${cell}">Average</td><td style="${cell}">Against the market</td><td style="${cell}">Ahead</td></tr>
                ${section('By screener', g.screener)}${section('By place in the ranking when bought', g.rank)}${section('By RSI when bought', g.rsi)}${section('By who chose', g.chosen)}${section('By how it was sold', g.exit)}
            </table></div><div style="font-size: 0.8rem; margin-top: 4px;">A group needs ${need} trades before the autopilot acts on it. A screener whose recent trades clearly lag the market is rested for two weeks. Past results of fake-money trades; they say nothing certain about the future.</div></details>
            ${lessons}
        </div>`;
    }

    // ---------------------------------------------------------------- the panel
    function render() {
        const el = box();
        if (!el) return;
        if (!data || !data.allowed) { el.innerHTML = ''; return; }
        ensureStyle();
        const d = draft, o = data.options, on = data.settings.enabled, dirty = isDirty();
        const select = (id, list, value, label) => `<select id="${id}">${list.map(v => `<option value="${v}" ${v === value ? 'selected' : ''}>${label(v)}</option>`).join('')}</select>`;
        const icons = { buy: '🟢', sell: '🔴', note: 'ℹ️' };
        const log = (data.log || []).slice().reverse();
        const shown = showAll ? log : log.slice(0, 8);
        const levels = Object.keys(o.risk).sort();
        const chosen = d.screeners.length;
        el.innerHTML = `
            <div class="ap-wrap">
                <div class="ap-head">
                    <h3>🤖 AI autopilot <span class="ap-sub">fake money, an experiment to watch</span></h3>
                    <label class="ap-switch" title="Switch the autopilot on or off. This is saved straight away."><span id="ap-switch-text">${d.enabled ? 'On' : 'Off'}</span><input id="ap-enabled" type="checkbox" ${d.enabled ? 'checked' : ''} ${working ? 'disabled' : ''}><span class="ap-track"></span></label>
                </div>
                <p class="ap-intro">An AI model makes practice buys and sells for you from the latest results of the screeners you choose, inside the limits you set here. It uses the practice portfolio above. Nothing here is advice, and past screener results have not shown a reliable edge.</p>
                <div id="ap-status" class="ap-status ${on ? 'on' : ''}">${esc(statusText())}</div>

                <div class="ap-card">
                    <span class="ap-label">Risk level</span>
                    <input id="ap-risk" class="ap-risk" type="range" min="1" max="${levels.length || 5}" step="1" value="${d.risk}" aria-label="Risk level">
                    <div class="ap-levels">${levels.map(n => `<span data-ap-level="${n}" class="${String(d.risk) === n ? 'now' : ''}">${esc(o.risk[n].name)}</span>`).join('')}</div>
                    <div id="ap-risk-text" class="ap-help">${esc(riskText(d.risk))}</div>
                </div>

                <div class="ap-card">
                    <div class="ap-fields">
                        <div><label class="ap-label" for="ap-budget">Budget for the AI</label><div class="ap-input">$ <input id="ap-budget" type="number" min="100" step="500" value="${d.budgetUsd}"></div></div>
                        <div><label class="ap-label" for="ap-period">Build up to it over</label><div class="ap-input"><input id="ap-period" type="number" min="1" max="90" step="1" value="${d.periodDays}"> days</div></div>
                        <div><label class="ap-label" for="ap-every">Checks in</label><div class="ap-input">${select('ap-every', o.everyHours, d.everyHours, everyText)}</div></div>
                        <div><label class="ap-label" for="ap-hold">Keeps a holding at most</label><div class="ap-input">${select('ap-hold', o.holdDays, d.maxHoldDays, v => `${v} days`)}</div></div>
                    </div>
                    <div id="ap-plan" class="ap-help">${esc(planText(d))}</div>
                </div>

                <div class="ap-card">
                    <span class="ap-label">Screeners it buys from <span id="ap-chosen" class="ap-sub">${chosen} chosen</span></span>
                    ${screenerGroups(o.screeners).map(([group, keys], i) => `<div class="ap-group ${i === 0 ? 'first' : ''}"><div class="ap-group-name">${esc(group)}</div><div class="ap-chips">${keys.map(k => `<label class="ap-chip"><input type="checkbox" data-ap-screener="${esc(k)}" ${d.screeners.includes(k) ? 'checked' : ''}> ${esc(o.screeners[k].name)}${data.resting && data.resting[k] ? ' <small title="Resting after its recent trades lagged the market">(resting until ' + esc(day(data.resting[k])) + ')</small>' : ''}</label>`).join('')}</div></div>`).join('')}
                    <div class="ap-help">Each share market is only traded while it is open; coins at any time. Bigger lists take a little longer to check.</div>
                </div>

                <div class="ap-actions">
                    <button id="ap-save" data-ap="save" class="ap-btn ${dirty ? 'primary' : ''}" ${working || !dirty ? 'disabled' : ''}>${working === 'save' ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}</button>
                    <button id="ap-run" data-ap="run" class="ap-btn" ${working || !on || dirty ? 'disabled' : ''} title="${!on ? 'Switch the autopilot on first' : dirty ? 'Save your changes first' : 'Runs one check-in now instead of waiting for the next one'}">${working === 'run' ? 'Checking in… this can take up to a minute' : 'Check in now'}</button>
                    <span id="ap-dirty" class="ap-dirty">${hintText(dirty, on)}</span>
                </div>
                <div id="ap-notice" class="${notice ? 'ap-note ' + (notice.bad ? 'bad' : 'good') : ''}" role="status">${notice ? esc(notice.text) : ''}</div>

                ${recordHtml()}
                ${log.length ? `<div class="ap-section"><h4>What it has done</h4>
                    ${shown.map(e => `<div class="ap-log"><time>${icons[e.type] || ''} ${esc(when(e.t))}</time> ${e.type === 'buy' ? `<strong style="color: var(--text-primary);">Bought ${esc(e.symbol)}</strong> with ${usd0(e.usd)}. ` : e.type === 'sell' ? `<strong style="color: var(--text-primary);">Sold ${esc(e.symbol)}</strong>. ` : ''}${esc(e.text)}</div>`).join('')}
                    ${log.length > shown.length ? `<a href="#" data-ap="more" style="display: inline-block; margin-top: 8px;">Show all ${log.length}</a>` : ''}</div>` : ''}
            </div>`;
    }

    function readDraft() {
        if (!byId('ap-risk')) return;
        draft = {
            enabled: !!byId('ap-enabled').checked, risk: parseInt(byId('ap-risk').value, 10) || 3,
            budgetUsd: parseFloat(byId('ap-budget').value) || 0, periodDays: parseInt(byId('ap-period').value, 10) || 1,
            everyHours: parseInt(byId('ap-every').value, 10), maxHoldDays: parseInt(byId('ap-hold').value, 10),
            screeners: Array.from(document.querySelectorAll('[data-ap-screener]')).filter(c => c.checked).map(c => c.getAttribute('data-ap-screener')).sort()
        };
    }
    // After a control changes: bring the buttons and the explanatory lines up to date without redrawing (typing keeps its place)
    function syncDraft() {
        readDraft();
        if (!draft || !data) return;
        const dirty = isDirty(), on = data.settings.enabled, set = (id, fn) => { const el = byId(id); if (el) fn(el); };
        set('ap-save', el => { el.disabled = !dirty || !!working; el.textContent = dirty ? 'Save changes' : 'Saved'; if (el.classList) el.classList.toggle('primary', dirty); });
        set('ap-run', el => { el.disabled = !!working || !on || dirty; el.title = !on ? 'Switch the autopilot on first' : dirty ? 'Save your changes first' : 'Runs one check-in now instead of waiting for the next one'; });
        set('ap-dirty', el => { el.textContent = hintText(dirty, on); });
        set('ap-risk-text', el => { el.textContent = riskText(draft.risk); });
        set('ap-plan', el => { el.textContent = planText(draft); });
        set('ap-chosen', el => { el.textContent = draft.screeners.length + ' chosen'; });
        if (document.querySelectorAll) Array.from(document.querySelectorAll('[data-ap-level]')).forEach(el => { if (el.classList) el.classList.toggle('now', el.getAttribute('data-ap-level') === String(draft.risk)); });
    }
    function validate(d) {
        const cash = data.practiceCash || 100000;
        if (!d.screeners.length) throw new Error('Choose at least one screener for it to buy from.');
        if (!(d.budgetUsd >= 100)) throw new Error('The budget must be at least $100.');
        if (d.budgetUsd > cash * 10) throw new Error(`The budget cannot be more than ${usd0(cash * 10)}.`);
        if (!(d.periodDays >= 1 && d.periodDays <= 90)) throw new Error('Spread the buying over 1 to 90 days.');
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
    function saveNow(turned) {
        return act('save', async () => {
            try { validate(draft); } catch (e) { if (turned) draft.enabled = data.settings.enabled; throw e; }
            const wasOn = data.settings.enabled;
            take(await api('save', { settings: draft }));
            const on = data.settings.enabled;
            notice = { text: on && !wasOn ? 'Autopilot switched on. Press "Check in now" to see its first choices, or leave it to check in by itself.'
                : !on && wasOn ? 'Autopilot switched off. What it holds stays in the practice portfolio until you sell it.' : 'Settings saved.' };
        });
    }

    document.addEventListener('click', (e) => {
        const level = e.target.closest && e.target.closest('[data-ap-level]');
        if (level && data && byId('ap-risk')) { byId('ap-risk').value = level.getAttribute('data-ap-level'); syncDraft(); return; }
        const t = e.target.closest && e.target.closest('[data-ap]');
        if (!t || !data) return;
        if (t.tagName === 'A') e.preventDefault();
        const action = t.getAttribute('data-ap');
        if (action === 'more') { readDraft(); showAll = true; render(); }
        else if (action === 'save') saveNow(false);
        else if (action === 'run') {
            act('run', async () => {
                const r = await api('run');
                take(r);
                const s = r.summary || {};
                notice = { text: s.conflict ? 'The portfolio was being changed at the same time, so nothing was traded. Try again.' : `Checked in: ${s.bought || 0} bought, ${s.sold || 0} sold. Details are listed below.` };
                if (window.practicePortfolio && window.practicePortfolio.reload) window.practicePortfolio.reload();
            });
        }
    });
    const changed = (e) => {
        if (!e.target || !data || !data.allowed) return;
        const id = e.target.id || '', inPanel = id.indexOf('ap-') === 0 || (e.target.getAttribute && e.target.getAttribute('data-ap-screener'));
        if (!inPanel) return;
        if (id === 'ap-enabled') { if (e.type === 'change') saveNow(true); return; }     // the switch saves straight away
        syncDraft();
    };
    document.addEventListener('input', changed);
    document.addEventListener('change', changed);

    window.practiceAutopilot = { reload: load };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load); else load();
})();
