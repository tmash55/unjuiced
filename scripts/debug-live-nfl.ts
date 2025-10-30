/**
 * Debug script to check live NFL data in Redis
 * Usage: npx tsx scripts/debug-live-nfl.ts
 */

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: 'https://finer-basilisk-19142.upstash.io',
  token: 'AUrGAAIjcDFjOGUyMWUxOTA3NDY0NzAwOTFiMGU3OWMzYzVjN2QyMHAxMA',
});

async function debugLiveNFL() {
  console.log('🔍 Debugging Live NFL Data in Redis\n');

  const sport = 'nfl';
  const market = 'moneyline';
  
  // Check the sorted set for live games
  const liveKey = `props:${sport}:sort:roi:live:${market}`;
  console.log(`1️⃣ Checking live sorted set: ${liveKey}`);
  
  try {
    const liveCount = await redis.zcard(liveKey);
    console.log(`   ✅ Found ${liveCount} entries in live sorted set\n`);
    
    if (liveCount > 0) {
      // Get top 10 SIDs
      const topSids = await redis.zrange(liveKey, 0, 9, { rev: true });
      console.log(`   Top 10 SIDs from live set:`);
      topSids.forEach((sid, i) => {
        console.log(`   ${i + 1}. ${sid}`);
      });
      console.log('');
      
      // Check if these SIDs exist in the primary hash
      const primKey = `props:${sport}:rows:prim`;
      console.log(`2️⃣ Checking primary hash: ${primKey}`);
      
      if (topSids.length > 0) {
        const firstSid = topSids[0];
        const rowData = await redis.hget(primKey, firstSid);
        
        if (rowData) {
          console.log(`   ✅ Sample row data exists for SID: ${firstSid}`);
          const parsed = JSON.parse(rowData);
          console.log(`   Event: ${parsed.ev?.away || '?'} @ ${parsed.ev?.home || '?'}`);
          console.log(`   Entity: ${parsed.ent}`);
          console.log(`   Market: ${parsed.mkt}`);
          console.log(`   Live: ${parsed.ev?.live ? 'YES' : 'NO'}`);
          console.log('');
        } else {
          console.log(`   ❌ No row data found for SID: ${firstSid}`);
          console.log(`   This is the problem! The sorted set has SIDs but the hash doesn't have the data.\n`);
        }
      }
    } else {
      console.log(`   ⚠️  No live games found in sorted set\n`);
    }
    
    // Check pregame for comparison
    const pregameKey = `props:${sport}:sort:roi:pregame:${market}`;
    console.log(`3️⃣ Checking pregame sorted set for comparison: ${pregameKey}`);
    const pregameCount = await redis.zcard(pregameKey);
    console.log(`   Found ${pregameCount} entries in pregame sorted set\n`);
    
    // Check if there are any live events at all
    console.log(`4️⃣ Checking for any live NFL events (all markets)`);
    const allMarkets = ['moneyline', 'spread', 'total', 'passing_yards', 'rushing_yards', 'receiving_yards'];
    
    for (const mkt of allMarkets) {
      const key = `props:${sport}:sort:roi:live:${mkt}`;
      const count = await redis.zcard(key);
      if (count > 0) {
        console.log(`   ✅ ${mkt}: ${count} live entries`);
      }
    }
    console.log('');
    
    // Check the live status hash
    console.log(`5️⃣ Checking live status hash: props:${sport}:is_live`);
    const liveStatusKey = `props:${sport}:is_live`;
    const allLiveStatus = await redis.hgetall(liveStatusKey);
    const liveStatusCount = Object.keys(allLiveStatus || {}).length;
    console.log(`   Found ${liveStatusCount} entries in live status hash`);
    
    // Count how many are actually live (status = 1)
    const liveGames = Object.entries(allLiveStatus || {}).filter(([_, status]) => status === '1' || status === 1);
    console.log(`   🔴 Actually LIVE games: ${liveGames.length}`);
    
    if (liveGames.length > 0) {
      console.log(`   Live game SIDs:`);
      liveGames.slice(0, 10).forEach(([sid, status]) => {
        console.log(`   ${sid}: ${status}`);
      });
      
      // Check if these live SIDs exist in the primary hash
      console.log(`\n6️⃣ Checking if live game data exists in primary hash`);
      const primKey = `props:${sport}:rows:prim`;
      const firstLiveSid = liveGames[0][0];
      const rowData = await redis.hget(primKey, firstLiveSid);
      
      if (rowData) {
        console.log(`   ✅ Live game data exists for SID: ${firstLiveSid}`);
        const parsed = JSON.parse(rowData);
        console.log(`   Event: ${parsed.ev?.away || '?'} @ ${parsed.ev?.home || '?'}`);
        console.log(`   Market: ${parsed.mkt}`);
        console.log(`   Live flag: ${parsed.ev?.live}`);
      } else {
        console.log(`   ❌ No data found for live SID: ${firstLiveSid}`);
      }
    } else {
      console.log(`   ⚠️  All ${liveStatusCount} games are marked as NOT live (status = 0)`);
      console.log(`   This means there are currently no live NFL games.`);
    }
    console.log('');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
  
  console.log('✅ Debug complete!');
  process.exit(0);
}

debugLiveNFL().catch(console.error);

