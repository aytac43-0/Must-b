#!/usr/bin/env bash
# ── Must-b Universal Installer (Linux / macOS) ────────────────────────────
set -euo pipefail

REPO="https://github.com/aytac43-0/must-b.git"
DIR="must-b"

cyan()  { printf '\033[38;2;0;204;255m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
red()   { printf '\033[31m%s\033[0m\n' "$*"; }
dim()   { printf '\033[2m%s\033[0m\n'  "$*"; }

echo ""
cyan "  ══════════════════════════════════════════════"
cyan "    Must-b v2.0 — Installer (Linux / macOS)"
cyan "  ══════════════════════════════════════════════"
echo ""

# ── 1. Check Node.js ──────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  red "  ✗  Node.js not found."
  echo "     Install Node 18+ via your package manager or:"
  echo "     https://nodejs.org"
  exit 1
fi

NODE_MAJOR=$(node -e "process.stdout.write(String(process.versions.node.split('.')[0]))")
if [ "$NODE_MAJOR" -lt 18 ]; then
  red "  ✗  Node.js ${NODE_MAJOR} found, but 18+ is required."
  echo "     Please upgrade: https://nodejs.org"
  exit 1
fi
green "  ✓  Node.js $(node --version)"

# ── 2. Check Git ──────────────────────────────────────────────────────────
if ! command -v git &>/dev/null; then
  red "  ✗  Git not found. Install it:"
  echo "     Debian/Ubuntu: sudo apt install git"
  echo "     macOS:         xcode-select --install"
  exit 1
fi
green "  ✓  $(git --version)"

# ── 3. Clone ──────────────────────────────────────────────────────────────
if [ -d "$DIR" ]; then
  echo ""
  dim "  Directory '$DIR' already exists — pulling latest..."
  cd "$DIR"
  git pull --ff-only
else
  echo ""
  dim "  [1/4] Cloning Must-b..."
  git clone "$REPO" "$DIR"
  cd "$DIR"
fi

# ── 4. npm install ────────────────────────────────────────────────────────
dim "  [2/4] Installing dependencies..."
npm install

# ── 5. .env setup ─────────────────────────────────────────────────────────
dim "  [3/4] Setting up environment config..."
if [ ! -f .env ]; then
  cp .env.example .env
  green "  ✓  .env created from .env.example"
  echo "     Edit .env and set your OPENROUTER_API_KEY before starting."
else
  dim "  .env already exists — skipping."
fi

# ── 6. Global link ────────────────────────────────────────────────────────
dim "  [4/4] Linking global 'must-b' command..."
npm link 2>/dev/null || {
  echo ""
  dim "  npm link requires write permission to the global node_modules."
  dim "  Try:  sudo npm link   or   npm link --prefix ~/.local"
}

echo ""
cyan "  ══════════════════════════════════════════════"
green "  Installation complete!"
echo ""
dim "  Run the first-time setup wizard:"
echo "    must-b onboard"
echo ""
dim "  Or start directly:"
echo "    must-b           → web UI at http://localhost:4309"
echo "    must-b cli       → terminal chat"
echo "    must-b doctor    → system health check"
cyan "  ══════════════════════════════════════════════"
echo ""
