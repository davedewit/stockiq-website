#!/usr/bin/env node

/**
 * Lambda Endpoint Tests
 * Tests all Lambda functions are responding correctly
 */

const https = require('https');
const http = require('http');

class LambdaTest {
    constructor() {
        this.results = { passed: 0, failed: 0, tests: [] };
        this.endpoints = {
            'Market Data - US': 'https://xqma6tuoaeb5nd32gpdyk5uonm0yvgiy.lambda-url.us-east-1.on.aws/',
            'Market Data - Europe': 'https://2azr7bjzjfvkadj2hzztk5icia0xnnoa.lambda-url.us-east-1.on.aws/',
            'Market Data - Asia': 'https://kzspffs5uombzw73vudd3p57x40agikm.lambda-url.us-east-1.on.aws/',
            'Market Data - Crypto': 'https://x5xnafkpdtym4i7vezbhjaizry0leaxk.lambda-url.us-east-1.on.aws/',
            'Market Data - Rates': 'https://ewowkcosbyc5rkk2b6ypvlx6la0pzfww.lambda-url.us-east-1.on.aws/',
            'Market Data - Commodities': 'https://4ynwdgbmuf7jvxxxckmvu7plwa0gxnby.lambda-url.us-east-1.on.aws/',
            'Market Data - Currencies': 'https://xdqiva3aoe4e4esa3cwdrkyt7i0izcvr.lambda-url.us-east-1.on.aws/',
            'Trending Tickers List': 'https://iz6jpzev3ty4q37anieqnckkxa0skisc.lambda-url.us-east-1.on.aws/',
            'Top Gainers List': 'https://hfya2wu77mjszyffeeqzvzhjh40iywvz.lambda-url.us-east-1.on.aws/',
            'Top Losers List': 'https://dzzudu2sf6b2yh7j4utknjn33i0mhahj.lambda-url.us-east-1.on.aws/',
            'Ticker Data Fetcher': 'https://2vl4la6od3vfgbkv6ycbj7ewry0yxvck.lambda-url.us-east-1.on.aws/'
        };
    }

    async test(name, testFn) {
        try {
            process.stdout.write(`🧪 ${name}... `);
            await testFn();
            this.results.passed++;
            this.results.tests.push({ name, status: 'PASS' });
            console.log('✅ PASS');
        } catch (error) {
            this.results.failed++;
            this.results.tests.push({ name, status: 'FAIL', error: error.message });
            console.log(`❌ FAIL: ${error.message}`);
        }
    }

    async httpGet(url) {
        return new Promise((resolve, reject) => {
            const client = url.startsWith('https') ? https : http;
            const req = client.get(url, { timeout: 30000 }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        resolve({ status: res.statusCode, data: json });
                    } catch (e) {
                        resolve({ status: res.statusCode, data: data });
                    }
                });
            });
            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
        });
    }

    async httpPost(url, body) {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const options = {
                hostname: urlObj.hostname,
                path: urlObj.pathname,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(body)
                },
                timeout: 30000
            };

            const client = url.startsWith('https') ? https : http;
            const req = client.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        resolve({ status: res.statusCode, data: json });
                    } catch (e) {
                        resolve({ status: res.statusCode, data: data });
                    }
                });
            });
            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
            req.write(body);
            req.end();
        });
    }

    async runAllTests() {
        console.log('🔬 Lambda Endpoint Tests\n');
        console.log('Testing all index.html widget Lambda functions...\n');

        // Test market data endpoints
        for (const [name, url] of Object.entries(this.endpoints)) {
            if (name.startsWith('Market Data')) {
                await this.test(name, async () => {
                    const res = await this.httpGet(url);
                    if (res.status !== 200) throw new Error(`Status ${res.status}`);
                    if (!res.data || typeof res.data !== 'object') throw new Error('Invalid response');
                    
                    // Check for expected data structure
                    let category = name.split(' - ')[1].toLowerCase();
                    // Crypto endpoint uses 'cryptocurrencies' not 'crypto'
                    if (category === 'crypto') category = 'cryptocurrencies';
                    if (!res.data[category]) throw new Error(`Missing ${category} data`);
                });
            }
        }

        // Test trending tickers
        await this.test('Trending Tickers List', async () => {
            const res = await this.httpGet(this.endpoints['Trending Tickers List']);
            if (res.status !== 200) throw new Error(`Status ${res.status}`);
            if (!res.data.success || !res.data.tickers) throw new Error('Invalid response');
            if (!Array.isArray(res.data.tickers)) throw new Error('Tickers not an array');
        });

        // Test top gainers
        await this.test('Top Gainers List', async () => {
            const res = await this.httpGet(this.endpoints['Top Gainers List']);
            if (res.status !== 200) throw new Error(`Status ${res.status}`);
            if (!res.data.success || !res.data.tickers) throw new Error('Invalid response');
        });

        // Test top losers
        await this.test('Top Losers List', async () => {
            const res = await this.httpGet(this.endpoints['Top Losers List']);
            if (res.status !== 200) throw new Error(`Status ${res.status}`);
            if (!res.data.success || !res.data.tickers) throw new Error('Invalid response');
        });

        // Test ticker data fetcher (POST)
        await this.test('Ticker Data Fetcher', async () => {
            const body = JSON.stringify({ tickers: ['AAPL', 'MSFT'] });
            const res = await this.httpPost(this.endpoints['Ticker Data Fetcher'], body);
            if (res.status !== 200) throw new Error(`Status ${res.status}`);
            if (!res.data.success || !res.data.data) throw new Error('Invalid response');
            if (!res.data.data.AAPL || !res.data.data.MSFT) throw new Error('Missing ticker data');
        });

        this.showResults();
    }

    showResults() {
        console.log('\n' + '='.repeat(50));
        console.log('📊 LAMBDA TEST RESULTS');
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
        
        console.log('\n🎉 Lambda testing completed!');
    }
}

// Run tests
if (require.main === module) {
    const tester = new LambdaTest();
    tester.runAllTests().catch(error => {
        console.error('Test failed:', error.message);
        process.exit(1);
    });
}

module.exports = LambdaTest;
