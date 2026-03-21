---
summary: "Uninstall Must-b completely (CLI, service, state, workspace)"
read_when:
  - You want to remove Must-b from a machine
  - The gateway service is still running after uninstall
title: "Uninstall"
---

# Uninstall

Two paths:

- **Easy path** if `must-b` is still installed.
- **Manual service removal** if the CLI is gone but the service is still running.

## Easy path (CLI still installed)

Recommended: use the built-in uninstaller:

```bash
must-b uninstall
```

Non-interactive (automation / npx):

```bash
must-b uninstall --all --yes --non-interactive
npx -y must-b uninstall --all --yes --non-interactive
```

Manual steps (same result):

1. Stop the gateway service:

```bash
must-b gateway stop
```

2. Uninstall the gateway service (launchd/systemd/schtasks):

```bash
must-b gateway uninstall
```

3. Delete state + config:

```bash
rm -rf "${MUSTB_STATE_DIR:-$HOME/.must-b}"
```

If you set `MUSTB_CONFIG_PATH` to a custom location outside the state dir, delete that file too.

4. Delete your workspace (optional, removes agent files):

```bash
rm -rf ~/.must-b/workspace
```

5. Remove the CLI install (pick the one you used):

```bash
npm rm -g must-b
pnpm remove -g must-b
bun remove -g must-b
```

6. If you installed the macOS app:

```bash
rm -rf /Applications/Must-b.app
```

Notes:

- If you used profiles (`--profile` / `MUSTB_PROFILE`), repeat step 3 for each state dir (defaults are `~/.must-b-<profile>`).
- In remote mode, the state dir lives on the **gateway host**, so run steps 1-4 there too.

## Manual service removal (CLI not installed)

Use this if the gateway service keeps running but `must-b` is missing.

### macOS (launchd)

Default label is `ai.must-b.gateway` (or `ai.must-b.<profile>`; legacy `com.must-b.*` may still exist):

```bash
launchctl bootout gui/$UID/ai.must-b.gateway
rm -f ~/Library/LaunchAgents/ai.must-b.gateway.plist
```

If you used a profile, replace the label and plist name with `ai.must-b.<profile>`. Remove any legacy `com.must-b.*` plists if present.

### Linux (systemd user unit)

Default unit name is `must-b-gateway.service` (or `must-b-gateway-<profile>.service`):

```bash
systemctl --user disable --now must-b-gateway.service
rm -f ~/.config/systemd/user/must-b-gateway.service
systemctl --user daemon-reload
```

### Windows (Scheduled Task)

Default task name is `Must-b Gateway` (or `Must-b Gateway (<profile>)`).
The task script lives under your state dir.

```powershell
schtasks /Delete /F /TN "Must-b Gateway"
Remove-Item -Force "$env:USERPROFILE\.must-b\gateway.cmd"
```

If you used a profile, delete the matching task name and `~\.must-b-<profile>\gateway.cmd`.

## Normal install vs source checkout

### Normal install (install.sh / npm / pnpm / bun)

If you used `https://must-b.ai/install.sh` or `install.ps1`, the CLI was installed with `npm install -g must-b@latest`.
Remove it with `npm rm -g must-b` (or `pnpm remove -g` / `bun remove -g` if you installed that way).

### Source checkout (git clone)

If you run from a repo checkout (`git clone` + `must-b ...` / `bun run must-b ...`):

1. Uninstall the gateway service **before** deleting the repo (use the easy path above or manual service removal).
2. Delete the repo directory.
3. Remove state + workspace as shown above.
