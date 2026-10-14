# PROJECT_MAP — TaskFlow

> External memory / single source of truth. Update this file at the end of every milestone.
> Status legend: `TODO` · `IN PROGRESS` · `DONE` · `UNVERIFIED` · `DROPPED`

---

## [TECH_STACK]

**Temporal context:** 2026-10-12 · Node v24.13.0 · npm 11.6.2 · all versions are npm `latest` Stable on that date, verified against real `peerDependencies`/`engines`. Nothing Deprecated. No backend, no auth, no AI, no cloud, no paid service.

**Version control (2026-10-15):** git 2.53.0 · remote `origin` → `https://github.com/Yasser-mostafa1/TaskFlow` (PUBLIC, branch `main`; the repo's own initial `.gitignore` commit `b4cdbc8` is preserved as the parent — normal fast-forward push, never force) · gh CLI 2.102.0 authenticated as `Yasser-mostafa1`. First app commit = M0–M6 + dashboard + this map; `node_modules/`, `dist/`, `.env*`, logs excluded by `.gitignore` (remote Node template + local supplements).

### Runtime dependencies (pinned)

| Package | Version | Why |
|---|---|---|
| react / react-dom | 19.3.0 | Required stack |
| motion | 14.1.0 | Animations; peer `react ^18 \|\| ^19` ✓ |
| @dnd-kit/core | 6.3.1 | Drag-and-drop base |
| @dnd-kit/sortable | 10.0.0 | Reordering; peer `@dnd-kit/core ^6.3.0` ✓ |
| @dnd-kit/utilities | 3.2.2 | CSS/transform helpers for dnd-kit |
| lucide-react | 1.55.0 | Icons; peer react ≤19 ✓ |
| idb | 8.0.4 | IndexedDB promise wrapper (structured data + images) |

### Dev dependencies (pinned)

| Package | Version | Why |
|---|---|---|
| vite | 8.3.4 | Build/dev; engines `node ^20.19 \|\| ≥22.12` ✓ |
| @vitejs/plugin-react | 6.1.2 | peer `vite ^8` ✓ |
| typescript | 7.0.2 | Latest stable; quality gate = `tsc --noEmit --strict` |
| tailwindcss + @tailwindcss/vite | 4.3.3 / 4.3.3 | Styling (v4, matching pair) |
| vitest | 5.0.3 | Test runner; peer `vite ^6‖^7‖^8` ✓ |
| jsdom | 29.1.2 → **29.1.1** | Deviation: jsdom 30.x requires Node ≥24.15 while this machine runs 24.13 — 29.1.1 is the newest release whose engines match (`≥24.0.0`). |
| @testing-library/react | 16.3.3 | Component tests; peer react 19 ✓ |
| @testing-library/dom | 10.4.2 | RTL peer `^10` ✓ |
| @testing-library/jest-dom | 7.0.1 | DOM assertions |
| @testing-library/user-event | 14.6.7 | Interaction tests |
| @types/react / @types/react-dom | 19.3.0 | Types |
| fake-indexeddb | 6.2.5 | IndexedDB in Vitest (persistence tests) |

### Decisions & documented conflicts

- **CONFLICT (documented, resolved by decision):** `typescript-eslint@8.71.1` requires `typescript >=4.8.4 <6.1.0` → incompatible with TS 7.0.2.
  **Decision:** TypeScript **7.0.2**, `typescript-eslint` **out of scope**. Quality gate = `tsc --noEmit --strict` (+ `noUncheckedIndexedAccess`) + Vitest.
- **Validation:** hand-written type-guards (no zod) — ~150 LOC, fully tested, full control over rejection messages.
- **Charts:** hand-written inline SVG (no recharts) — no dependency, full control of dark mode, responsiveness, zero-denominator handling.
- **Routing:** no router dependency — internal navigation via app state.
- **State:** no Redux/Zustand (outside stated stack) — a ~60-line `createStore` on `useSyncExternalStore` with selectors (Context+useReducer rejected: full-tree re-renders across 7 views during drag).
- Rejected as a class: extra abstractions, speculative layers, backend infra, glassmorphism-heavy UI.

---

## [SYSTEM_FLOW]

**Boot**
`main.tsx` → logger init (ring buffer, dev-only console) → theme hydrate (localStorage) → `db.open()` → hydrate all repositories → `store.init(state)` → `render(App)` → persistence loop starts.

**Write path (single direction)**
`UI event → action(dispatch) → pure reducer → new state → store notifies subscribers (useSyncExternalStore) → views re-render → persistence effect batches an IDB write → logger records a redacted event`.

**Read path**
`store selector (memoized) → derived value → component`. All counts/percentages/summaries are computed from real state, never hardcoded.

**Rules**
1. Views never mutate data directly; only actions do.
2. One dataset, many views → List/Kanban/Calendar/Dashboard/Focus/Insights are projections of the same store (view synchronization is structural, not manual).
3. Persistence is fire-and-forget with error surfaced to Toast; a failed write never corrupts in-memory state.
4. Dates are naive-local strings (`YYYY-MM-DD` or `YYYY-MM-DDTHH:mm`); `toISOString()` is banned in display/formatting paths (timezone day-shift prevention).

---

## [ARCHITECTURE]

```
src/
  core/        types.ts · logger.ts · dates.ts · ids.ts · guards.ts (type-guards + import validation)
  db/          schema.ts (open + defensive load) · repos.ts (syncCollection + meta)
  store/       createStore.ts · appStore.ts · reducer.ts · selectors.ts · AppStoreContext.tsx (provider + persistence)
  ui/          Button · Field · Modal · Feedback (toast+confirm) · EmptyState · Badges · Progress · Segmented · Dropdown · PageHeader
  app/         App.tsx (hydrate + wiring) · AppShell · Navigation.ts · prefs.ts (theme/sidebar)
  test/        setup.ts · factories.ts
  features/
    tasks/         List · Kanban · TaskCard · TaskEditor · QuickAdd · Subtasks · Deps · bulkActions
    dashboard/     DashboardView · StatCards (+OverviewCard) · RecommendCard · ActivityPanels (attention/upcoming/weekly/timer banner)
    projects/      ProjectsView · ProjectEditor · ProjectCard
    tags/          tagManager · TagPicker
    calendar/      MonthGrid · DatePanel
    focus/         FocusView · useFocusTimer · sessions
    insights/      charts.tsx (WeekChart) · InsightsView
    recommend/     rules.ts (pure) · RecommendCard hosts it on the dashboard
    recovery/      OverdueCenter · bulkReschedule
    settings/      SettingsView · transfer.ts (export/import) · diagnostics
    attachments/   imageValidation.ts · objectUrls.ts
  app/         App.tsx · AppShell · Navigation.ts (SECTIONS + NavigateFn) · prefs.ts
```

**Rules of engagement**
- Shared/Core exists only for logic actually repeated across features (dates, logging, ids, types, guards, store). No single-use abstractions.
- Feature-first division; no micro-files (avoid files under ~40 lines without cause); no oversized components (split beyond ~250 lines).
- Pure, unit-testable logic lives outside components: recommendation rules, timer math, dependency/cycle checks, subtask progress, import validation.
- Accessibility: keyboard navigation, visible focus, semantic elements, contrast, `prefers-reduced-motion`.
- Logging: async, `debug|info|warn|error`, ring buffer (200), console only in `import.meta.env.DEV`, **never logs user content** (titles/descriptions/notes/imported payloads) — only event names, ids, counts, error names.

---

## [MILESTONES]

| # | Scope | Acceptance (Verifiable Goals) | Status |
|---|---|---|---|
| M0 | Foundation: scaffold, pinned versions, Tailwind v4 tokens (light/dark), AppShell + collapsible Sidebar, logger, dates | `npm run typecheck && npm run test && npm run build` all green + shell smoke test | **DONE** (54 tests) |
| M1 | Domain + Persistence: types, IDB repos, store, hydrate/batched write | Full roundtrip test + corrupted-record isolation test | **DONE** |
| M2 | Task CRUD + List view + Quick-Add + search/filter/sort + bulk actions + confirmations | G1, G2 (RTL tests) | **DONE** |
| M3 | Kanban + dnd-kit (cross-column, reorder, keyboard-accessible alternative) | G3: reducer move tests + drop behavior | **DONE** |
| M4 | Subtasks + dependencies (cycle rejection, Blocked state) | G4: exact progress %, circular dependency rejected | **DONE** (incl. keyboard subtask reorder) |
| M5 | Projects + tags + image attachments (type/size validation, object URL release) | Project delete never deletes tasks; image accept/reject tests | **DONE** |
| M6 | Calendar (month nav, date select, create/edit on date, overdue marks) | G7: date-shift prevention test under multiple TZs | **DONE** |
| M7 | Focus view + timer + sessions (timestamp-based, no overlap) | G6: fake-timer math, overlap guard, state survives reload | TODO |
| M8 | "What Should I Do Now?" deterministic rules | G5: fixture matrix covering priority/due/duration/available-time/status/deps | **IN PROGRESS** — `recommend/rules.test.ts` matrix (priority/due/duration/status/deps) + `RecommendCard` on the dashboard DONE; *pending: available-time (time-of-day) rule* |
| M9 | Overdue recovery center + confirmed bulk actions | G8: deadlines never change silently | TODO |
| M10 | Productivity insights (inline SVG) | Real data only; zero denominators → explicit 0/null, no fabricated % | TODO |
| M11 | Settings, theme persistence, JSON export/import, responsive + a11y + reduced motion, regression run, browser visual verification, honest status report | G9, G10 + `[ORPHANS & PENDING]` refreshed | TODO |

**User journeys (verifiable):** G1 quick-add syncs everywhere · G2 filter/sort/complete/bulk · G3 drag persists + syncs · G4 subtasks + blocked deps · G5 recommendations with reasons, no blocked tasks · G6 focus timer survives navigation/reload, single active session · G7 calendar without timezone shift · G8 overdue recovery, no silent deadline changes · G9 validated import, never silent overwrite · G10 theme/sidebar/responsive/a11y.

---

## [ORPHANS & PENDING]

**Verified so far:** 153 automated tests green · `tsc --noEmit` clean · production build green (M0–M6 + dashboard rebuild + M8 core).

**In progress:** M8 — pending only the available-time (time-of-day) rule.

**Remaining milestones:** M7 → M11 (see table).

**Sections still minimal (must be completed before release):** Focus (M7 stub — the dashboard's "Open focus" shortcut lands there), Insights, Settings. **Dashboard is now complete** (surgical rebuild 2026-10-12).

**Dashboard rebuild (surgical, goal-driven):**
- Goals (all test-backed): greeting + real day heading · 4 interactive stat cards deep-linking into a pre-filtered My Tasks (new `scope: 'today'` + `NavigateFn(section, filter?)` in `app/Navigation.ts`) · real ProgressRing overview · QuickAdd · deterministic "What should I do now?" with reasons, never blocked/completed · attention (overdue+blocked) and upcoming (7d) lists reusing `TaskRow` · 7-day weekly summary (hand-written `WeekChart` SVG) · live focus-timer banner · onboarding state when the workspace is empty · `logger` events for stat clicks and recommend actions.
- TDD: 18 tests written first and confirmed RED (4 files), then implementation made them green; no regressions (118 → 153).
- Browser visual verification (2026-10-12, real UI): empty onboarding → seeded workspace (overdue/today/future/undated) → full dashboard (dark **and** light) → recommendation "Fix login bug · Overdue since Yesterday" → mark-complete → deep-link card → My Tasks pre-filtered on Overdue → cleanup (test data deleted, theme restored, dev server stopped). Zero console errors throughout.
- `TaskRow` select props became optional (dashboard renders non-selectable rows) — TasksView callers unchanged.

**Decisions recorded during build:**
- `blockInfo` ignores dangling dependency ids (the reducer already removes them on delete) so a task can never be stuck "Blocked" forever.
- Project deletion always detaches tasks (never deletes them); deleting tasks too is a separate, explicit confirmation.
- Kanban drop position is resolved by the dragged card's midpoint vs. the target's (falls back to index math when no rects exist).
- Subtask reordering uses dnd-kit with keyboard sensor — verified by an automated keyboard test (space → arrow → space).
- Recommendation ranking (documented in `rules.ts`): overdue → due today → due ≤3d → in progress → due ≤7d → later deadline → no deadline; ties broken by priority → earliest deadline → shortest estimate → oldest task. Blocked/completed tasks are never candidates; null when nothing is eligible (no fabricated suggestion).
- `motion` is now actually used (`ui/Reveal.tsx`, entrance fade/slide with `useReducedMotion` guard) → bundle grew 341 kB → 502 kB (156 kB gzip); rolldown warns >500 kB. **Code-splitting (React.lazy per section) deferred to M11.**
- Dashboard empty workspace shows a single onboarding state instead of empty panels (stats/overview stay, all zeros — never fabricated).

**Pending (tracked here, not silent):**
1. M7 Focus view + timer + sessions (G6) — FocusView is a stub.
2. M8 available-time rule (time-of-day vs `estimateMinutes`).
3. M9 overdue recovery center + confirmed bulk reschedule (G8).
4. M10 Insights view wiring the existing `WeekChart` (G-beyond: real data only).
5. M11 Settings/theme/export-import (G9, G10), responsive + a11y pass, browser visual verification, optional code-splitting.
