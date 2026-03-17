#!/bin/bash

echo "🚀 StockIQ Simple Test Suite"
echo "============================"

# Test 1: Check if essential files exist
echo "📁 Checking files..."
files=("index.html" "analysis.html" "dashboard.html" "styles.css" "analysis-functions.js")
for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file exists"
    else
        echo "❌ $file missing"
    fi
done

# Test 2: Check for JavaScript errors in files
echo ""
echo "🔍 Checking JavaScript syntax..."
if command -v node &> /dev/null; then
    node -c analysis-functions.js && echo "✅ analysis-functions.js syntax OK" || echo "❌ analysis-functions.js has syntax errors"
else
    echo "⚠️  Node.js not available, skipping JS syntax check"
fi

# Test 3: Check HTML structure
echo ""
echo "🏗️  Checking HTML structure..."
if grep -q "<h1>" index.html; then
    echo "✅ index.html has main heading"
else
    echo "❌ index.html missing main heading"
fi

if grep -q "showComingSoonPopup" analysis-functions.js; then
    echo "✅ Coming soon popup function exists"
else
    echo "❌ Coming soon popup function missing"
fi

# Test 4: Check CSS file
echo ""
echo "🎨 Checking CSS..."
if [ -f "styles.css" ] && [ -s "styles.css" ]; then
    echo "✅ styles.css exists and not empty"
else
    echo "❌ styles.css missing or empty"
fi

echo ""
echo "🎉 Simple tests completed!"
