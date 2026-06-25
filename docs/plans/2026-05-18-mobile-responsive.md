# Mobile-responsive UI

**Status:** Draft · **Date:** 2026-05-18

A plan to make the entire UI work on phones and tablets, not just
desktop. Survey of the current state lives near the end; this opening
is the target and the migration path.

---

## 1. Decisions locked in

| Decision | Choice |
|---|---|
| Approach | **Mobile-first per component.** Default classes work for narrow viewports; `md:` / `lg:` add desktop affordances. |
| Viewport tiers | **Phone + tablet + desktop.** Three real tiers using Tailwind's default `sm:` (≥640), `md:` (≥768), `lg:` (≥1024), `xl:` (≥1280). |
| Scope | **Everything residents, board, contractor, and admin touch.** All `src/components/**` (~162 files) and all `src/app/[locale]/**/page.tsx`. Excludes auth screens (already lean) and PDFs (`src/reports/templates/` — those render at fixed paper size). |

---

## 2. Target state

### Breakpoints

| Tier | Width | Tailwind prefix | Default? |
|---|---|---|---|
| Phone | < 640 px | (no prefix) | ✅ Default — classes without a prefix target phones |
| Large phone / small tablet | ≥ 640 px | `sm:` | |
| Tablet | ≥ 768 px | `md:` | |
| Desktop | ≥ 1024 px | `lg:` | |
| Wide desktop | ≥ 1280 px | `xl:` | Optional — only when a layout has more to give |

**The rule:** no class without a prefix is allowed to assume desktop
width. If a component has `grid-cols-4`, that's a desktop layout
leaking into the phone fallback. The fix is `grid-cols-1 md:grid-cols-2 lg:grid-cols-4`.

### Three layout patterns to lean on

1. **Stack on phone → grid on desktop.** The default. Used everywhere
   the desktop view is a multi-column grid.
   ```tsx
   <div className="flex flex-col gap-4 lg:grid lg:grid-cols-3 lg:gap-6">
   ```

2. **Drawer / sheet on phone → sidebar on desktop.** Used for any
   secondary navigation (filters, channel lists, voting sidebar). The
   `Sidebar` already does this — generalize the pattern into a shared
   component (`<ResponsiveSidebar />`).

3. **Cards on phone → table on desktop.** Tabular data renders as a
   card stack at narrow widths and a table at `md:` and up. Implemented
   per surface — finance, voting, complaints, maintenance lists all
   need this.

### Design tokens

Add to `globals.css` (no Tailwind config in this Tailwind-v4 setup —
tokens live in CSS custom properties):

- `--touch-target-min: 44px` — the floor for any tappable area on
  phone. Maps to a `touch:min-h-11 touch:min-w-11` utility (defined as
  a custom variant; see §4).
- `--container-padding-sm: 1rem; --container-padding-lg: 2rem;` —
  consistent horizontal padding so phone screens get tight gutters and
  desktop gets breathing room.
- `--header-h-mobile: 56px; --header-h-desktop: 64px;` — header
  height. Used by sticky-positioned elements to offset correctly.

### Principles

- **No fixed widths** on content. `w-[600px]` is a phone-killer. Use
  `max-w-` instead.
- **Touch targets ≥ 44 px** on phone for every interactive element.
  Tap targets that are fine on desktop hover are too small on a thumb.
- **Tables → cards** below `md:`. Forced horizontal scroll on a table
  is acceptable only as a temporary fallback.
- **Avoid `hover:`-only affordances.** Phones don't hover. Anything
  that's only discoverable on hover (tooltips, action buttons) needs a
  visible-on-tap or always-visible counterpart.
- **Forms stack on phone.** Two-column form layouts (`label | input`)
  break under 480 px — stack labels above inputs.
- **Modals → full-screen on phone.** Modal dialogs that work at desktop
  width become full-screen sheets on phone.

---

## 3. Current state (survey, 2026-05-18)

Hard numbers from the codebase:

- **162 component `.tsx` files** under `src/components/`.
- **124 of 162 (76%) have zero responsive prefixes.**
- Total `sm:` / `md:` / `lg:` / `xl:` class usages across the entire
  codebase: ~150. Of those, the heavy users are `grid-cols-*` (58)
  and `px-*` (28).
- Layout shell (`sidebar.tsx`, `topbar.tsx`) has basic mobile chrome
  — hamburger sidebar overlay below `lg:`, but the topbar isn't fully
  hardened.
