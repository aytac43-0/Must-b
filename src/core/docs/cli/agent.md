---
summary: "CLI reference for `must-b agent` (send one agent turn via the Gateway)"
read_when:
  - You want to run one agent turn from scripts (optionally deliver reply)
title: "agent"
---

# `must-b agent`

Run an agent turn via the Gateway (use `--local` for embedded).
Use `--agent <id>` to target a configured agent directly.

Related:

- Agent send tool: [Agent send](/tools/agent-send)

## Examples

```bash
must-b agent --to +15555550123 --message "status update" --deliver
must-b agent --agent ops --message "Summarize logs"
must-b agent --session-id 1234 --message "Summarize inbox" --thinking medium
must-b agent --agent ops --message "Generate report" --deliver --reply-channel slack --reply-to "#reports"
```

## Notes

- When this command triggers `models.json` regeneration, SecretRef-managed provider credentials are persisted as non-secret markers (for example env var names, `secretref-env:ENV_VAR_NAME`, or `secretref-managed`), not resolved secret plaintext.
- Marker writes are source-authoritative: Must-b persists markers from the active source config snapshot, not from resolved runtime secret values.
