// Migrate old localStorage keys to new format
(function migrateNotificationKeys() {
    const userId = localStorage.getItem('userId');
    if (userId && userId !== 'anonymous') {
        const oldUnread = localStorage.getItem('unreadReports');
        const oldSeen = localStorage.getItem('seenReports');
        
        if (oldUnread) {
            localStorage.setItem(`unreadReports_${userId}`, oldUnread);
            localStorage.removeItem('unreadReports');
            console.log('✅ Migrated unreadReports to new format');
        }
        if (oldSeen) {
            localStorage.setItem(`seenReports_${userId}`, oldSeen);
            localStorage.removeItem('seenReports');
            console.log('✅ Migrated seenReports to new format');
        }
    }
})();

// AWS Cognito Authentication
const COGNITO_CONFIG = {
    region: 'us-east-1', // Change to your region
    userPoolId: 'us-east-1_P4lqPzrlY', // Replace with your User Pool ID
    clientId: '6s3i43db9g6jlgjisr0b3blh56' // Replace with your Client ID
};

class AuthManager {
    constructor() {
        this.currentUser = null;
        this._checkingAuth = false;
        this.checkAuthStatus();
    }

    async signUp(email, password, name) {
        try {
            // Check IP blocking BEFORE attempting Cognito registration
            const ipCheckResult = await this.checkIPBlocking(email, name);
            if (!ipCheckResult.allowed) {
                return { success: false, error: ipCheckResult.error };
            }

            const response = await fetch(`https://cognito-idp.${COGNITO_CONFIG.region}.amazonaws.com/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-amz-json-1.1',
                    'X-Amz-Target': 'AWSCognitoIdentityProviderService.SignUp'
                },
                body: JSON.stringify({
                    ClientId: COGNITO_CONFIG.clientId,
                    Username: email,
                    Password: password,
                    UserAttributes: [
                        { Name: 'email', Value: email },
                        { Name: 'name', Value: name }
                    ]
                })
            });

            const data = await response.json();
            
            if (response.ok) {
                // Cognito registration succeeded, now create registration record in DynamoDB
                // This should succeed since we already checked IP blocking
                await this.createRegistrationRecord(email, name);
                return { success: true, data };
            } else {
                throw new Error(data.message || 'Sign up failed');
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async confirmSignUp(email, code) {
        try {
            const response = await fetch(`https://cognito-idp.${COGNITO_CONFIG.region}.amazonaws.com/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-amz-json-1.1',
                    'X-Amz-Target': 'AWSCognitoIdentityProviderService.ConfirmSignUp'
                },
                body: JSON.stringify({
                    ClientId: COGNITO_CONFIG.clientId,
                    Username: email,
                    ConfirmationCode: code
                })
            });

            const data = await response.json();
            
            if (response.ok) {
                return { success: true };
            } else {
                throw new Error(data.message || 'Confirmation failed');
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async signIn(email, password) {
        try {
            const response = await fetch(`https://cognito-idp.${COGNITO_CONFIG.region}.amazonaws.com/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-amz-json-1.1',
                    'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth'
                },
                body: JSON.stringify({
                    ClientId: COGNITO_CONFIG.clientId,
                    AuthFlow: 'USER_PASSWORD_AUTH',
                    AuthParameters: {
                        USERNAME: email,
                        PASSWORD: password
                    }
                })
            });

            const data = await response.json();
            
            if (response.ok && data.AuthenticationResult) {
                const tokens = data.AuthenticationResult;
                localStorage.setItem('accessToken', tokens.AccessToken);
                localStorage.setItem('refreshToken', tokens.RefreshToken);
                localStorage.setItem('idToken', tokens.IdToken);
                
                this.currentUser = this.parseJWT(tokens.IdToken);
                
                // Store userId for dashboard
                localStorage.setItem('userId', this.currentUser.email);
                
                // Store login time for 3-day session
                localStorage.setItem('loginTime', Date.now().toString());
                
                // Update user's IP address on login for enhanced duplicate prevention
                try {
                    await this.updateUserIPOnLogin(this.currentUser.email);
                } catch (error) {
                    console.warn('Failed to update IP on login:', error);
                }
                
                // Check subscription status and cache immediately to prevent banner flash
                try {
                    const subStatus = await this.getSubscriptionStatus();
                    const cacheKey = `userPaidStatus_${this.currentUser.email}`;
                    if (subStatus.hasPaid) {
                        localStorage.setItem(cacheKey, 'paid');
                    }
                } catch (error) {
                    console.warn('Failed to check subscription on login:', error);
                }
                
                setTimeout(() => {
                    this.updateUI();
                    setTimeout(displayTrialStatus, 100);
                    if (typeof updateNotificationBell === 'function') {
                        updateNotificationBell();
                    }
                }, 100);
                
                // Handle redirect after login
                const redirectUrl = localStorage.getItem('redirectAfterLogin');
                if (redirectUrl) {
                    localStorage.removeItem('redirectAfterLogin');
                    setTimeout(() => {
                        window.location.href = redirectUrl;
                    }, 200);
                }
                
                // Update notification bell
                setTimeout(() => {
                    if (typeof updateNotificationBell === 'function') {
                        updateNotificationBell();
                    }
                }, 300);
                
                return { success: true, user: this.currentUser };
            } else {
                throw new Error(data.message || 'Sign in failed');
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async forgotPassword(email) {
        try {
            const response = await fetch(`https://cognito-idp.${COGNITO_CONFIG.region}.amazonaws.com/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-amz-json-1.1',
                    'X-Amz-Target': 'AWSCognitoIdentityProviderService.ForgotPassword'
                },
                body: JSON.stringify({
                    ClientId: COGNITO_CONFIG.clientId,
                    Username: email
                })
            });

            const data = await response.json();
            
            if (response.ok) {
                return { success: true, data };
            } else {
                throw new Error(data.message || 'Failed to send reset code');
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async confirmForgotPassword(email, code, newPassword) {
        try {
            const response = await fetch(`https://cognito-idp.${COGNITO_CONFIG.region}.amazonaws.com/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-amz-json-1.1',
                    'X-Amz-Target': 'AWSCognitoIdentityProviderService.ConfirmForgotPassword'
                },
                body: JSON.stringify({
                    ClientId: COGNITO_CONFIG.clientId,
                    Username: email,
                    ConfirmationCode: code,
                    Password: newPassword
                })
            });

            const data = await response.json();
            
            if (response.ok) {
                return { success: true };
            } else {
                throw new Error(data.message || 'Failed to reset password');
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    signOut() {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('idToken');
        localStorage.removeItem('loginTime');
        const userId = localStorage.getItem('userId');
        // Keep unreadReports and seenReports to preserve notification state across logins
        localStorage.removeItem('userId');
        // Keep firstLoginTime to preserve free trial period across logins
        this.currentUser = null;
        this.updateUI();
        const isStocksPage = window.location.pathname.includes('/stocks/');
        const pathPrefix = isStocksPage ? '../' : '';
        window.location.href = pathPrefix + 'login.html';
    }

    async refreshTokens() {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) return false;
        
        try {
            console.log('🔄 Refreshing tokens...');
            const response = await fetch(`https://cognito-idp.${COGNITO_CONFIG.region}.amazonaws.com/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-amz-json-1.1',
                    'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth'
                },
                body: JSON.stringify({
                    ClientId: COGNITO_CONFIG.clientId,
                    AuthFlow: 'REFRESH_TOKEN_AUTH',
                    AuthParameters: {
                        REFRESH_TOKEN: refreshToken
                    }
                })
            });
            
            const data = await response.json();
            if (response.ok && data.AuthenticationResult) {
                localStorage.setItem('accessToken', data.AuthenticationResult.AccessToken);
                localStorage.setItem('idToken', data.AuthenticationResult.IdToken);
                // Update loginTime to prevent session expiry during active use
                localStorage.setItem('loginTime', Date.now().toString());
                console.log('✅ Tokens refreshed successfully');
                return true;
            }
            return false;
        } catch (error) {
            console.warn('Failed to refresh tokens:', error);
            return false;
        }
    }

