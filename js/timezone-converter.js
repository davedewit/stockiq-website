// Convert UTC timestamps to user's local timezone
(function() {
    function formatLocalTime(isoString) {
        const date = new Date(isoString);
        
        // Format: "Sat, March 7, 2026 at 1:04 PM GMT+11 3 min read"
        const weekday = date.toLocaleDateString('en-US', { weekday: 'short' });
        const month = date.toLocaleDateString('en-US', { month: 'long' });
        const day = date.getDate();
        const year = date.getFullYear();
        const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        
        // Get timezone offset
        const offset = -date.getTimezoneOffset();
        const offsetHours = Math.floor(Math.abs(offset) / 60);
        const offsetMins = Math.abs(offset) % 60;
        const offsetSign = offset >= 0 ? '+' : '-';
        const offsetStr = offsetMins === 0 
            ? `GMT${offsetSign}${offsetHours}`
            : `GMT${offsetSign}${offsetHours}:${offsetMins.toString().padStart(2, '0')}`;
        
        return `${weekday}, ${month} ${day}, ${year} at ${time} ${offsetStr}`;
    }
    
    function convertTimestamps() {
        // Convert article dates
        const elements = document.querySelectorAll('.article-date[data-timestamp]');
        elements.forEach(el => {
            const timestamp = el.getAttribute('data-timestamp');
            if (timestamp) {
                try {
                    // Extract read time from original text (e.g., "2 min read")
                    const originalText = el.textContent;
                    const readTimeMatch = originalText.match(/(\d+) min read/);
                    const readTime = readTimeMatch ? readTimeMatch[0] : '3 min read';
                    
                    // Format with user's timezone
                    const formattedDate = formatLocalTime(timestamp);
                    el.textContent = `${formattedDate} ${readTime}`;
                } catch (e) {
                    console.error('Error converting timestamp:', e);
                }
            }
        });
        
        // Convert collapsed button dates
        const buttons = document.querySelectorAll('.collapsed-btn[data-timestamp]');
        buttons.forEach(btn => {
            const timestamp = btn.getAttribute('data-timestamp');
            if (timestamp) {
                try {
                    const date = new Date(timestamp);
                    const month = date.toLocaleDateString('en-US', { month: 'long' });
                    const day = date.getDate();
                    const year = date.getFullYear();
                    const newDate = `${month} ${day}, ${year}`;
                    
                    // Store the converted date for use in onclick
                    btn.setAttribute('data-converted-date', newDate);
                    
                    // Replace date in button text
                    const currentText = btn.innerHTML;
                    const datePattern = /[A-Z][a-z]+ \d{1,2}, \d{4}/;
                    const newText = currentText.replace(datePattern, newDate);
                    btn.innerHTML = newText;
                    
                    // Replace onclick to use data-converted-date
                    const articleId = btn.getAttribute('onclick').match(/getElementById\('([^']+)'\)/)[1];
                    const titleMatch = btn.innerHTML.match(/[▶▼] [^:]+: (.+)/);
                    const title = titleMatch ? titleMatch[1] : '';
                    
                    btn.onclick = function() {
                        const d = document.getElementById(articleId);
                        const open = d.style.display === 'block';
                        d.style.display = open ? 'none' : 'block';
                        const convertedDate = this.getAttribute('data-converted-date');
                        this.innerHTML = open ? `▶ ${convertedDate}: ${title}` : `▼ ${convertedDate}: ${title}`;
                    };
                } catch (e) {
                    console.error('Error converting button timestamp:', e);
                }
            }
        });
    }
    
    // Run on page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', convertTimestamps);
    } else {
        convertTimestamps();
    }
})();
