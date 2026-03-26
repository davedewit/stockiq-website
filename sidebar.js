// Shared sidebar data fetching and rendering
// Used by index.html, dashboard.html, and analysis.html

const LAMBDA_URLS = {
    us: 'https://xqma6tuoaeb5nd32gpdyk5uonm0yvgiy.lambda-url.us-east-1.on.aws/',
    europe: 'https://2azr7bjzjfvkadj2hzztk5icia0xnnoa.lambda-url.us-east-1.on.aws/',
    asia: 'https://kzspffs5uombzw73vudd3p57x40agikm.lambda-url.us-east-1.on.aws/',
    cryptocurrencies: 'https://x5xnafkpdtym4i7vezbhjaizry0leaxk.lambda-url.us-east-1.on.aws/',
    rates: 'https://ewowkcosbyc5rkk2b6ypvlx6la0pzfww.lambda-url.us-east-1.on.aws/',
    commodities: 'https://4ynwdgbmuf7jvxxxckmvu7plwa0gxnby.lambda-url.us-east-1.on.aws/',
    currencies: 'https://xdqiva3aoe4e4esa3cwdrkyt7i0izcvr.lambda-url.us-east-1.on.aws/'
};

let marketDataSidebar = {};
let currentTabSidebar = 'us';

async function fetchMarketDataSidebar() {
    const cachedData = localStorage.getItem('marketDataSidebar');
    if (cachedData) {
        try {
            marketDataSidebar = JSON.parse(cachedData);
            const loadingEl = document.getElementById('loading-sidebar');
            if (loadingEl) loadingEl.style.display = 'none';
            renderMarketDataSidebar(currentTabSidebar);
        } catch (e) {}
    }

    if (document.hidden) return;

    try {
        const timestamp = Date.now();
        const promises = Object.entries(LAMBDA_URLS).map(async ([category, url]) => {
            try {
                const response = await fetch(`${url}?t=${timestamp}`);
                const data = await response.json();
                return { category, data: data[category] || {} };
            } catch (error) {
                return { category, data: {} };
            }
        });

        const results = await Promise.all(promises);
        const newData = { timestamp: new Date().toISOString() };
        results.forEach(({ category, data }) => {
            newData[category] = data;
        });

        if (Object.keys(newData).length > 1 && newData[currentTabSidebar] && Object.keys(newData[currentTabSidebar]).length > 0) {
            marketDataSidebar = newData;
            localStorage.setItem('marketDataSidebar', JSON.stringify(marketDataSidebar));
            const loadingEl = document.getElementById('loading-sidebar');
            if (loadingEl) loadingEl.style.display = 'none';
            renderMarketDataSidebar(currentTabSidebar);
        } else if (!cachedData) {
            renderMarketDataSidebar(currentTabSidebar);
        }
    } catch (error) {
        if (!cachedData) {
            const loadingEl = document.getElementById('loading-sidebar');
            if (loadingEl) loadingEl.innerHTML = 'Failed to load';
        }
    }
}

function renderMarketDataSidebar(tab) {
    const modal = document.getElementById('mobile-sidebar-modal');
    const isModalOpen = modal && modal.style.display === 'block';
    const container = isModalOpen ? modal.querySelector('#market-data-sidebar-container') : document.getElementById('market-data-sidebar-container');
    const data = marketDataSidebar[tab];

    if (!data || !container) return;

    container.innerHTML = '';
    container.style.display = 'grid';

    const entries = Object.entries(data).slice(0, 6);
    entries.forEach(([name, info]) => {
        if (info.error) return;

        const isPositive = info.change >= 0;
        const changeClass = isPositive ? 'positive' : 'negative';
        const changeSymbol = isPositive ? '+' : '';
        const chartColor = isPositive ? '#22c55e' : '#ef4444';
        const symbol = info.symbol || name;

        const item = document.createElement('div');
        item.className = 'market-item-sidebar';
        item.style.cursor = 'pointer';
        item.title = 'View Analysis';
        item.onclick = () => window.location.href = `analysis.html?symbol=${encodeURIComponent(symbol)}&option=1&subOption=custom`;
        item.innerHTML = `
<div class="market-item-sidebar-name">${name}</div>
<div class="market-item-sidebar-value">${formatValueSidebar(info.value, tab)}</div>
<svg class="market-item-sidebar-chart" width="100%" height="30" viewBox="0 0 100 30" preserveAspectRatio="none">
<polyline points="${generateSparkline(isPositive)}" stroke="${chartColor}" stroke-width="1.5" fill="none" opacity="0.8"/>
</svg>
<div class="market-item-sidebar-change ${changeClass}">${changeSymbol}${info.change.toFixed(2)} (${changeSymbol}${info.changePercent.toFixed(2)}%)</div>
`;
        container.appendChild(item);
    });
}