- `globals.css` is 83 lines; no responsive design tokens defined.
- No Tailwind config file (Tailwind v4 inline config).

Concentration of work by domain (component count):

| Domain | Components | Responsive coverage |
|---|---|---|
| Voting | 28 | Light (mostly `lg:grid-cols-*`) |
| Finance | 20 | Light (some `sm:grid-cols-*` on KPI cards) |
| Contractor | 17 | Light |
| Settings | 15 | Mixed — some forms responsive |
| Units | 10 | None |
| Maintenance | 9 | None |
| Layout shell | 8 | Partial (sidebar yes, topbar minimal) |
| Marketplace | 6 | Some |
| Complaints | 6 | None |
| Auth | 6 | Lean already — small forms |
| Other (shared, residents, reports, public, documents, admin, dashboard, communication, notifications) | 37 | Mostly none |

**Translation:** every component is going to need attention. The
"already done" surfaces are mostly the dashboard KPI grids and the
sidebar/topbar chrome — i.e., the bits whose desktop layout was so
obviously a grid that someone reached for `sm:grid-cols-2 lg:grid-cols-4` reflexively.

---

## 4. Foundations (Phase 0)

Before refactoring per-domain components, lay the ground. **Do not start
component work until Phase 0 is done.**

### 0.1 Design tokens + `touch:` variant in `globals.css`

```css
:root {
  --touch-target-min: 44px;
  --container-padding-sm: 1rem;
  --container-padding-lg: 2rem;
  --header-h-mobile: 56px;
  --header-h-desktop: 64px;
}

/* Tailwind v4 custom variant — applies the utility only on coarse-pointer
   (touch) devices. Use as `touch:min-h-11 touch:min-w-11`. */
@custom-variant touch (&:where(@media (pointer: coarse)));
```

The `touch:` variant means tap-target floors don't bloat desktop layouts —
the `min-h-11 min-w-11` only kicks in on touch devices.

### 0.2 Shared responsive primitives

Add to `src/components/shared/`:

- **`<ResponsiveSidebar />`** — the drawer-on-phone / sidebar-on-desktop
  pattern, currently inlined in `layout/sidebar.tsx`. Lift into a shared
  component so voting filters, communication channel list, etc., can
  reuse it.
- **`<DataTable>`** — single component, breakpoint-aware. Renders as a
  table at `md:`+ (or `lg:` per `tableAt` prop) and as a card stack
  below. **Targets ~11 surfaces with real `<table>` markup today:**
  finance (ledger, payment-history, budget), units, admin (buildings,
  users), settings (invitations, notifications), documents. Pure card
  lists (voting `meeting-list`, `past-vote-card`) don't use this — they
  just need their card components made mobile-friendly. Spike landed
  2026-05-18 — see [docs/spikes/2026-05-18-card-list-api.md](../spikes/2026-05-18-card-list-api.md) for API and skeleton.
- **`<ResponsiveDialog>`** — modal that's a centered card on desktop
  and a full-screen sheet on phone. Wraps Radix Dialog or the project's
  existing modal primitive.
- **`<PageHeader>`** — title + actions row with the right responsive
  behavior (actions wrap below title on phone, sit beside it on desktop).
  Most pages roll this by hand today.

### 0.3 Lint rule to enforce mobile-first

Add an ESLint rule that flags Tailwind classes likely to break on
phone:

- `w-[600px]`, `w-[800px]`, etc. — bare pixel widths over `w-96` (24rem).
- `grid-cols-3` and higher without a `sm:` / `md:` / `lg:` qualifier
  (these are desktop grids leaking into phone).
- `flex-row` on a container with > 3 children, no `sm:flex-row` /
  `flex-col` mobile fallback.

Heuristic, not perfect — false positives are OK; the cost is one
comment-suppression per false positive vs. shipping broken phone layouts.

### 0.4 Visual regression baseline

Before any component changes, capture the current state at three
viewports for the critical pages:

- 375 × 667 (iPhone SE — narrowest realistic phone)
- 768 × 1024 (iPad portrait)
- 1440 × 900 (laptop)

Use Playwright's screenshot snapshots (already in the repo for e2e).
**Don't expect them to look good** — they're characterization
screenshots: lock in current behavior so post-refactor diffs surface
what changed.

