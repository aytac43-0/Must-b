/**
 * UserProfilePanel — Must-b Cloud Identity v1.22.0
 *
 * Fixed top-right avatar trigger → glassmorphism dropdown panel.
 *
 * States:
 *   • Not logged in  → orange pulsing "Giriş Yap" ring avatar
 *   • Logged in      → avatar image or initials circle; profile menu
 *
 * Connects via:
 *   • GET  /api/auth/user-status    (initial load)
 *   • Socket.io 'authStateChanged'  (real-time update after OAuth callback)
 *   • window.open /api/auth/user-connect?provider=github|google  (OAuth initiation)
 *   • POST /api/auth/signout        (sign out)
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence }                   from "framer-motion";
import { User, LogIn, LogOut, ExternalLink, KeyRound, X, Github } from "lucide-react";
import { getSocket } from "@/lib/socket";

// ── Types ─────────────────────────────────────────────────────────────────

interface AuthStatus {
  authenticated: boolean;
  userEmail:     string | null;
  userName:      string | null;
  avatarUrl:     string | null;
  expiresAt:     string | null;
}

const DEFAULT_STATUS: AuthStatus = {
  authenticated: false,
  userEmail:     null,
  userName:      null,
  avatarUrl:     null,
  expiresAt:     null,
};

// ── Helpers ───────────────────────────────────────────────────────────────

function getInitials(name: string | null, email: string | null): string {
  if (name) {
    return name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }
  if (email) return email[0].toUpperCase();
  return "?";
}

// ── Component ─────────────────────────────────────────────────────────────

export default function UserProfilePanel() {
  const [open,   setOpen]   = useState(false);
  const [auth,   setAuth]   = useState<AuthStatus>(DEFAULT_STATUS);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  /* ── Fetch current status ─────────────────────────────────────────── */
  const refreshStatus = useCallback(() => {
    fetch("/api/auth/user-status")
      .then((r) => r.json())
      .then((data: AuthStatus) => setAuth(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  /* ── Socket.io — real-time auth state ───────────────────────────── */
  useEffect(() => {
    const socket = getSocket();

    const handler = (data: Partial<AuthStatus> & { authenticated: boolean }) => {
      if (data.authenticated) {
        setAuth((prev) => ({
          ...prev,
          authenticated: true,
          userEmail:  data.userEmail  ?? prev.userEmail,
          userName:   data.userName   ?? prev.userName,
          avatarUrl:  data.avatarUrl  ?? prev.avatarUrl,
        }));
      } else {
        setAuth(DEFAULT_STATUS);
      }
    };

    socket.on("authStateChanged", handler);
    return () => { socket.off("authStateChanged", handler); };
  }, []);

  /* ── OAuth popup message relay ───────────────────────────────────── */
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data === "mustb:auth:done") refreshStatus();
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [refreshStatus]);

  /* ── Close on outside click ──────────────────────────────────────── */
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  /* ── Escape key ──────────────────────────────────────────────────── */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  /* ── Actions ─────────────────────────────────────────────────────── */
  const handleLogin = (provider: "github" | "google") => {
    window.open(
      `/api/auth/user-connect?provider=${provider}`,
      "mustb-auth",
      "width=540,height=660,scrollbars=yes"
    );
  };

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await fetch("/api/auth/signout", { method: "POST" });
      setAuth(DEFAULT_STATUS);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const openCloud = (path: string) => {
    const base = (import.meta.env.VITE_CLOUD_URL as string | undefined) ?? "https://must-b.com";
    window.open(`${base}${path}`, "_blank", "noopener,noreferrer");
  };

  /* ── Derived ─────────────────────────────────────────────────────── */
  const initials   = getInitials(auth.userName, auth.userEmail);
  const isLoggedIn = auth.authenticated;

  /* ── Render ──────────────────────────────────────────────────────── */
  return (
    <div ref={ref} className="fixed top-4 right-4 z-50 flex flex-col items-end">

      {/* ── Avatar trigger ─────────────────────────────────────────── */}
      <button
        onClick={() => setOpen((p) => !p)}
        title={isLoggedIn ? (auth.userEmail ?? "Profil") : "must-b.com ile Giriş Yap"}
        className={`
          relative w-9 h-9 rounded-full flex items-center justify-center
          select-none transition-all duration-200 focus:outline-none
          ${isLoggedIn
            ? "bg-white/10 border border-white/20 hover:border-orange-400/50 hover:bg-white/15 shadow-[0_4px_16px_rgba(0,0,0,0.5)]"
            : "bg-orange-500/15 border border-orange-400/40 hover:bg-orange-500/25 hover:border-orange-400/70 shadow-[0_0_16px_rgba(249,115,22,0.3)] animate-orange-pulse"
          }
        `}
      >
        {/* Avatar image */}
        {isLoggedIn && auth.avatarUrl ? (
          <img
            src={auth.avatarUrl}
            alt="avatar"
            className="w-full h-full rounded-full object-cover"
          />
        ) : isLoggedIn ? (
          <span className="text-[13px] font-black text-orange-400">{initials}</span>
        ) : (
          <LogIn size={15} className="text-orange-400" />
        )}

        {/* Online dot — only when logged in */}
        {isLoggedIn && (
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-black" />
        )}
      </button>

      {/* ── Glassmorphism panel ─────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="profile-panel"
            initial={{ opacity: 0, scale: 0.93, y: -8 }}
            animate={{ opacity: 1, scale: 1,    y: 0  }}
            exit={{    opacity: 0, scale: 0.93, y: -6 }}
            transition={{ duration: 0.17, ease: [0.22, 1, 0.36, 1] }}
            className="mt-2 w-72 glass-panel rounded-2xl overflow-hidden
                       shadow-[0_24px_64px_rgba(0,0,0,0.75),0_0_0_1px_rgba(249,115,22,0.18)]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
              <span className="text-[11px] font-black uppercase tracking-[0.1em] text-orange-400/70">
                {isLoggedIn ? "Hesap" : "must-b Hesabı"}
              </span>
              <button
                onClick={() => setOpen(false)}
                className="w-6 h-6 flex items-center justify-center rounded-full
                           hover:bg-white/8 text-white/30 hover:text-white/60 transition-colors"
              >
                <X size={12} />
              </button>
            </div>

            {/* ── Not logged in ────────────────────────────────────── */}
            {!isLoggedIn && (
              <div className="p-4 flex flex-col gap-2">
                {/* Glow login CTA */}
                <p className="text-[12px] text-white/50 text-center mb-1">
                  Bulut yedekleme, çoklu cihaz ve profil ayarları için giriş yapın.
                </p>

                <button
                  onClick={() => handleLogin("github")}
                  className="
                    w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl
                    bg-orange-500/20 border border-orange-400/40 text-orange-300
                    text-[13px] font-semibold
                    hover:bg-orange-500/30 hover:border-orange-400/70
                    transition-all duration-200
                    shadow-[0_0_18px_rgba(249,115,22,0.25)]
                    animate-orange-pulse
                  "
                >
                  <Github size={15} />
                  GitHub ile Giriş Yap
                </button>

                <button
                  onClick={() => handleLogin("google")}
                  className="
                    w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl
                    bg-white/5 border border-white/12 text-white/60
                    text-[13px] font-semibold
                    hover:bg-white/10 hover:text-white/80 hover:border-white/25
                    transition-all duration-200
                  "
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Google ile Giriş Yap
                </button>
              </div>
            )}

            {/* ── Logged in ────────────────────────────────────────── */}
            {isLoggedIn && (
              <div className="p-2">
                {/* User info row */}
                <div className="flex items-center gap-3 px-3 py-2.5 mb-1">
                  <div className="w-9 h-9 rounded-full bg-orange-500/20 border border-orange-400/30 flex items-center justify-center shrink-0 overflow-hidden">
                    {auth.avatarUrl ? (
                      <img src={auth.avatarUrl} alt="avatar" className="w-full h-full object-cover rounded-full" />
                    ) : (
                      <span className="text-[14px] font-black text-orange-400">{initials}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    {auth.userName && (
                      <p className="text-[13px] font-semibold text-white/90 truncate leading-tight">
                        {auth.userName}
                      </p>
                    )}
                    <p className="text-[11px] text-white/45 truncate">
                      {auth.userEmail ?? "—"}
                    </p>
                  </div>
                </div>

                <div className="h-px bg-white/6 mx-2 mb-1" />

                {/* Menu items */}
                {[
                  {
                    icon:  <User size={13} />,
                    label: "Profil Ayarları",
                    sub:   "Web",
                    action: () => openCloud("/profile/settings"),
                  },
                  {
                    icon:  <KeyRound size={13} />,
                    label: "Şifre Değiştir",
                    sub:   "Web",
                    action: () => openCloud("/profile/security"),
                  },
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={() => { item.action(); setOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl
                               hover:bg-white/6 transition-colors group text-left"
                  >
                    <span className="w-6 h-6 flex items-center justify-center rounded-lg
                                     bg-white/5 text-white/40 group-hover:text-orange-400
                                     group-hover:bg-orange-500/10 transition-all shrink-0">
                      {item.icon}
                    </span>
                    <span className="text-[12px] font-semibold text-white/70 group-hover:text-white/90 transition-colors flex-1">
                      {item.label}
                    </span>
                    <span className="flex items-center gap-1 text-[9px] text-white/25 group-hover:text-orange-400/60 transition-colors">
                      <ExternalLink size={9} />
                      {item.sub}
                    </span>
                  </button>
                ))}

                <div className="h-px bg-white/6 mx-2 my-1" />

                {/* Sign out */}
                <button
                  onClick={handleSignOut}
                  disabled={loading}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl
                             hover:bg-red-500/10 transition-colors group text-left
                             disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="w-6 h-6 flex items-center justify-center rounded-lg
                                   bg-white/5 text-white/30 group-hover:text-red-400
                                   group-hover:bg-red-500/10 transition-all shrink-0">
                    <LogOut size={13} />
                  </span>
                  <span className="text-[12px] font-semibold text-white/50 group-hover:text-red-400 transition-colors">
                    {loading ? "Çıkış yapılıyor…" : "Çıkış Yap"}
                  </span>
                </button>
              </div>
            )}

            {/* Footer */}
            <div className="px-4 py-2 border-t border-white/6">
              <p className="text-[9.5px] text-white/18 text-center">
                must-b.com · Güvenli OAuth bağlantısı
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
