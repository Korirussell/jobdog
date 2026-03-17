# JobDog UI Architecture

**Theme:** Neo-Brutalist / Retro OS (Windows 95 meets Modern Flexbox)

---

## Color Palette

### Primary Colors
```css
--background: #F4F0EB       /* Warm manila/beige background */
--foreground: #000000       /* Pure black text */
--primary: #FFD166          /* Golden folder yellow - primary actions */
--primary-dark: #E6BC5C     /* Darker golden yellow for hover */
--secondary: #CD7A2C        /* Dog fur brown - secondary accent */
--secondary-dark: #B86A24   /* Darker brown for hover */
```

### Styling Rules
- **All interactive elements:** `border-2 border-black`
- **Shadows:** Solid, unblurred (e.g., `shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]`)
- **Fonts:** 
  - Monospace (JetBrains Mono) for job metadata, paths, labels
  - Inter for body text

---

## Layout Architecture

### Two-Pane Structure

```
┌─────────────────────────────────────────────────────┐
│  [Fixed Sidebar - 256px]  │  [Main Content Area]   │
│                            │                        │
│  ┌──────────────────────┐ │  ┌──────────────────┐  │
│  │ JobDog Logo          │ │  │ Sticky SearchBar │  │
│  │ (jobdog.png)         │ │  └──────────────────┘  │
│  └──────────────────────┘ │                        │
│                            │  ┌──────────────────┐  │
│  📁 /jobs/all             │  │ Job Cards Grid   │  │
│  ⭐ /jobs/saved           │  │                  │  │
│  📄 /applications         │  │  [Card] [Card]   │  │
│  📋 /resumes              │  │  [Card] [Card]   │  │
│  👤 /profile/settings     │  │  [Card] [Card]   │  │
│                            │  │                  │  │
│  ┌──────────────────────┐ │  └──────────────────┘  │
│  │ Stats Footer         │ │                        │
│  │ Jobs: 1,829          │ │  [Load More Button]    │
│  │ Updated: 6h ago      │ │                        │
│  └──────────────────────┘ │                        │
└─────────────────────────────────────────────────────┘
```

---

## Components

### 1. Sidebar (`components/Sidebar.tsx`)

**Purpose:** Fixed left-hand navigation resembling Windows 95 file explorer

**Features:**
- JobDog logo at top (from `public/assets/jobdog.png`)
- File path-style navigation links
- Active state highlighting with golden yellow background
- Footer with live stats (job count, last update)

**Styling:**
- Fixed position, 256px width
- Border-right: 2px solid black
- Background: warm beige (#F4F0EB)
- Logo section: golden yellow background with black border

### 2. JobCard (`components/JobCard.tsx`)

**Purpose:** Terminal-style job listing card

**Features:**
- Company name in brown header bar
- Job title, location, employment type
- Posted date
- "Apply Now" CTA button

**Styling:**
- Border: 2px solid black
- Shadow: 4px 4px 0px 0px rgba(0,0,0,1)
- Header: brown background (#CD7A2C)
- Hover: increases shadow to 6px 6px
- Monospace font for all metadata

### 3. SearchBar (`components/SearchBar.tsx`)

**Purpose:** Sticky search and filter interface

**Features:**
- Text input for job search
- Search button with magnifying glass icon
- Quick filter buttons (INTERNSHIP, REMOTE, NEW, US ONLY)

**Styling:**
- Sticky positioning at top of main content
- Border-bottom: 2px solid black
- Input: solid border with brutal shadow on focus
- Buttons: golden yellow with black borders

### 4. Layout (`app/layout.tsx`)

**Structure:**
```tsx
<div className="flex min-h-screen">
  <Sidebar />
  <main className="ml-64 flex-1">
    {children}
  </main>
</div>
```

**Key Points:**
- Sidebar is fixed, main content has left margin
- No authentication walls - job board visible to all
- Responsive (sidebar collapses on mobile - TODO)

---

## Page Structure

### Home Page (`app/page.tsx`)

**Current Implementation:**
- SearchBar (sticky)
- Page header showing current directory path (`📁 /jobs/all`)
- Job count display
- Grid of JobCard components (3 columns on desktop)
- "Load More" button

**Mock Data:**
Currently using 6 hardcoded jobs. Will be replaced with API integration.

---

## Typography

### Font Stack
- **Sans-serif:** Inter (via next/font/google)
- **Monospace:** JetBrains Mono (via next/font/google)

### Usage
- Job titles, company names: `font-mono font-bold`
- Metadata (location, date, type): `font-mono text-sm`
- Navigation links: `font-mono text-sm`
- Body text: `font-sans` (Inter)

---

## Shadows & Borders

### Shadow Classes
```css
.shadow-brutal-sm: 2px 2px 0px 0px rgba(0,0,0,1)
.shadow-brutal: 4px 4px 0px 0px rgba(0,0,0,1)
.shadow-brutal-lg: 6px 6px 0px 0px rgba(0,0,0,1)
```

### Border Standard
All interactive elements use `border-2 border-black`

### Hover Effects
- Buttons: increase shadow size
- Cards: shadow-brutal → shadow-brutal-lg
- Active state: translate(2px, 2px) + reduce shadow

---

## Accessibility

- All navigation links use semantic HTML (`<Link>`)
- Images have alt text
- Color contrast meets WCAG AA standards
- Keyboard navigation supported
- Focus states clearly visible

---

## Responsive Behavior (TODO)

### Desktop (>1024px)
- Full sidebar visible (256px)
- 3-column job grid

### Tablet (768px - 1024px)
- Full sidebar visible
- 2-column job grid

### Mobile (<768px)
- Sidebar collapses to hamburger menu
- 1-column job grid
- Search bar remains sticky

---

## Next Steps

### Immediate
1. ✅ Build UI shell (COMPLETED)
2. ⏳ Integrate with backend API (`lib/api.ts`)
3. ⏳ Add authentication pages (login, register)
4. ⏳ Implement saved jobs functionality
5. ⏳ Build resume upload page

### Future Enhancements
- Mobile responsive sidebar
- Job filtering and sorting
- Pagination
- Job detail modal/page
- Application tracking dashboard
- User profile settings

---

## File Structure

```
services/frontend/
├── app/
│   ├── globals.css          # Neo-Brutalist theme
│   ├── layout.tsx           # Two-pane root layout
│   └── page.tsx             # Job board homepage
├── components/
│   ├── Sidebar.tsx          # File explorer navigation
│   ├── JobCard.tsx          # Terminal-style job card
│   ├── SearchBar.tsx        # Sticky search/filter
│   ├── Button.tsx           # Reusable button (legacy)
│   ├── Card.tsx             # Reusable card (legacy)
│   ├── Input.tsx            # Reusable input (legacy)
│   └── WindowFrame.tsx      # Window wrapper (legacy)
├── lib/
│   └── api.ts               # Backend API client
└── public/
    └── assets/
        └── jobdog.png       # Logo
```

---

## Design Principles

1. **No Modern SaaS Aesthetics** - Embrace retro, brutalist design
2. **High Contrast** - Black borders, solid shadows, bold colors
3. **Monospace Everything** - Use JetBrains Mono for UI elements
4. **File Explorer Metaphor** - Navigation feels like browsing directories
5. **No Authentication Walls** - Job board visible without login
6. **Solid, Unblurred Shadows** - All shadows are hard-edged
7. **Golden Yellow CTAs** - Primary actions use folder yellow
8. **Brown Accents** - Secondary elements use dog fur brown
