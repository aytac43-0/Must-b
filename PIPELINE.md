# PIPELINE — Must-b Inc.

> **Yönetici:** PM_MustB
> **Protokol:** Ekipler terminal yerine bu dosyayı kullanır. Durum güncellemeleri buraya yazılır.
> **Son güncelleme:** PM_MustB | 2026-04-01 | v1.21.0 — Hayalet Temizliği Tamamlandı + auth.ts placeholder + paths.ts denetimi

---

## Durum Değerleri

| Durum | Anlam |
|---|---|
| `PENDING` | Henüz başlanmadı — sıra bekliyor |
| `IN_PROGRESS` | Aktif olarak çalışılıyor |
| `DONE` | Ekip görevi tamamladı |
| `BLOCKED` | Engelleyici var — PM müdahalesi gerekli |
| `QA_TESTING` | Tüm DONE → QA_Lead devreye girmeli |
| `QA_PASSED` | QA onayladı — deploy bekliyor |
| `QA_FAILED` | QA başarısız — PM müdahale ediyor |
| `DEPLOYED` | Deploy_Chief yayına aldı |

---

## Sprint 2 — AKTİF (CEO Direktifi 2026-03-27)

### Hedefler
1. **UYUMLULUK** — Tüm UI kontrast/okunabilirlik sorunları düzeltilecek
2. **AKIŞ** — Wake → Dashboard akışı restore edilecek, Chat butonu bug'ı giderilecek
3. **TAM ENTEGRASYON** — Tüm pasif modüller (Skills, Workspace, WarRoom, LiveSight, 5 sayfa) erişilebilir hale getirilecek

---

### Görev Tablosu

| ID | Departman | Açıklama | Durum | Not |
|---|---|---|---|---|
| S2-F001 | Frontend_Engineer | **KONTRAST FİX**: Sidebar / SetupPage / SettingsPage / WelcomePage — `text-gray-500` → `text-gray-400`, `text-gray-600` → `text-gray-400`, `placeholder:text-gray-600` → `placeholder:text-gray-500` ile değiştir | DONE | 2026-03-27 |
| S2-F002 | Frontend_Engineer | **WAKE AKIŞ**: AppLayout "Chat" hızlı eylem butonu `/app`'e yönlendirmeli (şu an `/`'e dönüyor). WelcomePage → `/app` fade geçişi çalışmalı | DONE | 2026-03-27 |
| S2-F003 | Frontend_Engineer | **ROTA**: `App.tsx`'e eksik 5 route ekle: `/app/active`, `/app/automations`, `/app/clients`, `/app/logs`, `/app/products` | DONE | 2026-03-27 |
| S2-F004 | Frontend_Engineer | **NAVİGASYON**: AppLayout Omni-Dock + Sidebar'a 5 yeni sayfa linki ekle (Globe/Active, Zap/Automations, Users/Clients, BarChart3/Logs, Package/Products) | DONE | 2026-03-27 |
| S2-F005 | Frontend_Engineer | **WARROOM**: `DashboardPage.tsx`'e `WarRoomPanel` entegre et; AppLayout Omni-Dock "Workflows" altına erişim noktası ekle | DONE | 2026-03-27 |
| S2-F006 | Frontend_Engineer | **WORKSPACE**: AppLayout'taki `Files (FolderOpen)` hızlı eylem butonu şu an işlevsiz — `WorkspacePreview` panelini bağla | DONE | 2026-03-27 |
| S2-F007 | Frontend_Engineer | **LIVESIGHT**: `LiveSightPanel`'i AppLayout Omni-Dock "Skills" → "Visual Audit" olarak ekle | DONE | 2026-03-27 |
| S2-B001 | Backend_Architect | **API DOĞRULAMA**: `/api/skills/*` `/api/workspace/*` `/api/memory/*` `/api/system/screenshot` `/api/shadow/*` `/api/tone/*` endpoint'lerinin aktif ve hatasız çalıştığını doğrula; eksik varsa düzelt | DONE | tsc --noEmit: 0 hata. Tüm 6 grup aktif ve import zincirleri doğrulandı. |
| S2-SK000 | Skill_Master | **TEST**: Pipeline hook entegrasyon testi — bu satırı algıla ve DONE olarak güncelle | DONE | Skill_Master \| 2026-03-27 |

---

### Sprint 2 Durumu = DEPLOYED

