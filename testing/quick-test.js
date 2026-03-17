#!/usr/bin/env node

/**
 * Quick Test - Essential functionality check
 * Tests server and basic page loads without browser automation
 */

const http = require('http');

class QuickTest {
    constructor() {
        this.baseUrl = 'http://localhost:8000';
    }

    async test(name, testFn) {
        try {
            process.stdout.write(`🧪 ${name}... `);
            await testFn();
            console.log('✅ PASS');
        } catch (error) {
            console.log(`❌ FAIL: ${error.message}`);
            throw error;
        }
    }

    async httpGet(path) {
        return new Promise((resolve, reject) => {
            http.get(`${this.baseUrl}${path}`, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve({ status: res.statusCode, data }));
            }).on('error', reject);
        });
    }

    async runQuickTests() {
        console.log('⚡ Quick Test Starting...\n');

        try {
            await this.test('Index page loads', async () => {
                const res = await this.httpGet('/index.html');
                if (res.status !== 200) throw new Error(`Status ${res.status}`);
                if (!res.data.includes('StockIQ')) throw new Error('Missing content');
            });

            await this.test('Analysis page loads', async () => {
                const res = await this.httpGet('/analysis.html');
                if (res.status !== 200) throw new Error(`Status ${res.status}`);
                if (!res.data.includes('main-menu')) throw new Error('Missing menu');
            });

            await this.test('CSS file loads', async () => {
                const res = await this.httpGet('/styles.css');
                if (res.status !== 200) throw new Error(`Status ${res.status}`);
            });

            await this.test('Auth script loads', async () => {
                const res = await this.httpGet('/auth.js');
                if (res.status !== 200) throw new Error(`Status ${res.status}`);
            });

            console.log('\n🎉 All quick tests passed!');

        } catch (error) {
            console.log('\n💥 Quick test failed!');
            throw error;
        }
    }
}

// Run quick tests
if (require.main === module) {
    const tester = new QuickTest();
    tester.runQuickTests().catch(error => {
        console.error('Test failed:', error.message);
        process.exit(1);
    });
}

module.exports = QuickTest;