function generateSparkline(isPositive) {
    const points = [];
    const segments = 20;
    const baseY = 15;
    const amplitude = 8;

    for (let i = 0; i <= segments; i++) {
        const x = (i / segments) * 100;
        const randomVariation = (Math.random() - 0.5) * amplitude;
        const trend = isPositive ? -i * 0.3 : i * 0.3;
        const y = baseY + randomVariation + trend;
        points.push(`${x},${Math.max(2, Math.min(28, y))}`);
    }

    return points.join(' ');
}

function formatValueSidebar(value, category) {
    if (category === 'cryptocurrencies') {
        return value >= 1000 ? value.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : value.toFixed(4);
    }
    return value.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
}

async function fetchTrendingTickers(forceRefresh = false) {
    const lastFetch = localStorage.getItem('trendingTickersLastFetchTime');
    const now = Date.now();
    const shouldFetch = forceRefresh || !lastFetch || (now - parseInt(lastFetch)) >= 300 * 1000;

    let todayTickers = JSON.parse(localStorage.getItem('trendingTickersList') || '[]').slice(0, 5);
    if (!todayTickers.length) todayTickers = ['NVDA', 'TSLA', 'AAPL', 'MSFT', 'GOOGL'];

    const cachedPrices = localStorage.getItem('trendingTickerPrices');
    if (cachedPrices) {
        try {
            const priceData = JSON.parse(cachedPrices);
            Object.keys(priceData).forEach(ticker => {
                const data = priceData[ticker];
                const tickerId = ticker.toLowerCase().replace(/[^a-z0-9]/g, '');
                const nameElem = document.getElementById(`trend-name-${tickerId}`);
                const priceElem = document.getElementById(`trend-price-${tickerId}`);
                const changeElem = document.getElementById(`trend-change-${tickerId}`);
                if (nameElem) nameElem.textContent = data.name || ticker;
                if (priceElem) priceElem.textContent = typeof data.price === 'number' ? data.price.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : data.price;
                if (changeElem) {
                    const changeSign = data.changePercent >= 0 ? '+' : '';
                    changeElem.textContent = `${changeSign}${data.change.toFixed(2)} (${changeSign}${data.changePercent.toFixed(2)}%)`;
                    changeElem.style.color = data.changePercent >= 0 ? '#22c55e' : '#ef4444';
                }
            });
        } catch (e) {}
    }

    if (document.hidden || !shouldFetch) return;

    localStorage.setItem('trendingTickersLastFetchTime', Date.now().toString());

    try {
        const trendResponse = await fetch('https://iz6jpzev3ty4q37anieqnckkxa0skisc.lambda-url.us-east-1.on.aws/?t=' + Date.now());
        const trendResult = await trendResponse.json();
        if (trendResult.success && trendResult.tickers) {
            const newTickers = trendResult.tickers.slice(0, 5);
            if (JSON.stringify(newTickers) !== JSON.stringify(todayTickers)) {
                todayTickers = newTickers;
                localStorage.setItem('trendingTickersList', JSON.stringify(trendResult.tickers));
                if (window.renderTrendingTickers) window.renderTrendingTickers(todayTickers);
            }
        }
    } catch (e) {}

    if (todayTickers.length === 0) return;

    try {
        const response = await fetch('https://2vl4la6od3vfgbkv6ycbj7ewry0yxvck.lambda-url.us-east-1.on.aws/', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({tickers: todayTickers})
        });
        const result = await response.json();

        if (result.success && result.data) {
            const oldCache = JSON.parse(localStorage.getItem('trendingTickerPrices') || '{}');
            const priceCache = {};
            Object.keys(result.data).forEach(ticker => {
                const data = result.data[ticker];
                if (!data.error) {
                    const tickerId = ticker.toLowerCase().replace(/[^a-z0-9]/g, '');
                    const priceElem = document.getElementById(`trend-price-${tickerId}`);
                    const changeElem = document.getElementById(`trend-change-${tickerId}`);
                    const nameElem = document.getElementById(`trend-name-${tickerId}`);

                    if (nameElem) nameElem.textContent = data.name || ticker;
                    if (priceElem) priceElem.textContent = data.price.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
                    if (changeElem) {
                        const changeSign = data.changePercent >= 0 ? '+' : '';
                        changeElem.textContent = `${changeSign}${data.change.toFixed(2)} (${changeSign}${data.changePercent.toFixed(2)}%)`;
                        changeElem.style.color = data.changePercent >= 0 ? '#22c55e' : '#ef4444';
                    }

                    priceCache[ticker] = {name: data.name || ticker, price: data.price, change: data.change, changePercent: data.changePercent};
                }
            });
            localStorage.setItem('trendingTickerPrices', JSON.stringify(priceCache));
        }
    } catch (error) {}
}

