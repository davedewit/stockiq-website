// AI Stock Chat Widget
(function() {
    const LAMBDA_URL = 'https://qkxnxpxsk5dxin7pagolehsqyy0iigpe.lambda-url.us-east-1.on.aws/';
    
    // Create chat widget HTML
    const chatHTML = `
        <style>
        @media (min-width: 769px) {
            body:not(.stock-page) #ai-chat-widget { right: 370px !important; }
            body.stock-page #ai-chat-widget { right: 20px !important; }
            #ai-chat-window { right: 0 !important; }
        }
        @media (max-width: 768px) {
            #ai-chat-widget { right: 20px !important; }
            #ai-chat-window { right: 0 !important; width: calc(100vw - 40px) !important; max-width: 350px !important; }
        }
        </style>
        <div id="ai-chat-widget" style="position: fixed; bottom: 20px; right: 20px; z-index: 10000; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
            <!-- Chat Button -->
            <button id="ai-chat-btn" style="width: 60px; height: 60px; border-radius: 50%; background: #007bff; border: none; box-shadow: 0 4px 12px rgba(0,0,0,0.3); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: transform 0.2s;">
                <svg id="ai-chat-icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                <svg id="ai-chat-close-icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" style="display: none;">
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
            </button>
            
            <!-- Chat Window -->
            <div id="ai-chat-window" style="display: none; position: absolute; bottom: 80px; right: 0; width: 350px; height: 500px; background: var(--bg-primary, #fff); border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.3); flex-direction: column; overflow: hidden;">
                <!-- Header -->
                <div style="background: #007bff; color: white; padding: 16px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="font-weight: 600; font-size: 16px;">AI Stock Assistant</div>
                        <div style="font-size: 12px; opacity: 0.9;">Ask me anything about stocks</div>
                    </div>
                    <button id="ai-chat-close" style="background: none; border: none; color: white; font-size: 24px; cursor: pointer; padding: 0; width: 30px; height: 30px;">&times;</button>
                </div>
                
                <!-- Messages -->
                <div id="ai-chat-messages" style="flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; background: var(--bg-secondary, #f5f5f5);">
                    <div style="background: var(--bg-primary, #fff); padding: 12px; border-radius: 8px; font-size: 14px; color: var(--text-primary, #333);">
                        👋 Hi! I'm your AI stock assistant. Ask me questions like:
                        <ul style="margin: 8px 0 0 0; padding-left: 20px; font-size: 13px;">
                            <li>Should I buy AAPL?</li>
                            <li>How does your S&P 500 screener work?</li>
                            <li>Where can I analyze crypto?</li>
                        </ul>
                    </div>
                </div>
                
                <!-- Input -->
                <div style="padding: 12px; border-top: 1px solid var(--border-color, #ddd); background: var(--bg-primary, #fff);">
                    <div style="display: flex; gap: 8px;">
                        <input id="ai-chat-input" type="text" placeholder="Ask about stocks..." style="flex: 1; padding: 10px; border: 1px solid var(--border-color, #ddd); border-radius: 6px; font-size: 16px; background: var(--bg-primary, #fff); color: var(--text-primary, #333);">
                        <button id="ai-chat-send" style="padding: 10px 16px; background: #007bff; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 16px;">Send</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Insert widget into page
    document.addEventListener('DOMContentLoaded', function() {
        document.body.insertAdjacentHTML('beforeend', chatHTML);
        
        const chatBtn = document.getElementById('ai-chat-btn');
        const chatWindow = document.getElementById('ai-chat-window');
        const chatClose = document.getElementById('ai-chat-close');
        const chatInput = document.getElementById('ai-chat-input');
        const chatSend = document.getElementById('ai-chat-send');
        const chatMessages = document.getElementById('ai-chat-messages');
        
        // Check if rate limited from previous session
        const currentUserId = localStorage.getItem('userId') || 'anonymous';
        const rateLimitedUserId = sessionStorage.getItem('aiChatRateLimitedUser');
        const rateLimited = sessionStorage.getItem('aiChatRateLimited');
        
        // Clear rate limit if user changed (logged in/out)
        if (rateLimited === 'true' && rateLimitedUserId !== currentUserId) {
            sessionStorage.removeItem('aiChatRateLimited');
            sessionStorage.removeItem('aiChatRateLimitedUser');
        } else if (rateLimited === 'true') {
            chatInput.disabled = true;
            chatSend.disabled = true;
            chatInput.placeholder = 'Chat limit reached';
            chatInput.style.opacity = '0.5';
            chatSend.style.opacity = '0.5';
            chatSend.style.cursor = 'not-allowed';
        }
        
        // Clear chat history if user changed (logged in/out)
        const lastChatUserId = sessionStorage.getItem('lastChatUserId');
        if (lastChatUserId && lastChatUserId !== currentUserId) {
            // User changed - clear old chat history
            sessionStorage.removeItem('aiChatHistory_' + lastChatUserId);
        }
        sessionStorage.setItem('lastChatUserId', currentUserId);
        
        // Load chat history from sessionStorage (per user)
        const userId = localStorage.getItem('userId') || 'anonymous';
        const savedHistory = sessionStorage.getItem('aiChatHistory_' + userId);
        if (savedHistory) {
            try {
                const messages = JSON.parse(savedHistory);
                messages.forEach(msg => {
                    const msgId = 'msg-' + Date.now() + Math.random();
                    const isUser = msg.sender === 'user';
                    
                    // Convert URLs to clickable links for AI messages
                    let displayText = msg.text;
                    if (!isUser) {
                        // Decode ALL HTML entities
                        displayText = msg.text.replace(/&amp;/g, '&')
                                             .replace(/&#39;/g, "'")
                                             .replace(/&quot;/g, '"')
                                             .replace(/&lt;/g, '<')
                                             .replace(/&gt;/g, '>');
                        // Handle markdown links [text](url) or [text]url
                        displayText = displayText.replace(/\[([^\]]+)\]\(?(https?:\/\/[^\s)]+)\)?/g, '<a href="$2" style="color: #007bff; text-decoration: underline;">$1</a>');
                        // Handle plain URLs (not already in links)
                        displayText = displayText.replace(/(?<!href=")(?<!>)(https?:\/\/[^\s<]+)(?![^<]*<\/a>)/g, '<a href="$1" style="color: #007bff; text-decoration: underline;">$1</a>');
                    }
                    
                    const msgHTML = `
                        <div id="${msgId}" style="display: flex; ${isUser ? 'justify-content: flex-end;' : ''}">
                            <div style="max-width: 80%; padding: 10px 14px; border-radius: 12px; font-size: 14px; ${isUser ? 'background: #007bff; color: white;' : 'background: var(--bg-primary, #fff); color: var(--text-primary, #333);'}">
                                ${displayText}
                            </div>
                        </div>
                    `;
                    chatMessages.insertAdjacentHTML('beforeend', msgHTML);
                });
                chatMessages.scrollTop = chatMessages.scrollHeight;
            } catch (e) {
                console.error('Failed to load chat history:', e);
            }
        }
        
        // Toggle chat window
        chatBtn.addEventListener('click', function() {
            const isVisible = chatWindow.style.display === 'flex';
            chatWindow.style.display = isVisible ? 'none' : 'flex';
            document.getElementById('ai-chat-icon').style.display = isVisible ? 'block' : 'none';
            document.getElementById('ai-chat-close-icon').style.display = isVisible ? 'none' : 'block';
            if (!isVisible) {
                // Track chat opened
                if (typeof gtag !== 'undefined') {
                    gtag('event', 'chat_opened', {
                        'event_category': 'AI Chat',
                        'event_label': 'Chat Widget Opened'
                    });
                }
                // Don't auto-focus on mobile to prevent keyboard popup
                // Scroll to bottom after window is visible
                setTimeout(() => {
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                }, 0);
            }
        });
        
        chatClose.addEventListener('click', function() {
            chatWindow.style.display = 'none';
            document.getElementById('ai-chat-icon').style.display = 'block';
            document.getElementById('ai-chat-close-icon').style.display = 'none';
        });
        
        // Close chat when clicking outside
        document.addEventListener('click', function(e) {
            if (chatWindow.style.display === 'flex' && 
                !chatWindow.contains(e.target) && 
                !chatBtn.contains(e.target)) {
                chatWindow.style.display = 'none';
                document.getElementById('ai-chat-icon').style.display = 'block';
                document.getElementById('ai-chat-close-icon').style.display = 'none';
            }
        });
        
        // Send message
        function sendMessage() {
            const message = chatInput.value.trim();
            if (!message) return;
            
            // Clear input immediately
            chatInput.value = '';
            
            // Add user message
            addMessage(message, 'user');
            
            // Show typing indicator after a tiny delay to ensure unique ID
            setTimeout(() => {
                const typingId = addMessage('Thinking...', 'ai', true);
                
                // Get user ID - prioritize real userId (email) over anonymous
                let userId = localStorage.getItem('userId');
                const isLoggedIn = userId && userId.includes('@');
                
                if (!isLoggedIn) {
                    // Not logged in - use/generate anonymous ID
                    userId = localStorage.getItem('anonymousId');
                    if (!userId) {
                        userId = 'anon_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                        localStorage.setItem('anonymousId', userId);
                    }
                }
                
                // Call Lambda
                fetch(LAMBDA_URL, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({message, userId})
                })
                .then(res => {
                    if (res.status === 429) {
                        // Rate limit hit - disable chat
                        return res.json().then(data => ({rateLimited: true, data}));
                    }
                    return res.json().then(data => ({rateLimited: false, data}));
                })
                .then(result => {
                    // Remove typing indicator
                    const typingEl = document.getElementById(typingId);
                    if (typingEl) typingEl.remove();
                    
                    if (result.rateLimited) {
                        // Show rate limit message and disable input
                        addMessage(result.data.response, 'ai');
                        chatInput.disabled = true;
                        chatSend.disabled = true;
                        chatInput.placeholder = 'Chat limit reached';
                        chatInput.style.opacity = '0.5';
                        chatSend.style.opacity = '0.5';
                        chatSend.style.cursor = 'not-allowed';
                        sessionStorage.setItem('aiChatRateLimited', 'true');
                        sessionStorage.setItem('aiChatRateLimitedUser', userId);
                        // Track rate limit hit
                        if (typeof gtag !== 'undefined') {
                            gtag('event', 'chat_rate_limited', {
                                'event_category': 'AI Chat',
                                'event_label': isLoggedIn ? 'Logged In' : 'Anonymous'
                            });
                        }
                    } else if (result.data.response) {
                        addMessage(result.data.response, 'ai');
                        
                        // Track message sent
                        if (typeof gtag !== 'undefined') {
                            const history = JSON.parse(sessionStorage.getItem('aiChatHistory_' + userId) || '[]');
                            const messageCount = history.filter(m => m.sender === 'user').length + 1;
                            gtag('event', 'chat_message_sent', {
                                'event_category': 'AI Chat',
                                'event_label': isLoggedIn ? 'Logged In' : 'Anonymous',
                                'value': messageCount
                            });
                        }
                        
                        // Check if this was the 10th message (warning message)
                        if (result.data.response.includes('⚠️')) {
                            // Disable input after showing warning
                            chatInput.disabled = true;
                            chatSend.disabled = true;
                            chatInput.placeholder = 'Chat limit reached';
                            chatInput.style.opacity = '0.5';
                            chatSend.style.opacity = '0.5';
                            chatSend.style.cursor = 'not-allowed';
                            sessionStorage.setItem('aiChatRateLimited', 'true');
                            sessionStorage.setItem('aiChatRateLimitedUser', userId);
                        }
                    } else {
                        addMessage('Sorry, I encountered an error. Please try again.', 'ai');
                    }
                })
                .catch(err => {
                    const typingEl = document.getElementById(typingId);
                    if (typingEl) typingEl.remove();
                    addMessage('Sorry, I\'m having trouble connecting. Please try again.', 'ai');
                });
            }, 10);
        }
        
        chatSend.addEventListener('click', sendMessage);
        chatInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') sendMessage();
        });
        
        // Add message to chat
        function addMessage(text, sender, isTyping = false) {
            const msgId = 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
            const isUser = sender === 'user';
            
            // Convert URLs to clickable links for AI messages
            let displayText = text;
            if (!isUser) {
                // Decode ALL HTML entities
                displayText = text.replace(/&amp;/g, '&')
                                 .replace(/&#39;/g, "'")
                                 .replace(/&quot;/g, '"')
                                 .replace(/&lt;/g, '<')
                                 .replace(/&gt;/g, '>');
                // Handle markdown links [text](url) or [text]url
                displayText = displayText.replace(/\[([^\]]+)\]\(?(https?:\/\/[^\s)]+)\)?/g, '<a href="$2" style="color: #007bff; text-decoration: underline;">$1</a>');
                // Handle plain URLs (not already in links)
                displayText = displayText.replace(/(?<!href=")(?<!>)(https?:\/\/[^\s<]+)(?![^<]*<\/a>)/g, '<a href="$1" style="color: #007bff; text-decoration: underline;">$1</a>');
            }
            
            const msgHTML = `
                <div id="${msgId}" style="display: flex; ${isUser ? 'justify-content: flex-end;' : ''}">
                    <div style="max-width: 80%; padding: 10px 14px; border-radius: 12px; font-size: 14px; ${isUser ? 'background: #007bff; color: white;' : 'background: var(--bg-primary, #fff); color: var(--text-primary, #333);'} ${isTyping ? 'opacity: 0.7; font-style: italic;' : ''}">
                        ${displayText}
                    </div>
                </div>
            `;
            chatMessages.insertAdjacentHTML('beforeend', msgHTML);
            chatMessages.scrollTop = chatMessages.scrollHeight;
            
            // Save to sessionStorage (skip typing indicators) - per user
            if (!isTyping) {
                const userId = localStorage.getItem('userId') || 'anonymous';
                const history = JSON.parse(sessionStorage.getItem('aiChatHistory_' + userId) || '[]');
                history.push({text, sender});
                sessionStorage.setItem('aiChatHistory_' + userId, JSON.stringify(history));
            }
            
            return msgId;
        }
        
        // Hover effect on button
        chatBtn.addEventListener('mouseenter', function() {
            this.style.transform = 'scale(1.1)';
        });
        chatBtn.addEventListener('mouseleave', function() {
            this.style.transform = 'scale(1)';
        });
    });
})();
