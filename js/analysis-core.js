// Core analysis orchestrator - delegates to feature modules
// (Variables declared in main file)

// Dynamic module loader
async function loadAnalysisModule(option) {
    const moduleMap = {
        1: 'stock-analysis.js',
        2: 'trading-signals.js',
        3: 'us-screeners.js',
        4: 'asx-screeners.js',
        7: 'crypto-screeners.js'
    };
    
    const file = moduleMap[option];
    if (!file || window.loadedModules?.[file]) return;
    
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = `js/modules/${file}`;
        script.onload = () => {
            window.loadedModules = window.loadedModules || {};
            window.loadedModules[file] = true;
            resolve();
        };
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// Bot/crawler detection
function isBotOrCrawler() {
    const ua = navigator.userAgent.toLowerCase();
    const botPatterns = ['bot', 'crawler', 'spider', 'google', 'bing', 'yahoo', 'baidu',
                         'slurp', 'duckduckbot', 'yandex', 'facebookexternalhit',
                         'twitterbot', 'linkedinbot', 'whatsapp', 'telegram', 'headless'];
    return botPatterns.some(p => ua.includes(p));
}

// URL parameter handling - immediate processing
function handleURLParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const option = urlParams.get('option');
    const subOption = urlParams.get('subOption');
    const autorun = urlParams.get('autorun');
    
    if (option) {
        const optionNum = parseInt(option);
        
        // Hide menu and show option immediately
        const mainMenu = document.getElementById('main-menu');
        const optionSection = document.getElementById(`option-${optionNum}`);
        const backBtn = document.getElementById('back-btn');
        
        if (mainMenu) mainMenu.style.display = 'none';
        if (optionSection) optionSection.style.display = 'block';
        if (backBtn) backBtn.style.display = 'block';
        
        // Auto-run if specified - skip for bots
        if (autorun === 'true' && subOption && typeof runAnalysis === 'function') {
            if (isBotOrCrawler()) {
                console.log('🤖 Bot detected, skipping autorun analysis');
                return;
            }
            setTimeout(() => runAnalysis(optionNum, subOption), 100);
        }
    }
}

// Run on DOM ready only
document.addEventListener('DOMContentLoaded', handleURLParams);