    checkAuthStatus() {
        // Skip auth redirects for bots/crawlers
        if (this.isBotOrCrawler()) {
            console.log('🤖 Bot detected, skipping auth checks');
            return;
        }
        
        if (this._checkingAuth) {
            console.log('⏳ Auth check already in progress, skipping...');
            return;
        }
        this._checkingAuth = true;
        
        const idToken = localStorage.getItem('idToken');
        const accessToken = localStorage.getItem('accessToken');
        const loginTime = localStorage.getItem('loginTime');
        const userId = localStorage.getItem('userId');
        const threeDays = 3 * 24 * 60 * 60 * 1000; // 3 days in milliseconds for session
        
        if (idToken && loginTime) {
            const isWithin3Days = (Date.now() - parseInt(loginTime)) < threeDays;
            
            if (isWithin3Days) {
                try {
                    // Check if it's a Facebook login
                    if (idToken.startsWith('facebook_')) {
                        // Facebook tokens don't have JWT expiry, use 3-day session limit
                        this.currentUser = {
                            email: userId,
                            name: 'Facebook User',
                            provider: 'facebook',
                            'custom:tier': 'free'
                        };
                        console.log('✅ Facebook user logged in:', userId);
                    } else if (idToken.startsWith('google_')) {
                        // Validate Google JWT token expiry
                        const googleToken = accessToken.replace('google_', '');
                        const payload = this.parseJWT(googleToken);
                        if (payload && payload.exp) {
                            const expiryTime = payload.exp * 1000; // Convert to milliseconds
                            if (Date.now() >= expiryTime) {
                                console.log('❌ Google token expired');
                                this.signOut();
                                return;
                            }
                        }
                        // Handle Google login
                        this.currentUser = {
                            email: userId,
                            name: 'Google User',
                            provider: 'google',
                            'custom:tier': 'free'
                        };
                        console.log('✅ Google user logged in:', userId);
                    } else {
                        // Validate AWS Cognito JWT token expiry and refresh if needed
                        const payload = this.parseJWT(idToken);
                        if (payload && payload.exp) {
                            const expiryTime = payload.exp * 1000; // Convert to milliseconds
                            const fiveMinutes = 5 * 60 * 1000;
                            
                            // Refresh token if expired or expiring within 5 minutes
                            if (Date.now() >= (expiryTime - fiveMinutes)) {
                                console.log('🔄 Token expired or expiring soon, refreshing...');
                                this.refreshTokens().then(success => {
                                    if (success) {
                                        // Re-parse the new token
                                        const newIdToken = localStorage.getItem('idToken');
                                        const newPayload = this.parseJWT(newIdToken);
                                        this.currentUser = newPayload;
                                        localStorage.setItem('userId', newPayload.email);
                                        this.updateUI();
                                    } else {
                                        console.log('❌ Token refresh failed, signing out');
                                        this.signOut();
                                    }
                                });
                                // Use existing token while refresh is in progress
                                this.currentUser = payload;
                                localStorage.setItem('userId', payload.email);
                            } else {
                                // Token still valid
                                this.currentUser = payload;
                                localStorage.setItem('userId', payload.email);
                            }
                        } else {
                            // No expiry in token, use it
                            this.currentUser = payload;
                            localStorage.setItem('userId', payload.email);
                        }
                        console.log('✅ Cognito user logged in:', this.currentUser.email);
                    }
                    
                    // Update UI immediately
                    this.updateUI();
                    setTimeout(() => {
                        if (typeof displayTrialStatus === 'function') {
                            displayTrialStatus();
                        }
                    }, 50);
                } catch (error) {
                    console.log('❌ Token expired after 3 days');
                    this.signOut();
                }
            } else {
                console.log('❌ 3-day session expired');
                this.signOut();
            }
        } else {
            console.log('❌ No valid session found');
            this.currentUser = null;
            // Reset email prompt dismissal for new sessions
            localStorage.removeItem('emailPromptDismissed');
            this.updateUI();
            // Show usage counter for anonymous users
            setTimeout(() => {
                if (typeof displayTrialStatus === 'function') {
                    displayTrialStatus();
                }
            }, 50);
        }
        
        this._checkingAuth = false;
    }

