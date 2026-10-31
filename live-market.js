/* live-market.js: the market data on the page moves while someone is looking at it (18 Oct 2026).
 *
 * The owner: "they should update often so when users on the page they see its active not a static site ... only if user is active
 * on page". Loaded by theme.js on every page (?h=<the hour>, no version to raise); it does something only where the page has the
 * market data: the four movers lists (trending, top gainers, top losers, most active: rows with ids `<kind>-price-<symbol>`) and
 * the market-data side panel (`.market-item-sidebar` rows). The pages' own code still builds the lists and decides what is in
 * them; this script only keeps the figures fresh, flashes a figure green or red when it moves, and draws the side panel's small
 * charts from today's real prices (they were random lines).
 *
 * How often: one request a round for every figure on show (the price function, ticker-data-fetcher, answers 26 symbols in
 * about a second), every 6 to 10 seconds at random, and each changed row a moment apart (the owner's own idea of a random
 * delay). Only while the tab is on screen and someone has moved, scrolled, typed or touched in the last 90 seconds. When a round
 * changes nothing (a market that is closed) the gap grows by half each time, up to a minute; the first change brings it back.
 * About 6 requests a minute while someone is watching, none while nobody is.
 *
 * Version 3 (18 Oct 2026): the home page's four index cards (S&P 500, Dow Jones, Nasdaq, Russell 2000: `<id>-value`, `<id>-change`,
 * `#<id>-chart`) are kept fresh the same way, and their small charts are today's real line (they were a fixed up or down line).
 */
