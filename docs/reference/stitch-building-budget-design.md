# Stitch Building Budget & Ledger Screen Design Reference

## Layout
- Main content area (ml-64 for sidebar offset), max-w-7xl centered
- Page header: "Building Finance" (4xl, font-manrope, extrabold, text-primary), subtitle below
- Admin/Board role only view

## Summary Cards (grid-cols-4)

Each card:
- bg-surface-container-lowest (white), p-6, rounded-xl, shadow-sm
- Icon in colored rounded-full pill (w-10 h-10, flex items-center justify-center)
- Label: uppercase, tracking-wider, text-xs, text-secondary, mt-3
- Amount: text-2xl, font-extrabold, text-primary, mt-1

### Card 1 — Current Fund Balance
- Icon: account_balance (bg-primary-fixed text-primary)
- Amount: $412,850
- Badge: "+2.4%" — bg-green-100 text-green-700, rounded-full, px-2 py-0.5, text-xs font-semibold, inline next to amount

### Card 2 — Reserve Fund
- Icon: savings (bg-tertiary-fixed text-tertiary)
- Amount: $1,240,000
- Sub-label: "Reserve fund" (text-secondary, text-sm)

### Card 3 — Total Income YTD
- Icon: trending_up (bg-green-100 text-green-700)
- Amount: $850,200
- Sub-label: "Year to date" (text-secondary, text-sm)

### Card 4 — Total Expenses YTD
- Icon: trending_down (bg-error-container text-error)
- Amount: $437,350
- Sub-label: "Year to date" (text-secondary, text-sm)

## Action Bar

- Container: flex flex-wrap gap-3 items-center justify-between, mb-6, bg-surface-container-lowest, p-4, rounded-xl
- Left side (filters):
  - Date range picker: two date inputs (From / To), rounded-xl, border border-outline-variant, px-3 py-2, text-sm
  - Category filter dropdown: bg-surface-container-low, rounded-xl, border-none, px-3 py-2, text-sm
- Right side (actions):
  - Add Expense button: outlined (border border-error text-error), rounded-xl, px-4 py-2, text-sm, with remove icon
  - Add Income button: outlined (border border-green-600 text-green-700), rounded-xl, px-4 py-2, text-sm, with add icon
  - Import Bank Statement button: outlined (border border-outline text-secondary), rounded-xl, px-4 py-2, text-sm, with upload_file icon
  - Generate Report button: bg-primary text-white, rounded-xl, px-4 py-2, text-sm font-semibold, with picture_as_pdf icon

## Main Grid (grid grid-cols-12 gap-6)

### Budget vs Actual Table (col-span-5)

- Section header: "Budget Overview" (xl, font-manrope, font-semibold), year selector dropdown (right-aligned)
- Container: bg-surface-container-lowest, rounded-xl, overflow-hidden, shadow-sm

#### Table columns
| Column    | Detail                                                              |
|-----------|---------------------------------------------------------------------|
| Category  | font-semibold, text-primary                                         |
| Planned   | text-secondary, text-sm                                             |
| Actual    | font-semibold (red if over-budget, green if under)                  |
| Progress  | Progress bar (see below)                                            |

#### Progress Bars
- Bar wrapper: w-full bg-surface-container-low, rounded-full, h-2
- Bar fill: bg-primary by default, rounded-full
- Over-budget rows: bar fill uses bg-error, row background bg-error-container/20
- Percentage label: text-xs text-secondary, mt-0.5

#### Table Styling
- Header row: bg-surface-container-low, text-xs uppercase tracking-wider, text-secondary, px-4 py-3
- Body rows: bg-surface-container-lowest, border-b border-outline-variant, px-4 py-3
- Totals row: bg-surface-container-low, font-bold, border-t-2 border-outline

### Recent Ledger Table (col-span-7)

- Section header: "Ledger Entries" (xl, font-manrope, font-semibold), "View All" link (text-primary, text-sm)
- Container: bg-surface-container-lowest, rounded-xl, overflow-hidden, shadow-sm

#### Table columns
| Column      | Detail                                                                         |
|-------------|--------------------------------------------------------------------------------|
| Date        | text-secondary, text-sm                                                        |
| Description | font-semibold text-primary (main), category badge below (text-xs pill)         |
| Category    | Inline badge: bg-surface-container text-secondary, rounded-full, px-2 py-0.5  |
| Debit       | font-semibold text-error (negative amounts, prefixed with −)                   |
| Credit      | font-semibold text-green-700 (positive amounts, prefixed with +)               |
| Balance     | font-semibold text-primary                                                     |

#### Table Styling
- Header row: bg-surface-container-low, text-xs uppercase tracking-wider, text-secondary, px-4 py-3
- Body rows: bg-surface-container-lowest, border-b border-outline-variant, px-4 py-3, hover:bg-surface-container-low
- Debit column: text-error, font-semibold
- Credit column: text-green-700, font-semibold

## Modals

### Add Expense / Add Income Modal
- Overlay: bg-black/40 backdrop-blur-sm, fixed inset-0, z-50
- Dialog: bg-surface, rounded-2xl, p-8, max-w-md w-full, shadow-xl
- Header: title (xl font-manrope font-bold) + X close button
- Fields: Date picker, Account/Category select, Description textarea, Amount input, Receipt upload (drag-drop zone)
- Footer: Cancel (outlined) + Save (bg-primary text-white) buttons

### CSV Import Dialog
- Overlay: same as above
- Dialog: max-w-lg
- Drag-and-drop zone: border-2 border-dashed border-outline-variant, rounded-xl, p-12, text-center
- File accepted: .csv only, show file name + size after upload
- Preview: first 5 rows of parsed CSV in a table
- Footer: Cancel + Import buttons

## Colors (from Tailwind config)
- primary: #002045
- primary-container: #1a365d
- primary-fixed: #d6e3ff
- tertiary: #006874
- tertiary-fixed: #97f0ff
- surface: #faf8ff
- surface-container-lowest: #ffffff
- surface-container-low: #f3f0fb
- surface-container: #eceaf7
- outline-variant: #c4c6d0
- error: #ba1a1a
- error-container: #ffdad6

## Typography
- Font: Manrope (headings), system-ui (body)
- Heading sizes: 4xl (page title), xl (section titles), base (table data)
- Label pattern: uppercase + tracking-wider + text-xs for card meta-labels