    parseJWT(token) {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            return JSON.parse(jsonPayload);
        } catch (error) {
            console.warn('JWT parse error:', error);
            return null;
        }
    }



    updateUI() {
        const accountDropdown = document.getElementById('account-dropdown');
        
        if (this.currentUser) {
            const userName = this.currentUser.name || this.currentUser.given_name || 'User';
            const userEmail = this.currentUser.email;
            
            // Update desktop navigation
            if (accountDropdown) {
                const isStocksPage = window.location.pathname.includes('/stocks/');
                const pathPrefix = isStocksPage ? '../' : '';
                accountDropdown.innerHTML = `
                    <div style="padding: 12px 16px; border-bottom: 1px solid var(--border-color); background: var(--bg-secondary); cursor: default; display: flex; align-items: center; gap: 10px;">
                        <div style="width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #007bff, #0056b3); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 14px;">
                            ${userName.charAt(0).toUpperCase()}
                        </div>
                        <div style="flex: 1; min-width: 0;">
                            <div style="font-weight: 600; color: var(--text-primary); font-size: 0.9em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${userName}</div>
                            <div style="font-size: 0.8em; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${userEmail}</div>
                        </div>
                    </div>
                    <a href="${pathPrefix}dashboard.html" style="display: flex; align-items: center; gap: 8px; padding: 10px 16px;">📊 Dashboard</a>
                    <a href="#" onclick="authManager.signOut()" style="display: flex; align-items: center; gap: 8px; padding: 10px 16px;">🚪 Sign Out</a>
                `;
            }
            
            // Update mobile navigation - find Account section
            const mobileSections = document.querySelectorAll('.mobile-section');
            mobileSections.forEach(section => {
                const title = section.querySelector('.mobile-section-title');
                if (title && title.textContent.includes('Account')) {
                    const userName = this.currentUser.name || this.currentUser.given_name || 'User';
                    const userEmail = this.currentUser.email;
                    
                    // Remove existing user info if any
                    const existingUserInfo = section.querySelector('.mobile-user-info');
                    if (existingUserInfo) {
                        existingUserInfo.remove();
                    }
                    
                    // Add user info after title
                    const userInfo = document.createElement('div');
                    userInfo.className = 'mobile-user-info';
                    userInfo.style.cssText = 'padding: 12px 0; border-bottom: 1px solid var(--border-color); margin-bottom: 8px; display: flex; align-items: center; gap: 10px;';
                    userInfo.innerHTML = `
                        <div style="width: 28px; height: 28px; border-radius: 50%; background: linear-gradient(135deg, #007bff, #0056b3); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 12px;">
                            ${userName.charAt(0).toUpperCase()}
                        </div>
                        <div style="flex: 1; min-width: 0;">
                            <div style="font-weight: 600; color: var(--text-primary); font-size: 0.9em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${userName}</div>
                            <div style="font-size: 0.8em; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${userEmail}</div>
                        </div>
                    `;
                    title.parentNode.insertBefore(userInfo, title.nextSibling);
                    
                    // Show dashboard link
                    const dashboardLink = section.querySelector('#mobile-dashboard-link');
                    if (dashboardLink) {
                        dashboardLink.style.display = 'block';
                    }
                    
                    // Hide register and login links
                    const accountLinks = section.querySelectorAll('a');
                    accountLinks.forEach(link => {
                        if (link.textContent.includes('Register') || link.textContent.includes('Login')) {
                            link.style.display = 'none';
                        }
                    });
                    
                    // Remove existing sign out links first
                    const existingSignOut = section.querySelectorAll('a');
                    existingSignOut.forEach(link => {
                        if (link.textContent.includes('Sign Out')) {
                            link.remove();
                        }
                    });
                    
                    // Add single sign out link
                    const signOutLink = document.createElement('a');
                    signOutLink.href = '#';
                    signOutLink.onclick = () => this.signOut();
                    signOutLink.textContent = 'Sign Out';
                    section.appendChild(signOutLink);
                }
            });
        } else {
            // Reset to default state
            if (accountDropdown) {
                const isStocksPage = window.location.pathname.includes('/stocks/');
                const pathPrefix = isStocksPage ? '../' : '';
                accountDropdown.innerHTML = `
                    <a href="${pathPrefix}signup.html" style="display: flex; align-items: center; gap: 8px; padding: 10px 16px;">🔐 Register</a>
                    <a href="#" onclick="showLoginModal()" style="display: flex; align-items: center; gap: 8px; padding: 10px 16px;">🔑 Login</a>
                `;
            }
            
            // Show register and login links in mobile menu, hide dashboard
            const mobileSections = document.querySelectorAll('.mobile-section');
            mobileSections.forEach(section => {
                const title = section.querySelector('.mobile-section-title');
                if (title && title.textContent.includes('Account')) {
                    // Remove user info if exists
                    const existingUserInfo = section.querySelector('.mobile-user-info');
                    if (existingUserInfo) {
                        existingUserInfo.remove();
                    }
                    
                    // Hide dashboard link
                    const dashboardLink = section.querySelector('#mobile-dashboard-link');
                    if (dashboardLink) {
                        dashboardLink.style.display = 'none';
                    }
                    
                    const accountLinks = section.querySelectorAll('a');
                    accountLinks.forEach(link => {
                        if (link.textContent.includes('Register') || link.textContent.includes('Login')) {
                            link.style.display = 'block';
                        } else if (link.textContent.includes('Sign Out')) {
                            link.remove();
                        }
                    });
                }
            });
        }
    }

    isAuthenticated() {
        return this.currentUser !== null;
    }

    getUserTier() {
        if (!this.currentUser) return 'free';
        return this.currentUser['custom:tier'] || 'free';
    }

    // Usage tracking for free tier - DynamoDB
    async getUsageCount(forceRefresh = false) {
        if (!this.currentUser) return 0;
        
        const cacheKey = `usage_${this.currentUser.email}_${new Date().toISOString().split('T')[0]}`;
        
        // Check if call is already in progress
        if (this._pendingUsageCalls && this._pendingUsageCalls.has(cacheKey)) {
            console.log('📊 Usage call already in progress, waiting...');
            return await this._pendingUsageCalls.get(cacheKey);
        }
        
        // Check cache unless force refresh
        if (!forceRefresh && this._usageCache && this._usageCache[cacheKey]) {
            const cached = this._usageCache[cacheKey];
            if (Date.now() - cached.timestamp < 3000) { // 3 second cache
                console.log('📊 Using cached usage count:', cached.value);
                return cached.value;
            }
        }
        
        try {
            console.log('📊 Calling get_usage API for:', this.currentUser.email);
            
            // Initialize pending calls map if needed
            if (!this._pendingUsageCalls) {
                this._pendingUsageCalls = new Map();
            }
            
            const url = 'https://32p2mynai46u36ppmaxleahpbe0fzfdz.lambda-url.us-east-1.on.aws/';
            const promise = fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'get_usage',
                    email: this.currentUser.email,
                    date: new Date().toISOString().split('T')[0],
                    timestamp: Date.now()
                })
            }).then(response => response.json()).then(data => data.usage || 0);
            
            // Store pending promise
            this._pendingUsageCalls.set(cacheKey, promise);
            
            const usage = await promise;
            console.log('📊 Get usage response:', usage);
            
            // Cache the result
            if (!this._usageCache) {
                this._usageCache = {};
            }
            this._usageCache[cacheKey] = {
                value: usage,
                timestamp: Date.now()
            };
            
            return usage;
        } catch (error) {
            console.warn('Failed to get usage count:', error);
            return 0;
        } finally {
            // Clean up pending call
            if (this._pendingUsageCalls) {
                this._pendingUsageCalls.delete(cacheKey);
            }
        }
    }

    async refreshUsageData() {
        // Force fresh data by clearing any cached values
        this._cachedUsage = null;
        this._cachedTrialStatus = null;
        this._lastUsageCheck = null;
    }

    async incrementUsage() {
        if (!this.currentUser) return 0;
        try {
            console.log('📊 Calling increment_usage API for:', this.currentUser.email);
            const response = await fetch('https://32p2mynai46u36ppmaxleahpbe0fzfdz.lambda-url.us-east-1.on.aws/', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    action: 'increment_usage',
                    email: this.currentUser.email,
                    date: new Date().toISOString().split('T')[0]
                })
            });
            const data = await response.json();
            console.log('📊 Increment response:', data);
            return data.usage || 0;
        } catch (error) {
            console.warn('Failed to increment usage:', error);
            return 0;
        }
    }

    async getAnonymousUsageCount() {
        try {
            const ip = await this.getUserIP();
            const response = await fetch('https://dcegrxwikpuwup7qas24dubloq0ohurf.lambda-url.us-east-1.on.aws/', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    action: 'get_usage',
                    ip_address: ip,
                    date: new Date().toISOString().split('T')[0]
                })
            });
            const data = await response.json();
            return parseInt(data.usage) || 0;
        } catch (error) {
            console.warn('Failed to get anonymous usage count:', error);
            return 0;
        }
    }

    async incrementAnonymousUsage() {
        try {
            const ip = await this.getUserIP();
            const response = await fetch('https://dcegrxwikpuwup7qas24dubloq0ohurf.lambda-url.us-east-1.on.aws/', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    action: 'increment_usage',
                    ip_address: ip,
                    date: new Date().toISOString().split('T')[0]
                })
            });
            const data = await response.json();
            const usage = data.usage || 0;
            if (usage >= 1) {
                localStorage.setItem('showStickyRegister', 'true');
            }
            return usage;
        } catch (error) {
            console.warn('Failed to increment anonymous usage:', error);
            return 0;
        }
    }

    async getUserIP() {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            return data.ip;
        } catch (error) {
            console.warn('Failed to get IP address:', error);
            return 'unknown';
        }
    }

    getCanvasFingerprint() {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = 200;
            canvas.height = 50;
            const ctx = canvas.getContext('2d');
            
            // Create more complex canvas fingerprint
            ctx.textBaseline = 'top';
            ctx.font = '14px Arial';
            ctx.fillStyle = '#f60';
            ctx.fillRect(125, 1, 62, 20);
            ctx.fillStyle = '#069';
            ctx.font = '11pt Arial';
            ctx.fillText('Canvas fingerprint 🔒', 2, 15);
            ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
            ctx.font = '18pt Arial';
            ctx.fillText('StockIQ', 4, 35);
            
            // Add geometric shapes for more uniqueness
            ctx.globalCompositeOperation = 'multiply';
            ctx.fillStyle = 'rgb(255,0,255)';
            ctx.beginPath();
            ctx.arc(50, 25, 20, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.fill();
            
            // Get full hash of canvas data
            const canvasData = canvas.toDataURL();
            let hash = 0;
            for (let i = 0; i < canvasData.length; i++) {
                const char = canvasData.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash; // Convert to 32-bit integer
            }
            return Math.abs(hash).toString(36);
        } catch (error) {
            return 'canvas_error';
        }
    }

    getWebGLFingerprint() {
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            if (!gl) return 'no_webgl';
            
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            const vendor = debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : 'unknown';
            const renderer = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'unknown';
            
            return `${vendor}|${renderer}`.replace(/\s+/g, '_').substring(0, 32);
        } catch (error) {
            return 'webgl_error';
        }
    }

    isBotOrCrawler() {
        const userAgent = navigator.userAgent.toLowerCase();
        const botPatterns = [
            'googlebot', 'bingbot', 'slurp', 'duckduckbot', 'baiduspider',
            'yandexbot', 'facebookexternalhit', 'twitterbot', 'rogerbot',
            'linkedinbot', 'embedly', 'quora link preview', 'showyoubot',
            'outbrain', 'pinterest', 'developers.google.com/+/web/snippet',
            'crawler', 'spider', 'bot', 'headless'
        ];
        return botPatterns.some(pattern => userAgent.includes(pattern));
    }

    getAudioFingerprint() {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const analyser = audioContext.createAnalyser();
            const gainNode = audioContext.createGain();
            
            oscillator.type = 'triangle';
            oscillator.frequency.setValueAtTime(10000, audioContext.currentTime);
            
            gainNode.gain.setValueAtTime(0, audioContext.currentTime);
            oscillator.connect(analyser);
            analyser.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.start(0);
            
            const frequencyData = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(frequencyData);
            
            oscillator.stop();
            audioContext.close();
            
            let hash = 0;
            for (let i = 0; i < frequencyData.length; i++) {
                hash = ((hash << 5) - hash) + frequencyData[i];
                hash = hash & hash;
            }
            
            return Math.abs(hash).toString(36).substring(0, 16);
        } catch (error) {
            return 'audio_error';
        }
    }

    async getEnhancedFingerprint() {
        return {
            canvas: this.getCanvasFingerprint(),
            webgl: this.getWebGLFingerprint(),
            audio: this.getAudioFingerprint()
        };
    }

    async checkTrialStatus() {
        if (!this.currentUser) return null;
        try {
            const response = await fetch('https://32p2mynai46u36ppmaxleahpbe0fzfdz.lambda-url.us-east-1.on.aws/', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    action: 'check_trial_status',
                    email: this.currentUser.email
                })
            });
            if (!response.ok) {
                console.warn('Trial status endpoint unavailable');
                return { isTrialActive: true, daysRemaining: 3, hoursRemaining: 72 }; // Default 3-day trial
            }
            const data = await response.json();
            return data.success ? data : null;
        } catch (error) {
            console.warn('Trial status check failed, using defaults');
            return { isTrialActive: true, daysRemaining: 3, hoursRemaining: 72 }; // Default 3-day trial
        }
    }

    async checkIPBlocking(email, name) {
        try {
            const ip = await this.getUserIP();
            const response = await fetch('https://32p2mynai46u36ppmaxleahpbe0fzfdz.lambda-url.us-east-1.on.aws/', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    action: 'register',
                    email: email,
                    name: name,
                    userAgent: navigator.userAgent,
                    ipAddress: ip,
                    screenResolution: `${screen.width}x${screen.height}`,
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    language: navigator.language
                })
            });

            const result = await response.json();
            
            if (response.status === 429) {
                // IP blocked
                return { 
                    allowed: false, 
                    error: result.error || 'You have already registered! Please login with your existing account or contact support if you need assistance.' 
                };
            } else if (response.status === 400 && result.error === 'User already registered') {
                // User already exists
                return { 
                    allowed: false, 
                    error: 'An account with this email already exists. Please try logging in instead.' 
                };
            } else if (response.ok) {
                // Registration allowed and record created
                return { allowed: true };
            } else {
                // Other error
                return { 
                    allowed: false, 
                    error: result.error || 'Registration temporarily unavailable. Please try again later.' 
                };
            }
        } catch (error) {
            console.warn('Failed to check IP blocking:', error);
            // Allow registration if check fails (fail open)
            return { allowed: true };
        }
    }

    async createRegistrationRecord(email, name) {
        // This function is now called from checkIPBlocking, so we don't need to do anything here
        // The registration record is already created during the IP blocking check
        return;
    }

    async updateUserIPOnLogin(email) {
        try {
            const ip = await this.getUserIP();
            console.log(`🔄 Updating IP for user ${email} to ${ip}`);
            
            const response = await fetch('https://32p2mynai46u36ppmaxleahpbe0fzfdz.lambda-url.us-east-1.on.aws/', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    action: 'update_user_ip',
                    email: email,
                    ip_address: ip,
                    date: new Date().toISOString().split('T')[0]
                })
            });

            const result = await response.json();
            if (response.ok) {
                console.log('✅ IP updated successfully on login');
            } else {
                console.warn('⚠️ Failed to update IP:', result.error);
            }
        } catch (error) {
            console.warn('Failed to update user IP on login:', error);
        }
    }



    async canUseStockAnalysis() {
        if (this.isAuthenticated()) {
            const tier = this.getUserTier();
            if (tier !== 'free') return true; // Paid tiers have unlimited access
            
            // Check trial status from DynamoDB
            const trialStatus = await this.checkTrialStatus();
            if (trialStatus && trialStatus.isTrialActive) {
                const usage = await this.getUsageCount();
                return usage < 5; // Free trial: 5 uses per day
            }
            
            // After 3 days, no access for free tier
            return false;
        }
        // Anonymous users: 1 use per day (IP-based)
        const usage = await this.getAnonymousUsageCount();
        return usage < 1;
    }

    async checkStockAnalysisAccess() {
        // Skip redirects for bots/crawlers
        if (this.isBotOrCrawler()) {
            return true;
        }
        
        // Prevent multiple simultaneous redirects
        if (this._redirecting) {
            console.log('⏳ Redirect already in progress, skipping...');
            return false;
        }
        
        // Force fresh data check
        await this.refreshUsageData();
        
        if (this.isAuthenticated()) {
            const tier = this.getUserTier();
            if (tier !== 'free') return true; // Paid tiers have unlimited access
            
            // Check trial status from DynamoDB with fresh data
            const trialStatus = await this.checkTrialStatus();
            if (trialStatus && trialStatus.isTrialActive) {
                const usage = await this.getUsageCount();
                const dailyLimit = trialStatus.dailyLimit || 5;
                const remaining = Math.max(0, dailyLimit - usage);
                
                if (remaining > 0) {
                    return true; // User has remaining clicks
                } else {
                    // Daily limit reached - redirect once
                    this._redirecting = true;
                    window.location.href = 'dashboard.html?redirect=upgrade';
                    return false;
                }
            } else {
                // Trial expired - redirect once
                this._redirecting = true;
                window.location.href = 'dashboard.html?redirect=upgrade';
                return false;
            }
        } else {
            // Anonymous users: 1 use per day (IP-based)
            const usage = await this.getAnonymousUsageCount();
            const remaining = Math.max(0, 1 - usage);
            if (remaining > 0) {
                return true;
            } else {
                this._redirecting = true;
                window.location.href = 'signup.html';
                return false;
            }
        }
    }

    async getSubscriptionStatus() {
        if (!this.currentUser) {
            return { hasPaid: false };
        }
        
        try {
            const response = await fetch('https://32p2mynai46u36ppmaxleahpbe0fzfdz.lambda-url.us-east-1.on.aws/', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    action: 'get_subscription_status',
                    email: this.currentUser.email
                })
            });
            const data = await response.json();
            return {
                hasPaid: data.hasPaid || false,
                planType: data.planType,
                subscriptionStatus: data.subscriptionStatus
            };
        } catch (error) {
            console.warn('Failed to get subscription status:', error);
            return { hasPaid: false };
        }
    }

    async getStockAnalysisStatus(forceRefresh = false) {
        // Clear cache on mobile
        if (/Mobi|Android/i.test(navigator.userAgent)) {
            this._cachedUsage = null;
            this._cachedTrialStatus = null;
        }
        
        if (!this.isAuthenticated()) {
            const used = await this.getAnonymousUsageCount();
            const remaining = Math.max(0, 1 - (used || 0));
            return {
                unlocked: remaining > 0,
                remaining: remaining,
                message: `${remaining}/1 Analyses remaining today`
            };
        }
        
        const tier = this.getUserTier();
        if (tier !== 'free') {
            return { unlocked: true, remaining: '∞', message: 'Unlimited' };
        }
        
        // Check trial status from DynamoDB - use same logic as dashboard
        try {
            const response = await fetch('https://32p2mynai46u36ppmaxleahpbe0fzfdz.lambda-url.us-east-1.on.aws/', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    action: 'check_trial_status',
                    email: this.currentUser.email
                })
            });
            const data = await response.json();
            
            if (data.success && data.isTrialActive) {
                const usageResponse = await fetch('https://32p2mynai46u36ppmaxleahpbe0fzfdz.lambda-url.us-east-1.on.aws/', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        action: 'get_usage',
                        email: this.currentUser.email,
                        date: new Date().toISOString().split('T')[0]
                    })
                });
                const usageData = await usageResponse.json();
                const used = usageData.usage || 0;
                const dailyLimit = data.dailyLimit || 5;
                const remaining = Math.max(0, dailyLimit - used);
                
                // Determine if this is a trial (5 clicks) or paid plan (50+ clicks)
                if (dailyLimit > 5) {
                    // Paid subscription (Starter=50, Pro=200, Elite=unlimited)
                    const hoursInDay = data.hoursRemaining % 24;
                    const timeLeft = data.daysRemaining > 0 
                        ? `${data.daysRemaining}d ${hoursInDay}h`
                        : `${data.hoursRemaining}h`;
                    if (dailyLimit >= 999999 && this.currentUser.email !== 'dave@dewit.com.au') {
                        return {
                            unlocked: true,
                            remaining: '∞',
                            message: `Unlimited • Subscription: ${timeLeft}`
                        };
                    } else {
                        return {
                            unlocked: remaining > 0,
                            remaining: remaining,
                            message: `${remaining}/${dailyLimit} today (resets 00:00 UTC) • Subscription: ${timeLeft}`
                        };
                    }
                } else {
                    // Free trial user (5 reports)
                    const hoursInDay = data.hoursRemaining % 24;
                    const timeLeft = data.daysRemaining > 0 
                        ? `${data.daysRemaining}d ${hoursInDay}h`
                        : `${data.hoursRemaining}h`;
                    if (dailyLimit >= 999999 && this.currentUser.email !== 'dave@dewit.com.au') {
                        return {
                            unlocked: true,
                            remaining: '∞',
                            message: `Unlimited • Trial: ${timeLeft}`
                        };
                    } else {
                        return {
                            unlocked: remaining > 0,
                            remaining: remaining,
                            message: `${remaining}/${dailyLimit} today (resets 00:00 UTC) • Trial: ${timeLeft}`
                        };
                    }
                }
            } else {
                return {
                    unlocked: false,
                    remaining: 0,
                    message: 'Trial expired - <a href="dashboard.html?redirect=upgrade#upgrade" style="color: #007bff; text-decoration: underline;">Upgrade</a>'
                };
            }
        } catch (error) {
            console.warn('Failed to get trial status:', error);
            return {
                unlocked: false,
                remaining: 0,
                message: 'Status unavailable'
            };
        }
    }
}

