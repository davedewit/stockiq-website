// The latest news for a share, under a search box (26 Oct 2026, the owner: "when users type in the search box for a company or
// stock, can it include to show related news articles?"). Read from the share's own stock page (its NEWS section, written daily by
// update_stock_news.py), so nothing new runs or is stored: one request to a page the site already serves. Shares without a stock
// page, or whose page has no news, show nothing.
//   symbolNews.show('AAPL', element)   draws up to 3 headlines and a link to the page into element; symbolNews.hide(element)
(function () {
    if (window.symbolNews) return;
    const cache = {};
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const pages = () => new Set(String(window.STOCK_PAGES || '').split(',').filter(Boolean));
    let listAsked = null;
    function pageList() {        // stock-pages.js: every share that has a page (the market panel loads it too)
        if (window.STOCK_PAGES) return Promise.resolve(pages());
        if (!listAsked) listAsked = new Promise(done => {
            const s = document.createElement('script');
            s.src = 'stock-pages.js?h=' + Math.floor(Date.now() / 3600000);
            s.onload = s.onerror = () => done();
            document.head.appendChild(s);
        });
        return listAsked.then(pages);
    }
    function ago(t) {
        const h = (Date.now() - t) / 3600000;
        if (!(h >= 0)) return '';
        if (h < 1) return 'within the hour';
        if (h < 24) return Math.round(h) + (Math.round(h) === 1 ? ' hour ago' : ' hours ago');
        const d = Math.round(h / 24);
        return d === 1 ? 'yesterday' : d + ' days ago';
    }
    async function articles(symbol) {
        if (cache[symbol]) return cache[symbol];
        const r = await fetch('stocks/' + encodeURIComponent(symbol) + '.html');
        if (!r.ok) throw new Error('HTTP ' + r.status);     // not cached: a later pick tries again
        const html = await r.text(), a = html.indexOf('<!-- NEWS_SECTION_START -->'), b = html.indexOf('<!-- NEWS_SECTION_END -->');
        if (a < 0 || b < a) return (cache[symbol] = []);
        const doc = new DOMParser().parseFromString('<div>' + html.slice(a, b) + '</div>', 'text/html');
        const out = [];
        doc.querySelectorAll('a').forEach(link => {
            if (!/read full article/i.test(link.textContent)) return;
            const block = link.closest('div[style*="border-left"]') || link.parentElement.parentElement;
            const title = block && block.querySelector('strong'), when = block && block.querySelector('[data-timestamp]');
            const href = link.getAttribute('href') || '';
            if (!title || !/^https?:\/\//.test(href)) return;
            out.push({ title: title.textContent.trim(), href, t: when ? Date.parse(when.getAttribute('data-timestamp')) : 0 });
        });
        out.sort((x, y) => y.t - x.t);
        return (cache[symbol] = out.slice(0, 3));
    }
    let shown = 0;
    async function show(symbol, el) {
        symbol = String(symbol || '').trim().toUpperCase();
        if (!el) return false;
        const ticket = ++shown;
        if (!symbol || !(await pageList()).has(symbol)) { hide(el); return false; }
        let list = [], failed = false;       // failed: the page could not be fetched (offline, a local preview), not "no news"
        try { list = await articles(symbol); } catch (e) { failed = true; }
        if (ticket !== shown) return false;     // another share was picked meanwhile
        const page = 'stocks/' + encodeURIComponent(symbol) + '.html';
        el.innerHTML = `<div class="sn-head">📰 Latest news on ${esc(symbol)}</div>`
            + (list.length ? list.map(n => `<a class="sn-item" href="${esc(n.href)}" target="_blank" rel="noopener nofollow">${esc(n.title)}<span class="sn-when">${esc(ago(n.t))}</span></a>`).join('')
                : `<div class="sn-none">${failed ? `Could not load the news for ${esc(symbol)} just now.` : `No recent articles for ${esc(symbol)}.`}</div>`)
            + `<a class="sn-page" href="${page}">${esc(symbol)}'s page: its data snapshot and all its news →</a>`;
        el.style.display = 'block';
        return true;
    }
    function hide(el) { if (el) { shown++; el.style.display = 'none'; el.innerHTML = ''; } }
    const css = document.createElement('style');
    css.textContent = `.sn-box { display: none; margin-top: 10px; text-align: left; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px 12px; font-size: 0.88rem; }
        .sn-head { font-weight: 700; color: var(--text-primary); margin-bottom: 4px; }
        .sn-item { display: block; padding: 6px 0; border-top: 1px solid var(--border-color); color: var(--text-primary); text-decoration: none; line-height: 1.35; }
        .sn-item:hover { color: #007bff; } .sn-when { display: block; font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px; }
        .sn-none { color: var(--text-secondary); padding: 4px 0; }
        .sn-page { display: block; margin-top: 6px; padding-top: 6px; border-top: 1px solid var(--border-color); color: #007bff; text-decoration: none; font-weight: 600; font-size: 0.82rem; }`;
    document.head.appendChild(css);
    window.symbolNews = { show, hide, articles };
})();
