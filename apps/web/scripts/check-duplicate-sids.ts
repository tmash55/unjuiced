#!/usr/bin/env tsx
/**
 * Check for duplicate SIDs in Redis sorted sets
 * 
 * Usage:
 *   tsx scripts/check-duplicate-sids.ts
 *   tsx scripts/check-duplicate-sids.ts nfl spread pregame
 */

import { redis } from '../lib/redis'

async function checkDuplicates(sport: string, market: string, scope: 'pregame' | 'live') {
  const key = `props:${sport}:sort:roi:${scope}:${market}`
  
  console.log(`\n🔍 Checking: ${key}`)
  console.log('─'.repeat(60))
  
  try {
    // Get total count
    const total = await redis.zcard(key)
    console.log(`📊 Total entries: ${total}`)
    
    if (total === 0) {
      console.log('⚠️  No data found')
      return
    }
    
    // Get all SIDs
    const allSids = await redis.zrange(key, 0, -1) as string[]
    
    // Count occurrences
    const sidCounts = new Map<string, number>()
    allSids.forEach(sid => {
      sidCounts.set(sid, (sidCounts.get(sid) || 0) + 1)
    })
    
    // Find duplicates
    const duplicates = Array.from(sidCounts.entries())
      .filter(([_, count]) => count > 1)
      .sort((a, b) => b[1] - a[1]) // Sort by count descending
    
    if (duplicates.length === 0) {
      console.log('✅ No duplicates found!')
    } else {
      console.log(`\n❌ Found ${duplicates.length} duplicate SIDs:\n`)
      
      for (const [sid, count] of duplicates.slice(0, 10)) {
        console.log(`   ${sid}: ${count}x`)
        
        // Get the scores for this SID
        const scores = await redis.zmscore(key, [sid]) as (number | null)[]
        if (scores && scores.length > 0) {
          console.log(`      Scores: ${scores.filter(s => s !== null).join(', ')}`)
        }
        
        // Get row data
        const rowKey = `props:${sport}:rows:prim`
        const rowData = await redis.hget(rowKey, sid)
        if (rowData) {
          try {
            const row = typeof rowData === 'string' ? JSON.parse(rowData) : rowData
            console.log(`      Event: ${row.ev?.away?.abbr || '?'} @ ${row.ev?.home?.abbr || '?'}`)
            console.log(`      Entity: ${row.player || row.ent || '?'}`)
            console.log(`      Line: ${row.ln}`)
          } catch (e) {
            console.log(`      (Could not parse row data)`)
          }
        }
        console.log()
      }
      
      if (duplicates.length > 10) {
        console.log(`   ... and ${duplicates.length - 10} more`)
      }
      
      // Calculate stats
      const totalDuplicateEntries = duplicates.reduce((sum, [_, count]) => sum + count, 0)
      const uniqueSids = duplicates.length
      const wastedEntries = totalDuplicateEntries - uniqueSids
      
      console.log(`\n📈 Stats:`)
      console.log(`   Unique SIDs with duplicates: ${uniqueSids}`)
      console.log(`   Total duplicate entries: ${totalDuplicateEntries}`)
      console.log(`   Wasted entries: ${wastedEntries}`)
      console.log(`   Efficiency: ${((total - wastedEntries) / total * 100).toFixed(1)}%`)
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
  
  console.log('─'.repeat(60))
}

async function main() {
  const args = process.argv.slice(2)
  
  if (args.length === 3) {
    // Check specific sport/market/scope
    const [sport, market, scope] = args
    await checkDuplicates(sport, market, scope as 'pregame' | 'live')
  } else {
    // Check common markets
    console.log('🔍 Checking common markets for duplicates...\n')
    
    const checks = [
      { sport: 'nfl', market: 'spread', scope: 'pregame' as const },
      { sport: 'nfl', market: 'total', scope: 'pregame' as const },
      { sport: 'nfl', market: 'moneyline', scope: 'pregame' as const },
      { sport: 'nfl', market: 'passing_yards', scope: 'pregame' as const },
      { sport: 'nba', market: 'spread', scope: 'pregame' as const },
      { sport: 'nba', market: 'total', scope: 'pregame' as const },
      { sport: 'nhl', market: 'moneyline', scope: 'pregame' as const },
    ]
    
    for (const check of checks) {
      await checkDuplicates(check.sport, check.market, check.scope)
    }
  }
  
  // No need to close Upstash Redis connection (REST-based)
}

main().catch(console.error)

