import { Send, Mic, MicOff } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import clsx from "clsx";
import { apiFetch } from "@/lib/api";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

// Augment window for cross-browser Speech API
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    textareaRef.current?.focus();
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSpeechSupported(!!SR);
  }, []);

  // Model guidance: warn once per session if a weak model is active
  const warnedRef = useRef(false);
  const checkModelGuidance = useCallback(async () => {
    if (warnedRef.current) return;
    try {
      const r = await apiFetch("/api/system/vision-guidance");
      if (!r.ok) return;
      const g = await r.json() as { warn: boolean; message: string | null };
      if (g.warn && g.message) {
        warnedRef.current = true;
        onSend("__GUIDANCE__" + g.message);  // prefix stripped by ChatArea
      }
    } catch { /* silent */ }
  }, [onSend]);

  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    checkModelGuidance();

    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onresult = (e: SpeechRecognitionEvent) => {
      let transcript = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript;
      }
      setMessage(transcript);
    };

    rec.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    rec.onerror = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = rec;
    rec.start();
    setIsListening(true);
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const handleMicMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const handleSend = () => {
    const text = message.trim();
    if (!text || disabled) return;
    if (isListening) stopListening();
    setMessage("");
    onSend(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [message]);

  return (
    <div className="w-full relative max-w-4xl mx-auto px-4">
      <div className="relative flex items-center w-full bg-[#111318]/80 backdrop-blur-xl border border-white/5 rounded-[28px] shadow-2xl transition-all duration-300 focus-within:border-orange-500/30 ring-1 ring-white/5 pr-4 pl-2 overflow-hidden group">
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-[1px] bg-gradient-to-r from-transparent via-orange-500/20 to-transparent" />

        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isListening ? "Listening…" : "Ask Must-b anything…"}
          className="flex-1 bg-transparent border-none focus:ring-0 text-white placeholder-gray-500 py-4 px-6 resize-none min-h-[60px] max-h-[200px] overflow-y-auto scrollbar-hide text-[16px] leading-relaxed outline-none"
          disabled={disabled}
          rows={1}
        />

        <div className="flex items-center gap-2">
          {/* Mic — push-to-talk or tap-to-toggle */}
          {speechSupported && (
            <button
              type="button"
              onMouseDown={handleMicMouseDown}
              title={isListening ? "Stop listening" : "Push to talk"}
              className={clsx(
                "p-3 rounded-full transition-all duration-200",
                isListening
                  ? "text-orange-400 bg-orange-500/15 shadow-[0_0_12px_rgba(234,88,12,0.4)] animate-pulse"
                  : "text-gray-500 hover:text-orange-400 hover:bg-white/5"
              )}
            >
              {isListening ? <MicOff size={20} /> : <Mic size={20} />}
            </button>
          )}

          {/* Send */}
          <button
            onClick={handleSend}
            disabled={!message.trim() || disabled}
            className={clsx(
              "flex items-center justify-center w-11 h-11 rounded-full transition-all duration-300",
              message.trim() && !disabled
                ? "bg-orange-600 text-white hover:bg-orange-500 shadow-[0_0_15px_rgba(234,88,12,0.4)] active:scale-95"
                : "text-gray-600 cursor-not-allowed"
            )}
          >
            {disabled ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Send size={20} strokeWidth={2.5} className={clsx(message.trim() ? "translate-x-0.5" : "text-orange-500/30")} />
            )}
          </button>
        </div>
      </div>

      {/* Listening indicator bar */}
      {isListening && (
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-1 pointer-events-none">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="w-0.5 bg-orange-400 rounded-full animate-bounce"
              style={{
                height: `${6 + (i % 3) * 4}px`,
                animationDelay: `${i * 0.1}s`,
                animationDuration: "0.6s",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
