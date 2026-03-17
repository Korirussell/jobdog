# JobDog Neo-Brutalist Design System

**Inspired by PostHog.com**

## Color Palette

### Primary Colors
```css
--primary: #ff6b35        /* Vibrant orange */
--primary-dark: #e85a2a   /* Darker orange for hover */
--secondary: #4ecdc4      /* Teal/cyan */
--accent: #ffe66d         /* Yellow */
--danger: #ff006e         /* Hot pink */
--success: #06ffa5        /* Bright green */
```

### Neutrals
```css
--background: #faf4ed     /* Retro off-white */
--foreground: #1a1a1a     /* Near black */
--gray-800: #2d2d2d
--gray-900: #1a1a1a
```

## Typography

### Fonts
- **Sans-serif**: Inter (primary UI font)
- **Monospace**: JetBrains Mono (code, labels, buttons)

### Usage
```tsx
className="font-mono"  // For buttons, labels, code
className="font-sans"  // For body text
```

## Shadows (Neo-Brutalist Hard Shadows)

```css
--shadow-brutal-sm: 2px 2px 0px 0px #000000
--shadow-brutal: 4px 4px 0px 0px #000000
--shadow-brutal-lg: 6px 6px 0px 0px #000000
```

### Usage
```tsx
className="shadow-brutal"     // Standard
className="shadow-brutal-lg"  // Large elements
className="shadow-brutal-sm"  // Small elements
```

## Borders

All borders are **3px thick** and **black**:
```tsx
className="border-thick border-black"
```

## Interactive States

### Hover Effect
```tsx
className="brutal-hover"
```

Behavior:
- **Hover**: Element moves up-left (-2px, -2px), shadow increases
- **Active**: Element moves down-right (+2px, +2px), shadow decreases

## Components

### WindowFrame
OS-style window with title bar and controls.

```tsx
<WindowFrame title="MyApp.exe" closeable>
  <p>Content goes here</p>
</WindowFrame>
```

Props:
- `title`: Window title (string)
- `closeable`: Show close button (boolean)
- `defaultMinimized`: Start minimized (boolean)
- `onClose`: Callback when closed (function)

### Button
Neo-brutalist button with variants.

```tsx
<Button variant="primary" size="md">
  Click Me
</Button>
```

Variants: `primary` | `secondary` | `danger` | `success`
Sizes: `sm` | `md` | `lg`

### Card
Container with brutal styling.

```tsx
<Card hoverable>
  <h3>Card Title</h3>
  <p>Card content</p>
</Card>
```

Props:
- `hoverable`: Enable hover effect (boolean)

### Input
Form input with brutal styling.

```tsx
<Input
  label="Email"
  placeholder="you@example.com"
  error="Invalid email"
/>
```

## Layout Principles

1. **High Contrast**: Use bold, contrasting colors
2. **Thick Borders**: Always 3px black borders
3. **Hard Shadows**: No blur, only offset shadows
4. **Mono Typography**: Use monospace for UI elements
5. **Retro Aesthetic**: Think Windows 95 meets modern web

## Example Combinations

### Primary CTA
```tsx
<Button variant="primary" size="lg" className="shadow-brutal-lg">
  Get Started
</Button>
```

### Info Card
```tsx
<Card hoverable className="bg-accent">
  <h3 className="font-mono font-bold uppercase">Pro Tip</h3>
  <p className="font-mono text-sm">Use keyboard shortcuts!</p>
</Card>
```

### Window Section
```tsx
<WindowFrame title="Dashboard.exe">
  <div className="grid grid-cols-2 gap-4">
    <div className="border-thick border-black bg-primary p-4 shadow-brutal-sm">
      <div className="font-mono text-3xl font-bold text-white">1,829</div>
      <div className="font-mono text-xs uppercase text-white">Jobs</div>
    </div>
  </div>
</WindowFrame>
```

## Best Practices

1. **Always use thick borders** on interactive elements
2. **Combine shadows with borders** for depth
3. **Use monospace fonts** for labels and buttons
4. **High contrast** color combinations only
5. **Avoid gradients** - stick to solid colors
6. **Keep it bold** - this is brutalism, not minimalism

## Accessibility

- All interactive elements have proper ARIA labels
- Color contrast meets WCAG AA standards
- Keyboard navigation supported
- Focus states clearly visible

## Resources

- PostHog.com (inspiration)
- Neo-Brutalism UI examples
- Windows 95 UI guidelines
