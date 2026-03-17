// Global variables
let activeDropdown = null;
let currentPage = 'landing';
let currentOption = null;
let currentSubOption = null;

// Navigation Functions
function showDropdown(dropdownId) {
    if (window.activeDropdown && window.activeDropdown !== dropdownId) {
        document.getElementById(window.activeDropdown).classList.remove('show');
    }
    
    const dropdown = document.getElementById(dropdownId);
    if (dropdown) {
        dropdown.classList.toggle('show');
        window.activeDropdown = dropdown.classList.contains('show') ? dropdownId : null;
    }
}

function toggleMobileMenu(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    const mobileMenu = document.getElementById('mobile-menu');
    const overlay = document.getElementById('mobile-menu-overlay');
    const hamburgerBtn = document.querySelector('.hamburger-btn');
    
    // Store current scroll position
    const scrollY = window.scrollY;
    
    if (mobileMenu) mobileMenu.classList.toggle('open');
    if (overlay) overlay.classList.toggle('show');
    if (hamburgerBtn) hamburgerBtn.classList.toggle('active');
    
    if (mobileMenu && mobileMenu.classList.contains('open')) {
        document.body.style.top = `-${scrollY}px`;
        document.body.classList.add('menu-open');
    } else {
        document.body.classList.remove('menu-open');
        document.body.style.top = '';
        window.scrollTo(0, scrollY);
    }
}

function closeMobileMenu() {
    const scrollY = parseInt(document.body.style.top || '0') * -1;
    
    const mobileMenu = document.getElementById('mobile-menu');
    const overlay = document.getElementById('mobile-menu-overlay');
    const hamburgerBtn = document.querySelector('.hamburger-btn');
    
    if (mobileMenu) mobileMenu.classList.remove('open');
    if (overlay) overlay.classList.remove('show');
    if (hamburgerBtn) hamburgerBtn.classList.remove('active');
    
    document.body.classList.remove('menu-open');
    document.body.style.top = '';
    
    if (scrollY > 0) {
        window.scrollTo(0, scrollY);
    }
}

// Sub-option handlers for Option 1
function showStockInput() {
    document.getElementById('stock-input').style.display = 'block';
    document.getElementById('presets').style.display = 'none';
}

function showPresets() {
    document.getElementById('presets').style.display = 'block';
    document.getElementById('stock-input').style.display = 'none';
}

// Sub-option handlers for Option 2
function showSignalInput() {
    document.getElementById('signal-input').style.display = 'block';
}

// Close dropdowns when clicking outside
document.addEventListener('click', function(event) {
    if (!event.target.closest('.dropdown')) {
        if (window.activeDropdown) {
            const dropdown = document.getElementById(window.activeDropdown);
            if (dropdown) {
                dropdown.classList.remove('show');
            }
            window.activeDropdown = null;
        }
    }
});

// Close mobile menu when clicking outside
document.addEventListener('click', function(event) {
    const mobileMenu = document.getElementById('mobile-menu');
    const hamburgerBtn = document.querySelector('.hamburger-btn');
    
    if (mobileMenu && mobileMenu.classList.contains('open') && 
        !mobileMenu.contains(event.target) && 
        !hamburgerBtn.contains(event.target)) {
        closeMobileMenu();
    }
});

// Generate chart using Lambda function
async function generateChart(symbol) {
    try {
        console.log(`📊 Calling Lambda chart generator for ${symbol}`);
        
        const response = await fetch('https://6beqon56uidrwxtl52oycyn6kq0lyezp.lambda-url.us-east-1.on.aws/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ symbol: symbol })
        });
        
        if (!response.ok) {
            console.error(`Chart API failed for ${symbol}: ${response.status}`);
            return null;
        }
        
        // Check if response is SVG (text) or JSON
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('image/svg+xml')) {
            // Response is SVG - convert to data URL
            const svgText = await response.text();
            const dataUrl = 'data:image/svg+xml;base64,' + btoa(svgText);
            console.log(`✅ SVG chart generated for ${symbol}`);
            return dataUrl;
        } else {
            // Response is JSON - handle as before
            const result = await response.json();
            if (result.success && result.chart_url) {
                console.log(`✅ Chart generated for ${symbol}`);
                return result.chart_url;
            } else {
                console.error(`Chart generation failed for ${symbol}:`, result.error);
                return null;
            }
        }
        
    } catch (error) {
        console.error('Error generating chart for', symbol, ':', error);
        return null;
    }
}

// Initialize page state on load
document.addEventListener('DOMContentLoaded', function() {
    // Make navigation functions globally available
    window.showDropdown = showDropdown;
    window.toggleMobileMenu = toggleMobileMenu;
    window.closeMobileMenu = closeMobileMenu;
    window.generateChart = generateChart;
});