> **QA_Lead** | 2026-03-27 | Build: BAŞARILI (1999 modül) | TypeScript: Sprint 2 dosyaları temiz | API: 14/14 eşleşiyor
> **Deploy_Chief** | 2026-03-27 | v1.9.0 canlıya alındı. Commit: feat(v1.9.0) | git push: BAŞARILI

---

### PM Geçiş Kuralı

```
S2-F001 AND S2-F002 AND S2-F003 AND S2-F004
AND S2-F005 AND S2-F006 AND S2-F007 AND S2-B001
tümü = DONE → PM bu tablonun altına "Sprint 2 durumu = QA_TESTING" yazar
```

---

### QA_Lead Kontrol Listesi (QA_TESTING aşamasında)

```bash
cd C:/Users/aytac/must-b && npx tsc --noEmit
cd C:/Users/aytac/must-b/public/must-b-ui && npx tsc --noEmit
npm run build:prod
```

Manuel:
- [ ] WelcomePage başlık ve metinler yüksek kontrast (cream/white)
- [ ] Sidebar bölüm başlıkları, model adı, provider net okunuyor
- [ ] SetupPage etiket ve yardım metinleri net
- [ ] SettingsPage açıklama metinleri net
- [ ] Wake butonu → `/app` geçişi sorunsuz
- [ ] AppLayout Chat butonu `/app`'te kalıyor
- [ ] `/app/active`, `/app/automations`, `/app/clients`, `/app/logs`, `/app/products` açılıyor
- [ ] WarRoomPanel Dock'tan açılıyor
- [ ] WorkspacePreview Files butonundan açılıyor
- [ ] LiveSightPanel Visual Audit menüsünden açılıyor
- [ ] `/api/skills`, `/api/workspace`, `/api/memory` endpoint'leri yanıt veriyor

---

---

## CEO Direktifi 2026/09-RevB — AKTİF

> Direktif tarihi: 2026-03-27 | PM_MustB tarafından işleniyor

### ADIM 0 — Kritik Dosya Doğrulaması

| Varlık | Beklenen Konum | Durum |
|---|---|---|
| `sleep.png` | `public/must-b-ui/public/avatar/sleep.png` | ✅ BULUNDU |
| `dashboard new.jpeg` | `public/must-b-ui/public/` veya proje kökü | ❌ BULUNAMADI |

> **PM_MustB** | 2026-03-27 | `sleep.png` 3 konumda doğrulandı. Ancak `dashboard new.jpeg` tüm proje dizininde bulunamadı.

### ⛔ KRİTİK HATA: Varlık Eksik — ADIM 3 Durduruldu

```
dashboard new.jpeg → BULUNAMADI
ADIM 3 (Dashboard UI Optimizasyonu): OPERASYON DURDURULDU
CEO referans görseli upload etmeden ADIM 3 başlatılamaz.
```

### Direktif Görev Tablosu

| ID | Adım | Departman | Açıklama | Durum | Not |
|---|---|---|---|---|---|
| R9-A0 | ADIM 0 | PM_MustB | Varlık doğrulama: sleep.png + dashboard new.jpeg | DONE | Her ikisi de `avatar/` altında doğrulandı ✅ |
| R9-A1 | ADIM 1 | Backend_Architect | `src/core/doctor.ts` boot check modülü + `src/index.ts` entegrasyonu | DONE | runBootCheck() + port check |
| R9-A2+3 | ADIM 2+3 | Frontend_Engineer | WelcomePage yeniden yaz: sleep.png → UYANDIR → dark hero (dashboard new.jpeg referansı) | DONE | 3-phase UX, framer-motion blur, orange/dark palette |
| R9-A4 | ADIM 4 | Backend_Architect + Frontend_Engineer | Native `/api/tools` + `/api/agents` + ProductsPage güncelle | DONE | Must-b bağımlılığı sıfırlandı |
| R9-QA | QA | QA_Lead | `npm run build:prod` + TypeScript denetimi | QA_PASSED | TS: 0 hata (backend+frontend). Build: 10.2MB ✓ |
| R9-DEPLOY | DEPLOY | Deploy_Chief | v1.10.0 GitHub'a gönderildi | DEPLOYED | 2026-03-28 \| commit: Must-b v1.10.0: The Sovereign Fox Update \| push: BAŞARILI |

