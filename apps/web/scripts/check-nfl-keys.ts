/**
 * Check what NFL live keys exist in Redis
 */

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: 'https://finer-basilisk-19142.upstash.io',
  token: 'AUrGAAIjcDFjOGUyMWUxOTA3NDY0NzAwOTFiMGU3OWMzYzVjN2QyMHAxMA',
});

async function checkNFLKeys() {
  console.log('🔍 Checking NFL Live Keys in Redis\n');

  // Check all possible live sorted sets for NFL
  const markets = [
    'moneyline', 'spread', 'total',
    'passing_yards', 'rushing_yards', 'receiving_yards',
    'passing_tds', 'rushing_tds', 'receptions',
    'pass_completions', 'pass_attempts', 'interceptions'
  ];
  
  console.log('📊 NFL Live Sorted Sets:');
  for (const market of markets) {
    const key = `props:nfl:sort:roi:live:${market}`;
    const count = await redis.zcard(key);
    if (count > 0) {
      console.log(`   ✅ ${market}: ${count} entries`);
      
      // Get a sample SID
      const sample = await redis.zrange(key, 0, 0, { rev: true });
      if (sample.length > 0) {
        console.log(`      Sample SID: ${sample[0]}`);
      }
    } else {
      console.log(`   ❌ ${market}: 0 entries`);
    }
  }
  
  console.log('\n📊 Checking if NFL primary hash has any data:');
  const primKey = 'props:nfl:rows:prim';
  
  // Try to get the hash length (this might not work directly, so we'll sample)
  console.log(`   Key: ${primKey}`);
  
  // Check pregame to see if there's data structure
  console.log('\n📊 NFL Pregame Sorted Sets (for comparison):');
  for (const market of markets.slice(0, 6)) {
    const key = `props:nfl:sort:roi:pregame:${market}`;
    const count = await redis.zcard(key);
    if (count > 0) {
      console.log(`   ✅ ${market}: ${count} entries`);
    }
  }
  
  console.log('\n✅ Check complete!');
  process.exit(0);
}

checkNFLKeys().catch(console.error);

