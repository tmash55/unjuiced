/**
 * Compare live data across all sports
 */

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: 'https://finer-basilisk-19142.upstash.io',
  token: 'AUrGAAIjcDFjOGUyMWUxOTA3NDY0NzAwOTFiMGU3OWMzYzVjN2QyMHAxMA',
});

async function compareLiveSports() {
  console.log('🔍 Comparing Live Data Across All Sports\n');

  const sports = ['nfl', 'nba', 'nhl', 'ncaaf', 'mlb'];
  const market = 'moneyline';
  
  for (const sport of sports) {
    console.log(`\n━━━ ${sport.toUpperCase()} ━━━`);
    
    // Check live sorted set
    const liveKey = `props:${sport}:sort:roi:live:${market}`;
    const liveCount = await redis.zcard(liveKey);
    console.log(`Live sorted set (${market}): ${liveCount} entries`);
    
    // Check live status hash (try both hash and set types)
    const liveStatusKey = `props:${sport}:is_live`;
    try {
      const allLiveStatus = await redis.hgetall(liveStatusKey);
      const totalEntries = Object.keys(allLiveStatus || {}).length;
      const actuallyLive = Object.entries(allLiveStatus || {}).filter(([_, status]) => status === '1' || status === 1).length;
      console.log(`Live status hash: ${totalEntries} total, ${actuallyLive} actually live`);
    } catch (e: any) {
      if (e.message?.includes('WRONGTYPE')) {
        // Try as a set instead
        const setSize = await redis.scard(liveStatusKey);
        console.log(`Live status set: ${setSize} entries (using SET type, not HASH)`);
      } else {
        console.log(`Live status: Error - ${e.message}`);
      }
    }
    
    // If there are live games, show a sample
    if (liveCount > 0) {
      const topSids = await redis.zrange(liveKey, 0, 0, { rev: true });
      if (topSids.length > 0) {
        const primKey = `props:${sport}:rows:prim`;
        const rowData = await redis.hget(primKey, topSids[0]);
        if (rowData) {
          try {
            const parsed = typeof rowData === 'string' ? JSON.parse(rowData) : rowData;
            console.log(`✅ Sample live game: ${parsed.ev?.away || '?'} @ ${parsed.ev?.home || '?'}`);
          } catch (e) {
            console.log(`⚠️  Could not parse row data`);
          }
        }
      }
    }
    
    // Check pregame for comparison
    const pregameKey = `props:${sport}:sort:roi:pregame:${market}`;
    const pregameCount = await redis.zcard(pregameKey);
    console.log(`Pregame sorted set: ${pregameCount} entries`);
  }
  
  console.log('\n✅ Comparison complete!');
  process.exit(0);
}

compareLiveSports().catch(console.error);

