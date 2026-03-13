"use client";

import { Send, Mic } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import clsx from "clsx";

interface ChatInputProps {
    onSend: (message: string) => void;
    disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
    const [message, setMessage] = useState("");
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        textareaRef.current?.focus();
    }, []);

    const handleSend = () => {
        const text = message.trim();
        if (!text || disabled) return;
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
            <div className="relative flex items-center w-full bg-[#111318]/80 backdrop-blur-xl border border-white/5 rounded-[28px] shadow-2xl transition-all duration-300 focus-within:border-blue-500/30 ring-1 ring-white/5 pr-4 pl-2 overflow-hidden group">
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-[1px] bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />

                <textarea
                    ref={textareaRef}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask Must-b anything..."
                    className="flex-1 bg-transparent border-none focus:ring-0 text-white placeholder-gray-500 py-4 px-6 resize-none min-h-[60px] max-h-[200px] overflow-y-auto scrollbar-hide text-[16px] leading-relaxed outline-none"
                    disabled={disabled}
                    rows={1}
                />

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        className="p-3 text-gray-500 hover:text-blue-400 transition-colors rounded-full hover:bg-white/5"
                    >
                        <Mic size={20} />
                    </button>
                    <button
                        onClick={handleSend}
                        disabled={!message.trim() || disabled}
                        className={clsx(
                            "flex items-center justify-center w-11 h-11 rounded-full transition-all duration-300",
                            message.trim() && !disabled
                                ? "bg-blue-600 text-white hover:bg-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.4)] active:scale-95"
                                : "text-gray-600 cursor-not-allowed"
                        )}
                    >
                        {disabled ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <Send size={20} strokeWidth={2.5} className={clsx(message.trim() ? "translate-x-0.5" : "text-blue-500/30")} />
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
