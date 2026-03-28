# Condo Manager — Documents Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Document Center module — categorized document storage with versioning, visibility-based access control, full-text search readiness, and a Stitch-matching UI with category sidebar, document table, and version history panel.

**Architecture:** Extends the Foundation with DocumentCategory (self-referencing tree), Document, and DocumentVersion models. Visibility enum (PUBLIC/BOARD/ADMIN) controls access based on user role. Version history tracks all file uploads per document. Full-text search index can be added later; extractedText field is nullable for future text extraction via BullMQ.

**Tech Stack:** Next.js 15, Prisma, PostgreSQL, Tailwind CSS, lucide-react, next-intl

**Spec:** `docs/superpowers/specs/2026-03-25-condo-manager-design.md`
**Design refs:** `docs/reference/stitch-documents-design.md`
**GitHub Issues:** #34–#36 in `siposzoltan03/condo-manager`

---

## File Structure

```
src/
├── app/
│   ├── api/
│   │   └── documents/
│   │       ├── route.ts                        # GET list (filtered, paginated, search), POST create
│   │       ├── [id]/
│   │       │   ├── route.ts                    # GET detail with versions, PATCH update, DELETE
│   │       │   └── versions/
│   │       │       └── route.ts                # POST upload new version
│   │       └── categories/
│   │           └── route.ts                    # GET category tree, POST create category
│   └── [locale]/
│       └── documents/
│           └── page.tsx                        # Document Center page
├── components/
│   └── documents/
│       ├── documents-page.tsx                  # Main page with sidebar + content
│       ├── category-sidebar.tsx                # Category tree sidebar
│       ├── document-table.tsx                  # Document table with columns
│       ├── document-filters.tsx                # Search bar + filter chips
│       ├── upload-document-modal.tsx           # Upload/create document modal
│       └── version-history-panel.tsx           # Right fly-out version history
└── i18n/
    ├── en.json                                 # + documents.* keys
    └── hu.json                                 # + documents.* keys
```

---

## Task 1 — Schema: DocumentCategory, Document, DocumentVersion (Issue #34)

- [ ] Add `DocumentVisibility` enum: `PUBLIC`, `BOARD_ONLY`, `ADMIN_ONLY`
- [ ] Add `DocumentCategory` model: `id`, `name`, `parentId` (self-ref), `icon` (String?), `sortOrder` (Int)
- [ ] Add `Document` model: `id`, `title`, `description` (String?), `categoryId` (FK), `visibility` (DocumentVisibility, default PUBLIC), `tags` (Json, default "[]"), `uploadedById` (FK), `createdAt`, `updatedAt`
- [ ] Add `DocumentVersion` model: `id`, `documentId` (FK), `versionNumber` (Int), `fileUrl`, `fileName`, `fileSize` (Int), `mimeType`, `extractedText` (Text, nullable), `uploadedById` (FK), `uploadedAt`
- [ ] Add relations to User model: `documents` and `documentVersions`
- [ ] Run `npx prisma generate` to verify schema
- [ ] Commit: `feat(documents): add schema — DocumentCategory, Document, DocumentVersion`

## Task 2 — API: CRUD, Versioning, Categories, Search (Issue #35)

- [ ] `GET /api/documents` — list documents filtered by category, visibility (role-based), search (title contains), tags; paginated
- [ ] `POST /api/documents` — create document (board+ only); creates initial DocumentVersion
- [ ] `GET /api/documents/[id]` — detail with all versions, respect visibility
- [ ] `PATCH /api/documents/[id]` — update title, description, visibility, category, tags (board+ only)
- [ ] `DELETE /api/documents/[id]` — delete document and all versions (admin only)
- [ ] `POST /api/documents/[id]/versions` — upload new version (board+ only); auto-increment versionNumber
- [ ] `GET /api/documents/categories` — return category tree with document counts
- [ ] `POST /api/documents/categories` — create category (admin only)
- [ ] Text extraction: store file URL and set `extractedText = null` (future: BullMQ worker for PDF/DOCX text extraction)
- [ ] Audit logging for all write operations
- [ ] Commit: `feat(documents): document management API — CRUD, versioning, categories, search`

## Task 3 — UI: Document Center matching Stitch design (Issue #36)

- [ ] `documents-page.tsx` — two-panel layout: category sidebar (w-64) + main content
- [ ] `category-sidebar.tsx` — tree with icons (Gavel, FileText, Users, Wallet, ShieldCheck), active state, Upload Document button, Archive/Trash links
- [ ] `document-table.tsx` — columns: Title (icon+name+desc), Version, Visibility badge, Uploaded By, Last Updated, Type badge
- [ ] `document-filters.tsx` — search input with full-text toggle, Visibility dropdown, Type dropdown
- [ ] `upload-document-modal.tsx` — modal for creating document: title, description, category, visibility, file upload
- [ ] `version-history-panel.tsx` — right fly-out (w-96): timeline with version dots, current highlighted, View/Restore buttons
- [ ] Add i18n keys for `documents.*` in both en.json and hu.json
- [ ] Page route: `src/app/[locale]/documents/page.tsx`
- [ ] Commit: `feat(documents): document center UI matching Stitch design`

## Task 4 — Navigation Verification

- [ ] Verify sidebar link for Documents (`/documents`, FileText icon) is already present and works
- [ ] Ensure the documents page loads correctly with category sidebar
- [ ] Commit: `feat(documents): verify navigation`

---

## Acceptance Criteria

1. DocumentCategory, Document, DocumentVersion models in Prisma schema with proper relations
2. API endpoints enforce visibility: PUBLIC docs visible to all, BOARD_ONLY to board+, ADMIN_ONLY to admin+
3. Version history tracks every upload with incrementing version numbers
4. UI matches Stitch design: category sidebar, document table, search/filters, version history panel
5. i18n keys in both en.json and hu.json
6. Build passes (`npm run build`)
