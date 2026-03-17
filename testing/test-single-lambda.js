#!/usr/bin/env node

/**
 * Test Single Lambda Endpoint
 * Tests a specific Lambda URL
 */

const https = require('https');
const http = require('http');

const url = process.argv[2];

if (!url) {
    console.log('❌ Please provide a Lambda URL');
    console.log('Usage: node test-single-lambda.js <url>');
    process.exit(1);
}

console.log(`🧪 Testing Lambda endpoint...\n`);
console.log(`URL: ${url}\n`);

const client = url.startsWith('https') ? https : http;

const startTime = Date.now();

const req = client.get(url, { timeout: 30000 }, (res) => {
    const duration = Date.now() - startTime;
    let data = '';
    
    res.on('data', chunk => data += chunk);
    
    res.on('end', () => {
        console.log(`⏱️  Response time: ${duration}ms`);
        console.log(`📊 Status code: ${res.statusCode}`);
        console.log(`📦 Response size: ${data.length} bytes\n`);
        
        if (res.statusCode === 200 || res.statusCode === 201) {
            console.log('✅ SUCCESS\n');
            try {
                const json = JSON.parse(data);
                console.log('Response preview:');
                console.log(JSON.stringify(json, null, 2).substring(0, 500));
                if (JSON.stringify(json).length > 500) {
                    console.log('...(truncated)');
                }
            } catch (e) {
                console.log('Response (not JSON):');
                console.log(data.substring(0, 500));
            }
        } else {
            console.log(`❌ FAILED - Status ${res.statusCode}\n`);
            console.log('Response:');
            console.log(data.substring(0, 500));
        }
    });
});

req.on('error', (error) => {
    console.log(`❌ FAILED - ${error.message}`);
    process.exit(1);
});

req.on('timeout', () => {
    req.destroy();
    console.log('❌ FAILED - Request timeout (30s)');
    process.exit(1);
});
