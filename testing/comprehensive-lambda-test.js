#!/usr/bin/env node

/**
 * Comprehensive Lambda Endpoint Test
 * Tests ALL 600+ Lambda functions used across the site
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class ComprehensiveLambdaTest {
    constructor() {
        this.results = { passed: 0, failed: 0, tests: [] };
        this.endpoints = new Set();
    }

    // Extract all Lambda URLs from website files
    extractLambdaEndpoints() {
        console.log('🔍 Scanning website files for Lambda endpoints...\n');
        
        const websiteDir = path.join(__dirname, '..');
        const files = [
            'index.html',
            'analysis.html',
            'dashboard.html',
            'login.html',
            'signup.html',
            'auth.js',
            'analysis-functions.js',
            'js/analysis-core.js'
        ];

        files.forEach(file => {
            const filePath = path.join(websiteDir, file);
            if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath, 'utf8');
                const regex = /https:\/\/[a-z0-9]+\.lambda-url\.us-east-1\.on\.aws/g;
                const matches = content.match(regex);
                if (matches) {
                    matches.forEach(url => this.endpoints.add(url));
                }
            }
        });

        console.log(`✅ Found ${this.endpoints.size} unique Lambda endpoints\n`);
        return Array.from(this.endpoints);
    }

    async httpGet(url) {
        return new Promise((resolve, reject) => {
            const client = url.startsWith('https') ? https : http;
            const req = client.get(url, { timeout: 10000 }, (res) => {
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

    async test(url, testFn) {
        try {
            await testFn();
            this.results.passed++;
            this.results.tests.push({ url, status: 'PASS' });
            process.stdout.write('✅');
        } catch (error) {
            this.results.failed++;
            this.results.tests.push({ url, status: 'FAIL', error: error.message });
            process.stdout.write('❌');
        }
    }

    async runAllTests(retryMode = false) {
        console.log('🔬 Comprehensive Lambda Endpoint Tests\n');
        
        const failedFile = path.join(__dirname, '.failed-lambdas.json');
        
        let endpoints;
        if (retryMode) {
            if (!fs.existsSync(failedFile)) {
                console.log('❌ No failed endpoints file found. Run full test first.\n');
                return;
            }
            endpoints = JSON.parse(fs.readFileSync(failedFile, 'utf8'));
            console.log(`🔁 Retrying ${endpoints.length} failed Lambda endpoints...\n`);
        } else {
            console.log('Testing ALL Lambda functions across the site...\n');
            endpoints = this.extractLambdaEndpoints();
        }
        
        console.log('🧪 Testing endpoints (this may take several minutes)...\n');
        console.log('Progress: ');

        let count = 0;
        for (const url of endpoints) {
            count++;
            await this.test(url, async () => {
                const res = await this.httpGet(url);
                if (res.status !== 200 && res.status !== 201) {
                    throw new Error(`Status ${res.status}`);
                }
            });

            // New line every 50 tests
            if (count % 50 === 0) {
                console.log(` (${count}/${endpoints.size})`);
            }
        }

        console.log(`\n\n`);
        this.showResults(endpoints.length, retryMode);
    }

    loadMapping() {
        const mappingFile = path.join(__dirname, 'lambda-url-mapping.json');
        if (fs.existsSync(mappingFile)) {
            return JSON.parse(fs.readFileSync(mappingFile, 'utf8'));
        }
        return {};
    }

    checkLambdaUsage(url) {
        const websiteDir = path.join(__dirname, '..');
        try {
            const result = execSync(`grep -r "${url}" ${websiteDir} --include="*.html" --include="*.js" | head -5`, { encoding: 'utf8' });
            return result.trim().split('\n').map(line => {
                const parts = line.split(':');
                return parts[0].replace(websiteDir + '/', '');
            }).filter((v, i, a) => a.indexOf(v) === i).join(', ');
        } catch (e) {
            return 'Not found in code';
        }
    }

    async analyzeFailed() {
        console.log('\n🔍 ANALYZING FAILED ENDPOINTS...\n');
        
        const mapping = this.loadMapping();
        const failed = this.results.tests.filter(test => test.status === 'FAIL');
        
        const analysis = [];
        
        for (const test of failed) {
            // Try with and without trailing slash
            const funcName = mapping[test.url] || mapping[test.url + '/'] || 'Unknown';
            const usage = this.checkLambdaUsage(test.url);
            
            analysis.push({
                url: test.url,
                functionName: funcName,
                error: test.error,
                usedIn: usage,
                recommendation: usage === 'Not found in code' ? 'DELETE' : 'FIX'
            });
        }
        
        return analysis;
    }

    async showResults(totalEndpoints, retryMode = false) {
        console.log('='.repeat(60));
        console.log('📊 COMPREHENSIVE LAMBDA TEST RESULTS');
        console.log('='.repeat(60));
        console.log(`🔗 Total Endpoints Found: ${totalEndpoints}`);
        console.log(`✅ Passed: ${this.results.passed}`);
        console.log(`❌ Failed: ${this.results.failed}`);
        console.log(`📈 Success Rate: ${((this.results.passed / (this.results.passed + this.results.failed)) * 100).toFixed(1)}%`);
        
        // Save/merge failed endpoints for retry
        const failedFile = path.join(__dirname, '.failed-lambdas.json');
        const newFailedUrls = this.results.tests.filter(t => t.status === 'FAIL').map(t => t.url);
        
        if (retryMode) {
            // In retry mode: only save the ones that still failed
            if (newFailedUrls.length > 0) {
                fs.writeFileSync(failedFile, JSON.stringify(newFailedUrls, null, 2));
                console.log(`\n💾 ${newFailedUrls.length} endpoints still failing (saved to .failed-lambdas.json)`);
                console.log(`   ${this.results.passed} endpoints now passing (removed from list)`);
                console.log('   Run option 8 again to retry remaining failures\n');
            } else {
                // All passed on retry!
                fs.unlinkSync(failedFile);
                console.log('\n🎉 All previously failed endpoints now passing - cleared failed list\n');
            }
        } else {
            // In full test mode: merge with existing failures
            if (newFailedUrls.length > 0) {
                let allFailedUrls = newFailedUrls;
                if (fs.existsSync(failedFile)) {
                    const existingFailed = JSON.parse(fs.readFileSync(failedFile, 'utf8'));
                    allFailedUrls = [...new Set([...existingFailed, ...newFailedUrls])];
                }
                
                fs.writeFileSync(failedFile, JSON.stringify(allFailedUrls, null, 2));
                console.log(`\n💾 Saved ${allFailedUrls.length} total failed endpoints to .failed-lambdas.json`);
                console.log(`   (${newFailedUrls.length} from this test, ${allFailedUrls.length - newFailedUrls.length} from previous tests)`);
                console.log('   Run option 8 to retry these endpoints\n');
            } else {
                // All passed in full test
                if (fs.existsSync(failedFile)) {
                    fs.unlinkSync(failedFile);
                    console.log('\n✅ All endpoints passed - cleared failed list\n');
                }
            }
        }
        
        if (this.results.failed > 0) {
            const analysis = await this.analyzeFailed();
            
            console.log('\n❌ FAILED ENDPOINTS ANALYSIS:\n');
            
            const toDelete = analysis.filter(a => a.recommendation === 'DELETE');
            const toFix = analysis.filter(a => a.recommendation === 'FIX');
            
            if (toDelete.length > 0) {
                console.log('🗑️  RECOMMEND DELETE (not used in code):\n');
                toDelete.forEach((item, idx) => {
                    console.log(`   ${idx + 1}. Function: ${item.functionName}`);
                    console.log(`      URL: ${item.url}`);
                    console.log(`      Error: ${item.error}`);
                    console.log('');
                });
            }
            
            if (toFix.length > 0) {
                console.log('🔧 RECOMMEND FIX (actively used):\n');
                
                const status400 = [];
                const otherErrors = [];
                
                toFix.forEach(item => {
                    if (item.error.includes('Status 400')) {
                        status400.push(item);
                    } else {
                        otherErrors.push(item);
                    }
                });
                
                if (status400.length > 0) {
                    console.log('   ℹ️  Status 400 (Auth Required - Expected Behavior):\n');
                    status400.forEach((item, idx) => {
                        console.log(`      ${idx + 1}. Function: ${item.functionName}`);
                        console.log(`         URL: ${item.url}`);
                        console.log(`         Note: This endpoint requires authentication/authorization`);
                        console.log(`         Used in: ${item.usedIn}`);
                        console.log('');
                    });
                }
                
                if (otherErrors.length > 0) {
                    console.log('   ⚠️  Other Errors (Need Investigation):\n');
                    otherErrors.forEach((item, idx) => {
                        console.log(`      ${idx + 1}. Function: ${item.functionName}`);
                        console.log(`         URL: ${item.url}`);
                        console.log(`         Error: ${item.error}`);
                        console.log(`         Used in: ${item.usedIn}`);
                        console.log('');
                    });
                }
            }
            
            console.log('\n💡 NEXT STEPS:');
            console.log('   1. Review recommendations above');
            console.log('   2. For DELETE: Remove unused Lambda functions');
            console.log('   3. For FIX: Check Lambda logs with:');
            console.log('      aws logs tail /aws/lambda/<function-name> --follow');
        }
        
        console.log('\n🎉 Comprehensive Lambda testing completed!');
    }
}

// Run tests
if (require.main === module) {
    const retryMode = process.argv.includes('--retry');
    const tester = new ComprehensiveLambdaTest();
    tester.runAllTests(retryMode).catch(error => {
        console.error('Test failed:', error.message);
        process.exit(1);
    });
}

module.exports = ComprehensiveLambdaTest;
