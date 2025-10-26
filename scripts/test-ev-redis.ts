/**
 * Test script to check EV data in Redis
 * Run with: npx tsx scripts/test-ev-redis.ts
 */

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

async function testEVRedis() {
  console.log('🔍 Testing EV Redis keys...\n');

  // Test 1: Check if sorted sets exist
  console.log('1️⃣ Checking sorted sets:');
  const pregameKey = 'ev:all:sort:pregame:best';
  const liveKey = 'ev:all:sort:live:best';
  
  const pregameCount = await redis.zcard(pregameKey);
  const liveCount = await redis.zcard(liveKey);
  
  console.log(`   ${pregameKey}: ${pregameCount} items`);
  console.log(`   ${liveKey}: ${liveCount} items\n`);

  // Test 2: Get sample SEIDs from pregame
  if (pregameCount > 0) {
    console.log('2️⃣ Sample SEIDs from pregame (top 5):');
    const sampleSeids = await redis.zrange(pregameKey, 0, 4, { rev: true, withScores: true });
    console.log(sampleSeids);
    console.log('');

    // Test 3: Fetch a sample row
    if (sampleSeids.length > 0) {
      const firstSeid = sampleSeids[0];
      const sport = String(firstSeid).split(':')[0];
      const rowKey = `ev:${sport}:rows`;
      
      console.log(`3️⃣ Fetching sample row from ${rowKey}:`);
      const sampleRow = await redis.hget(rowKey, String(firstSeid));
      
      if (sampleRow) {
        const parsed = JSON.parse(sampleRow as string);
        console.log(JSON.stringify(parsed, null, 2));
      } else {
        console.log(`   ❌ No row found for SEID: ${firstSeid}`);
      }
    }
  } else {
    console.log('2️⃣ No pregame data found');
  }

  // Test 4: Check live data
  if (liveCount > 0) {
    console.log('\n4️⃣ Sample SEIDs from live (top 5):');
    const liveSampleSeids = await redis.zrange(liveKey, 0, 4, { rev: true, withScores: true });
    console.log(liveSampleSeids);
  } else {
    console.log('\n4️⃣ No live data found');
  }

  // Test 5: Check all sport-specific row hashes
  console.log('\n5️⃣ Checking sport-specific row hashes:');
  const sports = ['nfl', 'nba', 'nhl', 'mlb', 'ncaaf'];
  
  for (const sport of sports) {
    const rowKey = `ev:${sport}:rows`;
    const count = await redis.hlen(rowKey);
    console.log(`   ${rowKey}: ${count} rows`);
  }

  console.log('\n✅ Test complete!');
}

testEVRedis().catch(console.error);


