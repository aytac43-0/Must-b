# Must-b

**Autonomous AI Operating System** — Professional AI agent that thinks, acts, and learns on your behalf.

[![Version](https://img.shields.io/badge/version-1.28.0-orange)](https://www.npmjs.com/package/@must-b/must-b)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

---

## What is Must-b?

Must-b is an autonomous AI agent platform that runs locally on your machine. It connects to 20+ LLM providers (OpenRouter, Anthropic, OpenAI, Gemini, Ollama, and more), executes multi-step plans, controls your browser, reads and writes files, and learns from every interaction through its long-term memory system.

Key capabilities:

- **Autonomous agent pipeline** — goal → plan → execute, fully automatic
- **Browser control** — Playwright-powered web automation with live screenshot feed
- **Multi-channel messaging** — WhatsApp Cloud API, Discord, Telegram, Slack, iMessage
- **Long-term memory** — vector store with semantic search and 30-day temporal decay
- **Skill library** — save, reuse, and share AI workflows
- **Project Intelligence** — automatic codebase indexing and smart suggestions
- **Night Shift** — autonomous background task execution while you sleep
- **Ghost Guard** — real-time RAM/CPU monitoring with safe-mode protection
- **8-language UI** — English, Turkish, German, French, Spanish, Portuguese, Japanese, Chinese

---

## Quick Start

### Install globally (recommended)

```bash
npm install -g @must-b/must-b
must-b
```

Opens the setup wizard on first run. Follow the prompts to configure your AI provider and start the dashboard.

### Run from source

```bash
git clone https://github.com/auto-step/must-b.git
cd must-b
npm install
npm run onboard   # first-time setup
npm start         # start web dashboard on http://localhost:4309
```

---

## Requirements

- **Node.js** >= 20
- An API key for at least one LLM provider (OpenRouter free tier works out of the box)
- Optional: [Playwright browsers](https://playwright.dev) for browser automation (`npx playwright install chromium`)

---

## Architecture

```
User goal (Web UI or CLI)
  └─ Orchestrator   — classifies: "direct" (single call) vs "agent" (full pipeline)
       └─ Planner   — decomposes into PlanStep[] using LLM
            └─ Executor — dispatches tool calls sequentially
                  ├─ FilesystemTools  (read / write / search)
                  ├─ TerminalTools    (shell execution)
                  ├─ BrowserTools     (Playwright automation)
                  ├─ VisionTools      (screenshot + element detection)
                  └─ MemoryTools      (semantic search & recall)
  └─ Socket.io → real-time dashboard updates
```

### Backend (`src/`)

| Module | Purpose |
|---|---|
| `src/core/orchestrator.ts` | Central agent loop — classify, plan, execute |
| `src/core/provider.ts` | Unified LLM abstraction (20+ providers) |
| `src/core/guard/ghost-guard.ts` | RAM/CPU monitor, lite/safe mode |
| `src/core/automation/night-owl.ts` | Autonomous night-shift scheduler |
| `src/core/intelligence/project-intelligence.ts` | Codebase indexer & whisper hints |
| `src/memory/long-term.ts` | User profile + conversation history |
| `src/core/memory/ltm.ts` | Vector store (episodic + semantic) |
| `src/interface/api.ts` | Express + Socket.io server on port 4309 |

### Frontend (`public/must-b-ui/`)

React 18 + TypeScript + Vite + Tailwind CSS + Radix UI.

Key pages: `DashboardPage`, `SettingsPage`, `SetupPage`
Key components: `WarRoomPanel`, `MemoryPanel`, `LiveSightPanel`, `ConnectorsPanel`

---

## Configuration

Must-b is configured via a `.env` file (created automatically during onboarding):

```env
MUSTB_NAME=Must-b
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-...
MUSTB_LANGUAGE=en

# Optional channels
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_ACCESS_TOKEN=...
WHATSAPP_VERIFY_TOKEN=your-secret-token
DISCORD_BOT_TOKEN=...
DISCORD_CLIENT_ID=...
DISCORD_PUBLIC_KEY=...
TELEGRAM_BOT_TOKEN=...
```

### Supported LLM Providers

OpenRouter · OpenAI · Anthropic · Google Gemini · Groq · Mistral · XAI (Grok) · DeepSeek · Ollama (local) · Azure OpenAI · and more.

---

## Autonomous Channels

When a WhatsApp or Discord message arrives, Must-b automatically:
1. Receives the message via webhook
2. Wakes the orchestrator with the message as a goal
3. Generates a response using the active LLM
4. (Discord) Sends the reply back via the interaction follow-up API

### WhatsApp Setup

1. Create a Meta App at [developers.facebook.com](https://developers.facebook.com)
2. Configure webhook URL: `https://your-domain.com/webhook/whatsapp`
3. Set `WHATSAPP_VERIFY_TOKEN` in `.env` to match your Meta webhook token
4. Add `WHATSAPP_PHONE_NUMBER_ID` and `WHATSAPP_ACCESS_TOKEN`

### Discord Setup

1. Create a bot at [discord.com/developers](https://discord.com/developers/applications)
2. Set Interactions Endpoint URL: `https://your-domain.com/webhook/discord`
3. Add `DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_PUBLIC_KEY` to `.env`

---

## CLI Commands

```bash
must-b               # Start web dashboard (default)
must-b cli           # Terminal chat mode
must-b doctor        # System health check + auto-repair
must-b onboard       # Re-run setup wizard
must-b memory-sync   # View memory statistics
```

---

## Development

```bash
npm run dev            # Backend with live-reload (tsx watch)
npm run dev:frontend   # Frontend Vite HMR dev server
npm run build:prod     # Production build (esbuild + Vite)
npm run build:bin      # Standalone binaries (Win/Linux/macOS)
```

---

## License

MIT © 2026 [Auto Step](https://auto-step.io)

---
---

# Must-b — Türkçe

**Otonom Yapay Zeka İşletim Sistemi** — Sizin adınıza düşünen, harekete geçen ve öğrenen profesyonel AI ajanı.

---

## Must-b Nedir?

Must-b, makinenizde yerel olarak çalışan otonom bir AI ajan platformudur. 20'den fazla LLM sağlayıcısına (OpenRouter, Anthropic, OpenAI, Gemini, Ollama ve daha fazlası) bağlanır, çok adımlı planlar yürütür, tarayıcınızı kontrol eder, dosyaları okuyup yazabilir ve uzun vadeli bellek sistemi aracılığıyla her etkileşimden öğrenir.

Temel yetenekler:

- **Otonom ajan pipeline** — hedef → plan → yürütme, tamamen otomatik
- **Tarayıcı kontrolü** — Playwright destekli web otomasyonu ve canlı ekran görüntüsü akışı
- **Çok kanallı mesajlaşma** — WhatsApp Cloud API, Discord, Telegram, Slack, iMessage
- **Uzun vadeli bellek** — anlamsal arama ve 30 günlük zamansal bozunma ile vektör deposu
- **Skill kütüphanesi** — AI iş akışlarını kaydedin, yeniden kullanın ve paylaşın
- **Proje Zekası** — otomatik kod tabanı indeksleme ve akıllı öneriler
- **Gece Vardiyası** — siz uyurken otonom arka plan görev yürütme
- **Ghost Guard** — güvenli mod korumasıyla gerçek zamanlı RAM/CPU izleme
- **8 dil desteği** — Türkçe dahil İngilizce, Almanca, Fransızca, İspanyolca, Portekizce, Japonca, Çince

---

## Hızlı Başlangıç

### Global kurulum (önerilen)

```bash
npm install -g @must-b/must-b
must-b
```

İlk çalıştırmada kurulum sihirbazı açılır. AI sağlayıcınızı yapılandırın ve paneli başlatın.

### Kaynak koddan çalıştırma

```bash
git clone https://github.com/auto-step/must-b.git
cd must-b
npm install
npm run onboard   # ilk kurulum
npm start         # http://localhost:4309 adresinde web panelini başlatır
```

---

## Gereksinimler

- **Node.js** >= 20
- En az bir LLM sağlayıcı için API anahtarı (OpenRouter ücretsiz katman kutudan çalışır)
- İsteğe bağlı: Tarayıcı otomasyonu için Playwright (`npx playwright install chromium`)

---

## CLI Komutları

```bash
must-b               # Web panelini başlatır (varsayılan)
must-b cli           # Terminal sohbet modu
must-b doctor        # Sistem sağlık kontrolü + otomatik onarım
must-b onboard       # Kurulum sihirbazını yeniden çalıştırır
must-b memory-sync   # Bellek istatistiklerini görüntüler
```

---

## Lisans

MIT © 2026 [Auto Step](https://auto-step.io)
