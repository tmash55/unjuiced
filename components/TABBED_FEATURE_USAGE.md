# Tabbed Feature Section - Reusable Component

## Overview
The `TabbedFeatureSection` is a highly reusable component for showcasing multiple features with interactive tabs, auto-rotation, and beautiful animations.

## Architecture

```
components/
├── tabbed-feature-section.tsx    # Core reusable component
├── how-it-works/
│   ├── index.tsx                  # Arbitrage features implementation
│   └── skeletons2.tsx            # Arbitrage-specific skeletons
└── positive-ev/
    └── index.tsx                  # Positive EV features implementation
```

## Usage

### Basic Implementation

```tsx
import { TabbedFeatureSection } from "@/components/tabbed-feature-section";

export const MyFeature = () => {
  const tabs = [
    {
      title: "Feature One",
      description: "Description of feature one",
      icon: FeatureOneIcon,
      id: "feature-one",
      skeleton: <FeatureOneSkeleton />,
      learnMoreHref: "/feature-one", // Optional
    },
    // ... more tabs
  ];

  return (
    <TabbedFeatureSection
      badge="Product Name"
      heading="Main heading text"
      subheading="Supporting subheading text"
      ctaText="Call to action"      // Optional
      ctaHref="/cta-link"            // Optional
      tabs={tabs}
      autoRotate={true}              // Optional, default: true
      autoRotateDuration={8000}      // Optional, default: 8000ms
    />
  );
};
```

## Props API

### TabbedFeatureSectionProps

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `badge` | `string` | ✅ | - | Badge text shown at the top |
| `heading` | `string` | ✅ | - | Main section heading |
| `subheading` | `string` | ✅ | - | Supporting text below heading |
| `ctaText` | `string` | ❌ | - | Call-to-action button text |
| `ctaHref` | `string` | ❌ | - | Call-to-action button link |
| `tabs` | `FeatureTab[]` | ✅ | - | Array of tab configurations |
| `autoRotate` | `boolean` | ❌ | `true` | Enable auto-rotation through tabs |
| `autoRotateDuration` | `number` | ❌ | `8000` | Duration (ms) before rotating to next tab |

### FeatureTab Type

```typescript
type FeatureTab = {
  title: string;                                    // Tab title
  description: string;                              // Tab description
  icon: React.FC<React.SVGProps<SVGSVGElement>>;  // Icon component
  id: string;                                       // Unique identifier
  skeleton: React.ReactNode;                        // Content to display
  learnMoreHref?: string;                          // Optional learn more link
};
```

## Examples

### Example 1: Arbitrage Features (how-it-works)

```tsx
<TabbedFeatureSection
  badge="Arbitrage"
  heading="Arbitrage, simplified."
  subheading="Live and pregame risk-free pairs..."
  ctaText="Explore Arbitrage"
  ctaHref="/arbitrage"
  tabs={arbitrageTabs}
  autoRotateDuration={8000}
/>
```

### Example 2: Positive EV Features

```tsx
<TabbedFeatureSection
  badge="Positive EV"
  heading="Find profitable edges, automatically."
  subheading="Our algorithm scans thousands of lines..."
  ctaText="Start Finding +EV"
  ctaHref="/positive-ev"
  tabs={evTabs}
  autoRotateDuration={10000}  // 10 seconds per tab
/>
```

### Example 3: Without CTA or Auto-Rotation

```tsx
<TabbedFeatureSection
  badge="Analytics"
  heading="Track your performance"
  subheading="Advanced analytics for serious bettors"
  tabs={analyticsTabs}
  autoRotate={false}  // Disable auto-rotation
/>
```

## Features

✅ **Responsive Design**: Desktop tabs, mobile stacked layout  
✅ **Auto-Rotation**: Optional automatic tab cycling  
✅ **Progress Indicator**: Visual loader shows time until next tab  
✅ **Smooth Animations**: Blur transitions, canvas effects  
✅ **Hover States**: Visual feedback on tab hover  
✅ **Learn More Links**: Optional per-tab learn more links  
✅ **Flexible Grid**: Automatically adjusts for 2-4+ tabs  
✅ **Dark Mode**: Full dark mode support  

## Best Practices

### 1. Create Feature-Specific Skeletons

Keep your skeleton components separate and co-located with your feature:

```
components/
├── positive-ev/
│   ├── index.tsx
│   └── skeletons.tsx  ✅ Feature-specific skeletons here
```

### 2. Consistent Icon Sizes

All icons should be **16x16** SVGs for visual consistency:

```tsx
const MyIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg width="16" height="16" viewBox="0 0 16 16" {...props}>
    {/* ... */}
  </svg>
);
```

### 3. Meaningful Tab IDs

Use descriptive, unique IDs for each tab:

```tsx
id: "opportunities"  // ✅ Good
id: "tab1"          // ❌ Bad
```

### 4. Optimize Skeleton Performance

Keep skeletons lightweight:
- Use CSS animations over JavaScript when possible
- Lazy load heavy components
- Respect `prefers-reduced-motion`

### 5. Tab Count Recommendations

- **2-3 tabs**: Ideal, each gets proper attention
- **4 tabs**: Maximum recommended
- **5+ tabs**: Consider splitting into multiple sections

## Customization

### Changing Colors

The component uses CSS variables from your design system:
- `--color-brand`: Primary brand color
- `--color-dots`: Background dot pattern
- `--color-canvas`: Canvas fill color

### Adjusting Timing

```tsx
autoRotateDuration={12000}  // 12 seconds per tab
```

### Display Height

Modify the canvas height in `tabbed-feature-section.tsx`:

```tsx
<div className="relative h-[480px] ...">  // Change 480px
```

## Migration Guide

### Converting Existing Feature Sections

1. **Extract your tabs configuration**:
```tsx
const tabs = [/* your tabs */];
```

2. **Replace component body**:
```tsx
return (
  <TabbedFeatureSection
    badge="Your Badge"
    heading="Your Heading"
    subheading="Your Subheading"
    tabs={tabs}
  />
);
```

3. **Test and adjust**:
- Verify animations
- Check responsive behavior
- Test auto-rotation timing

## Performance Notes

- Component uses `AnimatePresence` for smooth transitions
- Canvas effects are GPU-accelerated
- Auto-rotation uses `setInterval` (cleaned up on unmount)
- Responsive images should use Next.js `<Image>` component

## Accessibility

- ✅ Keyboard navigation supported
- ✅ `aria-label` on tab buttons
- ✅ Semantic HTML structure
- ✅ Focus management

## Questions?

See the implementations in:
- `/components/how-it-works/index.tsx`
- `/components/positive-ev/index.tsx`