async function fetchTopGainers(forceRefresh = false) {
    const lastFetch = localStorage.getItem('gainersLastFetchTime');
    const now = Date.now();
    const shouldFetch = forceRefresh || !lastFetch || (now - parseInt(lastFetch)) >= 300 * 1000;

    let todayGainers = JSON.parse(localStorage.getItem('gainersTickersList') || '[]').slice(0, 5);
    if (!todayGainers.length) todayGainers = ['NVDA', 'TSLA', 'AAPL', 'MSFT', 'GOOGL'];

    const cachedPrices = localStorage.getItem('gainersTickerPrices');
    if (cachedPrices) {
        try {
            const priceData = JSON.parse(cachedPrices);
            Object.keys(priceData).forEach(ticker => {
                const data = priceData[ticker];
                const tickerId = ticker.toLowerCase().replace(/[^a-z0-9]/g, '');
                const priceElem = document.getElementById(`gainer-price-${tickerId}`);
                const changeElem = document.getElementById(`gainer-change-${tickerId}`);
                if (priceElem) priceElem.textContent = typeof data.price === 'number' ? data.price.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : data.price;
                if (changeElem) {
                    const changeSign = data.changePercent >= 0 ? '+' : '';
                    changeElem.textContent = `${changeSign}${data.change.toFixed(2)} (${changeSign}${data.changePercent.toFixed(2)}%)`;
                    changeElem.style.color = '#22c55e';
                }
            });
        } catch (e) {}
    }

    if (document.hidden || !shouldFetch) return;

    try {
        const gainerResponse = await fetch('https://hfya2wu77mjszyffeeqzvzhjh40iywvz.lambda-url.us-east-1.on.aws/?t=' + Date.now());
        const gainerResult = await gainerResponse.json();
        if (gainerResult.success && gainerResult.tickers) {
            const newGainers = gainerResult.tickers.slice(0, 5);
            if (JSON.stringify(newGainers) !== JSON.stringify(todayGainers)) {
                todayGainers = newGainers;
                localStorage.setItem('gainersTickersList', JSON.stringify(gainerResult.tickers));
                localStorage.setItem('gainersLastFetchTime', Date.now().toString());
                if (window.renderGainersTickers) window.renderGainersTickers(todayGainers, false);
            }
        }
    } catch (e) {}

    if (todayGainers.length === 0) return;

    try {
        const response = await fetch('https://2vl4la6od3vfgbkv6ycbj7ewry0yxvck.lambda-url.us-east-1.on.aws/', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({tickers: todayGainers})
        });
        const result = await response.json();

        if (result.success && result.data) {
            const priceCache = {};
            Object.keys(result.data).forEach(ticker => {
                const data = result.data[ticker];
                if (!data.error) {
                    const tickerId = ticker.toLowerCase().replace(/[^a-z0-9]/g, '');
                    const priceElem = document.getElementById(`gainer-price-${tickerId}`);
                    const changeElem = document.getElementById(`gainer-change-${tickerId}`);

                    if (priceElem) priceElem.textContent = data.price.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
                    if (changeElem) {
                        const changeSign = data.changePercent >= 0 ? '+' : '';
                        changeElem.textContent = `${changeSign}${data.change.toFixed(2)} (${changeSign}${data.changePercent.toFixed(2)}%)`;
                        changeElem.style.color = '#22c55e';
                    }

                    priceCache[ticker] = {name: data.name || ticker, price: data.price, change: data.change, changePercent: data.changePercent};
                }
            });
            localStorage.setItem('gainersTickerPrices', JSON.stringify(priceCache));
            localStorage.setItem('gainersLastFetchTime', Date.now().toString());
        }
    } catch (error) {}
}