---

---

## Sprint 3 — Glassmorphism Overhaul (CEO Direktifi 2026-03-29)

> **Hedef:** Dashboard UI tamamen referans tasarıma (dashboard new.jpeg) getirilecek.
> Koyu arka plan + radyal turuncu glow + glassmorphism input + temiz minimal görünüm.

| ID | Departman | Açıklama | Durum | Not |
|---|---|---|---|---|
| S3-F001 | Frontend_Engineer | **BACKGROUND**: index.css body — dikey cream→dark gradient → koyu base + radyal orange spotlight | DONE | 2026-03-29 |
| S3-F002 | Frontend_Engineer | **CHATAREA**: Tüm green renk referansları orange/amber ile değiştirilecek; user/assistant bubble polish | DONE | 2026-03-29 |
| S3-B001 | Backend_Architect | **NATIVE YAPILANMA**: Must-b kalıntılarını temizle — `Must-bBridge`→`MustbGatewayBridge` (`src/core/gateway-bridge.ts`), `/api/must-b/*`→`/api/gateway/*`, tüm yorum satırları güncelle | DONE | Backend_Architect \| 2026-03-29 |
| S3-B002 | Backend_Architect | **DOCTOR**: pip otomatik kurulum desteği ekle (`checkPip` fonksiyonu) | DONE | Backend_Architect \| 2026-03-29 |
| S3-B003 | Backend_Architect | **DOCTOR FIX**: `checkPythonHeaders` sysconfig ile gerçek include path + node-gyp `npm config set python` otomatik düzeltme | DONE | Backend_Architect \| 2026-03-29 |
| S3-B004 | Backend_Architect | **DOCTOR v2.0**: `refreshPathFromRegistry`, `withSpinner`, `verifyBinaryOnPath` altyapısı + C++ `--wait` + Python PATH enjeksiyonu + post-fix doğrulama | DONE | Backend_Architect \| 2026-03-30 |
| S3-QA | QA_Lead | `npm run build:prod` + TypeScript denetimi | QA_PASSED | TS: 0 hata (backend+frontend). Build: 10.2MB ✓ pip: v25.3 ✓ Python.h: found ✓ node-gyp path: set ✓ Network: ortam kısıtı (kod hatası değil) \| QA_Lead \| 2026-03-29 |
| S3-DEPLOY | Deploy_Chief | v1.11.0 deploy | DEPLOYED | Deploy_Chief \| 2026-03-29 \| commit: Must-b v1.11.0: Glassmorphism Overhaul \| push: BAŞARILI |
| S3-B004-QA | QA_Lead | Doctor v2.0 — `npx tsc --noEmit` backend + frontend | QA_PASSED | TS: 0 hata (backend+frontend) \| QA_Lead \| 2026-03-30 |
| S3-B004-DEPLOY | Deploy_Chief | v1.12.0 deploy — Doctor v2.0: Autonomous Install Engine | DEPLOYED | Deploy_Chief \| 2026-03-30 \| commit: Must-b v1.12.0: Autonomous Install Engine \| push: BAŞARILI |
| S3-F003 | Frontend_Engineer | **ROOT REDIRECT**: `/` → WelcomePage kaldırıldı; setup tamamsa `/app`, değilse `/setup`'a yönlendir (`RootRedirect` bileşeni) | DONE | Frontend_Engineer \| 2026-03-30 |
| S3-F003-QA | QA_Lead | Root redirect — TS: 0 hata, build: başarılı | QA_PASSED | QA_Lead \| 2026-03-30 |
| S3-F003-DEPLOY | Deploy_Chief | v1.12.1 deploy — Root redirect: no landing page | DEPLOYED | Deploy_Chief \| 2026-03-30 \| commit: Must-b v1.12.1: Root Redirect — No Landing Page \| push: BAŞARILI |
| S3-F004 | Frontend_Engineer | **ROUTER OVERHAUL v1.12.1-fix**: WelcomePage awake ara-ekran silindi; UYANDIR → /app/chat direkt; /app/chat alias eklendi; WelcomePage import fix | QA_PASSED | TS: 0 hata, Build: exit 0 \| Frontend_Engineer \| 2026-03-30 |
| S3-F004-DEPLOY | Deploy_Chief | v1.12.1 deploy — Hızlı Uyanış: Router Overhaul + WelcomePage fix | DEPLOYED | Deploy_Chief \| 2026-03-30 \| commit: Must-b v1.12.1: Hızlı Uyanış — Router Overhaul \| push: BAŞARILI |
| S3-B005 | Backend_Architect | **DEFAULT LAUNCH**: `askLaunchMode()` inquirer prompt kaldırıldı; `must-b` → doğrudan Web Dashboard + tarayıcı aç; `must-b --logs` → terminal log modu | DONE | Backend_Architect \| 2026-03-30 |
| S3-B005-QA | QA_Lead | Default launch — TS: 0 hata | QA_PASSED | QA_Lead \| 2026-03-30 |
| S3-B005-DEPLOY | Deploy_Chief | v1.12.2 deploy — Zero-Prompt Launch | DEPLOYED | Deploy_Chief \| 2026-03-30 \| commit: Must-b v1.12.2: Zero-Prompt Launch \| push: BAŞARILI |

