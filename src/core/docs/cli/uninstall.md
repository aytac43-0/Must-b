---
summary: "CLI reference for `must-b uninstall` (remove gateway service + local data)"
read_when:
  - You want to remove the gateway service and/or local state
  - You want a dry-run first
title: "uninstall"
---

# `must-b uninstall`

Uninstall the gateway service + local data (CLI remains).

```bash
must-b backup create
must-b uninstall
must-b uninstall --all --yes
must-b uninstall --dry-run
```

Run `must-b backup create` first if you want a restorable snapshot before removing state or workspaces.
