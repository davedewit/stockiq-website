#!/bin/bash

set -u

echo "🔍 Testing Lambda mapping generation (first 5 functions only)..."
echo ""

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
OUTPUT_FILE="$SCRIPT_DIR/lambda-url-mapping-test.json"
TEMP_FILE="$SCRIPT_DIR/.lambda-mapping-test.tmp"

trap 'rm -f "$TEMP_FILE"' EXIT

echo "📡 Querying AWS Lambda functions..."

FUNCTIONS=$(aws lambda list-functions --region us-east-1 --query 'Functions[*].FunctionName' --output text 2>&1 | head -n 1 | awk '{print $1, $2, $3, $4, $5}')

if [ -z "$FUNCTIONS" ]; then
    echo "❌ Failed to get Lambda functions"
    exit 1
fi

TOTAL=$(echo $FUNCTIONS | wc -w | tr -d ' ')
echo "📊 Discovered $TOTAL Lambda functions (testing with first 5)"
echo ""

echo "{" > "$TEMP_FILE"

FIRST=true
COUNT=0
WITH_URL=0
WITHOUT_URL=0

for FUNC in $FUNCTIONS; do
    URL=$(aws lambda get-function-url-config --function-name "$FUNC" --region us-east-1 2>/dev/null | jq -r '.FunctionUrl' 2>/dev/null || echo "null")
    
    COUNT=$((COUNT + 1))
    
    if [ "$FIRST" = false ]; then
        echo "," >> "$TEMP_FILE"
    fi
    FIRST=false
    
    if [ "$URL" != "null" ] && [ ! -z "$URL" ]; then
        echo -n "  \"$FUNC\": \"$URL\"" >> "$TEMP_FILE"
        echo "✅ $FUNC -> $URL"
        WITH_URL=$((WITH_URL + 1))
    else
        echo -n "  \"$FUNC\": \"NO_URL\"" >> "$TEMP_FILE"
        echo "⚠️  $FUNC -> NO_URL"
        WITHOUT_URL=$((WITHOUT_URL + 1))
    fi
done

echo "" >> "$TEMP_FILE"
echo "}" >> "$TEMP_FILE"

mv "$TEMP_FILE" "$OUTPUT_FILE"

echo ""
echo "✅ Test complete! Discovered $TOTAL functions, displaying $COUNT functions"
echo "   - $WITH_URL with URLs"
echo "   - $WITHOUT_URL without URLs"
echo "📄 Saved to: $OUTPUT_FILE"
