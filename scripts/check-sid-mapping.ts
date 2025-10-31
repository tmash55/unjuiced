#!/usr/bin/env tsx
/**
 * Check SID mapping for a specific player/market
 * 
 * Compares:
 * 1. SIDs in props:{sport}:sids:ent:{ent}:mkt:{mkt} (used by /api/props/find)
 * 2. Actual SIDs in props:{sport}:rows:prim for that player/market
 * 
 * Usage:
 *   tsx scripts/check-sid-mapping.ts nfl "pid:00-0036389" passing_yards
 */

import { redis } from '../lib/redis'

async function checkSIDMapping(sport: string, ent: string, market: string) {
  console.log(`\n🔍 Checking SID mapping for:`)
  console.log(`   Sport: ${sport}`)
  console.log(`   Entity: ${ent}`)
  console.log(`   Market: ${market}`)
  console.log('─'.repeat(80))
  
  try {
    // 1. Get SIDs from the mapping SET (what /api/props/find returns)
    const sidsKey = `props:${sport}:sids:ent:${ent}:mkt:${market}`
    const mappedSids = await redis.smembers(sidsKey) as string[]
    
    console.log(`\n📍 SIDs in mapping SET (${sidsKey}):`)
    if (mappedSids.length === 0) {
      console.log('   ⚠️  No SIDs found in mapping SET')
    } else {
      mappedSids.forEach((sid, idx) => {
        console.log(`   ${idx + 1}. ${sid}`)
      })
    }
    
    // 2. Get all rows from props:rows:prim and find matching ones
    const rowsKey = `props:${sport}:rows:prim`
    const allSids = await redis.hkeys(rowsKey) as string[]
    
    console.log(`\n📊 Searching ${allSids.length} total rows for matches...`)
    
    const matchingRows: Array<{ sid: string; row: any }> = []
    
    // Fetch rows in batches to avoid overwhelming Redis
    const batchSize = 100
    for (let i = 0; i < allSids.length; i += batchSize) {
      const batch = allSids.slice(i, i + batchSize)
      const rawData = await redis.hmget(rowsKey, ...batch) as unknown as (string | null)[]
      
      for (let j = 0; j < batch.length; j++) {
        const sid = batch[j]
        const raw = rawData[j]
        
        if (!raw) continue
        
        try {
          const row = typeof raw === 'string' ? JSON.parse(raw) : raw
          
          // Check if this row matches our entity and market
          if (row.ent === ent && row.mkt === market) {
            matchingRows.push({ sid, row })
          }
        } catch (e) {
          // Skip unparseable rows
        }
      }
    }
    
    console.log(`\n📍 Actual rows in ${rowsKey} matching entity+market:`)
    if (matchingRows.length === 0) {
      console.log('   ⚠️  No matching rows found')
    } else {
      matchingRows.forEach((match, idx) => {
        console.log(`\n   ${idx + 1}. SID: ${match.sid}`)
        console.log(`      Player: ${match.row.player || 'N/A'}`)
        console.log(`      Team: ${match.row.team || 'N/A'}`)
        console.log(`      Market: ${match.row.mkt}`)
        console.log(`      Line: ${match.row.ln}`)
        console.log(`      Event: ${match.row.ev?.away?.abbr || '?'} @ ${match.row.ev?.home?.abbr || '?'}`)
        
        // Check if this SID is in the mapping SET
        const inMapping = mappedSids.includes(match.sid)
        if (inMapping) {
          console.log(`      ✅ In mapping SET`)
        } else {
          console.log(`      ❌ NOT in mapping SET (this is the problem!)`)
        }
      })
    }
    
    // 3. Check if mapped SIDs actually exist in rows:prim
    console.log(`\n🔍 Checking if mapped SIDs exist in rows:prim:`)
    for (const sid of mappedSids) {
      const exists = await redis.hexists(rowsKey, sid)
      if (exists) {
        const raw = await redis.hget(rowsKey, sid)
        const row = typeof raw === 'string' ? JSON.parse(raw) : raw
        console.log(`   ✅ ${sid}`)
        console.log(`      Player: ${row.player || 'N/A'}`)
        console.log(`      Line: ${row.ln}`)
      } else {
        console.log(`   ❌ ${sid} - NOT FOUND in rows:prim (stale mapping!)`)
      }
    }
    
    // 4. Summary
    console.log(`\n📈 Summary:`)
    console.log(`   SIDs in mapping SET: ${mappedSids.length}`)
    console.log(`   Actual matching rows: ${matchingRows.length}`)
    
    const staleSids = mappedSids.filter(sid => !matchingRows.some(m => m.sid === sid))
    const missingSids = matchingRows.filter(m => !mappedSids.includes(m.sid))
    
    if (staleSids.length > 0) {
      console.log(`   ⚠️  Stale SIDs in mapping: ${staleSids.length}`)
      console.log(`      (SIDs in mapping but not in actual rows)`)
    }
    
    if (missingSids.length > 0) {
      console.log(`   ⚠️  Missing SIDs in mapping: ${missingSids.length}`)
      console.log(`      (Actual rows not in mapping SET)`)
    }
    
    if (staleSids.length === 0 && missingSids.length === 0 && mappedSids.length > 0) {
      console.log(`   ✅ Mapping is correct!`)
    }
    
    // 5. Recommendations
    if (staleSids.length > 0 || missingSids.length > 0) {
      console.log(`\n💡 Recommendations:`)
      
      if (staleSids.length > 0) {
        console.log(`\n   Remove stale SIDs from mapping:`)
        staleSids.forEach(sid => {
          console.log(`   redis-cli SREM "${sidsKey}" "${sid}"`)
        })
      }
      
      if (missingSids.length > 0) {
        console.log(`\n   Add missing SIDs to mapping:`)
        missingSids.forEach(m => {
          console.log(`   redis-cli SADD "${sidsKey}" "${m.sid}"`)
        })
      }
      
      console.log(`\n   Or clear and rebuild the mapping:`)
      console.log(`   redis-cli DEL "${sidsKey}"`)
      missingSids.forEach(m => {
        console.log(`   redis-cli SADD "${sidsKey}" "${m.sid}"`)
      })
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
  
  console.log('─'.repeat(80))
}

async function main() {
  const args = process.argv.slice(2)
  
  if (args.length !== 3) {
    console.log('Usage: tsx scripts/check-sid-mapping.ts <sport> <entity> <market>')
    console.log('Example: tsx scripts/check-sid-mapping.ts nfl "pid:00-0036389" passing_yards')
    console.log('')
    console.log('To find the entity ID for a player:')
    console.log('  1. Go to odds screen and select the player')
    console.log('  2. Open browser console')
    console.log('  3. Look for the "ent" field in the row data')
    process.exit(1)
  }
  
  const [sport, ent, market] = args
  
  await checkSIDMapping(sport, ent, market)
  // No need to close Upstash Redis connection (REST-based)
}

main().catch(console.error)