**Storage decision (locked):** commit baseline PNGs to the repo under
`tests/e2e/__snapshots__/responsive/`. At 10 pages × 3 viewports = 30
PNGs (~few MB), this is fine in-tree for Phase 0–B. Playwright diff
output stays gitignored. Revisit external snapshot storage only if the
baseline set exceeds ~200 images in Phase C+.

### 0.5 Tablet sidebar decision (hamburger, not icon-only)

The shell needs one call before Phase A starts: tablet (`md:`–`lg:`)
gets the **hamburger sidebar**, same as phone. Full sidebar appears
only at `lg:`+. Reason: fewer sidebar states (2 instead of 3) = less
code, less testing, no "what does the icon mean" confusion. If usage
data later shows tablet users wanting persistent nav, revisit.

### 0.6 `<DataTable>` API spike (1 day) — **DONE 2026-05-18**

Output: [docs/spikes/2026-05-18-card-list-api.md](../spikes/2026-05-18-card-list-api.md).
Validated against **finance ledger** (escape-hatch `renderCard` route)
and **units list** (default auto-generated cards). Voting was the wrong
spike target — it's already cards by design. Plan §0.2 entry has been
updated to reflect the actual surface list (~11 tables, not ~50).

### 0.7 Exit criteria

- [ ] CSS custom properties + `touch:` variant defined in `globals.css`
- [ ] Tablet sidebar decision locked (hamburger; see §0.5)
- [ ] `CardList/DataTable` API spike done (§0.6); skeleton runs on finance ledger + voting history
- [ ] Shared primitives shipped: `ResponsiveSidebar`, `CardList/DataTable`, `ResponsiveDialog`, `PageHeader`
- [ ] ESLint rule active (warns, doesn't error yet)
- [ ] Visual regression baseline captured for ~10 critical pages at 3 viewports, committed to `tests/e2e/__snapshots__/responsive/`

---

## 5. Migration phases

### Phase A — Layout chrome (blocker for all per-page work)

Tablet-sidebar decision is **locked in Phase 0.5**: hamburger on
`md:`–`lg:`, full sidebar at `lg:`+. Phase A implements that, no
icon-only middle state.


The shell wraps every page. Fix it first.

**Targets:**
- `layout/app-shell.tsx`
- `layout/sidebar.tsx` (already partial — generalize, add `md:` tier)
- `layout/topbar.tsx` (currently 3 responsive classes — needs proper mobile treatment)
- `layout/building-switcher.tsx`
- `layout/notification-bell.tsx`

**Steps:**
1. Topbar: stack on phone (logo + hamburger + bell + avatar in a single row at 56px), keep current layout at `md:`+.
2. Sidebar: confirm hamburger UX (already there). Tablet keeps the hamburger (per §0.5). Full sidebar at `lg:`+.
3. Building switcher + language switcher: dropdown menus need bigger touch targets on phone.
4. Main content padding: **deferred to Phase B/C/D per-domain sweeps.**
   The original plan called for `px-4 lg:px-8` enforced at the shell
   level. Reality: every page already inlines its own horizontal padding
   (often different values), so a shell-level wrapper would double-pad
   ~100+ pages without per-page audit. Each Phase B/C/D PR removes the
   per-page padding from the surfaces it touches and (once the shell is
   the sole source) we can flip the shell wrapper on in Phase E.

**Stop condition:** at 375px wide, the shell is fully usable — sidebar hamburger works, topbar fits, nothing horizontally scrolls.

### Phase B — Tier 1 surfaces (highest traffic + field use)

Six surfaces. Contractor is pulled into Phase B because the field-use
case (small-business owners checking projects from a job site) makes
phone-readiness load-bearing for them, not a nice-to-have. **Caveat:**
that field-use claim is currently an assumption, not validated by usage
data — worth a quick check before Phase B starts (Mixpanel / GA on
contractor-section device breakdown).

1. **Dashboard** (`dashboard/*`) — both `board-dashboard` and `member-dashboard`. KPI tiles, activity feeds, quick actions.
2. **Voting** (`voting/*`) — vote list, vote detail, ballot cast UI, meeting list. The most complex domain — 28 components.
3. **Communication** (`communication/*`) — channel list, message thread, emergency button.
4. **Complaints** (`complaints/*`) — list + detail + new-complaint modal.
5. **Maintenance** (`maintenance/*`) — ticket board / list + ticket detail.
6. **Contractor** (`contractor/*`) — 17 components. Marketplace UI, project list, billing, onboarding wizard.

**Per surface:** the page-shell author (1–2 senior devs) drives, hits every component in the surface in one tight sprint. Roughly:
- 1–2 days per surface for the small ones (complaints, communication).
- 3–5 days for voting (large, complex modals, ballot UI).
- 3–4 days for contractor (17 components, onboarding wizard is the long pole).

**Stop condition (per surface):** every flow works at 375 px in
**Hungarian** (the longest target language; see §6.8). Visual regression
diff reviewed; intentional changes accepted, unintentional regressions
investigated.

### Phase C — Finance + marketplace

1. **Finance** (`finance/*`) — 20 components. Ledger table, budget panels, charges, payments. The card-vs-table pattern lands here heavily.
2. **Marketplace** (`marketplace/*`) — 6 components. Bid review, threads.

**Stop condition:** same as Phase B per surface.

### Phase D — Long tail

The remaining domains. Each is small (≤10 components):

- Units, residents, settings, documents, reports, admin.
- Notifications, public landing, shared.

**Approach:** batch by domain, one PR per. Lean on the shared primitives from Phase 0 — by the time we're here, `CardList` and `ResponsiveDialog` are doing most of the work.

**Stop condition:** every `src/components/**/*.tsx` either has responsive prefixes, is a primitive that doesn't need them (icons, single-line text), or is documented in a small exceptions list (e.g., the PDF templates).

### Phase E — Polish + cleanup

- **Tighten then promote the ESLint rule.** During Phase 0–D, the rule
  ran at warn level and accumulated suppression comments. Before
  flipping to **error**, audit the suppressions: each one is either a
  real false positive (narrow the rule) or a legitimate exception (keep
  the comment). Only flip to error once the warn level reports zero new
  issues across the codebase. If we just flip without narrowing, every
  future PR pays the false-positive tax.
- Replace any temporary horizontal-scroll table fallbacks with real card layouts.
- Update the Playwright e2e specs to run at phone viewport too (currently desktop-only). Cheap insurance.

---

## 6. Conventions to lock it in

1. **Mobile-first class order.** Default classes target phones. Add
   `sm:` / `md:` / `lg:` only when the layout needs to change. Example:
   ```tsx
   // good
   <div className="flex flex-col gap-2 md:flex-row md:gap-4" />
   // bad — desktop default with mobile patches
   <div className="flex flex-row gap-4 max-md:flex-col max-md:gap-2" />
   ```
2. **Don't use `max-*:` prefixes** unless there's a clear reason. They
   read backwards and pile up over time.
3. **Tap targets ≥ 44 px on phone.** Buttons, links in lists, dropdown
   triggers — use `min-h-11 min-w-11` (the `11` = 2.75rem ≈ 44 px). For
   inline links inside a paragraph this doesn't apply.
4. **Avoid `hidden md:block`** unless the content is genuinely
   redundant on phone. Most "hide it on mobile" attempts are signals
   that the layout needs a real rethink for that viewport.
5. **Forms stack on phone.** Labels above inputs. Two-column form rows
   only at `md:` and up — `sm:` (640 px) still includes landscape
   phones where two-column form rows squeeze inputs.
6. **Modals use `<ResponsiveDialog>`**, not Radix Dialog directly.
   `<ResponsiveDialog>` flips to a full-screen sheet on phone.
7. **Tables use `<CardList>` / `<DataTable>` pair**, not raw `<table>`.
   The shared component picks the right rendering at the breakpoint.
8. **Validate layouts in Hungarian, not English.** Hungarian labels run
   ~30 % longer than English equivalents (e.g., "Vote" → "Szavazás",
   "Maintenance" → "Karbantartás"). A layout that fits at 375 px in
   English may overflow once translated. Every phase's stop condition
   includes a Hungarian-locale check at 375 px.

---

## 7. Testing strategy

### What to test

| Concern | Tool |
|---|---|
| Visual regression per viewport | Playwright screenshot snapshots at 375 / 768 / 1440 |
| Touch-target sizes | Axe / Pa11y (`min-h-11`-style audits) — optional, manual review usually enough |
| Critical-path flows on phone viewport | Existing Playwright e2e suite, run at 375 wide as a second pass |

### What NOT to test

- Pixel-perfect parity. Mobile-first redesign **will** shift visuals.
  The point of the screenshot baseline is to surface *unintentional*
  shifts, not to lock the design.
- Every breakpoint. Test at the three core widths (375 / 768 / 1440);
  intermediate widths usually fall out automatically.

### Coverage gate per phase

Before merging a phase's PRs:
- Visual regressions surfaced and either accepted (intended) or fixed.
- Playwright e2e suite green at phone viewport for the surface the
  phase touched.
- Spot-check on a real phone (or browser devtools narrow viewport,
  with touch emulation on) for one happy-path flow per surface,
  **in Hungarian locale** — English will hide overflow issues.

---

## 8. What this buys us

- **Phone users get a real experience.** Today most surfaces are
  unusable below ~900 px. Half the residents who try the app on
  their phone bounce.
- **Contractor side becomes usable in the field.** Small-business
  contractors checking projects from a job site is a real use case.
- **Tablet support comes free.** With three real tiers, tablets get a
  layout designed for them rather than "small desktop, big phone."
- **Less custom CSS.** `globals.css` stays small; everything responsive
  lives in Tailwind utility classes that other devs can scan-read.
- **Future-proofing.** Once `<CardList>` / `<DataTable>` and
  `<ResponsiveDialog>` are shared, new domain surfaces inherit
  responsive behavior for free.

---

## 9. Non-goals

- **Not building a native app.** PWA-flavored install support is a
  separate decision; this plan is about the responsive web UI.
- **Not redesigning the visual language.** Colors, typography, spacing
  ratios stay as-is. Only layout/structure changes.
- **Not optimizing for landscape phone.** A real concern would be
  forms in landscape; we accept current behavior and address only if
  it's a reported pain point.
- **Not auditing every accessibility concern.** Touch-target size + tap
  affordance get attention because they're phone-specific. Full
  WCAG-AA accessibility is a separate (also-needed) effort.
- **Not converting tables to cards everywhere automatically.** Some
  tables (e.g., finance ledger when the user wants to compare rows)
  are intentionally tables on phone with horizontal scroll. Per-surface
  judgment.

---

## 10. Effort estimate

Rough, not exact. Numbers are *focused work-days* for one senior
front-end dev:

| Phase | Effort |
|---|---|
| Phase 0 — foundations (incl. CardList API spike) | 4–6 days |
| Phase A — layout chrome | 2–3 days |
| Phase B — tier 1 surfaces (dashboard / voting / communication / complaints / maintenance / contractor) | 13–18 days |
| Phase C — finance + marketplace | 5–7 days |
| Phase D — long tail | 6–8 days |
| Phase E — polish + cleanup | 2–3 days |
| **Total** | **~32–45 focused-work days** |

**Calendar reality:** 32–45 focused-work days is *not* 6–9 calendar
weeks. Factor in design review cycles, product feedback, code review
turnaround, holidays, and the fact that no developer gets 100 %
uninterrupted feature time — realistic calendar is **3–4 months** for
one dev, **2–2.5 months** for two devs parallelizing on independent
domains (e.g., one does finance while another does voting) after
Phase 0 + A.

---

## 11. Open questions

- **Do we ship PWA install prompts as part of this?** Currently the
  service worker is registered (`layout/service-worker-register.tsx`)
  but there's no install affordance. Worth a separate, smaller PR
  after Phase B.
- **Card-vs-table threshold.** `<CardList>` / `<DataTable>` switches
  at `md:` (768 px) by default. Some surfaces (finance ledger with
  10+ columns) might want `lg:` (1024 px). Per-surface override needed —
  bake into the API spike (§0.6).
- **Contractor field-use claim.** §5 Phase B treats contractor as
  high-priority because contractors are *assumed* to be on phones in
  the field. Validate against analytics before Phase B kickoff; if
  desktop dominates, demote contractor back to Phase C.

**Resolved in this revision:** tablet sidebar pattern (hamburger, §0.5)
and visual-regression storage (in-repo PNGs under
`tests/e2e/__snapshots__/responsive/`, §0.4).

---

## 12. What success looks like

After all phases ship, a resident or board member can:

- Open the app on any phone (down to 375 px wide), log in, see their
  dashboard, vote on an open vote, file a complaint, check finance
  status, and reply to a maintenance ticket — **without zooming, without
  horizontal scrolling, with tap targets that work on a thumb.**
- A contractor can use the marketplace, submit a bid, upload an
  invoice photo from their phone in the field.
- An admin can do their tools from a tablet without dropping back to
  a laptop.

If any of those flows still requires reaching for a laptop, the
relevant phase isn't done.
