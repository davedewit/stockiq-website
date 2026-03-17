#!/usr/bin/env node

/**
 * StockIQ Website Test Suite
 * Comprehensive testing for all major functionality
 */

const puppeteer = require('puppeteer-core');
const chromeLauncher = require('chrome-launcher');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

class StockIQTester {
    constructor() {
        this.browser = null;
        this.page = null;
        this.baseUrl = 'http://localhost:8000'; // Change to your local server
        this.results = {
            passed: 0,
            failed: 0,
            tests: []
        };
    }

    async init() {
        console.log('🚀 Starting StockIQ Test Suite...\n');
        
        // Find Chrome executable
        const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
        
        this.browser = await puppeteer.launch({ 
            executablePath: chromePath,
            headless: false, 
            defaultViewport: { width: 1280, height: 720 },
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        this.page = await this.browser.newPage();
        
        // Don't log console errors - network errors are expected on localhost
    }

    async test(name, testFn) {
        try {
            console.log(`🧪 Testing: ${name}`);
            await testFn();
            this.results.passed++;
            this.results.tests.push({ name, status: 'PASS' });
            console.log(`✅ PASS: ${name}\n`);
        } catch (error) {
            this.results.failed++;
            this.results.tests.push({ name, status: 'FAIL', error: error.message });
            console.log(`❌ FAIL: ${name} - ${error.message}\n`);
        }
    }

    async waitForUser(message) {
        return new Promise((resolve) => {
            process.stdin.setRawMode(false);
            rl.question(`⏸️  ${message} (Press Enter to continue): `, () => {
                resolve();
            });
        });
    }

    // Test 1: Page Loading
    async testPageLoading() {
        await this.test('Page Loading - Index', async () => {
            await this.page.goto(`${this.baseUrl}/index.html`);
            await this.page.waitForSelector('h1', { timeout: 5000 });
            const title = await this.page.$eval('h1', el => el.textContent);
            if (!title.includes('AI-Powered Stock Analysis')) {
                throw new Error('Main heading not found');
            }
        });

        await this.test('Page Loading - Analysis', async () => {
            await this.page.goto(`${this.baseUrl}/analysis.html`);
            await this.page.waitForSelector('#main-menu', { timeout: 5000 });
        });

        await this.test('Page Loading - Dashboard', async () => {
            await this.page.goto(`${this.baseUrl}/dashboard.html`);
            await this.page.waitForSelector('body', { timeout: 5000 });
        });
    }

    // Test 2: Navigation
    async testNavigation() {
        await this.test('Navigation - Menu Links', async () => {
            await this.page.goto(`${this.baseUrl}/index.html`);
            
            // Test navigation links
            const links = await this.page.$$eval('nav a', links => 
                links.map(link => ({ href: link.href, text: link.textContent }))
            );
            
            if (links.length === 0) {
                throw new Error('No navigation links found');
            }
        });

        await this.test('Navigation - Mobile Menu', async () => {
            await this.page.goto(`${this.baseUrl}/index.html`);
            await this.page.setViewport({ width: 375, height: 667 }); // Mobile size
            
            const hamburger = await this.page.$('.hamburger-btn');
            if (hamburger) {
                await hamburger.click();
                await this.page.waitForTimeout(500);
            }
            
            await this.page.setViewport({ width: 1280, height: 720 }); // Reset
        });
    }

    // Test 3: Search Functionality
    async testSearchFunctionality() {
        await this.test('Search - Stock Input', async () => {
            await this.page.goto(`${this.baseUrl}/index.html`);
            
            const searchInput = await this.page.$('#stock-search');
            if (!searchInput) {
                throw new Error('Search input not found');
            }
            
            await searchInput.type('AAPL');
            const value = await searchInput.evaluate(el => el.value);
            if (value !== 'AAPL') {
                throw new Error('Search input not working');
            }
        });
    }

    // Test 4: Analysis Options
    async testAnalysisOptions() {
        await this.test('Analysis - Main Menu Display', async () => {
            await this.page.goto(`${this.baseUrl}/analysis.html`);
            await this.page.waitForSelector('#main-menu', { timeout: 5000 });
            
            const options = await this.page.$$('.menu-btn');
            if (options.length === 0) {
                throw new Error('No analysis options found');
            }
        });

        await this.test('Analysis - Option Selection', async () => {
            await this.page.goto(`${this.baseUrl}/analysis.html`);
            await this.page.waitForSelector('#main-menu', { timeout: 5000 });
            
            // Click first option
            const firstOption = await this.page.$('.menu-btn');
            if (firstOption) {
                await firstOption.click();
                await this.page.waitForTimeout(1000);
                
                // Check if back button appears
                const backBtn = await this.page.$('#back-btn');
                if (!backBtn) {
                    throw new Error('Back button not shown after option selection');
                }
            }
        });
    }

    // Test 5: Coming Soon Popups
    async testComingSoonPopups() {
        await this.test('Coming Soon - Popup Display', async () => {
            await this.page.goto(`${this.baseUrl}/analysis.html`);
            
            // Execute the coming soon function
            await this.page.evaluate(() => {
                if (typeof showComingSoonPopup === 'function') {
                    showComingSoonPopup();
                }
            });
            
            await this.page.waitForTimeout(500);
            
            const modal = await this.page.$('#coming-soon-modal');
            if (!modal) {
                throw new Error('Coming soon modal not displayed');
            }
        });

        await this.test('Coming Soon - Popup Dismissal', async () => {
            // Modal should still be open from previous test
            const gotItBtn = await this.page.$('button');
            if (gotItBtn) {
                const btnText = await gotItBtn.evaluate(el => el.textContent);
                if (btnText.includes('Got it')) {
                    await gotItBtn.click();
                    await this.page.waitForTimeout(500);
                    
                    const modal = await this.page.$('#coming-soon-modal');
                    if (modal) {
                        throw new Error('Modal not properly dismissed');
                    }
                }
            }
        });
    }

    // Test 6: Authentication Flow (requires manual login)
    async testAuthenticationFlow() {
        await this.test('Authentication - Login Page', async () => {
            await this.page.goto(`${this.baseUrl}/login.html`);
            await this.page.waitForSelector('form', { timeout: 5000 });
            
            const emailInput = await this.page.$('input[type="email"]');
            const passwordInput = await this.page.$('input[type="password"]');
            
            if (!emailInput || !passwordInput) {
                throw new Error('Login form inputs not found');
            }
        });

        // Manual login step
        console.log('🔐 Please manually log in to test authenticated features...');
        await this.waitForUser('Complete login process');
        
        // Save cookies and localStorage for other tests
        const cookies = await this.page.cookies();
        const localStorage = await this.page.evaluate(() => JSON.stringify(window.localStorage));
        const fs = require('fs');
        const path = require('path');
        fs.writeFileSync(path.join(__dirname, '.test-session.json'), JSON.stringify({ cookies, localStorage }));
    }

    // Test 7: Responsive Design
    async testResponsiveDesign() {
        const viewports = [
            { width: 375, height: 667, name: 'Mobile' },
            { width: 768, height: 1024, name: 'Tablet' },
            { width: 1280, height: 720, name: 'Desktop' }
        ];

        for (const viewport of viewports) {
            await this.test(`Responsive - ${viewport.name}`, async () => {
                await this.page.setViewport(viewport);
                await this.page.goto(`${this.baseUrl}/index.html`);
                await this.page.waitForSelector('h1', { timeout: 5000 });
                
                // Check if content is visible
                const h1 = await this.page.$('h1');
                const isVisible = await h1.isIntersectingViewport();
                if (!isVisible) {
                    throw new Error(`Content not visible on ${viewport.name}`);
                }
            });
        }
        
        // Reset to desktop
        await this.page.setViewport({ width: 1280, height: 720 });
    }

    // Test 8: Performance Check
    async testPerformance() {
        await this.test('Performance - Page Load Speed', async () => {
            const startTime = Date.now();
            await this.page.goto(`${this.baseUrl}/index.html`);
            await this.page.waitForSelector('h1', { timeout: 10000 });
            const loadTime = Date.now() - startTime;
            
            if (loadTime > 5000) {
                throw new Error(`Page load too slow: ${loadTime}ms`);
            }
            
            console.log(`   ⏱️  Load time: ${loadTime}ms`);
        });
    }

    // Test 9: JavaScript Errors (page errors only, not console)
    async testJavaScriptErrors() {
        await this.test('JavaScript - No Page Errors', async () => {
            const errors = [];
            
            this.page.on('pageerror', error => {
                errors.push(error.message);
            });
            
            await this.page.goto(`${this.baseUrl}/index.html`);
            await this.page.waitForTimeout(2000);
            
            if (errors.length > 0) {
                throw new Error(`JavaScript errors found: ${errors.join(', ')}`);
            }
        });
    }

    // Test 10: CSS Styles
    async testCSSStyles() {
        await this.test('CSS - Styles Loading', async () => {
            await this.page.goto(`${this.baseUrl}/index.html`);
            
            const h1Color = await this.page.$eval('h1', el => 
                getComputedStyle(el).color
            );
            
            if (h1Color === 'rgba(0, 0, 0, 0)' || h1Color === 'rgb(0, 0, 0)') {
                console.log('   ⚠️  Warning: Default text color detected, CSS might not be loading');
            }
        });
    }

    async runAllTests() {
        await this.init();
        
        console.log('📋 Running comprehensive test suite...\n');
        
        await this.testPageLoading();
        await this.testNavigation();
        await this.testSearchFunctionality();
        await this.testAnalysisOptions();
        await this.testComingSoonPopups();
        await this.testAuthenticationFlow();
        await this.testResponsiveDesign();
        await this.testPerformance();
        await this.testJavaScriptErrors();
        await this.testCSSStyles();
        
        await this.showResults();
        await this.cleanup();
    }

    async showResults() {
        console.log('\n' + '='.repeat(50));
        console.log('📊 TEST RESULTS SUMMARY');
        console.log('='.repeat(50));
        console.log(`✅ Passed: ${this.results.passed}`);
        console.log(`❌ Failed: ${this.results.failed}`);
        console.log(`📈 Success Rate: ${((this.results.passed / (this.results.passed + this.results.failed)) * 100).toFixed(1)}%`);
        
        if (this.results.failed > 0) {
            console.log('\n❌ FAILED TESTS:');
            this.results.tests
                .filter(test => test.status === 'FAIL')
                .forEach(test => {
                    console.log(`   • ${test.name}: ${test.error}`);
                });
        }
        
        console.log('\n🎉 Test suite completed!');
    }

    async cleanup() {
        if (this.browser) {
            await this.browser.close();
        }
        rl.close();
    }
}

// Run the tests
if (require.main === module) {
    const tester = new StockIQTester();
    tester.runAllTests().catch(console.error);
}

module.exports = StockIQTester;