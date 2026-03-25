# Stitch Forum Screen Design Reference

## Layout
- Two-panel: left sidebar (w-64, categories) + main content area
- But our app already has the main sidebar, so categories go in a left sub-panel or inline

## Categories Sidebar
- Header: "CATEGORIES" (xs, extrabold, uppercase, tracking-widest, text-slate-400)
- Category items: icon + name + count in parens
  - Active: white bg, text-blue-900, rounded-lg, shadow-sm, font-semibold
  - Inactive: text-slate-500, hover:bg-white/50
- "New Discussion" button at bottom: bg-primary, rounded-xl, font-bold

## Pinned Topics Section
- Grid: 2 columns on desktop
- Pinned card style 1 (dark): gradient bg from-primary to-primary-container, white text
  - Push pin icon (filled), tag label, title (xl, bold), preview, author + date
- Pinned card style 2 (light): white bg with gradient border from-secondary-container
  - Push pin icon (primary), priority tag (error-container bg), same layout

## Topic List
- White card (rounded-xl), rows with hover:bg-surface-container
- Each row: avatar (w-10, rounded-full) + title (font-headline, font-bold, text-primary) + lock icon if locked
  - Author info: name + unit + category
  - Right side: reply count (bold) + "Last activity" date

## Filter Bar
- Sort dropdown ("Recent"/"Top") + Status dropdown ("All Status"/"Open"/"Resolved")
- Topic count: "Showing 1-15 of 324 topics"

## Pagination
- Previous/Next buttons + numbered page buttons (active: bg-primary text-white rounded-full)