(function () {
    'use strict';
    var VERSION = 9;
    if (window.liveMarket && window.liveMarket.version >= VERSION) return;
    var PRICES = 'https://2vl4la6od3vfgbkv6ycbj7ewry0yxvck.lambda-url.us-east-1.on.aws/';
    var T = window.LIVE_MARKET_TEST || {};               // a browser test may shorten the times
    var FAST = T.fast || [6000, 10000], SLOW = T.slow || 60000, IDLE = T.idle || 5 * 60000, STOP = T.stop || 15 * 60000, MAX = 40;
    // Full speed while someone has touched the page in the last IDLE (5 min: watching without moving is normal), then once a SLOW
    // (a minute), and nothing after STOP (15 min) without a touch, so a tab left open costs little. Until 31 Oct 2026 it stopped after 90 s.
    var KINDS = [['trend', 'trendingTickersList', 'trendingTickerPrices'], ['gainer', 'gainersTickersList', 'gainersTickerPrices'],
                 ['loser', 'losersTickersList', 'losersTickerPrices'], ['active', 'activeTickersList', 'activeTickerPrices']];
    var lastInput = Date.now(), gap = FAST[0], timer = null, busy = false, rounds = 0, changed = 0, sparks = {}, lastErr = null, allAt = 0;
    var SPARK_KEEP = 20 * 60 * 1000, ALL_EVERY = 5 * 60 * 1000;   // the lines are kept in the browser 20 minutes; every tab's fetched every 5

    function read(key) { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { return null; } }
    function write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { } }
    function idOf(sym) { return String(sym).toLowerCase().replace(/[^a-z0-9]/g, ''); }
    function money(n) { return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
    function changeText(c, p) { var s = p >= 0 ? '+' : ''; return s + Number(c).toFixed(2) + ' (' + s + Number(p).toFixed(2) + '%)'; }
    var CARDS = [['sp500', '^GSPC'], ['dow', '^DJI'], ['nasdaq', '^IXIC'], ['russell', '^RUT']];
    function watching() { return !document.hidden && Date.now() - lastInput < STOP; }

    function style() {
        if (document.getElementById('lm-style')) return;
        var s = document.createElement('style'); s.id = 'lm-style';
        // A change shows as a soft green or red tint, its figures in the page's own text colour while it is held (about half a second),
        // then a fainter tint fading out over a second (31 Oct 2026, the owner: the old pale tint for 1.2 s was hard to see, then a solid
        // dark green or red with white figures was too strong). The outline gives the figure a little room without moving anything.
        s.textContent = '@keyframes lmUp{0%,30%{background:rgba(34,197,94,.42);box-shadow:0 0 0 3px rgba(34,197,94,.42)}40%{background:rgba(34,197,94,.16);box-shadow:0 0 0 3px rgba(34,197,94,.16)}100%{background:transparent;box-shadow:0 0 0 3px transparent}}'
            + '@keyframes lmDown{0%,30%{background:rgba(239,68,68,.42);box-shadow:0 0 0 3px rgba(239,68,68,.42)}40%{background:rgba(239,68,68,.16);box-shadow:0 0 0 3px rgba(239,68,68,.16)}100%{background:transparent;box-shadow:0 0 0 3px transparent}}'
            + '@keyframes lmText{0%,75%{color:var(--text-primary,currentColor)}}'
            + '.lm-up{animation:lmUp 1.6s ease-out,lmText .64s;border-radius:3px}.lm-down{animation:lmDown 1.6s ease-out,lmText .64s;border-radius:3px}'
            + '.market-item-sidebar-chart polyline:not([data-lm]),.index-chart polyline:not([data-lm]){opacity:0}';      // the page's own lines are random: hidden until today's real one is in
        (document.head || document.documentElement).appendChild(s);
    }
    function flash(el, up) {
        if (!el || !el.classList) return;
        el.classList.remove('lm-up', 'lm-down'); void el.offsetWidth; el.classList.add(up ? 'lm-up' : 'lm-down');
    }
    // Every price arrives in one answer, so shown at once they would all flash in the same instant. Each price carries the time it last
    // traded (`time`, Unix seconds): the rows that changed flash in that order and with those gaps, starting the moment the answer
    // arrives, so every row shows the same short delay behind its real trade (31 Oct 2026, the owner: "they should be updating when they
    // change"). Rows in the same second get a little jitter (the time has no finer grain); with no time (an older answer) a random
    // 0 to 2.5 s, as before. A row still waiting when a newer answer comes is not shown with the older figure (`tok`).
    var pending = [], tok = 0;
    // The colour comes first and the figure changes a moment later, so the eye is drawn to the spot and then sees the figure move
    // (31 Oct 2026, the owner's idea). Up and down are swapped as classes, so the flash's own class is not wiped.
    var TEXT_AFTER = 250;
    function afterFlash(fn) { setTimeout(fn, TEXT_AFTER); }
    function upDown(el, up) { el.classList.remove('positive', 'negative'); el.classList.add(up ? 'positive' : 'negative'); }
    function later(fn, el, t) { pending.push({ fn: fn, el: el, t: t }); }
    function release() {
        var list = pending; pending = [];
        var times = list.map(function (x) { return x.t; }).filter(function (t) { return typeof t === 'number' && t > 0; });
        var t0 = times.length ? Math.min.apply(null, times) : null, cap = Math.max(0, FAST[0] - 1000), seq = ++tok;
        list.forEach(function (x) {
            if (x.el) x.el.__lmTok = seq;
            var wait = t0 !== null && typeof x.t === 'number' && x.t > 0 ? Math.min(cap, (x.t - t0) * 1000) + Math.random() * 600 : Math.random() * 2500;
            setTimeout(function () { if (!x.el || x.el.__lmTok === seq) x.fn(); }, wait);
        });
    }

    // What is on show: the movers rows, and the side panel's rows with their symbols (from the data the page saved)
    function movers() {
        var out = [];
        KINDS.forEach(function (k) {
            (read(k[1]) || []).slice(0, 8).forEach(function (sym) {
                var el = document.getElementById(k[0] + '-price-' + idOf(sym));
                if (el) out.push({ kind: k, sym: sym, price: el, change: document.getElementById(k[0] + '-change-' + idOf(sym)) });
            });
        });
        return out;
    }
    function panelRows() {
        var out = [], tab = document.querySelector('.market-tab-sidebar.active'), cat = tab && tab.getAttribute('data-tab') || 'us';
        var data = (read('marketDataSidebar') || {})[cat] || {};
        var boxes = document.querySelectorAll('#market-data-sidebar-container');
        for (var b = 0; b < boxes.length; b++) {
            var rows = boxes[b].querySelectorAll('.market-item-sidebar');
            for (var i = 0; i < rows.length; i++) {
                var nameEl = rows[i].querySelector('.market-item-sidebar-name'), name = nameEl && nameEl.textContent.trim(), info = name && data[name];
                if (info && info.symbol) out.push({ row: rows[i], name: name, cat: cat, sym: info.symbol, info: info });
            }
        }
        return out;
    }

    function cards() {                                  // the home page's four index cards, where the page has them
        var out = [];
        CARDS.forEach(function (c) {
            var v = document.getElementById(c[0] + '-value');
            if (v) out.push({ id: c[0], sym: c[1], value: v, change: document.getElementById(c[0] + '-change'), line: document.querySelector('#' + c[0] + '-chart polyline') });
        });
        return out;
    }
    // The line's colour follows the change shown beside it (23 Oct 2026, the owner: a green line under a red -3.20%). The line is
    // the latest day's prices (a coin's since 00:00 UTC) while the figure is the source's own change (a coin's over 24 hours), and a
    // line can come from the copy kept 20 minutes: the two could disagree. The figure is what the visitor reads, so it decides.
    function shownUp(el, s) {
        var t = el ? String(el.textContent || '') : '';
        if (el && el.classList && el.classList.contains('negative')) return false;
        if (el && el.classList && el.classList.contains('positive')) return true;
        if (/\d/.test(t)) return !/^\s*[-\u2212]/.test(t);
        return s.spark[s.spark.length - 1] >= (s.prev || s.spark[0]);
    }
    function drawCard(c, s) {
        if (!c.line || !s || !s.spark || s.spark.length < 2) return;
        c.line.setAttribute('points', sparkPoints(s.spark, s.prev, 58));
        c.line.setAttribute('data-lm', '1');
        c.line.setAttribute('stroke', shownUp(c.change, s) ? '#22c55e' : '#ef4444');
        var svg = c.line.parentNode; if (svg && svg.setAttribute) svg.setAttribute('aria-label', 'today so far');
    }
    function drawAll() {
        panelRows().forEach(function (r) { if (sparks[r.sym]) drawSpark(r.row, sparks[r.sym]); });
        cards().forEach(function (c) { if (sparks[c.sym]) drawCard(c, sparks[c.sym]); });
    }

    function panelValue(v, cat) {
        return cat === 'cryptocurrencies' && v < 1000 ? Number(v).toFixed(4) : money(v);
    }
    function sparkPoints(list, prev, width) {
        var all = list.concat(prev ? [prev] : []), lo = Math.min.apply(null, all), hi = Math.max.apply(null, all), span = hi - lo || 1, w = width || 100;
        return list.map(function (p, i) { return (i / (list.length - 1) * w).toFixed(1) + ',' + (28 - (p - lo) / span * 26).toFixed(1); }).join(' ');
    }
    function drawSpark(row, s) {
        var line = row.querySelector('.market-item-sidebar-chart polyline');
        if (!line || !s || !s.spark || s.spark.length < 2) return;
        line.setAttribute('points', sparkPoints(s.spark, s.prev));
        line.setAttribute('data-lm', '1');
        line.setAttribute('stroke', shownUp(row.querySelector('.market-item-sidebar-change'), s) ? '#22c55e' : '#ef4444');
        var svg = row.querySelector('.market-item-sidebar-chart'); if (svg) svg.setAttribute('aria-label', 'today so far');
    }

    // One row: its price and its change are compared apart, and only the part whose text changes flashes (31 Oct 2026, the owner:
    // a flash on a price that had not moved, when only the % had, looked like a fault). Each part says its own direction.
    function amountOf(text) { var n = parseFloat(String(text || '').replace(/[,+\s]/g, '')); return isNaN(n) ? null : n; }
    // A part flashes only when its price has traded since the last answer (`time` moved on). The first answer after the page opens,
    // and a market that is shut, put their figures right without a flash: the page first draws figures from other sources (the
    // panel's own functions, the last visit's), which differ by a cent or two, and those corrections flashed on every page load
    // (31 Oct 2026, the owner: the Dow and Nasdaq flashed a few times after a refresh on a Saturday). With no time in the answer
    // (an older price function) every change flashes, as before.
    var seenTime = {}, fresh = {};
    function show(el, ch, price, changeTxt, q, was, first, done) {
        if (!first && typeof q.time === 'number' && !fresh[q.__sym]) first = true;       // no new trade: put it right quietly
        var pMove = el && el.textContent.trim() !== price, cMove = ch && ch.textContent.trim() !== changeTxt;
        if (!pMove && !cMove) return 0;
        if (first) {                                     // a quiet correction: at once, no flash, and not counted as movement
            if (el) (el.__lmTok = ++tok);                // a flash still waiting from an older answer must not overwrite it
            if (pMove) el.textContent = price; if (cMove) ch.textContent = changeTxt; if (done) done();
            return 0;
        }
        var oldCh = ch ? amountOf(ch.textContent) : null;
        var upP = was === null ? q.change >= 0 : q.price >= was, upC = oldCh === null ? q.change >= 0 : q.change >= oldCh;
        later(function () {
            // the panel may have drawn the row again from the newest figures in the meantime: a part that already reads its new figure does not flash
            pMove = pMove && el.textContent.trim() !== price; cMove = cMove && ch.textContent.trim() !== changeTxt;
            if (pMove) flash(el, upP); if (cMove) flash(ch, upC);
            afterFlash(function () {
                if (pMove) el.textContent = price;
                if (cMove) ch.textContent = changeTxt;
                if (done) done();
            });
        }, el || ch, q.time);
        return 1;
    }

    function apply(answer) {
        var moved = 0, saved = {};
        fresh = {};
        Object.keys(answer).forEach(function (sym) {
            var q = answer[sym]; if (!q || q.error) return;
            q.__sym = sym;
            if (typeof q.time === 'number') { fresh[sym] = !!seenTime[sym] && q.time > seenTime[sym]; seenTime[sym] = Math.max(seenTime[sym] || 0, q.time); }
        });
        movers().forEach(function (m) {
            var q = answer[m.sym]; if (!q || q.error) return;
            var key = m.kind[2], cache = saved[key] || (saved[key] = read(key) || {}), old = cache[m.sym], ch = m.change;
            moved += show(m.price, ch, money(q.price), changeText(q.change, q.changePercent), q, old && typeof old.price === 'number' ? old.price : null, false,
                function () { if (ch) ch.style.color = q.changePercent >= 0 ? '#22c55e' : '#ef4444'; });
            cache[m.sym] = { name: q.name || m.sym, price: q.price, change: q.change, changePercent: q.changePercent };
        });
        Object.keys(saved).forEach(function (k) { write(k, saved[k]); });
        var store = read('marketDataSidebar'), touched = false, sparked = false;
        panelRows().forEach(function (r) {
            var q = answer[r.sym]; if (!q || q.error) return;
            if (q.spark) { sparks[r.sym] = { spark: q.spark, prev: q.prev, at: Date.now() }; drawSpark(r.row, sparks[r.sym]); sparked = true; }
            var valEl = r.row.querySelector('.market-item-sidebar-value'), chEl = r.row.querySelector('.market-item-sidebar-change');
            if (valEl) moved += show(valEl, chEl, panelValue(q.price, r.cat), changeText(q.change, q.changePercent), q, typeof r.info.value === 'number' ? r.info.value : null, false,
                function () { if (chEl) upDown(chEl, q.change >= 0); if (sparks[r.sym]) drawSpark(r.row, sparks[r.sym]); });
            if (store && store[r.cat] && store[r.cat][r.name]) {
                store[r.cat][r.name] = Object.assign({}, store[r.cat][r.name], { value: q.price, change: q.change, changePercent: q.changePercent }); touched = true;
            }
        });
        if (touched) write('marketDataSidebar', store);
        cards().forEach(function (c) {
            var q = answer[c.sym]; if (!q || q.error) return;
            if (q.spark) { sparks[c.sym] = { spark: q.spark, prev: q.prev, at: Date.now() }; drawCard(c, sparks[c.sym]); sparked = true; }
            var was = amountOf(c.value.textContent), ch = c.change;
            moved += show(c.value, ch, money(q.price), changeText(q.change, q.changePercent), q, was, was === null,
                function () { if (ch) { if (!ch.classList.contains('index-change')) ch.classList.add('index-change'); upDown(ch, q.change >= 0); } if (sparks[c.sym]) drawCard(c, sparks[c.sym]); });
        });
        if (sparked) saveSparks();
        release();
        return moved;
    }

    function round() {
        timer = null;
        if (!watching()) return schedule();           // looked at again at the next input or return to the tab
        var syms = movers().map(function (m) { return m.sym; }).concat(panelRows().map(function (r) { return r.sym; }), cards().map(function (c) { return c.sym; }));
        syms = syms.filter(function (s, i) { return syms.indexOf(s) === i; }).slice(0, MAX);
        if (!syms.length || busy) return schedule();
        busy = true; rounds++;
        fetch(PRICES, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tickers: syms, spark: true }) })
            .then(function (r) { return r.json(); })
            .then(function (j) {
                var moved = j && j.success && j.data ? apply(j.data) : 0;
                changed += moved;
                gap = moved ? FAST[0] : Math.min(SLOW, Math.round(gap * 1.5));
                if (watching()) setTimeout(fetchAllSparks, 800);
            })
            .catch(function (e) { lastErr = String(e && e.message || e); gap = Math.min(SLOW, gap * 2); })
            .then(function () { busy = false; schedule(); });
    }
    function schedule() {
        if (timer) clearTimeout(timer);
        var wait = gap <= FAST[0] ? FAST[0] + Math.random() * (FAST[1] - FAST[0]) : gap;
        if (Date.now() - lastInput >= IDLE) wait = Math.max(wait, SLOW);       // still there, not touching: once a minute
        timer = setTimeout(round, watching() ? wait : 15000);
    }
    function woke() {                                   // back after a pause: a round straight away, at the quick pace
        var was = Date.now() - lastInput >= IDLE || document.hidden;
        lastInput = Date.now();
        if (was && !document.hidden) { gap = FAST[0]; if (timer) clearTimeout(timer); timer = setTimeout(round, 400); }
    }
    ['mousemove', 'scroll', 'keydown', 'click', 'touchstart', 'focus'].forEach(function (ev) { window.addEventListener(ev, woke, { passive: true }); });
    document.addEventListener('visibilitychange', function () { if (!document.hidden) woke(); });

    // When the page draws its side panel again (a tab chosen), its charts are random lines: put today's real one back at once
    function watchPanel() {
        if (!window.MutationObserver) return;
        var boxes = document.querySelectorAll('#market-data-sidebar-container');
        for (var i = 0; i < boxes.length; i++) {
            if (boxes[i].__lm) continue; boxes[i].__lm = true;
            new MutationObserver(function () {
                drawAll();
                if (!timer || gap > FAST[0]) { gap = FAST[0]; if (timer) clearTimeout(timer); timer = setTimeout(round, 600); }
            }).observe(boxes[i], { childList: true });
        }
    }

    function loadSparks() {
        var kept = read('lmSparks') || {}, now = Date.now();
        Object.keys(kept).forEach(function (k) { if (kept[k] && now - kept[k].at < SPARK_KEEP) sparks[k] = kept[k]; });
    }
    function saveSparks() { write('lmSparks', sparks); }
    // Every tab's lines in one request in the background (the tab on show comes first in each round), so that a tab chosen
    // later shows its line at once: on 18 Oct 2026 the owner saw lines appear only seconds after he opened a tab
    function fetchAllSparks() {
        if (Date.now() - allAt < ALL_EVERY) return;
        allAt = Date.now();
        var data = read('marketDataSidebar') || {}, syms = [];
        Object.keys(data).forEach(function (cat) { var d = data[cat]; if (d && typeof d === 'object') Object.keys(d).slice(0, 6).forEach(function (n) { var sy = d[n] && d[n].symbol; if (sy && syms.indexOf(sy) < 0) syms.push(sy); }); });
        cards().forEach(function (c) { if (syms.indexOf(c.sym) < 0) syms.push(c.sym); });
        syms = syms.filter(function (sy) { return !sparks[sy] || Date.now() - sparks[sy].at > ALL_EVERY; });
        for (var i = 0; i < syms.length; i += MAX) {
            fetch(PRICES, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tickers: syms.slice(i, i + MAX), spark: true }) })
                .then(function (r) { return r.json(); })
                .then(function (j) {
                    if (!j || !j.data) return;
                    Object.keys(j.data).forEach(function (sy) { var q = j.data[sy]; if (q && q.spark) sparks[sy] = { spark: q.spark, prev: q.prev, at: Date.now() }; });
                    saveSparks();
                    drawAll();
                }).catch(function () { allAt = 0; });
        }
    }

    function start() { loadSparks(); style(); watchPanel(); drawAll(); setTimeout(watchPanel, 3000); timer = setTimeout(round, 1500); }
    window.liveMarket = { version: VERSION, round: round, apply: apply, movers: movers, panelRows: panelRows, cards: cards, sparkPoints: sparkPoints,
        state: function () { return { gap: gap, rounds: rounds, changed: changed, watching: watching(), busy: busy, lastErr: lastErr }; } };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