// Initialize auth manager
const authManager = new AuthManager();



// Update trial status when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Force immediate auth check and UI update
    if (typeof authManager !== 'undefined') {
        authManager.checkAuthStatus();
    }
    
    // Always show trial status for both authenticated and anonymous users
    setTimeout(() => {
        if (typeof displayTrialStatus === 'function') {
            displayTrialStatus();
        }
    }, 200);
});

// Modal functions
function closeModal(element) {
    const modal = element.closest('[style*="position: fixed"]');
    if (modal) {
        modal.remove();
    }
    document.body.style.overflow = '';
}

function showLoginModal() {
    const isStocksPage = window.location.pathname.includes('/stocks/');
    const pathPrefix = isStocksPage ? '../' : '';
    window.location.href = pathPrefix + 'login.html';
}

function showDashboard() {
    if (authManager.currentUser) {
        window.location.href = 'dashboard.html';
    } else {
        window.location.href = 'signup.html';
    }
}

// Notification Bell Functions
function updateNotificationBell() {
    const userId = localStorage.getItem('userId');
    if (!userId || userId === 'anonymous') return;
    
    let unreadReports = JSON.parse(localStorage.getItem(`unreadReports_${userId}`) || '[]');
    
    // Deduplicate unreadReports only (not seenReports to avoid race conditions)
    unreadReports = [...new Set(unreadReports)];
    localStorage.setItem(`unreadReports_${userId}`, JSON.stringify(unreadReports));
    
    const seenReports = JSON.parse(localStorage.getItem(`seenReports_${userId}`) || '[]');
    const bell = document.getElementById('notification-bell');
    const badge = document.getElementById('notification-badge');
    
    // Only show badge for reports that haven't been seen
    const unseenCount = unreadReports.filter(id => !seenReports.includes(id)).length;
    
    if (bell) {
        bell.style.display = 'block';
        if (badge) {
            if (unseenCount > 0) {
                badge.style.display = 'flex';
                badge.textContent = unseenCount > 9 ? '9+' : unseenCount;
            } else {
                badge.style.display = 'none';
            }
        }
    }
    
    // Update mobile bell
    const mobileBell = document.getElementById('mobile-notification-bell');
    const mobileBadge = document.getElementById('mobile-notification-badge');
    if (mobileBell) {
        mobileBell.style.display = 'block';
        if (mobileBadge) {
            if (unseenCount > 0) {
                mobileBadge.style.display = 'flex';
                mobileBadge.textContent = unseenCount > 9 ? '9+' : unseenCount;
            } else {
                mobileBadge.style.display = 'none';
            }
        }
    }
}

