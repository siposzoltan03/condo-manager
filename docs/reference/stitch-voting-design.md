# Stitch Voting & Meetings Screen Design Reference

## Layout
- Two-tab interface: "Active Votes" (with count badge) and "Meetings"
- 3-column grid layout: votes area (col-span-2) + sidebar (col-span-1)
- Same design system: primary #002045, Manrope/Inter fonts, surface #faf8ff

## Tabs
- Tab bar with two options: "Active Votes" and "Meetings"
- Active Votes tab shows count badge (e.g., "3") in primary color circle
- Active tab: border-b-2 border-primary, font-semibold text-primary
- Inactive tab: text-on-surface-variant hover:text-primary

## Active Vote Card
- White card (rounded-xl, p-6, shadow-sm)
- Top row: resolution type badge (bg-surface-container, rounded-full, text-xs uppercase font-semibold) + countdown timer
- Countdown timer: text-error font-mono font-bold (e.g., "2d 14h 32m remaining")
- Title: text-2xl font-bold text-on-surface
- Description: text-on-surface-variant, mt-2, line-clamp-3
- Quorum progress bar:
  - Label: "Quorum: 67% (required: 51%)" text-sm
  - Bar: bg-surface-container-high rounded-full h-2
  - Fill: bg-primary rounded-full (width proportional to current quorum percentage)
- Ownership weight display: text-sm text-on-surface-variant "Your voting weight: 2.45%"
- Vote buttons: radio group with three options
  - Yes: outline button with CheckCircle icon, hover:bg-green-50 hover:border-green-500
  - No: outline button with XCircle icon, hover:bg-red-50 hover:border-red-500
  - Abstain: outline button with MinusCircle icon, hover:bg-slate-50 hover:border-slate-400
  - Selected state: filled background (green-100/red-100/slate-100) with bold border
- Submit Vote button: bg-primary text-white rounded-lg px-6 py-2 font-semibold, disabled until option selected

## Past Votes Section
- Heading: "Past Votes" text-xl font-semibold
- 2-column grid of result cards
- Each card:
  - Result badge: PASSED (bg-green-100 text-green-800) or DEFEATED (bg-red-100 text-red-800)
  - Title: font-semibold text-on-surface
  - Date: text-xs text-on-surface-variant
  - Bar chart distribution: horizontal stacked bar
    - Green section: For votes percentage
    - Red section: Against votes percentage
    - Grey section: Abstain percentage
  - Text below bar: "For: 72% | Against: 18% | Abstain: 10%"

## Right Sidebar

### Other Open Polls
- Section heading: "Other Open Polls" font-semibold
- Mini cards (compact, rounded-lg, p-3, border border-outline-variant)
  - Title: text-sm font-medium, line-clamp-1
  - Timer: text-xs text-error font-mono
  - Arrow icon to navigate

### Next Meeting
- Dark card: bg-primary text-white rounded-xl p-5
- "Next Meeting" label: text-xs uppercase tracking-wide opacity-80
- Date: text-lg font-bold
- Time: text-sm opacity-90
- Location: text-sm opacity-80 with MapPin icon
- Two buttons:
  - RSVP: bg-white text-primary rounded-lg font-semibold
  - View Agenda: border border-white/30 text-white rounded-lg

### Voting Information
- Light card: bg-surface-container-low rounded-xl p-4
- "Voting Information" heading: text-sm font-semibold
- Info items with small icons:
  - "Votes weighted by ownership share"
  - "Quorum required: 51% of total shares"
  - "Secret ballot — your vote is anonymous"

## Meetings Tab

### Meeting List
- Cards in a vertical list
- Each meeting card: white rounded-xl p-5 shadow-sm
  - Date badge: bg-primary/10 text-primary rounded-lg p-3 (day number large, month small)
  - Title: font-semibold text-lg
  - Time + Location: text-sm text-on-surface-variant
  - RSVP status badge: ATTENDING (green), NOT_ATTENDING (red), PROXY (amber), No Response (grey)
  - Attendee count: "12/24 attending" text-sm
  - Action buttons: RSVP, View Agenda, Minutes (if available)

### Meeting Detail (modal or page)
- Agenda items list
- Attendee list with RSVP status
- Minutes section (uploaded PDF/text)
- Related votes section

## Design Tokens
- Primary: #002045
- Error (countdown): error color from system
- Result badges: green-100/green-800 for PASSED, red-100/red-800 for DEFEATED
- Surface: #faf8ff
- Cards: white, rounded-xl, shadow-sm
- Fonts: Manrope for headings, Inter for body
