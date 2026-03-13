---
summary: "CLI reference for `must-b config` (get/set/unset/file/validate)"
read_when:
  - You want to read or edit config non-interactively
title: "config"
---

# `must-b config`

Config helpers: get/set/unset/validate values by path and print the active
config file. Run without a subcommand to open
the configure wizard (same as `must-b configure`).

## Examples

```bash
must-b config file
must-b config get browser.executablePath
must-b config set browser.executablePath "/usr/bin/google-chrome"
must-b config set agents.defaults.heartbeat.every "2h"
must-b config set agents.list[0].tools.exec.node "node-id-or-name"
must-b config unset tools.web.search.apiKey
must-b config validate
must-b config validate --json
```

## Paths

Paths use dot or bracket notation:

```bash
must-b config get agents.defaults.workspace
must-b config get agents.list[0].id
```

Use the agent list index to target a specific agent:

```bash
must-b config get agents.list
must-b config set agents.list[1].tools.exec.node "node-id-or-name"
```

## Values

Values are parsed as JSON5 when possible; otherwise they are treated as strings.
Use `--strict-json` to require JSON5 parsing. `--json` remains supported as a legacy alias.

```bash
must-b config set agents.defaults.heartbeat.every "0m"
must-b config set gateway.port 19001 --strict-json
must-b config set channels.whatsapp.groups '["*"]' --strict-json
```

## Subcommands

- `config file`: Print the active config file path (resolved from `MUSTB_CONFIG_PATH` or default location).

Restart the gateway after edits.

## Validate

Validate the current config against the active schema without starting the
gateway.

```bash
must-b config validate
must-b config validate --json
```