---

## Sprint 5 — Long-Term Memory v1.0 (CEO Direktifi 2026-03-30)

> **Hedef:** LTM modülü — vektör tabanlı episodik/semantik bellek, context injection, auto-index.

| ID | Departman | Açıklama | Durum | Not |
|---|---|---|---|---|
| S5-MEM001 | Backend_Architect | **LTM ALTYAPI**: `src/core/memory/vector-store.ts` (TF-IDF cosine, SQLite, episodic\|semantic), `src/core/memory/ltm.ts` (LTMController, buildSystemContext, auto-index), Orchestrator+Planner context injection, `/api/memory/ltm/*` endpoint'leri | DONE | Backend_Architect \| 2026-03-30 |
| S5-MEM001-QA | QA_Lead | LTM — Backend TS: 0 hata. Frontend TS: 0 hata. Build: exit 0, 10.2MB ✓, clean ✓ | QA_PASSED | QA_Lead \| 2026-03-30 |
| S5-MEM001-DEPLOY | Deploy_Chief | v1.13.0 deploy — Deep Memory: LTM Vector Engine | DEPLOYED | Deploy_Chief \| 2026-03-30 \| commit: Must-b v1.13.0 + v1.13.1 \| push: BAŞARILI |

---

## Sprint 9 — Live Browser View (CEO Direktifi 2026-03-30)

> **Hedef:** Must-b tarayıcıda gezinirken floating PiP penceresi — JPEG stream + URL bar + son aksiyon.

| ID | Departman | Açıklama | Durum | Not |
|---|---|---|---|---|
| S9-F001 | Frontend_Engineer | **LiveBrowserView**: Floating PiP; shadowFrame/ghostFrame stream; URL bar; son aksiyon | DONE | 2026-03-30 |
| S9-QA | QA_Lead | TS + build | QA_PASSED | TS: 0 hata. Build: 2002 modül, exit 0, clean ✓ \| 2026-03-30 |
| S9-DEPLOY | Deploy_Chief | v1.17.0 deploy | DEPLOYED | Deploy_Chief \| 2026-03-31 \| commit: feat(v1.18.0): Dashboard Intelligence + Live Browser + Morning Briefing \| push: BAŞARILI |

---

## Sprint 8 — Dashboard Intelligence UI (CEO Direktifi 2026-03-30)

> **Hedef:** Ghost Guard `systemStats`/`systemHealth` + Project Intelligence `projectInsight` event'lerini glassmorphism bileşenlerle Dashboard'a bağla.

| ID | Departman | Açıklama | Durum | Not |
|---|---|---|---|---|
| S8-F001 | Frontend_Engineer | **SystemHealthBadge**: Nav pill'e live CPU/RAM bar + alert pulse; `systemStats`+`systemHealth` socket | DONE | 2026-03-30 |
| S8-F002 | Frontend_Engineer | **WhisperPanel**: Sağ-alt glassmorphism fısıltı kartları; `projectInsight` socket | DONE | 2026-03-30 |
| S8-F003 | Frontend_Engineer | **AppLayout wiring**: Statik System badge → SystemHealthBadge, WhisperPanel inject | DONE | 2026-03-30 |
| S8-ACT001 | Backend_Architect | **ACTION FORCE v1.16.0**: `browser_perceive` (snapshot+url+title tek çağrı), `browser_scroll`, `browser_wait` — BrowserTools'a eklendi. `executor.ts`'e GhostGuard RAM guard (%82 limit), her browser_* op öncesi checkBrowserRAM(), navigate/click/type sonrası otomatik perception inject. Planner sistem prompt güncellendi. | DONE | Backend_Architect \| 2026-03-30 |
| S8-ACT001-QA | QA_Lead | Action Force — TS: 0 hata. Backend tsc --noEmit: temiz | QA_PASSED | QA_Lead \| 2026-03-30 |
| S8-DEPLOY | Deploy_Chief | v1.16.0 deploy | DEPLOYED | Deploy_Chief \| 2026-03-31 \| commit: feat(v1.18.0) omnibus \| push: BAŞARILI |

