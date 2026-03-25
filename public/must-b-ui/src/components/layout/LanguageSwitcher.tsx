/**
 * LanguageSwitcher — polished locale selector (v4.3)
 *
 * Pill button showing current flag + code.
 * Animated dropdown with checkmark on active locale.
 * Closes on outside click or Escape.
 */

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence }      from "framer-motion";
import { Check, Languages }             from "lucide-react";
import { useI18n, type Locale }         from "@/i18n";

const LANGS: { code: Locale; label: string; flag: string; native: string }[] = [
  { code: "en", label: "English", flag: "🇬🇧", native: "English"  },
  { code: "tr", label: "Turkish", flag: "🇹🇷", native: "Türkçe"   },
  { code: "de", label: "German",  flag: "🇩🇪", native: "Deutsch"  },
];

export default function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();
  const [open, setOpen]       = useState(false);
  const ref                   = useRef<HTMLDivElement>(null);
  const current               = LANGS.find((l) => l.code === locale) ?? LANGS[0];

  // Close on Escape or outside click
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Switch language"
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[12px] font-medium transition-all select-none ${
          open
            ? "bg-white/10 border-white/15 text-white"
            : "bg-white/5 border-white/8 text-gray-300 hover:bg-white/8 hover:text-white"
        }`}
      >
        <Languages size={12} className="text-orange-400 shrink-0" />
        <span>{current.flag}</span>
        <span className="tracking-wide">{current.code.toUpperCase()}</span>
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />

            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.96 }}
              transition={{ duration: 0.13, ease: "easeOut" }}
              className="absolute right-0 top-full mt-2 z-20 w-44 bg-[#100806]/96 backdrop-blur-2xl border border-orange-500/15 rounded-xl shadow-2xl shadow-black/60 overflow-hidden"
            >
              {/* Header */}
              <div className="px-3 py-2 border-b border-white/6">
                <p className="text-[9px] font-bold text-gray-600 uppercase tracking-widest">Language</p>
              </div>

              {LANGS.map((l) => {
                const active = locale === l.code;
                return (
                  <button
                    key={l.code}
                    onClick={() => { setLocale(l.code); setOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-[12px] font-medium transition-colors ${
                      active
                        ? "bg-orange-500/12 text-orange-400"
                        : "text-gray-300 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <span className="text-base leading-none">{l.flag}</span>
                    <div className="text-left flex-1">
                      <p className="leading-none">{l.native}</p>
                      {!active && <p className="text-[10px] text-gray-600 mt-0.5">{l.label}</p>}
                    </div>
                    {active && <Check size={12} className="text-orange-400 shrink-0" />}
                  </button>
                );
              })}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
