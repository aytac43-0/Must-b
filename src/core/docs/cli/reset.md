---
summary: "CLI reference for `must-b reset` (reset local state/config)"
read_when:
  - You want to wipe local state while keeping the CLI installed
  - You want a dry-run of what would be removed
title: "reset"
---

# `must-b reset`

Reset local config/state (keeps the CLI installed).

```bash
must-b backup create
must-b reset
must-b reset --dry-run
must-b reset --scope config+creds+sessions --yes --non-interactive
```

Run `must-b backup create` first if you want a restorable snapshot before removing local state.
