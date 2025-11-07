# Best Odds Table - CSS Variables Match

## Current Status

✅ **Both tables now use the exact same CSS!**

The Best Odds table is using the `roi-badge up` class, which is the same class used in arb-table-v2.

## ROI Badge CSS Variables

### From `app/globals.css`:

```css
.roi-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: var(--roi-pad-y) var(--roi-pad-x);
  border-radius: var(--roi-radius);
  background: var(--roi-bg);        /* ← Accent-tinted background */
  border: 1px solid var(--roi-br);  /* ← Accent border */
  color: var(--roi-ink);            /* ← Accent text color */
  font: 600 15px/1.2 var(--roi-font);
  letter-spacing: -0.01em;
  position: relative;
  box-shadow:
    0 1px 0 0 rgba(0,0,0,0.06) inset,
    0 0 0 1px color-mix(in oklab,var(--accent) 12%, transparent); /* Soft glow */
}

.roi-badge::before { /* Subtle top gloss */
  content: "";
  position: absolute; 
  inset: 0;
  border-radius: inherit;
  background: var(--roi-gloss);
  pointer-events: none;
}

.roi-badge .caret {
  width: 0; 
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
}

.roi-badge.up .caret {
  border-bottom: 6px solid var(--roi-ink); /* Up arrow */
}
```

## Color Values

### Light Mode (`:root`):
```css
--accent: #22C55E;                    /* Green-500 */
--accent-strong: #16A34A;             /* Green-600 */

--roi-bg: color-mix(in oklab, var(--accent) 16%, var(--card));
--roi-br: color-mix(in oklab, var(--accent) 42%, var(--border));
--roi-ink: color-mix(in oklab, var(--accent) 90%, #0a0a0a);
--roi-gloss: linear-gradient(180deg, rgba(255,255,255,.6), rgba(255,255,255,0));
```

**Result:**
- Background: Very light green tint (16% accent + white card)
- Border: Medium green (42% accent + border color)
- Text: Rich dark green (90% accent + black)
- Gloss: White gradient overlay

### Dark Mode (`.dark`):
```css
--accent: #34D399;                    /* Emerald-400 */
--accent-weak: #6EE7B7;               /* Emerald-300 */
--accent-strong: #059669;             /* Emerald-600 */

--roi-bg: color-mix(in oklab, var(--accent) 14%, transparent);
--roi-br: color-mix(in oklab, var(--accent) 35%, #0b1014);
--roi-ink: color-mix(in oklab, var(--accent) 95%, #eafdf3);
--roi-gloss: linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,0));
```

**Result:**
- Background: Subtle emerald glow (14% accent + transparent)
- Border: Emerald border (35% accent + dark base)
- Text: Bright emerald (95% accent + minty white)
- Gloss: Very subtle white gradient

## Visual Effects

### 1. **Soft Outer Glow**
```css
box-shadow: 0 0 0 1px color-mix(in oklab, var(--accent) 12%, transparent);
```
Creates a subtle halo around the badge.

### 2. **Inner Shadow**
```css
box-shadow: 0 1px 0 0 rgba(0,0,0,0.06) inset;
```
Adds depth to the badge.

### 3. **Top Gloss** (::before pseudo-element)
```css
background: var(--roi-gloss);
```
Creates a subtle shine effect on top.

### 4. **Up Arrow Caret**
```css
border-bottom: 6px solid var(--roi-ink);
```
Triangle pointing up, same color as text.

## Comparison

### Arb Table V2:
```tsx
<span className="roi-badge up">
  <span className="caret"></span>
  +{roiPct}%
</span>
```

### Best Odds Table:
```tsx
<span className="roi-badge up">
  <span className="caret"></span>
  +{improvementPct}%
</span>
```

**✅ IDENTICAL CSS CLASSES**

## Why Colors Might Look Different

If the colors still appear different, it could be:

1. **Browser Cache** - Hard refresh (Cmd+Shift+R / Ctrl+Shift+R)
2. **Different Percentages** - Different ROI values might create optical illusions
3. **Surrounding Colors** - Context affects color perception
4. **Screen Calibration** - Display settings
5. **CSS Not Loaded** - Check browser console for CSS errors

## Verification Steps

1. Open browser DevTools
2. Inspect the improvement badge
3. Check computed styles
4. Verify these values:
   - `background`: Should use `var(--roi-bg)`
   - `border-color`: Should use `var(--roi-br)`
   - `color`: Should use `var(--roi-ink)`

## Expected Appearance

**Light Mode:**
- 🟢 Soft green background
- 🟢 Medium green border
- 🟢 Dark green text
- ▲ Dark green up arrow

**Dark Mode:**
- 🟢 Subtle emerald glow
- 🟢 Bright emerald border
- 🟢 Bright emerald text
- ▲ Bright emerald up arrow

Both tables should look **identical** now! 🎯


