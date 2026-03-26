# Stitch Unit Payment Screen Design Reference

## Layout
- Main content area (ml-64 for sidebar offset), max-w-6xl centered
- Page header: "Finance" or "My Payments" (4xl, font-manrope, extrabold, text-primary), subtitle below

## Summary Cards (grid-cols-3)

Each card:
- bg-surface-container-lowest (white), p-8, rounded-xl, shadow-sm
- Icon in colored rounded-full pill (w-10 h-10, flex items-center justify-center)
- Label: uppercase, tracking-wider, text-xs, text-secondary, mt-4
- Amount: text-4xl, font-extrabold, text-primary, mt-1

### Card 1 — Current Balance
- Icon: wallet or account_balance (bg-primary-fixed text-primary)
- Amount: $0.00
- Sub-label: green checkmark icon + "fully settled" (text-green-700, text-sm)

### Card 2 — Next Payment Due
- Icon: calendar_today (bg-tertiary-fixed text-tertiary)
- Amount: $350
- Sub-label: due date string (text-secondary, text-sm)
- PAY NOW button: bg-primary text-white, rounded-xl, px-4 py-2, text-sm font-semibold, mt-3, full width or inline

### Card 3 — Payment Status
- Icon: check_circle (bg-green-100 text-green-700)
- Amount/Badge: "SUCCESSFULLY PAID" — bg-green-100 text-green-700, rounded-full, px-3 py-1, text-xs font-bold uppercase tracking-wider
- Sub-label: last payment date (text-secondary, text-sm)

## Monthly Payment Trends

- Section header: "Monthly Payment Trends" (xl, font-manrope, font-semibold), year selector dropdown (right-aligned, bg-surface-container-low, rounded-xl, border-none, px-3 py-1)
- Bar chart container: bg-surface-container-lowest, p-6, rounded-xl
- 12 vertical bars, each with month label below
- Current month bar: bg-primary, rounded-t-md
- Future months: dashed border (border-2 border-dashed border-outline-variant), bg-transparent, rounded-t-md
- Past months: bg-primary-fixed, rounded-t-md
- Bar height proportional to amount (use inline style height)
- Amount label above each bar (text-xs, text-secondary)

## Financial History Table

- Section header: "Financial History" (xl, font-manrope, font-semibold)
- Action bar (flex, justify-between, mb-4):
  - Filter button: outlined, rounded-xl, with filter_list icon, text-sm
  - Export CSV button: outlined, rounded-xl, with download icon, text-sm

### Table columns
| Column     | Detail                                                                 |
|------------|------------------------------------------------------------------------|
| Month      | Bold month name + invoice ID in text-secondary below (text-xs)         |
| Amount     | font-semibold, text-primary                                            |
| Due Date   | text-secondary                                                         |
| Paid Date  | text-secondary (dash if unpaid)                                        |
| Status     | Colored pill badge (see below)                                         |
| Actions    | receipt icon button (text-secondary, hover:text-primary)               |

### Status Badges
- **Paid:** bg-green-100 text-green-700, rounded-full, px-3 py-1, text-xs font-semibold
- **Overdue:** bg-error-container text-error, rounded-full, px-3 py-1, text-xs font-semibold
- **Pending/Unpaid:** bg-tertiary-fixed text-tertiary, rounded-full, px-3 py-1, text-xs font-semibold

### Table Styling
- Header row: bg-surface-container-low, text-xs uppercase tracking-wider, text-secondary
- Body rows: bg-surface-container-lowest, border-b border-outline-variant, hover:bg-surface-container-low
- Rounded table wrapper: rounded-xl overflow-hidden shadow-sm

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
