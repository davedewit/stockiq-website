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
        
        // Auto-run if specified
        if (autorun === 'true' && subOption && typeof runAnalysis === 'function') {
            setTimeout(() => runAnalysis(optionNum, subOption), 100);
        }
    }
}

// Run immediately and on DOM ready
handleURLParams();
document.addEventListener('DOMContentLoaded', handleURLParams);
