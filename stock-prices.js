// Live stock price updater for "People also watch" section
// Fetches prices every 5 seconds while user is on the page

(function() {
    const LAMBDA_URL = 'https://vknfjazip3xpfwpfyd6ja6ui6q0lmxkw.lambda-url.us-east-1.on.aws/';
    let updateInterval = null;
    let previousPrices = {};
    let isFirstLoad = true;
    
    function getStockSymbols() {
        const symbols = [];
        
        // Get main stock symbol from page
        const mainSymbol = document.querySelector('[data-main-symbol]');
        if (mainSymbol) {
            symbols.push(mainSymbol.getAttribute('data-main-symbol'));
        }
        
        // Get "People also watch" symbols
        const priceElements = document.querySelectorAll('.stock-price[data-symbol]');
        priceElements.forEach(el => {
            const symbol = el.getAttribute('data-symbol');
            if (symbol) symbols.push(symbol);
        });
        
        return symbols;
    }
    
    async function fetchPrices(symbols) {
        if (!symbols || symbols.length === 0) return {};
        
        try {
            const response = await fetch(`${LAMBDA_URL}?symbols=${symbols.join(',')}`);
            if (!response.ok) throw new Error('Failed to fetch prices');
            return await response.json();
        } catch (error) {
            console.error('Error fetching stock prices:', error);
            return {};
        }
    }
    
    function updateMainTicker(symbol, data) {
        const tickerEl = document.getElementById('live-ticker');
        if (!tickerEl || !data || !data.price) return;
        
        const price = data.price;
        const change = data.change;
        const changePercent = data.changePercent;
        
        // Get previous values
        const oldData = previousPrices[symbol] || {};
        const oldPrice = oldData.price;
        const oldChange = oldData.change;
        const oldChangePercent = oldData.changePercent;
        
        // Determine flash color for price (only if price actually changed)
        let priceFlashBg = 'transparent';
        if (!isFirstLoad && oldPrice !== undefined && oldPrice !== price) {
            priceFlashBg = price > oldPrice ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)';
        }
        
        // Determine flash color for change/percentage (only if change OR changePercent value actually changed)
        let changeFlashBg = 'transparent';
        if (!isFirstLoad && oldChange !== undefined && oldChangePercent !== undefined) {
            // Check if either change or changePercent changed (use 0.005 threshold for floating point safety)
            const changeChanged = Math.abs(oldChange - change) > 0.005;
            const percentChanged = Math.abs(oldChangePercent - changePercent) > 0.005;
            
            if (changeChanged || percentChanged) {
                // Flash based on whether the new change is better or worse than old
                changeFlashBg = change > oldChange ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)';
            }
        }
        
        // Price with flash background
        let html = `<span id="price-indicator" style="font-size: 1.5em; font-weight: bold; color: var(--text-primary); background-color: ${priceFlashBg}; padding: 2px 8px; border-radius: 4px; transition: background-color 1s ease;">${price.toFixed(2)}</span>`;
        
        // Change/percentage colored based on day performance with flash
        if (change !== null && changePercent !== null) {
            const dayColor = change >= 0 ? '#22c55e' : '#ef4444';
            const sign = change >= 0 ? '+' : '';
            
            html += ` <span id="change-indicator" style="font-size: 1.2em; color: ${dayColor}; background-color: ${changeFlashBg}; padding: 2px 8px; border-radius: 4px; transition: background-color 1s ease;">${sign}${change.toFixed(2)} (${sign}${changePercent.toFixed(2)}%)</span>`;
        }
        
        tickerEl.innerHTML = html;
        
        // Fade backgrounds back to transparent after 1 second (only for elements that flashed)
        if (!isFirstLoad) {
            if (oldPrice !== undefined && oldPrice !== price) {
                setTimeout(() => {
                    const priceEl = document.getElementById('price-indicator');
                    if (priceEl) priceEl.style.backgroundColor = 'transparent';
                }, 1000);
            }
            if (oldChange !== undefined && oldChangePercent !== undefined) {
                const changeChanged = Math.abs(oldChange - change) > 0.005;
                const percentChanged = Math.abs(oldChangePercent - changePercent) > 0.005;
                
                if (changeChanged || percentChanged) {
                    setTimeout(() => {
                        const changeEl = document.getElementById('change-indicator');
                        if (changeEl) changeEl.style.backgroundColor = 'transparent';
                    }, 1000);
                }
            }
        }
        
        // Store current values for next comparison
        previousPrices[symbol] = {
            price: price,
            change: change,
            changePercent: changePercent
        };
    }
    
    function updatePrices(prices) {
        // Update main ticker if present
        const mainSymbol = document.querySelector('[data-main-symbol]');
        if (mainSymbol) {
            const symbol = mainSymbol.getAttribute('data-main-symbol');
            if (prices[symbol]) {
                updateMainTicker(symbol, prices[symbol]);
            }
        }
        
        // Update "People also watch" prices
        const priceElements = document.querySelectorAll('.stock-price[data-symbol]');
        priceElements.forEach(el => {
            const symbol = el.getAttribute('data-symbol');
            const data = prices[symbol];
            
            if (data && data.price !== undefined && data.price !== null) {
                const newPrice = data.price;
                const oldData = previousPrices[symbol] || {};
                const oldPrice = oldData.price;
                
                el.textContent = `$${newPrice.toFixed(2)}`;
                
                // Set color based on price change (only if price actually changed)
                if (!isFirstLoad && oldPrice !== undefined && oldPrice !== newPrice) {
                    if (newPrice > oldPrice) {
                        // Price went up - green
                        el.style.color = '#22c55e';
                        el.style.transition = 'color 0.3s ease';
                    } else if (newPrice < oldPrice) {
                        // Price went down - red
                        el.style.color = '#ef4444';
                        el.style.transition = 'color 0.3s ease';
                    }
                } else if (oldPrice === undefined) {
                    // First load - default color
                    el.style.color = 'var(--text-secondary)';
                }
                // If price unchanged, keep current color
                
                // Store current price for next comparison
                if (!previousPrices[symbol]) {
                    previousPrices[symbol] = {};
                }
                previousPrices[symbol].price = newPrice;
            }
        });
    }
    
    async function refreshPrices() {
        const symbols = getStockSymbols();
        if (symbols.length === 0) return;
        
        const prices = await fetchPrices(symbols);
        updatePrices(prices);
        
        // After first load, enable flashing for subsequent updates
        if (isFirstLoad) {
            isFirstLoad = false;
        }
    }
    
    // Start updating prices when page loads
    function init() {
        // Initial fetch
        refreshPrices();
        
        // Update every 5 seconds
        updateInterval = setInterval(refreshPrices, 5000);
        
        // Stop updating when user leaves page
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                if (updateInterval) {
                    clearInterval(updateInterval);
                    updateInterval = null;
                }
            } else {
                if (!updateInterval) {
                    refreshPrices();
                    updateInterval = setInterval(refreshPrices, 5000);
                }
            }
        });
    }
    
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