window.addEventListener('storage', function(e) {
    if (e.key && (e.key.startsWith('seenReports_') || e.key.startsWith('unreadReports_'))) {
        updateNotificationBell();
    }
});



function markReportAsRead(analysisId) {
    const userId = localStorage.getItem('userId');
    const unreadReports = JSON.parse(localStorage.getItem(`unreadReports_${userId}`) || '[]');
    const updatedUnread = unreadReports.filter(id => id !== analysisId);
    localStorage.setItem(`unreadReports_${userId}`, JSON.stringify(updatedUnread));
    updateNotificationBell();
}

// Debug function to check login status
function checkLoginStatus() {
    console.log('=== LOGIN STATUS DEBUG ===');
    console.log('Auth Manager exists:', typeof authManager !== 'undefined');
    console.log('Current User:', authManager?.currentUser);
    console.log('Is Authenticated:', authManager?.isAuthenticated());
    console.log('Access Token:', localStorage.getItem('accessToken'));
    console.log('ID Token:', localStorage.getItem('idToken'));
    console.log('User ID:', localStorage.getItem('userId'));
    console.log('Login Time:', localStorage.getItem('loginTime'));
    console.log('All localStorage keys:', Object.keys(localStorage));
    console.log('Stock Analysis Status:', authManager?.getStockAnalysisStatus());
    console.log('========================');
}

