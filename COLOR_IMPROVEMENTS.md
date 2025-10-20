# Arbitrage Table Color Improvements

## Changes Applied

### 1. **Dual Bet Button** (Primary Blue)
**Before**: White background on light mode with dark blue hover
**After**: 
- Light mode: `#0EA5E9` (sky-500) background with white text
- Dark mode: `#7DD3FC` (sky-400) background with white text
- Hover: Deeper shade in both modes
- **Visual Impact**: Eye-catching blue button with white zap icon

### 2. **ROI % Badge** (Accent Lime-Green)
**Before**: Emerald green subtle badge
**After**:
- Uses `--color-accent` (Lime `#84CC16`)
- Light mode: Lime-600 text on lime-100 background
- Dark mode: Lime-300 text on lime-900/20 background
- Added shadow for depth
- Bolder font weight
- **Visual Impact**: Vibrant lime badge that pops on the page

### 3. **Profit Column** (Accent Lime-Green)
**Before**: Emerald green text
**After**:
- Main profit value: Accent lime color
- ROI percentage: Accent-dark with transparency
- **Visual Impact**: Consistent lime-green theme for profit/gains

## Color System Used

### Primary (Blue) - Action & Navigation
- `--color-primary`: `#0EA5E9` (light) / `#7DD3FC` (dark)
- Used for: Dual bet button, interactive elements

### Accent (Lime) - Profit & Success
- `--color-accent`: `#84CC16`
- `--color-accent-light`: `#BEF264`
- `--color-accent-dark`: `#4D7C0F`
- Used for: ROI badges, profit values, positive metrics

### Secondary (Teal) - Available for EV/Edge
- `--color-secondary`: `#14B8A6`
- Potential use: Expected value indicators, edge calculations

### Tertiary (Violet) - Available for Premium/Pro
- `--color-tertiary`: `#A78BFA`
- Potential use: Pro badges, premium features

## Additional Color Opportunities

### 1. **Status Indicators**
- Use `--color-success` (#22C55E) for active/available opportunities
- Use `--color-warning` (#FACC15) for expiring soon
- Use `--color-error` (#EF4444) for expired/unavailable

### 2. **League Badges**
- Could add subtle tint based on sport type
- NFL: Blue tint
- NBA: Orange tint
- MLB: Red tint

### 3. **Market Type Pills**
- Different accent colors per market type
- Spread: Primary blue
- Moneyline: Secondary teal
- Total: Accent lime

### 4. **Time/Urgency Indicators**
- Games starting < 1 hour: Warning yellow
- Games starting < 15 min: Error red
- Future games: Neutral gray

### 5. **Best ROI Highlight**
- Top 3 opportunities could have a subtle tertiary (violet) glow
- Premium indicator for highest value arbs

## Light Mode vs Dark Mode

### Light Mode Characteristics:
- Deeper, more saturated colors (500-600 shades)
- Higher contrast for clarity
- Brighter accent colors pop against white backgrounds

### Dark Mode Characteristics:
- Lighter, less saturated colors (300-400 shades)
- Reduced eye strain
- Colors maintain visibility without being neon

## Implementation Notes

All colors use CSS variables that automatically adapt:
```css
/* Light mode */
--color-primary: #0EA5E9;
--color-accent: #84CC16;

/* Dark mode */
--color-primary: #7DD3FC;
--color-accent: #BEF264;
```

This ensures perfect harmony in both themes without manual overrides!