---

## Sprint 10 — Morning Briefing & Night Shift Log (CEO Direktifi 2026-03-30)

> **Hedef:** CEO girişte gece vardiyası raporunu hikaye tadında görür; canlı NightOwl log paneli.

| ID | Departman | Açıklama | Durum | Not |
|---|---|---|---|---|
| S10-F001 | Frontend_Engineer | **MorningBriefing**: Full-screen glassmorphism modal; NightOwl status + LTM findings; staggered story reveal | DONE | 2026-03-30 |
| S10-F002 | Frontend_Engineer | **NightShiftLog**: Fixed floating panel; real-time `nightOwlEvent` socket; scanning/idle state | DONE | 2026-03-30 |
| S10-F003 | Frontend_Engineer | **DashboardPage wiring**: MorningBriefing + NightShiftLog entegrasyonu | DONE | 2026-03-30 |
| S10-QA | QA_Lead | TS + build | QA_PASSED | TS: 0 hata. Build: 2004 modül, exit 0, clean ✓ \| 2026-03-30 |
| S10-DEPLOY | Deploy_Chief | v1.18.0 deploy | DEPLOYED | Deploy_Chief \| 2026-03-31 \| commit: feat(v1.18.0): NightOwl UI + Live Browser + Morning Briefing + Dashboard Intelligence \| push: BAŞARILI |

---

## Sprint 9 — NightOwl Automation (CEO Direktifi 2026-03-30)

> **Hedef:** Sistem boştayken (düşük CPU/RAM) otonom derin tarama görevlerini başlat; bulguları Semantic Memory'ye 'NightShift-Insights' etiketiyle işle.

| ID | Departman | Açıklama | Durum | Not |
|---|---|---|---|---|
| S9-OWL001 | Backend_Architect | **NIGHTOWL SCHEDULER**: `src/core/automation/night-owl.ts` — CPU<%15 ve RAM<%65 idle algılama (90s poll, 2h cooldown), 5 derin tarama görevi: CodeHealth/DepAudit/LogAnalysis/LTMGap/WorkspaceDiff, bulguları `['NightShift-Insights', task]` tag'i ile LTM semantik belleğe indeksle. `attachNightOwl()` + `/api/automation/nightowl/status` + `/api/automation/nightowl/trigger` endpoint'leri. | DONE | Backend_Architect \| 2026-03-30 |
| S9-OWL001-QA | QA_Lead | NightOwl — TS: 0 hata. Build: exit 0 | QA_PASSED | QA_Lead \| 2026-03-30 |
| S9-OWL001-DEPLOY | Deploy_Chief | v1.17.0 deploy — NightOwl Autonomous Night-Shift Scheduler | DEPLOYED | Deploy_Chief \| 2026-03-31 \| commit: feat(v1.18.0) omnibus \| push: BAŞARILI |

---

## Sprint 6 — Ghost Guard (CEO Direktifi 2026-03-30)

> **Hedef:** Kaynak izleme, log tarama, proaktif uyarı ve auto-heal altyapısı.

| ID | Departman | Açıklama | Durum | Not |
|---|---|---|---|---|
| S6-GRD001 | Backend_Architect | **GHOST GUARD**: `src/core/guard/ghost-guard.ts` — Resource Monitor (CPU/RAM, Lite Mode), Log Scanner (chokidar, pattern matching), Proaktif Uyarı (Socket.io systemHealth), Auto-Heal (doctor --fix tetikleme) | DONE | Backend_Architect \| 2026-03-30 |
| S6-GRD001-QA | QA_Lead | Ghost Guard — TS: 0 hata. Build: exit 0 | QA_PASSED | QA_Lead \| 2026-03-30 |
| S6-GRD001-DEPLOY | Deploy_Chief | v1.14.0 deploy — Ghost Guard: Resource & Error Intelligence | DEPLOYED | Deploy_Chief \| 2026-03-30 \| commit: Must-b v1.14.0: Ghost Guard \| push: BAŞARILI |

