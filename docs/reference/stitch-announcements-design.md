# Stitch Announcements Screen Design Reference

## Layout
- Main content area (ml-64 for sidebar offset), max-w-6xl centered
- Page header: "Announcements" (4xl, font-manrope, extrabold, text-primary), subtitle below
- "New Announcement" button: primary bg, rounded-xl, with + icon, shadow

## Filter Bar
- White card (rounded-2xl, shadow-sm, p-2) containing:
  - Keyword filter input with filter_list icon
  - "Audience: All" dropdown with groups icon (bg-surface-container-low, rounded-xl)
  - "Date Range" dropdown with calendar icon (same style)

## Announcement Cards
- **Unread:** White card (rounded-2xl, p-6), blue left border (border-l-4 border-primary), hover:shadow-md
  - Header row: author avatar (w-10, rounded-full) + name (bold) + role/time (xs, uppercase tracking-wider)
  - Right side: audience tag ("All Residents" in primary-fixed bg, xs, bold, rounded-full) + blue unread dot
  - Title: xl, font-manrope, font-bold
  - Body preview: text-secondary, line-clamp-2
  - Footer: attachment count + views count (left), "Read Full Details →" link (right, text-primary)

- **Read:** Same layout but opacity-90, no blue left border, title uses font-semibold instead of font-bold
  - "Board Only" tag uses surface-container-high bg instead of primary-fixed

## Colors (from Tailwind config)
- primary: #002045
- primary-container: #1a365d
- primary-fixed: #d6e3ff
- surface: #faf8ff
- surface-container-lowest: #ffffff
- on-surface: #131b2e
- secondary: #515f74
- outline: #74777f

## FAB
- Fixed bottom-8 right-8, rounded-full, bg-primary, w-14 h-14, shadow-2xl
- add_comment icon, hover tooltip "New Announcement"