async function fetchTopLosers(forceRefresh = false) {
    const lastFetch = localStorage.getItem('losersLastFetchTime');
    const now = Date.now();
    const shouldFetch = forceRefresh || !lastFetch || (now - parseInt(lastFetch)) >= 300 * 1000;

    let todayLosers = JSON.parse(localStorage.getItem('losersTickersList') || '[]').slice(0, 5);
    if (!todayLosers.length) todayLosers = ['NKLA', 'WISH', 'CLOV', 'SPCE', 'HOOD'];

    const cachedPrices = localStorage.getItem('losersTickerPrices');
    if (cachedPrices) {
        try {
            const priceData = JSON.parse(cachedPrices);
            Object.keys(priceData).forEach(ticker => {
                const data = priceData[ticker];
                const tickerId = ticker.toLowerCase().replace(/[^a-z0-9]/g, '');
                const priceElem = document.getElementById(`loser-price-${tickerId}`);
                const changeElem = document.getElementById(`loser-change-${tickerId}`);
                if (priceElem) priceElem.textContent = typeof data.price === 'number' ? data.price.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : data.price;
                if (changeElem) {
                    const changeSign = data.changePercent >= 0 ? '+' : '';
                    changeElem.textContent = `${changeSign}${data.change.toFixed(2)} (${changeSign}${data.changePercent.toFixed(2)}%)`;
                    changeElem.style.color = '#ef4444';
                }
            });
        } catch (e) {}
    }

    if (document.hidden || !shouldFetch) return;

    try {
        const loserResponse = await fetch('https://dzzudu2sf6b2yh7j4utknjn33i0mhahj.lambda-url.us-east-1.on.aws/?t=' + Date.now());
        const loserResult = await loserResponse.json();
        if (loserResult.success && loserResult.tickers) {
            const newLosers = loserResult.tickers.slice(0, 5);
            if (JSON.stringify(newLosers) !== JSON.stringify(todayLosers)) {
                todayLosers = newLosers;
                localStorage.setItem('losersTickersList', JSON.stringify(loserResult.tickers));
                localStorage.setItem('losersLastFetchTime', Date.now().toString());
                if (window.renderLosersTickers) window.renderLosersTickers(todayLosers, false);
            }
        }
    } catch (e) {}

    if (todayLosers.length === 0) return;

    try {
        const response = await fetch('https://2vl4la6od3vfgbkv6ycbj7ewry0yxvck.lambda-url.us-east-1.on.aws/', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({tickers: todayLosers})
        });
        const result = await response.json();

        if (result.success && result.data) {
            const priceCache = {};
            Object.keys(result.data).forEach(ticker => {
                const data = result.data[ticker];
                if (!data.error) {
                    const tickerId = ticker.toLowerCase().replace(/[^a-z0-9]/g, '');
                    const priceElem = document.getElementById(`loser-price-${tickerId}`);
                    const changeElem = document.getElementById(`loser-change-${tickerId}`);

                    if (priceElem) priceElem.textContent = data.price.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
                    if (changeElem) {
                        const changeSign = data.changePercent >= 0 ? '+' : '';
                        changeElem.textContent = `${changeSign}${data.change.toFixed(2)} (${changeSign}${data.changePercent.toFixed(2)}%)`;
                        changeElem.style.color = '#ef4444';
                    }

                    priceCache[ticker] = {name: data.name || ticker, price: data.price, change: data.change, changePercent: data.changePercent};
                }
            });
            localStorage.setItem('losersTickerPrices', JSON.stringify(priceCache));
            localStorage.setItem('losersLastFetchTime', Date.now().toString());
        }
    } catch (error) {}
}