async function displayTrialStatus(forceRefresh = false) {
    if (typeof authManager === 'undefined') return;
    
    // Force refresh usage data on mobile or when explicitly requested
    if (forceRefresh || /Mobi|Android/i.test(navigator.userAgent)) {
        await authManager.refreshUsageData();
    }
    
    const status = await authManager.getStockAnalysisStatus(forceRefresh);
    const isHomePage = window.location.pathname.endsWith('index.html') || window.location.pathname === '/';
    
    // Create or update trial status display
    let trialDisplay = document.getElementById('trial-status-display');
    if (!trialDisplay) {
        trialDisplay = document.createElement('div');
        trialDisplay.id = 'trial-status-display';
        const userId = localStorage.getItem('userId') || 'anonymous';
        const cacheKey = `userPaidStatus_${userId}`;
        const bannerVisible = localStorage.getItem(cacheKey) !== 'paid';
        const topPosition = bannerVisible ? '110px' : '70px';
        trialDisplay.style.cssText = `
            position: fixed;
            top: ${topPosition};
            right: 20px;
            background: var(--card-bg);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 8px 12px;
            font-size: 0.9rem;
            z-index: 1000;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        `;
        document.body.appendChild(trialDisplay);
    }
    
    trialDisplay.innerHTML = status.message;
    trialDisplay.style.color = status.unlocked ? '#22c55e' : '#ef4444';
    
    // Set consistent opacity for all pages
    trialDisplay.style.opacity = '1';
    // Fade to 0.7 after 3 seconds on all pages
    setTimeout(() => {
        if (trialDisplay) {
            trialDisplay.style.opacity = '0.7';
        }
    }, 3000);
}

