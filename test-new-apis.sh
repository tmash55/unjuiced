#!/bin/bash

# Test script for new props API architecture
# Run this from project root: bash test-new-apis.sh

BASE_URL="http://localhost:3000"
SPORT="nfl"
MARKET="passing_yards"

echo "🧪 Testing New Props API Architecture"
echo "======================================"
echo ""

# Test 1: Markets API
echo "1️⃣  Testing Markets API..."
echo "GET ${BASE_URL}/api/props/markets?sport=${SPORT}"
curl -s "${BASE_URL}/api/props/markets?sport=${SPORT}" | jq '.'
echo ""
echo "✅ Markets API test complete"
echo ""

# Test 2: Table API
echo "2️⃣  Testing Table API..."
echo "GET ${BASE_URL}/api/props/table?sport=${SPORT}&market=${MARKET}&scope=pregame&limit=5"
TABLE_RESPONSE=$(curl -s "${BASE_URL}/api/props/table?sport=${SPORT}&market=${MARKET}&scope=pregame&limit=5")
echo "$TABLE_RESPONSE" | jq '.'
echo ""

# Extract first SID for next tests
FIRST_SID=$(echo "$TABLE_RESPONSE" | jq -r '.sids[0] // empty')

if [ -z "$FIRST_SID" ]; then
  echo "⚠️  No SIDs returned from table API - skipping remaining tests"
  echo ""
  echo "This might mean:"
  echo "  - No data in Redis for this sport/market"
  echo "  - Backend hasn't populated the new keys yet"
  echo "  - Redis connection issue"
  exit 0
fi

echo "✅ Table API test complete (found SID: ${FIRST_SID})"
echo ""

# Test 3: Rows API
echo "3️⃣  Testing Rows API..."
echo "POST ${BASE_URL}/api/props/rows"
curl -s -X POST "${BASE_URL}/api/props/rows" \
  -H "Content-Type: application/json" \
  -d "{\"sport\":\"${SPORT}\",\"sids\":[\"${FIRST_SID}\"]}" | jq '.'
echo ""
echo "✅ Rows API test complete"
echo ""

# Test 4: Alternates API
echo "4️⃣  Testing Alternates API..."
echo "GET ${BASE_URL}/api/props/alternates/${FIRST_SID}?sport=${SPORT}"
curl -s "${BASE_URL}/api/props/alternates/${FIRST_SID}?sport=${SPORT}" | jq '.'
echo ""
echo "✅ Alternates API test complete"
echo ""

# Test 5: SSE Feed (requires auth - just check if endpoint exists)
echo "5️⃣  Testing SSE Props Endpoint (requires Pro account)..."
echo "GET ${BASE_URL}/api/sse/props?sport=${SPORT}"
echo "Note: This will return 401/403 unless you're authenticated as Pro"
curl -s -D - -o /dev/null "${BASE_URL}/api/sse/props?sport=${SPORT}" | head -n 1
echo ""
echo "✅ SSE endpoint check complete"
echo ""

echo "======================================"
echo "🎉 All API tests complete!"
echo ""
echo "Next steps:"
echo "  1. Check if data is being returned"
echo "  2. If empty, verify backend is populating props:{sport}:* keys"
echo "  3. For SSE test, login as Pro user and try in browser:"
echo "     ${BASE_URL}/api/sse/props?sport=${SPORT}"


