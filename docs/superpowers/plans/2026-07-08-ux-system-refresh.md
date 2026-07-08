# UX System Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a first production slice of the UX refresh: reusable UI primitives, consistent filters/tables, and a clearer operational card without changing business logic.

**Architecture:** Add small presentational components under `src/ui/` and CSS classes in `src/index.css`. Migrate high-impact surfaces incrementally so data flow and persistence remain untouched. Keep dynamic rendering in existing pages; components only standardize structure and visual vocabulary.

**Tech Stack:** React 18, TypeScript, Vite, existing CSS tokens, no new dependencies.

## Global Constraints

- Do not change Supabase, RLS, Auth, persistence, routes, permissions, roles, or formulas.
- Preserve SMART blue, CORE teal, SM red for chrome/actions, and gold for warnings/capacity.
- Use CSS classes and existing tokens; keep inline styles only for dynamic values.
- No external component library.
- Gate before publish: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

---

### Task 1: UI Primitives

**Files:**
- Create: `src/ui/Button.tsx`
- Create: `src/ui/Badge.tsx`
- Create: `src/ui/PageHeader.tsx`
- Create: `src/ui/KpiCard.tsx`
- Create: `src/ui/EmptyState.tsx`
- Modify: `src/index.css`

**Interfaces:**
- Produces: `Button`, `Badge`, `PageHeader`, `KpiCard`, `EmptyState`.
- Consumers: `Logistica.tsx`, `Rentabilidad.tsx`, `ColegioCard.tsx`.

- [x] Create components with narrow props.
- [x] Add CSS classes `.ui-btn`, `.ui-badge`, `.ui-page-head`, `.ui-kpi`, `.ui-empty`.
- [x] Run `npm run typecheck`.

### Task 2: Filter and Table Primitives

**Files:**
- Create: `src/ui/FilterBar.tsx`
- Create: `src/ui/DataTable.tsx`
- Modify: `src/index.css`

**Interfaces:**
- Produces: `FilterBar`, `FilterCount`, `DataTable`.
- Consumers: `Logistica.tsx`, `Rentabilidad.tsx`, later `Administracion.tsx`.

- [x] Create `FilterBar` as a wrapping toolbar with optional trailing content.
- [x] Create `DataTable` wrapper with horizontal overflow and empty fallback.
- [x] Add CSS classes `.ui-filter-bar`, `.ui-filter-count`, `.ui-data-table`.
- [x] Run `npm run typecheck`.

### Task 3: Logistica Refresh

**Files:**
- Modify: `src/pages/Logistica.tsx`

**Interfaces:**
- Consumes: `PageHeader`, `KpiCard`, `FilterBar`, `FilterCount`, `DataTable`, `Badge`, `Button`, `EmptyState`.

- [x] Replace header/subtitle and KPI markup with shared components.
- [x] Replace filter row with `FilterBar`.
- [x] Wrap table in `DataTable`.
- [x] Replace reservation/status chips with `Badge` and actions with `Button`.
- [x] Preserve all upload/delete/view behavior.
- [x] Run `npm run typecheck`.

### Task 4: Rentabilidad Refresh

**Files:**
- Modify: `src/pages/Rentabilidad.tsx`

**Interfaces:**
- Consumes: `PageHeader`, `KpiCard`, `FilterBar`, `DataTable`, `Badge`, `Button`, `EmptyState`.

- [x] Replace header/subtitle and KPI markup with shared components.
- [x] Standardize analysis and logistics filter rows.
- [x] Wrap tables in `DataTable`.
- [x] Preserve all calculations and inline money inputs.
- [x] Run `npm run typecheck`.

### Task 5: ColegioCard Visual Pass

**Files:**
- Modify: `src/features/planeacion/ColegioCard.tsx`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: `Badge`, `Button`.
- Produces: same public `ColegioCard` props; no API change.

- [x] Replace ad-hoc service badges with `Badge`.
- [x] Improve header/body classes for clearer scan.
- [x] Keep service row behavior, notes, reservations, contact, director link, and report action.
- [x] Avoid changing data mutations.
- [x] Run `npm run typecheck`.

### Task 6: Final Verification

**Files:**
- No source changes expected.

- [x] Run `npm run typecheck`.
- [x] Run `npm run lint`.
- [x] Run `npm test`.
- [x] Run `npm run build`.
- [x] Run local visual smoke for `#/director/demo`, `#/dev-card`, and login.
- [x] Review `git diff`.
- [ ] Commit and push when the gate is green.
