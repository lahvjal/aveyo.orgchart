# Process Editor Rollout Checklist

## Automated Verification (Completed)

- [x] `npm run build`
- [x] `npm run lint:process`

## Manual Multi-Tab Validation

- [ ] Open the same process in Tab A and Tab B as two different editor-capable users.
- [ ] Enter edit mode in Tab A and confirm Tab B shows current editor badge.
- [ ] In Tab B, click edit mode and confirm takeover modal shows lock holder.
- [ ] Execute takeover in Tab B and confirm Tab A exits edit mode automatically.
- [ ] In Tab B, make edits and verify save + autosave behavior still works.

## Remote Update Behavior

- [ ] With Tab A in view mode and clean local state, perform edits in Tab B and confirm Tab A reflects changes without refresh.
- [ ] While Tab A has unsaved edits, perform edits in Tab B and confirm Tab A shows "Remote updates are available."
- [ ] Click "Apply remote" in Tab A and confirm remote snapshot is applied and unsaved state is cleared.

## Backward Compatibility

- [ ] Existing process diagrams load unchanged.
- [ ] Public read-only process page remains functional.

## Rollout Guidance

1. Deploy DB migration first (`024_process_edit_locks.sql`).
2. Deploy app changes after migration completion.
3. Monitor for lock RPC errors and process save failures during initial rollout window.
