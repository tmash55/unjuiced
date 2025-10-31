#!/usr/bin/env tsx
/**
 * Find duplicate rows in props:nfl:rows:prim
 * 
 * Identifies multiple SIDs that represent the same logical row
 * (same event + same market + same line)
 * 
 * Usage:
 *   tsx scripts/find-duplicate-rows.ts nfl
 *   tsx scripts/find-duplicate-rows.ts nba spread
 */

import { redis } from '../lib/redis'

interface RowData {
  sid: string
  eid: string // Event ID
  ent: string // Entity ID
  player: string | null
  team: string | null
  mkt: string // Market
  ln: number // Line
  ev: {
    dt: string
    home: { abbr: string }
    away: { abbr: string }
  }
}

async function findDuplicateRows(sport: string, marketFilter?: string) {
  const key = `props:${sport}:rows:prim`
  
  console.log(`\n🔍 Analyzing: ${key}`)
  console.log('─'.repeat(80))
  
  try {
    // Get all SIDs in the hash
    const allSids = await redis.hkeys(key) as string[]
    console.log(`📊 Total SIDs in hash: ${allSids.length}`)
    
    if (allSids.length === 0) {
      console.log('⚠️  No data found')
      return
    }
    
    // Fetch all row data
    console.log('📥 Fetching row data...')
    const rawData = await redis.hmget(key, ...allSids) as unknown as (string | null)[]
    
    // Parse rows
    const rows: RowData[] = []
    for (let i = 0; i < allSids.length; i++) {
      const sid = allSids[i]
      const raw = rawData[i]
      
      if (!raw) continue
      
      try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
        rows.push({ sid, ...parsed })
      } catch (e) {
        console.warn(`⚠️  Could not parse SID ${sid}`)
      }
    }
    
    console.log(`✅ Parsed ${rows.length} rows`)
    
    // Filter by market if specified
    let filteredRows = rows
    if (marketFilter) {
      filteredRows = rows.filter(r => r.mkt === marketFilter)
      console.log(`🔎 Filtered to ${filteredRows.length} rows for market: ${marketFilter}`)
    }
    
    // Group by logical identity: event + entity + market + line
    const groups = new Map<string, RowData[]>()
    
    for (const row of filteredRows) {
      // For game markets, entity is "game" or event-based
      // For player markets, entity is the player ID
      const entityKey = row.player ? row.ent : 'game'
      const logicalId = `${row.eid}|${entityKey}|${row.mkt}|${row.ln}`
      
      if (!groups.has(logicalId)) {
        groups.set(logicalId, [])
      }
      groups.get(logicalId)!.push(row)
    }
    
    // Find duplicates
    const duplicates = Array.from(groups.entries())
      .filter(([_, rows]) => rows.length > 1)
      .sort((a, b) => b[1].length - a[1].length) // Sort by count descending
    
    if (duplicates.length === 0) {
      console.log('\n✅ No duplicate rows found!')
    } else {
      console.log(`\n❌ Found ${duplicates.length} logical rows with multiple SIDs:\n`)
      
      let totalDuplicateSids = 0
      
      for (const [logicalId, dupeRows] of duplicates.slice(0, 20)) {
        const [eid, ent, mkt, ln] = logicalId.split('|')
        const firstRow = dupeRows[0]
        
        totalDuplicateSids += dupeRows.length
        
        console.log(`\n📍 ${firstRow.ev.away.abbr} @ ${firstRow.ev.home.abbr}`)
        console.log(`   Market: ${mkt}`)
        console.log(`   Line: ${ln}`)
        if (firstRow.player) {
          console.log(`   Player: ${firstRow.player} (${firstRow.team})`)
        }
        console.log(`   Event ID: ${eid}`)
        console.log(`   Entity: ${ent}`)
        console.log(`   ⚠️  ${dupeRows.length} duplicate SIDs:`)
        
        dupeRows.forEach((row, idx) => {
          console.log(`      ${idx + 1}. ${row.sid}`)
        })
      }
      
      if (duplicates.length > 20) {
        console.log(`\n   ... and ${duplicates.length - 20} more duplicate groups`)
      }
      
      // Calculate stats
      const totalLogicalRows = groups.size
      const totalSids = filteredRows.length
      const wastedSids = totalSids - totalLogicalRows
      
      console.log(`\n📈 Stats:`)
      console.log(`   Total logical rows: ${totalLogicalRows}`)
      console.log(`   Total SIDs: ${totalSids}`)
      console.log(`   Duplicate SIDs: ${wastedSids}`)
      console.log(`   Efficiency: ${((totalLogicalRows / totalSids) * 100).toFixed(1)}%`)
      console.log(`   Average SIDs per row: ${(totalSids / totalLogicalRows).toFixed(2)}`)
    }
    
    // Check sorted sets for these duplicates
    if (duplicates.length > 0) {
      console.log(`\n🔍 Checking sorted sets...`)
      
      const sampleDupe = duplicates[0][1]
      const mkt = sampleDupe[0].mkt
      const zkey = `props:${sport}:sort:roi:pregame:${mkt}`
      
      console.log(`   Checking: ${zkey}`)
      
      const allZsetSids = await redis.zrange(zkey, 0, -1) as string[]
      const dupeSids = new Set(sampleDupe.map(r => r.sid))
      const foundInZset = allZsetSids.filter(sid => dupeSids.has(sid))
      
      console.log(`   Found ${foundInZset.length}/${dupeSids.size} duplicate SIDs in sorted set`)
      
      if (foundInZset.length > 1) {
        console.log(`   ⚠️  Multiple SIDs for same row are in the sorted set!`)
        console.log(`   This is why you see duplicate rows on the frontend.`)
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
  
  console.log('─'.repeat(80))
}

async function main() {
  const args = process.argv.slice(2)
  
  if (args.length === 0) {
    console.log('Usage: tsx scripts/find-duplicate-rows.ts <sport> [market]')
    console.log('Example: tsx scripts/find-duplicate-rows.ts nfl')
    console.log('Example: tsx scripts/find-duplicate-rows.ts nfl spread')
    process.exit(1)
  }
  
  const sport = args[0]
  const market = args[1]
  
  await findDuplicateRows(sport, market)
  // No need to close Upstash Redis connection (REST-based)
}

main().catch(console.error)

