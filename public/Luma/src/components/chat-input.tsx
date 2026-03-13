"use client";

import { Send, Mic } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import clsx from "clsx";
import { toast } from "sonner";

interface ChatInputProps {
    chatId?: string | null;
    onMessageSent?: () => void;
    setTyping?: (typing: boolean) => void;
    setInitialMessage?: string | null;
    onClearPrompt?: () => void;
}

export function ChatInput({ chatId, onMessageSent, setTyping, setInitialMessage, onClearPrompt }: ChatInputProps) {
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.focus();
        }
    }, [chatId]);

    useEffect(() => {
        if (setInitialMessage) {
            setMessage(setInitialMessage);
            onClearPrompt?.();
            if (textareaRef.current) {
                textareaRef.current.focus();
            }
        }
    }, [setInitialMessage, onClearPrompt]);

    const handleSend = async () => {
        if (!message.trim() || loading) return;

        const originalMessage = message;
        setMessage("");
        setLoading(true);
        setTyping?.(true);

        let currentChatId = chatId;

        if (!currentChatId) {
            const { createClient } = await import("@/utils/supabase/client");
            const supabase = createClient();

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setLoading(false);
                setTyping?.(false);
                setMessage(originalMessage);
                return;
            }

            const { data, error } = await supabase
                .from("chats")
                .insert([{
                    title: originalMessage.length > 40 ? originalMessage.slice(0, 40) + "..." : originalMessage,
                    user_id: user.id
                }])
                .select()
                .single();

            if (error || !data) {
                setLoading(false);
                setTyping?.(false);
                setMessage(originalMessage);
                return;
            }
            currentChatId = data.id;
            window.history.pushState({}, "", `/app?chat=${currentChatId}`);
        }

        try {
            const response = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chat_id: currentChatId, message: originalMessage }),
            });

            if (response.ok) {
                onMessageSent?.();
            } else {
                const errData = await response.json().catch(() => ({}));
                toast.error(errData.error || "Failed to send message. Please try again.");
                setMessage(originalMessage);
            }
        } catch (error) {
            console.error("Error sending message:", error);
            toast.error("Network error. Please check your connection.");
            setMessage(originalMessage);
        } finally {
            setLoading(false);
            setTyping?.(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
        }
    }, [message]);

    return (
        <div className="w-full relative max-w-4xl mx-auto px-4">
            <div className="relative flex items-center w-full bg-[#111318]/80 backdrop-blur-xl border border-white/5 rounded-[28px] shadow-2xl transition-all duration-300 focus-within:border-blue-500/30 ring-1 ring-white/5 pr-4 pl-2 overflow-hidden group">
                {/* Visual Accent */}
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-[1px] bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />

                <textarea
                    ref={textareaRef}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask Must-b anything..."
                    className="flex-1 bg-transparent border-none focus:ring-0 text-white placeholder-gray-500 py-4 px-6 resize-none min-h-[60px] max-h-[200px] overflow-y-auto scrollbar-hide text-[16px] leading-relaxed outline-none"
                    disabled={loading}
                    rows={1}
                ></textarea>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        className="p-3 text-gray-500 hover:text-blue-400 transition-colors rounded-full hover:bg-white/5"
                    >
                        <Mic size={20} />
                    </button>
                    <button
                        onClick={handleSend}
                        disabled={!message.trim() || loading}
                        className={clsx(
                            "flex items-center justify-center w-11 h-11 rounded-full transition-all duration-300",
                            message.trim() && !loading
                                ? "bg-blue-600 text-white hover:bg-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.4)] active:scale-95"
                                : "text-gray-600 cursor-not-allowed"
                        )}
                    >
                        {loading ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                            <Send size={20} strokeWidth={2.5} className={clsx(message.trim() ? "translate-x-0.5" : "text-blue-500/30")} />
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