async function fetchMostActive(forceRefresh = false) {
    const lastFetch = localStorage.getItem('activeLastFetchTime');
    const now = Date.now();
    const shouldFetch = forceRefresh || !lastFetch || (now - parseInt(lastFetch)) >= 300 * 1000;

    let todayActive = JSON.parse(localStorage.getItem('activeTickersList') || '[]').slice(0, 5);

    const cachedPrices = localStorage.getItem('activeTickerPrices');
    if (cachedPrices) {
        try {
            const priceData = JSON.parse(cachedPrices);
            Object.keys(priceData).forEach(ticker => {
                const data = priceData[ticker];
                const tickerId = ticker.toLowerCase().replace(/[^a-z0-9]/g, '');
                const priceElem = document.getElementById(`active-price-${tickerId}`);
                const changeElem = document.getElementById(`active-change-${tickerId}`);
                if (priceElem) priceElem.textContent = typeof data.price === 'number' ? data.price.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : data.price;
                if (changeElem) {
                    const changeSign = data.changePercent >= 0 ? '+' : '';
                    const color = data.changePercent >= 0 ? '#22c55e' : '#ef4444';
                    changeElem.textContent = `${changeSign}${data.change.toFixed(2)} (${changeSign}${data.changePercent.toFixed(2)}%)`;
                    changeElem.style.color = color;
                }
            });
        } catch (e) {}
    }

    if (document.hidden || !shouldFetch) return;

    try {
        const activeResponse = await fetch('https://hd5z2yzvrksub43ihitf7ea3bq0opwxa.lambda-url.us-east-1.on.aws/?t=' + Date.now());
        const activeResult = await activeResponse.json();
        if (activeResult.success && activeResult.tickers) {
            const newActive = activeResult.tickers.slice(0, 5);
            if (JSON.stringify(newActive) !== JSON.stringify(todayActive)) {
                todayActive = newActive;
                localStorage.setItem('activeTickersList', JSON.stringify(activeResult.tickers));
                localStorage.setItem('activeLastFetchTime', Date.now().toString());
                if (window.renderActiveTickers) window.renderActiveTickers(todayActive, false);
            }
        }
    } catch (e) {}

    if (todayActive.length === 0) return;

    try {
        const response = await fetch('https://2vl4la6od3vfgbkv6ycbj7ewry0yxvck.lambda-url.us-east-1.on.aws/', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({tickers: todayActive})
        });
        const result = await response.json();

        if (result.success && result.data) {
            const priceCache = {};
            Object.keys(result.data).forEach(ticker => {
                const data = result.data[ticker];
                if (!data.error) {
                    const tickerId = ticker.toLowerCase().replace(/[^a-z0-9]/g, '');
                    const priceElem = document.getElementById(`active-price-${tickerId}`);
                    const changeElem = document.getElementById(`active-change-${tickerId}`);

                    if (priceElem) priceElem.textContent = data.price.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
                    if (changeElem) {
                        const changeSign = data.changePercent >= 0 ? '+' : '';
                        const color = data.changePercent >= 0 ? '#22c55e' : '#ef4444';
                        changeElem.textContent = `${changeSign}${data.change.toFixed(2)} (${changeSign}${data.changePercent.toFixed(2)}%)`;
                        changeElem.style.color = color;
                    }

                    priceCache[ticker] = {name: data.name || ticker, price: data.price, change: data.change, changePercent: data.changePercent};
                }
            });
            localStorage.setItem('activeTickerPrices', JSON.stringify(priceCache));
            localStorage.setItem('activeLastFetchTime', Date.now().toString());
        }
    } catch (error) {}
}

// Initialize sidebar data fetching
function initSidebarData() {
    fetchMarketDataSidebar();
    fetchTrendingTickers(true);
    fetchTopGainers(true);
    fetchTopLosers(true);
    fetchMostActive(true);

    // Auto-refresh every 5 minutes
    let lastActivity = Date.now();
    document.addEventListener('mousemove', () => lastActivity = Date.now());
    document.addEventListener('keypress', () => lastActivity = Date.now());
    document.addEventListener('click', () => lastActivity = Date.now());
    document.addEventListener('scroll', () => lastActivity = Date.now());

    setInterval(() => {
        const idleTime = Date.now() - lastActivity;
        const maxIdle = 30 * 60 * 1000;
        if (!document.hidden && idleTime < maxIdle) {
            setTimeout(() => fetchTrendingTickers(false), Math.random() * 5000);
            setTimeout(() => fetchTopGainers(false), Math.random() * 5000);
            setTimeout(() => fetchTopLosers(false), Math.random() * 5000);
            setTimeout(() => fetchMostActive(false), Math.random() * 5000);
        }
    }, 300 * 1000);

    setInterval(() => {
        const idleTime = Date.now() - lastActivity;
        const maxIdle = 30 * 60 * 1000;
        if (!document.hidden && idleTime < maxIdle) {
            fetchMarketDataSidebar();
        }
    }, 5 * 60 * 1000);
}
