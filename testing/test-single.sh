#!/bin/bash
FUNC="stockiq-trial-cleanup"
URL=$(aws lambda get-function-url-config --function-name "$FUNC" --region us-east-1 2>/dev/null | jq -r '.FunctionUrl' 2>/dev/null || echo "null")

echo "Testing: $FUNC"
if [ "$URL" != "null" ] && [ ! -z "$URL" ]; then
    echo "  \"$FUNC\": \"$URL\""
else
    echo "  \"$FUNC\": \"NO_URL\""
fi
