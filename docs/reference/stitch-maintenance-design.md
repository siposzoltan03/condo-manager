# Stitch Maintenance Tickets Screen Design Reference

## Layout
- Main content area, max-w-6xl centered
- Same design system: primary #002045, Manrope/Inter fonts, surface #faf8ff

## Page Header
- Title: "Maintenance Tickets" (4xl, font-manrope, extrabold, text-primary)
- Subtitle: descriptive text
- "Report Issue" button (bg-primary, rounded-xl, font-semibold)

## Filter Bar
- Container: bg-surface-container-low, rounded-xl, p-6
- Search input with search icon
- Status dropdown: All / Submitted / Acknowledged / Assigned / In Progress / Completed
- Urgency dropdown: All / Low / Medium / High / Critical
- Category dropdown: All / HVAC / Plumbing / Electrical / Structural / Common Areas

## Ticket Rows
- White card (rounded-xl, p-5, hover:shadow-xl)
- Left urgency badge with colored background:
  - Critical: bg-error-container text-on-error-container, emergency icon
  - High: bg-orange-50 text-orange-800, border-l-4 border-orange-400
  - Medium: bg-secondary-container text-on-secondary-container, border-l-4
  - Low: bg-surface-container text-on-surface-variant

## Row Layout (12-col grid)
- col-span-4: tracking number (text-xs font-mono text-on-surface-variant e.g. "MNT-2026-001") + title + category icon
- col-span-3: reporter avatar + name
- col-span-3: assigned contractor name, or "Unassigned" if none
- col-span-2: status badge + date
- Trailing: chevron_right icon

## Status Badges
- In Progress: bg-surface-container-high text-primary
- Submitted: bg-surface-container text-on-surface-variant
- Acknowledged: bg-blue-100 text-blue-800
- Completed: bg-green-100 text-green-800

## Category Icons
- HVAC: thermostat / Thermometer
- Plumbing: water_drop / Droplets
- Electrical: bolt / Zap
- Structural: foundation / Building2
- Common Areas: groups / Users2
- Elevator: elevator / ArrowUpDown
- Heating: local_fire_department / Flame
- Other: more_horiz / MoreHorizontal

## Ticket Detail View
- Full description text
- Photo/attachment gallery (thumbnail grid, click to enlarge)
- Tracking number + category badge + urgency badge

### Status Timeline
- Vertical timeline (left border line)
- Each status change: colored dot + status label + date + changed by
- Current status highlighted

### Comments Thread
- Chronological comments below timeline
- Public comments: white bg card
- Internal comments (admin only): bg-amber-50 border-l-4 border-amber-400, with "Internal" badge
- Add comment form at bottom:
  - Textarea
  - "Internal note" toggle (admin only, with warning text)
  - Submit button
