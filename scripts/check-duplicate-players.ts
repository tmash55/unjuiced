#!/usr/bin/env tsx
/**
 * Check for duplicate players in the Ladders player list
 * 
 * This checks if the same player (entity) appears multiple times
 * in the props:{sport}:players:mkt:{mkt} SET
 * 
 * Usage:
 *   tsx scripts/check-duplicate-players.ts nfl passing_yards
 */

import { redis } from '../lib/redis'

async function checkDuplicatePlayers(sport: string, market: string) {
  console.log(`\n🔍 Checking for duplicate players:`)
  console.log(`   Sport: ${sport}`)
  console.log(`   Market: ${market}`)
  console.log('─'.repeat(80))
  
  try {
    // Get all entities from the players SET
    const setKey = `props:${sport}:players:mkt:${market}`
    const entities = await redis.smembers<string>(setKey) || []
    
    console.log(`\n📊 Total entities in SET: ${entities.length}`)
    
    if (entities.length === 0) {
      console.log('⚠️  No players found')
      return
    }
    
    // Count occurrences (should all be 1 since it's a SET)
    const counts = new Map<string, number>()
    entities.forEach(ent => {
      counts.set(ent, (counts.get(ent) || 0) + 1)
    })
    
    const duplicates = Array.from(counts.entries()).filter(([_, count]) => count > 1)
    
    if (duplicates.length > 0) {
      console.log(`\n❌ Found ${duplicates.length} duplicate entities in SET:`)
      duplicates.forEach(([ent, count]) => {
        console.log(`   ${ent}: ${count}x`)
      })
      console.log(`\n⚠️  This shouldn't happen - SETs should have unique members!`)
    } else {
      console.log(`\n✅ No duplicates in SET (as expected)`)
    }
    
    // Now check if multiple entities map to the same player
    console.log(`\n🔍 Checking for multiple entities mapping to same player...`)
    
    const playerCards = new Map<string, string[]>() // player name -> [entity IDs]
    
    for (const ent of entities) {
      const cardKey = `props:${sport}:player:${ent}`
      const card = await redis.hgetall<Record<string, string>>(cardKey) || {}
      
      if (card.name) {
        if (!playerCards.has(card.name)) {
          playerCards.set(card.name, [])
        }
        playerCards.get(card.name)!.push(ent)
      }
    }
    
    const duplicateNames = Array.from(playerCards.entries())
      .filter(([_, ents]) => ents.length > 1)
      .sort((a, b) => b[1].length - a[1].length)
    
    if (duplicateNames.length > 0) {
      console.log(`\n❌ Found ${duplicateNames.length} players with multiple entity IDs:\n`)
      
      for (const [name, ents] of duplicateNames.slice(0, 20)) {
        console.log(`📍 ${name}`)
        console.log(`   Entity IDs (${ents.length}):`)
        
        for (const ent of ents) {
          const cardKey = `props:${sport}:player:${ent}`
          const card = await redis.hgetall<Record<string, string>>(cardKey) || {}
          
          // Get SIDs for this entity
          const sidsKey = `props:${sport}:sids:ent:${ent}:mkt:${market}`
          const sids = await redis.smembers<string>(sidsKey) || []
          
          console.log(`      ${ent}`)
          console.log(`         Team: ${card.team || 'N/A'}`)
          console.log(`         Position: ${card.position || 'N/A'}`)
          console.log(`         SIDs: ${sids.length}`)
          
          // Check if SIDs are valid
          let validSids = 0
          for (const sid of sids) {
            const exists = await redis.exists(`props:${sport}:rows:alt:${sid}`)
            if (exists === 1) validSids++
          }
          console.log(`         Valid SIDs: ${validSids}`)
        }
        console.log()
      }
      
      if (duplicateNames.length > 20) {
        console.log(`   ... and ${duplicateNames.length - 20} more`)
      }
      
      console.log(`\n💡 This is likely the source of duplicate players in the UI!`)
      console.log(`   The same player has multiple entity IDs, all appearing in the dropdown.`)
    } else {
      console.log(`\n✅ No players with multiple entity IDs`)
    }
    
    // Summary
    console.log(`\n📈 Summary:`)
    console.log(`   Total entities: ${entities.length}`)
    console.log(`   Unique player names: ${playerCards.size}`)
    console.log(`   Players with multiple entity IDs: ${duplicateNames.length}`)
    
    if (duplicateNames.length > 0) {
      const totalDuplicateEntities = duplicateNames.reduce((sum, [_, ents]) => sum + ents.length, 0)
      const uniquePlayers = duplicateNames.length
      const extraEntities = totalDuplicateEntities - uniquePlayers
      
      console.log(`   Extra entity IDs: ${extraEntities}`)
      console.log(`   Efficiency: ${((entities.length - extraEntities) / entities.length * 100).toFixed(1)}%`)
      
      console.log(`\n💡 Recommendations:`)
      console.log(`   1. Ingestor should use consistent entity IDs for the same player`)
      console.log(`   2. Consider deduplicating by player name in the API`)
      console.log(`   3. Clean up duplicate entity IDs from the players SET`)
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
  
  console.log('─'.repeat(80))
}

async function main() {
  const args = process.argv.slice(2)
  
  if (args.length !== 2) {
    console.log('Usage: tsx scripts/check-duplicate-players.ts <sport> <market>')
    console.log('Example: tsx scripts/check-duplicate-players.ts nfl passing_yards')
    process.exit(1)
  }
  
  const [sport, market] = args
  
  await checkDuplicatePlayers(sport, market)
  await redis.quit()
}

main().catch(console.error)

