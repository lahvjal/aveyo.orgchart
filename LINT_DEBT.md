# Lint Debt Backlog

This backlog tracks repo-wide lint debt so process-editor regressions remain visible while broader cleanup is phased in.

## Current Buckets

- `@typescript-eslint/no-explicit-any`
  - Heaviest concentration in legacy data-access hooks and query helpers.
- `react-hooks/set-state-in-effect`
  - Present in several admin/manager dialogs and dashboard initialization flows.
- `@typescript-eslint/no-unused-vars`
  - Mostly stale destructuring variables and transitional migration code.

## Process Domain Guardrail

- Use `npm run lint:process` for all process-editor changes.
- Scope currently includes:
  - `src/components/processes/ProcessCanvas.tsx`
  - `src/components/processes/ProcessNode.tsx`
  - `src/components/processes/ProcessNodePalette.tsx`
  - `src/hooks/useProcesses.ts`
  - `src/pages/Processes.tsx`
  - `src/pages/PublicProcessView.tsx`

## Cleanup Sequence

1. Eliminate `any` in shared query/profile hooks that affect multiple pages.
2. Refactor effect-driven state initialization patterns flagged by `set-state-in-effect`.
3. Remove unused vars and tighten type-only imports.

## CI Rollout Recommendation

- Gate process work with:
  - `npm run build`
  - `npm run lint:process`
- Keep full `npm run lint` as informational until debt buckets are reduced.
