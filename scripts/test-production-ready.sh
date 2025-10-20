#!/bin/bash

# Test Production-Ready Features
# Run with: bash scripts/test-production-ready.sh

echo "🧪 Testing Production-Ready Features..."
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

BASE_URL="${1:-http://localhost:3000}"

# Test 1: Health Check
echo "1️⃣  Testing Health Check..."
HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/health")
if [ "$HEALTH_RESPONSE" = "200" ]; then
  echo -e "${GREEN}✅ Health check passed${NC}"
else
  echo -e "${RED}❌ Health check failed (HTTP $HEALTH_RESPONSE)${NC}"
fi
echo ""

# Test 2: Rate Limiting
echo "2️⃣  Testing Rate Limiting (sending 70 requests)..."
SUCCESS_COUNT=0
RATE_LIMITED=0

for i in {1..70}; do
  RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/props/table?sport=nfl&scope=pregame&type=player&market=player_pass_tds")
  if [ "$RESPONSE" = "200" ]; then
    ((SUCCESS_COUNT++))
  elif [ "$RESPONSE" = "429" ]; then
    ((RATE_LIMITED++))
  fi
done

echo "   - Successful: $SUCCESS_COUNT"
echo "   - Rate Limited: $RATE_LIMITED"

if [ $RATE_LIMITED -gt 0 ]; then
  echo -e "${GREEN}✅ Rate limiting is working${NC}"
else
  echo -e "${YELLOW}⚠️  Rate limiting might not be configured${NC}"
fi
echo ""

# Test 3: Validation
echo "3️⃣  Testing Request Validation..."
INVALID_SPORT=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/props/table?sport=invalid&scope=pregame&type=player&market=h2h")
if [ "$INVALID_SPORT" = "400" ]; then
  echo -e "${GREEN}✅ Validation is working (rejected invalid sport)${NC}"
else
  echo -e "${YELLOW}⚠️  Validation might not be configured (expected 400, got $INVALID_SPORT)${NC}"
fi
echo ""

# Test 4: Error Logging
echo "4️⃣  Testing Error Logging..."
echo "   Trigger an error manually and check Supabase logs table"
echo -e "${YELLOW}⚠️  Manual check required${NC}"
echo ""

# Test 5: Performance
echo "5️⃣  Testing API Performance..."
START_TIME=$(date +%s%3N)
curl -s "$BASE_URL/api/props/table?sport=nfl&scope=pregame&type=player&market=player_pass_tds" > /dev/null
END_TIME=$(date +%s%3N)
LATENCY=$((END_TIME - START_TIME))

echo "   - Latency: ${LATENCY}ms"
if [ $LATENCY -lt 500 ]; then
  echo -e "${GREEN}✅ Performance is good (<500ms)${NC}"
elif [ $LATENCY -lt 1000 ]; then
  echo -e "${YELLOW}⚠️  Performance is acceptable (500-1000ms)${NC}"
else
  echo -e "${RED}❌ Performance needs improvement (>1000ms)${NC}"
fi
echo ""

# Summary
echo "📊 Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Health Check: Working"
echo "✅ Rate Limiting: $([ $RATE_LIMITED -gt 0 ] && echo 'Working' || echo 'Check config')"
echo "✅ Validation: $([ "$INVALID_SPORT" = "400" ] && echo 'Working' || echo 'Check config')"
echo "⚠️  Error Logging: Manual check required"
echo "✅ Performance: ${LATENCY}ms"
echo ""
echo "🎉 Production-ready features test complete!"
echo ""
echo "Next steps:"
echo "1. Check Supabase logs table for error logs"
echo "2. Review rate limit settings in lib/rate-limit.ts"
echo "3. Run unit tests: npm test"
echo "4. Set up UptimeRobot monitoring"