function showSignUpModal(plan = 'free') {
    const modal = document.createElement('div');
    modal.innerHTML = `
        <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 10000; display: flex; align-items: center; justify-content: center;">
            <div style="background: var(--card-bg); padding: 30px; border-radius: 12px; max-width: 400px; width: 90%; position: relative;">
                <h2 style="margin-bottom: 20px; color: var(--text-primary);">Create Account - ${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan</h2>
                <form id="signUpForm">
                    <input type="text" id="signUpName" placeholder="Full Name" required style="width: 100%; padding: 12px; margin-bottom: 15px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--input-bg); color: var(--text-primary);">
                    <input type="email" id="signUpEmail" placeholder="Email" required style="width: 100%; padding: 12px; margin-bottom: 15px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--input-bg); color: var(--text-primary);">
                    <input type="password" id="signUpPassword" placeholder="Password (min 8 chars)" required minlength="8" style="width: 100%; padding: 12px; margin-bottom: 20px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--input-bg); color: var(--text-primary);">
                    <input type="hidden" id="selectedPlan" value="${plan}">
                    <button type="submit" style="width: 100%; padding: 12px; background: #007bff; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;">Create Account</button>
                </form>
                <p style="text-align: center; margin-top: 15px; color: var(--text-secondary); font-size: 0.9rem;">
                    Already have an account? <a href="#" onclick="closeModal(this); showLoginModal();" style="color: #007bff;">Sign in here</a>
                </p>
                <button onclick="closeModal(this)" style="position: absolute; top: 10px; right: 15px; background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-primary);">×</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    document.getElementById('signUpForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('signUpName').value;
        const email = document.getElementById('signUpEmail').value;
        const password = document.getElementById('signUpPassword').value;
        
        const result = await authManager.signUp(email, password, name);
        if (result.success) {
            modal.remove();
            showVerificationModal(email, password);
        } else {
            alert('Sign up failed: ' + result.error);
        }
    });
}

function showVerificationModal(email, password) {
    const modal = document.createElement('div');
    modal.innerHTML = `
        <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 10000; display: flex; align-items: center; justify-content: center;">
            <div style="background: var(--card-bg); padding: 30px; border-radius: 12px; max-width: 400px; width: 90%; position: relative;">
                <h2 style="margin-bottom: 20px; color: var(--text-primary);">Verify Your Email</h2>
                <p style="margin-bottom: 20px; color: var(--text-secondary);">We've sent a verification code to <strong>${email}</strong></p>
                <form id="verifyForm">
                    <input type="text" id="verifyCode" placeholder="Enter verification code" required style="width: 100%; padding: 12px; margin-bottom: 20px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--input-bg); color: var(--text-primary);">
                    <button type="submit" style="width: 100%; padding: 12px; background: #007bff; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;">Verify Account</button>
                </form>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    document.getElementById('verifyForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const code = document.getElementById('verifyCode').value;
        
        const result = await authManager.confirmSignUp(email, code);
        if (result.success) {
            modal.remove();
            alert('Account verified successfully! You will now be redirected to login.');
            window.location.href = `login.html?email=${encodeURIComponent(email)}`;
        } else {
            alert('Verification failed: ' + result.error);
        }
    });
}


