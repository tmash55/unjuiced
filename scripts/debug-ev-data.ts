import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

async function debugEVData() {
  console.log("🔍 Debugging EV Data in Redis\n");

  // 1. Check sorted sets
  console.log("📊 Checking sorted sets...");
  const pregameCount = await redis.zcard("ev:all:sort:pregame:best");
  const liveCount = await redis.zcard("ev:all:sort:live:best");
  console.log(`  - ev:all:sort:pregame:best: ${pregameCount} items`);
  console.log(`  - ev:all:sort:live:best: ${liveCount} items\n`);

  // 2. Get top 10 from pregame with scores
  console.log("🏆 Top 10 pregame opportunities (with scores):");
  const top10 = await redis.zrange("ev:all:sort:pregame:best", 0, 9, {
    rev: true,
    withScores: true,
  });
  
  if (Array.isArray(top10)) {
    for (let i = 0; i < top10.length; i += 2) {
      const seid = top10[i];
      const score = top10[i + 1];
      console.log(`  ${i/2 + 1}. ${seid} → EV: ${score}%`);
    }
  }
  console.log();

  // 3. Get bottom 10 from pregame with scores
  console.log("📉 Bottom 10 pregame opportunities (with scores):");
  const bottom10 = await redis.zrange("ev:all:sort:pregame:best", 0, 9, {
    withScores: true,
  });
  
  if (Array.isArray(bottom10)) {
    for (let i = 0; i < bottom10.length; i += 2) {
      const seid = bottom10[i];
      const score = bottom10[i + 1];
      console.log(`  ${i/2 + 1}. ${seid} → EV: ${score}%`);
    }
  }
  console.log();

  // 4. Check hash sizes
  console.log("📦 Checking hash sizes...");
  const sports = ["nfl", "nba", "nhl", "mlb", "ncaaf"];
  for (const sport of sports) {
    const key = `ev:${sport}:rows`;
    const count = await redis.hlen(key);
    console.log(`  - ${key}: ${count} rows`);
  }
  console.log();

  // 5. Sample a few rows to check data structure
  console.log("🔬 Sampling row data...");
  const sampleSeids = await redis.zrange("ev:all:sort:pregame:best", 0, 2, {
    rev: true,
  });
  
  for (const seid of sampleSeids as string[]) {
    const sport = seid.split(":")[0];
    const rowKey = `ev:${sport}:rows`;
    const rawRow = await redis.hget(rowKey, seid);
    
    if (rawRow) {
      const row = typeof rawRow === 'string' ? JSON.parse(rawRow) : rawRow;
      console.log(`\n  SEID: ${seid}`);
      console.log(`  Sport: ${row.sport}`);
      console.log(`  Market: ${row.mkt}`);
      console.log(`  Line: ${row.line}`);
      console.log(`  Side: ${row.side}`);
      console.log(`  Book: ${row.book}`);
      console.log(`  Odds: ${row.odds?.am}`);
      console.log(`  Best EV: ${row.rollup?.best_case}%`);
      console.log(`  Worst EV: ${row.rollup?.worst_case}%`);
      console.log(`  Method: ${row.rollup?.best_method}`);
    }
  }

  // 6. Check for high EV opportunities (> 3%)
  console.log("\n\n🎯 Checking for high EV opportunities (> 3%)...");
  const highEVCount = await redis.zcount(
    "ev:all:sort:pregame:best",
    3.0,
    "+inf"
  );
  console.log(`  Found ${highEVCount} opportunities with EV > 3%`);

  if (highEVCount > 0) {
    console.log("\n  Top 5 high EV opportunities:");
    const highEV = await redis.zrange("ev:all:sort:pregame:best", 0, 4, {
      rev: true,
      withScores: true,
    });
    
    if (Array.isArray(highEV)) {
      for (let i = 0; i < highEV.length; i += 2) {
        const seid = highEV[i];
        const score = highEV[i + 1];
        if (score > 3) {
          console.log(`    ${i/2 + 1}. ${seid} → EV: ${score}%`);
        }
      }
    }
  }

  console.log("\n✅ Debug complete!");
}

debugEVData().catch(console.error);


