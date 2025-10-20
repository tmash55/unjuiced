# Semantic Color System

We've implemented a semantic color token system that automatically adapts between light and dark modes for better visual harmony.

## Color Tokens

### Light Mode
- `--color-primary`: `#0EA5E9` (sky-500) - Main brand color, vibrant and clear
- `--color-primary-light`: `#38BDF8` (sky-400) - Softer highlights, hover states
- `--color-primary-dark`: `#0284C7` (sky-600) - Deeper accents, pressed states
- `--color-primary-rgb`: `14, 165, 233` - RGB values for opacity adjustments

### Dark Mode (Automatic)
- `--color-primary`: `#38BDF8` (sky-400) - Brighter for visibility on dark backgrounds
- `--color-primary-light`: `#7DD3FC` (sky-300) - Lighter highlights
- `--color-primary-dark`: `#0EA5E9` (sky-500) - Balanced shade
- `--color-primary-rgb`: `56, 189, 248` - RGB values for opacity adjustments

## Usage Examples

### In CSS/Tailwind
```css
/* Direct CSS */
.my-button {
  background-color: var(--color-primary);
  border-color: var(--color-primary-dark);
}

.my-button:hover {
  background-color: var(--color-primary-light);
}

/* With opacity */
.my-overlay {
  background-color: rgba(var(--color-primary-rgb), 0.1);
}
```

### In Tailwind Classes
```tsx
// Background
<div className="bg-[var(--color-primary)]">

// Text color
<span className="text-[var(--color-primary)]">

// Border
<div className="border-[var(--color-primary-dark)]">

// With opacity
<div className="bg-[rgba(var(--color-primary-rgb),0.1)]">
```

### In Framer Motion
```tsx
<motion.div
  animate={{
    backgroundColor: 'var(--color-primary)',
    // or with RGB for opacity
    backgroundColor: 'rgba(var(--color-primary-rgb), 0.08)',
  }}
/>
```

### In Component Styles
```tsx
<div
  style={{
    backgroundColor: 'var(--color-primary)',
    borderColor: 'var(--color-primary-dark)',
  }}
>
```

## Legacy Support

The original `--color-brand` token still exists for backward compatibility:
- `--color-brand`: `#38BDF8` (same in light and dark)
- `--color-brand-rgb`: `56, 189, 248`

## Migration Tips

When updating components, replace:
- `--color-brand` → `--color-primary`
- Direct hex colors like `#38BDF8` → `var(--color-primary)`
- Custom RGB values → `rgba(var(--color-primary-rgb), opacity)`

## Benefits

✅ **Automatic theme adaptation** - Colors adjust based on light/dark mode  
✅ **Better contrast** - Optimized for readability in each mode  
✅ **Consistent hierarchy** - light/dark variants maintain relationships  
✅ **Easy maintenance** - Update colors in one place  
✅ **Flexible opacity** - RGB variants for semi-transparent effects  

## Color Philosophy

**Light Mode**: Uses deeper, more saturated colors (sky-500/600) that stand out against light backgrounds while maintaining a professional appearance.

**Dark Mode**: Uses lighter, more vibrant colors (sky-300/400) that provide better visibility and feel more energetic against dark backgrounds while reducing eye strain.

