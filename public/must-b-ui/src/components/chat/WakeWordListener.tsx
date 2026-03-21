/**
 * WakeWordListener — continuous background listener for "Hey [AgentName]".
 *
 * When activated, it uses the Web Speech API in continuous mode to listen
 * for the wake phrase. On detection it fires the `onWake` callback so the
 * parent can focus the chat input, show a toast, etc.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { Ear, EarOff } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface WakeWordListenerProps {
  /** Called when the wake phrase is detected */
  onWake: () => void;
}

declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

export function WakeWordListener({ onWake }: WakeWordListenerProps) {
  const [enabled, setEnabled] = useState(false);
  const [agentName, setAgentName] = useState("Must-b");
  const [supported, setSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const enabledRef = useRef(false);

  // Sync ref so the restart loop can check without stale closure
  useEffect(() => { enabledRef.current = enabled; }, [enabled]);

  // Fetch agent name once
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSupported(!!SR);

    apiFetch("/api/identity")
      .then((r) => r.json())
      .then((d: { name?: string }) => { if (d.name) setAgentName(d.name); })
      .catch(() => {});
  }, []);

  const wakePhrase = `hey ${agentName}`.toLowerCase();

  const startRecognition = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR || !enabledRef.current) return;

    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.maxAlternatives = 1;

    rec.onresult = (e: SpeechRecognitionEvent) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript.toLowerCase().trim();
        if (t.includes(wakePhrase)) {
          onWake();
        }
      }
    };

    rec.onend = () => {
      // Auto-restart while still enabled
      if (enabledRef.current) {
        setTimeout(startRecognition, 300);
      }
    };

    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      // "no-speech" is normal — just restart
      if (e.error !== "no-speech") {
        console.warn("[WakeWord] SpeechRecognition error:", e.error);
      }
      if (enabledRef.current) {
        setTimeout(startRecognition, 1000);
      }
    };

    recognitionRef.current = rec;
    try { rec.start(); } catch { /* already started */ }
  }, [wakePhrase, onWake]);

  useEffect(() => {
    if (enabled) {
      startRecognition();
    } else {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
    }
    return () => {
      recognitionRef.current?.stop();
    };
  }, [enabled, startRecognition]);

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={() => setEnabled((v) => !v)}
      title={enabled ? `Listening for "Hey ${agentName}" — click to disable` : `Enable wake word "Hey ${agentName}"`}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
        enabled
          ? "text-orange-400 bg-orange-500/10 border border-orange-500/20 shadow-[0_0_8px_rgba(234,88,12,0.2)]"
          : "text-gray-600 hover:text-gray-400 hover:bg-white/5 border border-transparent"
      }`}
    >
      {enabled ? (
        <>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500" />
          </span>
          <Ear size={13} />
          <span>Hey {agentName}</span>
        </>
      ) : (
        <>
          <EarOff size={13} />
          <span>Wake word off</span>
        </>
      )}
    </button>
  );
}
