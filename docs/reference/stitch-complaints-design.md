# Stitch Formal Complaints Screen Design Reference

## Layout
- Main content area, max-w-6xl centered
- Same design system: primary #002045, Manrope/Inter fonts, surface #faf8ff

## Page Header
- Title: "Complaints & Requests" (4xl, font-manrope, extrabold, text-primary)
- Subtitle: descriptive text
- "Submit Complaint" button (bg-primary, rounded-xl, font-semibold)

## Filter Bar
- White card (rounded-2xl, shadow-sm, p-2)
- Search input with search icon
- Status dropdown: All / Submitted / Under Review / In Progress / Resolved / Rejected
- Category dropdown: All / Noise / Damage / Safety / Parking / Other

## Complaint Cards
- White card (rounded-2xl, p-6, hover:shadow-md)
- Header row:
  - Tracking number (text-xs, font-mono, text-on-surface-variant) e.g. "CMP-2026-001"
  - Category badge with icon (e.g. volume_off for Noise)
  - Private lock icon if isPrivate
- Status badge (color-coded):
  - Submitted: bg-slate-100 text-slate-700
  - Under Review: bg-blue-100 text-blue-800
  - In Progress: bg-amber-100 text-amber-800
  - Resolved: bg-emerald-100 text-emerald-800
  - Rejected: bg-red-100 text-red-800
- Description preview (line-clamp-2, text-secondary)
- Footer: author name, date, photo count if any

## Complaint Detail View
- Full description text
- Photo gallery (thumbnail grid, click to enlarge)
- Tracking number + category + private badge

### Status Timeline
- Vertical timeline (left border line)
- Each status change: colored dot + status label + date + changed by
- Current status highlighted

### Notes Thread
- Chronological notes below timeline
- Public notes: white bg card
- Internal notes (admin only): bg-amber-50 border-l-4 border-amber-400, with "Internal" badge
- Add note form at bottom:
  - Textarea
  - "Internal note" toggle (admin only, with warning text)
  - Submit button

## Category Icons
- Noise: volume_off / Volume2
- Damage: broken_image / AlertTriangle
- Safety: shield / ShieldAlert
- Parking: local_parking / Car
- Other: more_horiz / MoreHorizontal
