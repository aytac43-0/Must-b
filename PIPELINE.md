# PIPELINE — Must-b Inc.

> **Yönetici:** PM_MustB
> **Protokol:** Ekipler terminal yerine bu dosyayı kullanır. Durum güncellemeleri buraya yazılır.
> **Son güncelleme:** Deploy_Chief | 2026-03-28 | CEO Direktifi 2026/09-RevB — v1.10.0 QA_PASSED

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
| R9-A4 | ADIM 4 | Backend_Architect + Frontend_Engineer | Native `/api/tools` + `/api/agents` + ProductsPage güncelle | DONE | OpenClaw bağımlılığı sıfırlandı |
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
| S3-B001 | Backend_Architect | **NATIVE YAPILANMA**: OpenClaw kalıntılarını temizle — `OpenClawBridge`→`MustbGatewayBridge` (`src/core/gateway-bridge.ts`), `/api/openclaw/*`→`/api/gateway/*`, tüm yorum satırları güncelle | DONE | Backend_Architect \| 2026-03-29 |
| S3-B002 | Backend_Architect | **DOCTOR**: pip otomatik kurulum desteği ekle (`checkPip` fonksiyonu) | DONE | Backend_Architect \| 2026-03-29 |
| S3-B003 | Backend_Architect | **DOCTOR FIX**: `checkPythonHeaders` sysconfig ile gerçek include path + node-gyp `npm config set python` otomatik düzeltme | DONE | Backend_Architect \| 2026-03-29 |
| S3-QA | QA_Lead | `npm run build:prod` + TypeScript denetimi | QA_PASSED | TS: 0 hata (backend+frontend). Build: 10.2MB ✓ pip: v25.3 ✓ Python.h: found ✓ node-gyp path: set ✓ Network: ortam kısıtı (kod hatası değil) \| QA_Lead \| 2026-03-29 |
| S3-DEPLOY | Deploy_Chief | v1.11.0 deploy | DEPLOYED | Deploy_Chief \| 2026-03-29 \| commit: Must-b v1.11.0: Glassmorphism Overhaul \| push: BAŞARILI |

---

## Sprint 4 — Skill Entegrasyonu (CEO Direktifi 2026-03-29)

> **Hedef:** 52 SKILL.md kataloğu Dashboard'a entegre edilecek. Skills & Plugins panelleri OpenClaw bağımsız çalışacak.

| ID | Departman | Açıklama | Durum | Not |
|---|---|---|---|---|
| S4-SK001 | Skill_Master | **SKILL CATALOG**: `src/core/skill-catalog.ts` oluştur — 52 SKILL.md parse, `/api/skills/catalog` endpoint ekle | DONE | Skill_Master \| 2026-03-29 |
| S4-SK002 | Skill_Master | **SKILLS PANEL**: SkillsPanel.tsx'e "Library" sekmesi ekle — katalog skill kartları + invoke butonu | DONE | Skill_Master \| 2026-03-29 |
| S4-QA | QA_Lead | `npm run build:prod` + TypeScript denetimi | QA_PASSED | TS: 0 hata (backend+frontend). Build: 10.2MB ✓ 2026-03-29 |
| S4-DEPLOY | Deploy_Chief | v1.11.1 deploy (Savaş Modu Fix) | DEPLOYED | Deploy_Chief \| 2026-03-30 \| commit: Must-b v1.11.1: Savaş Modu Fix \| push: BAŞARILI |

---

## Sprint 1 — Tamamlandı (2026-03-27)

| ID | Departman | Açıklama | Durum |
|---|---|---|---|
| S1-T001 | Backend_Architect | OpenClawBridge + 19 /api/openclaw/* endpoint | DONE |
| S1-T002 | Frontend_Engineer | useOpenClawStatus hook + ChannelGrid bileşeni | DONE |
| S1-T003 | Frontend_Engineer | 6 stub sayfa gerçek veriye + SettingsPage Channels tab | DONE |
| S1-T004 | QA_Lead | TypeScript denetimi (backend + frontend) | QA_PASSED |
