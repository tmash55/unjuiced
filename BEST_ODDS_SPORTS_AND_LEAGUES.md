# Best Odds - Sports and Leagues Structure

## Changes Made

Updated the Best Odds filters to match the arbitrage pattern with separate Sports and Leagues sections, including sport icons.

### New Structure

#### Before:
```
Leagues & Markets Tab:
- Leagues (flat list)
  ☐ NBA
  ☐ NFL
  ☐ NCAAF
  ☐ NCAAB
  ☐ NHL
  ☐ MLB
  ☐ WNBA
- Markets (grouped by sport)
```

#### After:
```
Leagues & Markets Tab:
- Sports (with icons)
  ☐ 🏈 Football
  ☐ 🏀 Basketball
  ☐ ⚾ Baseball
  ☐ 🏒 Hockey

- Leagues (grouped under sports, with icons)
  ☐ 🏈 NFL
  ☐ 🏈 NCAAF
  ☐ 🏀 NBA
  ☐ 🏀 NCAAB
  ☐ 🏀 WNBA
  ☐ ⚾ MLB
  ☐ 🏒 NHL

- Markets (grouped by sport)
```

### Key Features

**1. Sports Section** ✅
- Football, Basketball, Baseball, Hockey
- Sport icons from `SportIcon` component
- Same icons as arbitrage filters

**2. Leagues Section** ✅
- NFL, NCAAF (under Football)
- NBA, NCAAB, WNBA (under Basketball)
- MLB (under Baseball)
- NHL (under Hockey)
- Sport icons next to each league

**3. Conditional Enabling** ✅
- Leagues disabled if parent sport not selected
- Visual feedback (opacity-50, cursor-not-allowed)
- Prevents selection of leagues from unselected sports

**4. Smart State Management** ✅
- Sports state derived from selected leagues on load
- Local state for uncommitted changes
- Syncs with preferences on save

### Data Structure

**Sports:**
```typescript
{
  id: 'Football',
  name: 'Football',
  leagues: [
    { id: 'nfl', name: 'NFL', sportId: 'Football' },
    { id: 'ncaaf', name: 'NCAAF', sportId: 'Football' },
  ]
}
```

**Leagues:**
```typescript
{
  id: 'nfl',
  name: 'NFL',
  sportId: 'Football'  // Links to parent sport
}
```

### Visual Design

**Sports Cards:**
```
┌─────────────────────────────────┐
│ ☑ 🏈 Football                   │ ← Active
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ ☐ 🏀 Basketball                 │ ← Inactive
└─────────────────────────────────┘
```

**Leagues Cards (when sport selected):**
```
┌─────────────────────────────────┐
│ ☑ 🏈 NFL                        │ ← Active
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ ☐ 🏈 NCAAF                      │ ← Inactive
└─────────────────────────────────┘
```

**Leagues Cards (when sport NOT selected):**
```
┌─────────────────────────────────┐
│ ☐ 🏀 NBA                        │ ← Disabled (grayed out)
└─────────────────────────────────┘
```

### Code Implementation

**Sports Toggle:**
```typescript
const toggleSport = (id: string) => {
  setLocalSports(prev => 
    prev.includes(id) 
      ? prev.filter(s => s !== id) 
      : [...prev, id]
  );
};
```

**League Conditional Rendering:**
```typescript
{allLeagues.map((league) => {
  const checked = allLeaguesSelected || localLeagues.includes(league.id);
  const sportSelected = localSports.length === 0 || localSports.includes(league.sportId);
  
  return (
    <label className={!sportSelected ? 'opacity-50 cursor-not-allowed' : ''}>
      <Checkbox
        checked={checked}
        onCheckedChange={() => sportSelected && toggleLeague(league.id)}
        disabled={!sportSelected}
      />
      <SportIcon sport={league.sportId.toLowerCase()} />
      <span>{league.name}</span>
    </label>
  );
})}
```

**Sport Icon Usage:**
```typescript
<SportIcon sport={sport.name.toLowerCase()} className="h-5 w-5" />
<SportIcon sport={league.sportId.toLowerCase()} className="h-4 w-4" />
```

## Files Changed

### `components/best-odds/best-odds-filters.tsx`
- Added imports for `getAllSports`, `getAllLeagues`, `SportIcon`
- Added `localSports` state
- Added `toggleSport` function
- Updated sync logic to derive sports from leagues
- Added Sports section with sport icons
- Updated Leagues section with conditional enabling
- Added sport icons to league cards
- Updated Select All/Clear All to handle sports

## Benefits

✅ **Matches Arb Pattern** - Consistent hierarchy across tools  
✅ **Better Organization** - Sports → Leagues → Markets  
✅ **Visual Icons** - Easy to identify sports at a glance  
✅ **Conditional Logic** - Can't select leagues from unselected sports  
✅ **Familiar UX** - Users already know this pattern from arb  
✅ **Same Icons** - Consistent iconography across app  

## Testing Checklist

1. ✅ Sports section shows Football, Basketball, Baseball, Hockey
2. ✅ Sport icons display correctly
3. ✅ Leagues section shows all leagues
4. ✅ League icons match parent sport
5. ✅ Leagues disabled when sport not selected
6. ✅ Visual feedback for disabled leagues (grayed out)
7. ✅ Can't check disabled leagues
8. ✅ Select All enables all sports and clears leagues
9. ✅ Clear All clears sports and sets specific leagues
10. ✅ Apply saves changes correctly
11. ✅ Reset restores all sports


