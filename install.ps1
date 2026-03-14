# ── Must-b Universal Installer (Windows PowerShell) ──────────────────────
# Usage: irm https://raw.githubusercontent.com/aytac43-0/must-b/main/install.ps1 | iex
# Or:   .\install.ps1
$ErrorActionPreference = "Stop"

$REPO = "https://github.com/aytac43-0/must-b.git"
$DIR  = "must-b"

function Write-Cyan($msg)  { Write-Host $msg -ForegroundColor Cyan }
function Write-Green($msg) { Write-Host $msg -ForegroundColor Green }
function Write-Red($msg)   { Write-Host $msg -ForegroundColor Red }
function Write-Dim($msg)   { Write-Host $msg -ForegroundColor DarkGray }

Write-Host ""
Write-Cyan  "  ══════════════════════════════════════════════"
Write-Cyan  "    Must-b v2.0 — Installer (Windows)"
Write-Cyan  "  ══════════════════════════════════════════════"
Write-Host ""

# ── 1. Check Node.js ──────────────────────────────────────────────────────
$nodePath = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodePath) {
    Write-Red "  ✗  Node.js not found."
    Write-Host "     Download Node 18+ from: https://nodejs.org"
    exit 1
}
$nodeVersion = (node --version)
$nodeMajor   = [int]($nodeVersion -replace 'v(\d+).*','$1')
if ($nodeMajor -lt 18) {
    Write-Red "  ✗  Node.js $nodeVersion found, but 18+ is required."
    Write-Host "     Download latest from: https://nodejs.org"
    exit 1
}
Write-Green "  ✓  Node.js $nodeVersion"

# ── 2. Check Git ──────────────────────────────────────────────────────────
$gitPath = Get-Command git -ErrorAction SilentlyContinue
if (-not $gitPath) {
    Write-Red "  ✗  Git not found."
    Write-Host "     Download from: https://git-scm.com"
    exit 1
}
Write-Green "  ✓  $(git --version)"

# ── 3. Clone or update ────────────────────────────────────────────────────
Write-Host ""
if (Test-Path $DIR) {
    Write-Dim "  Directory '$DIR' exists — pulling latest..."
    Push-Location $DIR
    git pull --ff-only
} else {
    Write-Dim "  [1/4] Cloning Must-b..."
    git clone $REPO $DIR
    Push-Location $DIR
}

# ── 4. npm install ────────────────────────────────────────────────────────
Write-Dim "  [2/4] Installing dependencies..."
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Red "  ✗  npm install failed."
    Pop-Location; exit 1
}

# ── 5. .env setup ─────────────────────────────────────────────────────────
Write-Dim "  [3/4] Setting up environment config..."
if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Green "  ✓  .env created from .env.example"
    Write-Host "     Edit .env and set your OPENROUTER_API_KEY before starting."
} else {
    Write-Dim "  .env already exists — skipping."
}

# ── 6. Global link ────────────────────────────────────────────────────────
Write-Dim "  [4/4] Linking global 'must-b' command..."
try {
    npm link
    Write-Green "  ✓  'must-b' registered as a global command."
} catch {
    Write-Host "  ⚠  npm link failed. Try running PowerShell as Administrator and re-run this script." -ForegroundColor Yellow
}

Pop-Location

Write-Host ""
Write-Cyan  "  ══════════════════════════════════════════════"
Write-Green "  Installation complete!"
Write-Host ""
Write-Dim   "  Run the first-time setup wizard:"
Write-Host  "    must-b onboard"
Write-Host ""
Write-Dim   "  Or start directly:"
Write-Host  "    must-b           -> web UI at http://localhost:4309"
Write-Host  "    must-b cli       -> terminal chat"
Write-Host  "    must-b doctor    -> system health check"
Write-Cyan  "  ══════════════════════════════════════════════"
Write-Host ""
