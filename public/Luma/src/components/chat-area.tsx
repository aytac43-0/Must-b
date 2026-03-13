"use client";

import { ChatInput } from "@/components/chat-input";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import Image from "next/image";
import clsx from "clsx";

type Message = {
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
    created_at: string;
};


export function ChatArea() {
    const searchParams = useSearchParams();
    const chatId = searchParams.get("chat");
    const [messages, setMessages] = useState<Message[]>([]);
    const [isTyping, setIsTyping] = useState(false);
    const [examplePrompt, setExamplePrompt] = useState<string | null>(null);
    const supabase = createClient();
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    };

    useEffect(() => {
        if (!chatId) {
            setMessages([]);
            return;
        }

        async function fetchMessages() {
            const { data, error } = await supabase
                .from("messages")
                .select("*")
                .eq("chat_id", chatId)
                .order("created_at", { ascending: true });

            if (!error && data) {
                setMessages(data);
            }
            scrollToBottom();
        }

        fetchMessages();

        const channel = supabase
            .channel(`chat:${chatId}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
                (payload) => {
                    const newMessage = payload.new as Message;
                    setMessages((current) => [...current, newMessage]);
                    if (newMessage.role === 'assistant') {
                        setIsTyping(false);
                    }
                    scrollToBottom();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [chatId, supabase]);

    useEffect(() => {
        scrollToBottom();
    }, [messages, isTyping]);

    const hasMessages = messages.length > 0;

    return (
        <div className="flex-1 relative flex flex-col h-full overflow-hidden bg-[#02040a]">
            {/* Ambient Background Gradient */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,_#1e293b_0%,_transparent_70%)] pointer-events-none opacity-20"></div>

            <div className="flex-1 overflow-y-auto scrollbar-hide">
                <div className="max-w-4xl mx-auto w-full px-6 pt-16 pb-12">
                    {!hasMessages ? (
                        <div className="flex flex-col items-center justify-center min-h-[70vh] text-center animate-in fade-in zoom-in duration-1000">
                            {/* Central Must-b Orb */}
                            <div className="relative w-48 h-48 mb-8 group cursor-pointer">
                                <div className="absolute inset-0 bg-blue-500 rounded-full blur-[60px] opacity-40 group-hover:opacity-60 transition-opacity animate-pulse" />
                                <div className="absolute inset-4 bg-cyan-400 rounded-full blur-[30px] opacity-20 group-hover:opacity-40 transition-opacity" />
                                <div className="relative w-full h-full p-2">
                                    <Image
                                        src="/logo.png"
                                        alt="Must-b Orb"
                                        fill
                                        className="object-contain relative z-10 drop-shadow-[0_0_30px_rgba(59,130,246,0.5)]"
                                    />
                                </div>
                            </div>

                            <h1 className="text-5xl font-extrabold text-white tracking-tight mb-4 drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]">
                                Must-b — <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">Your Personal AI Brain</span>
                            </h1>
                            <p className="text-gray-400 text-xl font-medium max-w-2xl">
                                Ask questions, manage automations, explore your data, and control your AI workflows — all in one place.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-8 animate-in fade-in duration-500">
                            {messages.map((message) => (
                                <div
                                    key={message.id}
                                    className={clsx(
                                        "flex w-full group",
                                        message.role === 'user' ? "justify-end" : "justify-start"
                                    )}
                                >
                                    {message.role === 'assistant' && (
                                        <div className="flex-shrink-0 mr-4 mt-2">
                                            <div className="relative w-8 h-8">
                                                <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-md" />
                                                <Image src="/logo.png" alt="Must-b" fill className="object-contain relative z-10" />
                                            </div>
                                        </div>
                                    )}
                                    <div className={clsx(
                                        "max-w-[80%] rounded-2xl px-6 py-4 text-[15px] leading-relaxed transition-all shadow-xl",
                                        message.role === 'user'
                                            ? "bg-blue-600/10 border border-blue-500/20 text-white selection:bg-blue-500/40"
                                            : "glass border-white/5 text-gray-200"
                                    )}>
                                        <div className="whitespace-pre-wrap font-medium">
                                            {message.content}
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {isTyping && (
                                <div className="flex w-full justify-start animate-pulse">
                                    <div className="flex-shrink-0 mr-4 mt-2">
                                        <div className="relative w-8 h-8">
                                            <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-md" />
                                            <Image src="/logo.png" alt="Must-b" fill className="object-contain relative z-10" />
                                        </div>
                                    </div>
                                    <div className="glass border-white/5 rounded-2xl px-6 py-4 inline-flex items-center gap-1.5 shadow-xl">
                                        <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                        <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                        <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce"></div>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} className="h-4" />
                        </div>
                    )}
                </div>
            </div>

            {/* Input Area */}
            <div className="p-8 bg-[#02040a]">
                <div className="max-w-4xl mx-auto w-full">
                    <ChatInput
                        chatId={chatId}
                        onMessageSent={scrollToBottom}
                        setTyping={setIsTyping}
                        setInitialMessage={examplePrompt}
                        onClearPrompt={() => setExamplePrompt(null)}
                    />
                    <p className="text-center mt-4 text-[12px] text-gray-600 font-medium tracking-wide">
                        Must-b can make mistakes. Consider checking important information.
                    </p>
                </div>
            </div>
        </div>
    );
}






