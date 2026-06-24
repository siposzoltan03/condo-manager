# Design Prompt — Superadmin Feature-Management Console

> Paste the block below into Claude (or the `artifact-design` skill) to generate the UI.
> Implementation plan it serves: [`docs/plans/2026-06-23-superadmin-feature-management.md`](../plans/2026-06-23-superadmin-feature-management.md).

---

## Prompt

You are designing the **Superadmin Feature-Management Console** for **Condo Manager**, a SaaS for Hungarian condominium (társasház) management. The audience for this UI is the **platform owner (`SUPER_ADMIN`)** — an internal operator, not an end customer. It is a dense, data-heavy admin tool, not a marketing surface. Optimize for clarity, scan-ability, and confidence-under-pressure (one wrong toggle can disable a feature for every paying customer).

### Tech & visual constraints (must match the existing app)
- **Stack:** Next.js App Router, React, **Tailwind CSS v4**, **`lucide-react`** icons. No other component/icon libraries.
- **Existing conventions to reuse:** page content wrapped in `max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8`; cards use `rounded-lg` with subtle borders/shadows; access-gated by a `<RoleGuard role="SUPER_ADMIN">` wrapper (assume it exists). Components live under `src/components/admin/`.
- **Language:** Hungarian-first. Primary labels in Hungarian, with a short English gloss in parentheses where helpful for the prompt reader. Copy is localized via next-intl, so write labels as short, translatable strings.
- **Tone:** neutral, precise, operational. Light theme. Restrained color — color carries meaning (state), not decoration.

### Core domain concepts the UI must express
- A **feature** has a code-owned `slug` (e.g. `voting.proxy`, read-only, monospace), a `module` (the slug prefix: voting / finance / maintenance / documents / communication / audit / platform / ai), an editable display name + description, and an `isActive` flag.
- Whether a feature is available **to a building** is resolved by this precedence (highest wins) — surface this model visibly:
  1. **Global kill-switch** — off for everyone, absolute.
  2. **Building override** — grant/revoke for one building.
  3. **Global force-on** — on for everyone (rollout).
  4. **Plan default** — included in the building's subscription plan.
- **Dependency cascade:** a feature is only effective if all its prerequisites are (e.g. `voting.proxy` needs `voting.basic`; `finance.bank-sync-live` → `bank-csv` → `ledger`). The UI must prevent and explain dependency violations.
- Plans are the three tiers: **Kezdő**, **Képviselő**, **Kezelő iroda**.

### Screens to design

**1. Feature Catalog & Global Flags** — `/admin/features`
- Features listed grouped by **module** (collapsible group headers with a count).
- Each row: monospace `slug` (read-only), editable **name** + **description** (inline edit), an `isActive` toggle, and a **global flag** selector with three states: `Terv szerint` (PER_PLAN, default) · `Mindenkinek be` (FORCE_ON) · `Kill-switch` (off for all).
- The flag selector is the highest-stakes control — make the three states visually distinct (e.g. neutral / green / red). Selecting **Kill-switch** opens a **confirmation dialog** spelling out "this disables `<feature>` for ALL buildings, regardless of plan or override."
- Show, per feature, a small **dependency hint** ("Igényli: voting.basic") and which plans currently include it.

**2. Plan Editor** — `/admin/plans`
- The centerpiece is a **feature × plan matrix**: features as rows (grouped by module), the three plans as columns, checkboxes at intersections (`PlanFeature.enabled`).
- **Dependency-aware toggling:** enabling a feature auto-checks its prerequisites (with a brief visual cue); trying to disable a feature while a dependent is still enabled is blocked, with a tooltip naming the blocker.
- Alongside the matrix, a per-plan **limits & pricing** panel: `maxBuildings`, `maxUnitsPerBuilding`, `priceMonthly`, `priceYearly` (HUF), `trialDays`, `isActive`, and a Stripe Price ID field. Include an inline **warning** that price edits affect new checkouts only (existing Stripe subscriptions keep their price until renewal).
- A guard-rail banner when deactivating a plan that has active subscriptions.

**3. Per-Building Overrides** — `/admin/buildings/[id]/features`
- A list of all features showing, per row, the **effective state** for this building plus a **"why" badge** explaining the source: `Terv` (plan) / `Mindenkinek be` (force-on) / `Kill-switch` / `Felülírás` (override).
- A **tri-state control** per feature: `Öröklés` (Inherit — no override) / `Engedélyezés` (Grant) / `Tiltás` (Revoke), with optional **reason** and **expiry date** fields shown when an override is set.
- When granting a feature whose prerequisites won't be effective, show an inline **warning** that the dependency cascade will nullify the grant until the prereqs are available.
- A building identity header (name, address, plan, subscription status).

### Cross-cutting UI requirements
- **Effective-state badges** are the visual backbone — design a small, consistent badge system for the four precedence sources + a clear "available / unavailable" indicator. Reuse it across all three screens.
- **States to design:** default, loading (skeleton), empty (no features in a module), the kill-switch confirmation dialog, dependency-blocked tooltip, and inline warnings. Every destructive/global action gets a confirmation.
- **Audit affordance:** each screen shows a subtle "last changed by / when" line where relevant (changes are audit-logged).
- **Responsive:** works down to tablet width; the matrix scrolls horizontally inside its own container on narrow viewports (the page body must never scroll horizontally).
- Keep it keyboard-navigable and accessible (proper labels on toggles/checkboxes, focus states).

### Deliverables
Produce the three screens as React + Tailwind v4 components using `lucide-react` icons, matching the conventions above. Include the shared badge component and the kill-switch confirmation dialog. Use realistic Hungarian sample data (the three plans, a dozen features across modules, one building with a mix of plan-included, force-on, and overridden features) so the precedence and dependency behavior is visible in the render.