---

## Sprint 7 — Project Intelligence (CEO Direktifi 2026-03-30)

> **Hedef:** Workspace izleme, proje özetleme, insight fısıltısı, otomatik CHANGELOG.

| ID | Departman | Açıklama | Durum | Not |
|---|---|---|---|---|
| S7-INS001 | Backend_Architect | **PROJECT INTELLIGENCE**: `workspace-watcher.ts` (chokidar, 5 kategori), `summary-engine.ts` (klasör+dep özeti → LTM semantic), `project-intelligence.ts` (insight heuristik, whisper, CHANGELOG gen), `attachIntelligence()`, `/api/intelligence/changelog` | DONE | Backend_Architect \| 2026-03-30 |
| S7-INS001-QA | QA_Lead | Project Intelligence — TS: 0 hata. esbuild: 0 hata, 456kb ✓ | QA_PASSED | QA_Lead \| 2026-03-30 |
| S7-INS001-DEPLOY | Deploy_Chief | v1.15.0 deploy — Project Intelligence | DEPLOYED | Deploy_Chief \| 2026-03-30 \| commit: Must-b v1.15.0: Project Intelligence \| push: BAŞARILI |

---

## Sprint 12 — Marka Temizliği + Auth Altyapısı (CEO Direktifi 2026-04-01)

> **Hedef:** Tüm eski marka kalıntılarını 'Must-b' ile değiştir; must-b.com OAuth için auth.ts placeholder yaz; paths.ts denetimi.

| ID | Departman | Açıklama | Durum | Not |
|---|---|---|---|---|
| S12-B001 | Backend_Architect | **AUTH PLACEHOLDER**: `src/core/auth.ts` — Supabase OAuth arayüzü; signInWithEmail, signInWithOAuth, signOut, getSession, onAuthStateChange, restoreSession, isAuthenticated, authInfo | DONE | Backend_Architect \| 2026-04-01 |
| S12-B002 | Backend_Architect | **PATHS DENETİMİ**: `src/core/paths.ts` incelendi — kalıntı yok, STORAGE_ROOT/MEMORY_DIR/LOGS_DIR temiz | DONE | Backend_Architect \| 2026-04-01 |
| S12-F001 | Frontend_Engineer | **MARKA TEMİZLİĞİ**: Eski marka kalıntıları temizlendi (PIPELINE.md, CLAUDE.md, hooks, core/scripts) — useMustbStatus/MustbStatus export eklendi; settings.local.json modernize edildi | DONE | Frontend_Engineer \| 2026-04-01 |
| S12-GHOST | Backend_Architect | **HAYALEt TEMİZLİĞİ**: settings.local.json modernize (13 kirli satır kaldırıldı), discord-smoke.ts + sync-plugin-versions.ts fonksiyon isimleri güncellendi, useOpenClawStatus.ts sıfırlandı. Proje geneli grep -ri: **0 eşleşme** ✅ | DONE | Backend_Architect \| 2026-04-01 |
| S12-QA | QA_Lead | TS: 0 hata (backend+frontend). Build: exit 0, dist/ temiz | QA_PASSED | TS: 0 hata (backend+frontend). Build: 10.3MB ✓, dist/ temiz ✓ \| QA_Lead \| 2026-04-01 |
| S12-DEPLOY | Deploy_Chief | v1.21.0 deploy — Hayalet Temizliği Tamamlandı | IN_PROGRESS | |

---

## Sprint 11 — Skill-Brain Entegrasyonu (CEO Direktifi 2026-03-31)

> **Hedef:** 52 Skill kataloğunu Planner/Executor pipeline'ına bağla. invoke_skill Master Tool + Dynamic Injection.

