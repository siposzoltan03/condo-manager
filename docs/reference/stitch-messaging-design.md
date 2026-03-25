# Stitch Direct Messaging Screen Design Reference

## Layout
- Split-panel: left sidebar (w-80) + main message thread area
- Same design system: primary #002045, Manrope/Inter fonts, surface #faf8ff

## Left Panel — Conversation List
- Header with "New Message" button (bg-primary, rounded-xl)
- Search input at top
- Conversation items:
  - Participant avatar (w-10, rounded-full) or initials circle
  - Participant name (font-semibold)
  - Last message preview (text-sm, text-secondary, truncate)
  - Timestamp (text-xs, text-on-surface-variant)
  - Unread count badge (bg-primary, text-white, rounded-full, text-xs)
  - Active conversation: bg-surface-container-low or bg-blue-50, left border accent
- Sorted by most recent message

## Right Panel — Message Thread
- Header: participant name(s), avatar, online status indicator
- Message area (flex-grow, overflow-y-auto):
  - Own messages: right-aligned, bg-primary (#002045), text-white, rounded-2xl (rounded-br-sm)
  - Others' messages: left-aligned, bg-surface-container-low (#f2f3ff), text-on-surface, rounded-2xl (rounded-bl-sm)
  - Each bubble: body text, timestamp below (text-xs, text-on-surface-variant)
  - Group messages: sender name above bubble
  - Date separators between day groups

## Message Input
- Fixed at bottom of right panel
- Input field: rounded-xl, bg-surface-container-low, py-3 px-4
- Send button: bg-primary, rounded-full, with send/arrow icon
- Placeholder: "Type a message..."

## Empty States
- No conversation selected: centered illustration + "Select a conversation" text
- No messages yet: "Start the conversation" prompt
