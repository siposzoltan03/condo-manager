# Stitch Document Center Screen Design Reference

## Layout
- Two-panel layout: left sidebar (w-64) + main content area
- Main content: ml-64 offset for sidebar

## Left Sidebar (w-64, bg-white, border-r)
- **Category Tree** with icons (from Material Symbols / lucide):
  - Rules & Regulations — `gavel` icon
  - Contracts — `description` icon, expandable with subcategories (Vendor Contracts, Service Agreements, etc.)
  - Meeting Minutes — `groups` icon
  - Financials — `payments` icon
  - Insurance — `verified_user` icon
- **Active category:** white bg, shadow-sm, font-bold text
- **Inactive category:** text-secondary, hover:bg-surface-container-low
- **"Upload Document" button** at sidebar bottom: bg-primary, text-white, rounded-xl, full-width, with upload icon
- **Footer links:** Archive, Trash (text-secondary, hover:text-primary)

## Main Content Header
- Category name: text-3xl, font-manrope, font-extrabold, text-on-surface
- Category description: text-secondary, mt-1
- **Search bar:** rounded-xl, bg-surface-container-low, with search icon, placeholder "Search documents..."
  - Full-text search toggle (switch/checkbox) beside the search input
- **Filter chips row:**
  - Visibility chip: dropdown (All, Public, Board Only, Admin Only)
  - Type chip: dropdown (All, PDF, DOCX, XLSX)
  - Filter button icon (filter_list) for additional filters

## Document Table
- White card (rounded-2xl, shadow-sm), overflow-hidden
- **Columns:**
  - **Title**: file type icon (colored circle bg) + document name (font-semibold) + description preview (text-secondary, text-xs, truncate)
  - **Version**: e.g. "v2.1" (text-sm, text-secondary)
  - **Visibility**: badge — Public (bg-green-50 text-green-700), Board Only (bg-blue-50 text-blue-700), Admin Only (bg-slate-100 text-slate-700)
  - **Uploaded By**: avatar (w-6, rounded-full) + name (text-sm)
  - **Last Updated**: relative or formatted date (text-sm, text-secondary)
  - **Type**: badge — PDF (bg-red-50 text-red-700), DOCX (bg-blue-50 text-blue-700), XLSX (bg-green-50 text-green-700)
- Table rows: hover:bg-surface-container-low, cursor-pointer, border-b last:border-b-0

## File Type Icons
- **PDF**: bg-red-50 rounded-lg p-2, FileText icon in text-red-600
- **DOCX**: bg-blue-50 rounded-lg p-2, FileText icon in text-blue-600
- **XLSX**: bg-green-50 rounded-lg p-2, Sheet icon in text-green-600

## Visibility Badges
- **Public**: bg-green-50 text-green-700 text-xs font-medium px-2.5 py-0.5 rounded-full
- **Board Only**: bg-blue-50 text-blue-700 text-xs font-medium px-2.5 py-0.5 rounded-full
- **Admin Only**: bg-slate-100 text-slate-700 text-xs font-medium px-2.5 py-0.5 rounded-full

## Version History Fly-out Panel
- Right side panel (w-96), slides in from right, bg-white, shadow-xl, border-l
- **Header**: "Version History" (text-lg, font-bold), close (X) button
- **Document title** below header (text-sm, text-secondary)
- **Timeline**: vertical line (border-l-2, border-slate-200) with version dots
  - **Current version**: primary-colored dot (bg-primary, w-3 h-3), bold label "v2.1 (Current)"
  - **Older versions**: slate dots (bg-slate-300, w-3 h-3), regular weight
  - Each entry: uploader name + date + change description
  - Action buttons per version: "View" (text-primary) and "Restore" (text-secondary, only on non-current)

## Colors (consistent with app Tailwind config)
- primary: #002045
- surface: #faf8ff
- surface-container-lowest: #ffffff
- on-surface: #131b2e
- secondary: #515f74
- outline: #74777f