| ID | Departman | Açıklama | Durum | Not |
|---|---|---|---|---|
| S11-SYN001 | Backend_Architect | **SKILL-BRAIN**: `planner.ts` — `loadSkillCatalog()` ile 52 skill dinamik sistem promptuna enjekte, `invoke_skill` tool tipi eklendi, Context Alignment talimatı. `executor.ts` — `invoke_skill` Master Tool: `routeSkill()` köprüsü, DIRECT→plugin, PROMPT→LLMProvider.chat() | DONE | Backend_Architect \| 2026-03-31 |
| S11-SYN001-QA | QA_Lead | `npx tsc --noEmit` backend + frontend + `npm run build:prod` | QA_PASSED | TS: 0 hata (backend+frontend). Build: 10.3MB ✓ \| QA_Lead \| 2026-04-01 |
| S11-SYN001-DEPLOY | Deploy_Chief | v1.19.0 deploy — Skill-Brain: Dynamic Tool Injection | IN_PROGRESS | |

---

## Sprint 4 — Skill Entegrasyonu (CEO Direktifi 2026-03-29)

> **Hedef:** 52 SKILL.md kataloğu Dashboard'a entegre edilecek. Skills & Plugins panelleri Must-b bağımsız çalışacak.

| ID | Departman | Açıklama | Durum | Not |
|---|---|---|---|---|
| S4-SK001 | Skill_Master | **SKILL CATALOG**: `src/core/skill-catalog.ts` oluştur — 52 SKILL.md parse, `/api/skills/catalog` endpoint ekle | DONE | Skill_Master \| 2026-03-29 |
| S4-SK002 | Skill_Master | **SKILLS PANEL**: SkillsPanel.tsx'e "Library" sekmesi ekle — katalog skill kartları + invoke butonu | DONE | Skill_Master \| 2026-03-29 |
| S4-QA | QA_Lead | `npm run build:prod` + TypeScript denetimi | QA_PASSED | TS: 0 hata (backend+frontend). Build: 10.2MB ✓ 2026-03-29 |
| S4-DEPLOY | Deploy_Chief | v1.11.1 deploy (Savaş Modu Fix) | DEPLOYED | Deploy_Chief \| 2026-03-30 \| commit: Must-b v1.11.1: Savaş Modu Fix \| push: BAŞARILI |

---

## Denetim Sprinti — Sistem Taraması (CEO Direktifi 2026-03-31)

> **Hedef:** Tüm `src/` ve `public/must-b-ui/` taranacak. Ölü kod, kırık köprü, bellek sızıntısı, skill entegrasyon açığı raporlanacak.

| ID | Departman | Açıklama | Durum | Not |
|---|---|---|---|---|
| AUD-B001 | Backend_Architect | Ölü kod, API endpoint haritası, otonom modül bellek analizi | DONE | Backend_Architect \| 2026-03-31 |
| AUD-F001 | Frontend_Engineer | Ölü kod, API çağrı envanteri, socket temizlik denetimi | DONE | Frontend_Engineer \| 2026-03-31 |
| AUD-SK001 | Skill_Master | 52 Skill kataloğu + Planner entegrasyon analizi | DONE | Skill_Master \| 2026-03-31 — KRİTİK AÇIK TESPİT EDİLDİ |
| AUD-FIX001 | Backend_Architect | `summary-engine.ts` — setTimeout sızıntısı düzeltildi (`initialTimer` + `clearTimeout`) | DONE | Backend_Architect \| 2026-03-31 \| TS: 0 hata |
| AUD-FIX002 | Backend_Architect | `project-intelligence.ts` — EventEmitter `fileChange` listener sızıntısı düzeltildi (`_fileChangeHandler` + `off()`) | DONE | Backend_Architect \| 2026-03-31 \| TS: 0 hata |
| AUD-CRIT001 | PM_MustB | **AÇIK RAPORU:** 52 Skill Kataloğu Planner'a bağlı değil — CEO direktifi bekleniyor | BLOCKED | CEO onayı gerekli — Skill→Planner entegrasyon sprint'i açılmalı |

---

## Sprint 1 — Tamamlandı (2026-03-27)

| ID | Departman | Açıklama | Durum |
|---|---|---|---|
| S1-T001 | Backend_Architect | MustbGatewayBridge + 19 /api/gateway/* endpoint | DONE |
| S1-T002 | Frontend_Engineer | useGatewayStatus hook + ChannelGrid bileşeni | DONE |
| S1-T003 | Frontend_Engineer | 6 stub sayfa gerçek veriye + SettingsPage Channels tab | DONE |
| S1-T004 | QA_Lead | TypeScript denetimi (backend + frontend) | QA_PASSED |