// Show upgrade modal for anonymous users after using their free click
function showAnonymousUpgradeModal() {
    const userId = localStorage.getItem('userId');
    if (userId && userId !== 'anonymous') {
        return; // Only show for anonymous users
    }

    const modal = document.createElement('div');
    modal.innerHTML = `
        <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); z-index: 10000; display: flex; align-items: center; justify-content: center; animation: fadeIn 0.3s;">
            <div style="background: var(--card-bg); padding: 40px 30px; border-radius: 16px; max-width: 480px; width: 90%; text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,0.3); animation: slideUp 0.3s;">
                <div style="font-size: 48px; margin-bottom: 20px;">🎉</div>
                <h2 style="color: var(--text-primary); margin-bottom: 15px; font-size: 1.8rem;">You've Used Your Free Daily Analysis!</h2>
                <p style="color: var(--text-secondary); margin-bottom: 25px; font-size: 1.1rem; line-height: 1.6;">
                    Want <strong style="color: #007bff;">15 free analyses</strong>?<br>
                    Create a free account in 30 seconds.
                </p>
                <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
                    <a href="signup.html" style="background: #007bff; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 1.1rem; transition: all 0.3s; display: inline-block;" onmouseover="this.style.background='#0056b3'; this.style.transform='translateY(-2px)'" onmouseout="this.style.background='#007bff'; this.style.transform='translateY(0)'">
                        Create Free Account
                    </a>
                    <button onclick="this.closest('[style*=\\'position: fixed\\']').remove()" style="background: transparent; color: var(--text-secondary); padding: 14px 32px; border: 2px solid var(--border-color); border-radius: 8px; font-weight: 600; font-size: 1.1rem; cursor: pointer; transition: all 0.3s;" onmouseover="this.style.borderColor='#007bff'; this.style.color='#007bff'" onmouseout="this.style.borderColor='var(--border-color)'; this.style.color='var(--text-secondary)'">
                        Maybe Later
                    </button>
                </div>
                <p style="color: var(--text-secondary); margin-top: 20px; font-size: 0.9rem;">
                    ✓ No credit card required &nbsp;•&nbsp; ✓ 3-day free trial
                </p>
            </div>
        </div>
        <style>
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes slideUp {
                from { transform: translateY(30px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
        </style>
    `;
    
    document.body.appendChild(modal);
    
    // Close on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// Export for use in other files
if (typeof window !== 'undefined') {
    window.showAnonymousUpgradeModal = showAnonymousUpgradeModal;
}
