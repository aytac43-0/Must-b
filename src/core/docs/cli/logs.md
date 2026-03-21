---
summary: "CLI reference for `must-b logs` (tail gateway logs via RPC)"
read_when:
  - You need to tail Gateway logs remotely (without SSH)
  - You want JSON log lines for tooling
title: "logs"
---

# `must-b logs`

Tail Gateway file logs over RPC (works in remote mode).

Related:

- Logging overview: [Logging](/logging)

## Examples

```bash
must-b logs
must-b logs --follow
must-b logs --json
must-b logs --limit 500
must-b logs --local-time
must-b logs --follow --local-time
```

Use `--local-time` to render timestamps in your local timezone.
