"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ShieldCheck, Zap, Mail, Lock } from "lucide-react";

export const dynamic = "force-dynamic";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();
    const supabase = createClient();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            setError(error.message);
            setLoading(false);
        } else {
            router.push("/app");
            router.refresh();
        }
    };

    return (
        <div className="flex min-h-screen bg-[#02040a] text-white font-sans overflow-hidden relative">
            {/* Background elements */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[100px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-600/10 rounded-full blur-[100px]" />
            </div>

            {/* Left Side: Product Expo */}
            <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 bg-navy-950/20 border-r border-white/5 overflow-hidden z-10">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,_rgba(59,130,246,0.1)_0%,_transparent_50%)]"></div>

                <Link href="/" className="relative z-10 flex items-center gap-2 group">
                    <div className="relative w-10 h-10">
                        <div className="absolute inset-0 bg-blue-500 rounded-full blur-md opacity-50 group-hover:opacity-100 transition-opacity" />
                        <Image src="/logo.png" alt="Must-b Logo" fill className="object-contain relative z-10" />
                    </div>
                    <span className="text-2xl font-bold tracking-tight">Must-b</span>
                </Link>

                <div className="relative z-10 max-w-lg">
                    <h2 className="text-6xl font-bold tracking-tight leading-[1.1] mb-8">
                        Think faster, <br />
                        <span className="text-blue-500 drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]">Build smarter.</span>
                    </h2>
                    <p className="text-gray-400 text-xl leading-relaxed mb-12">
                        Must-b is your central AI intelligence, designed to streamline your digital world and automate your workflows.
                    </p>

                    <div className="space-y-8">
                        <div className="flex items-start gap-5">
                            <div className="mt-1 p-3 rounded-xl glass">
                                <Zap size={22} className="text-blue-400" />
                            </div>
                            <div>
                                <h4 className="text-lg font-semibold text-gray-200">Real-time Automation</h4>
                                <p className="text-gray-500 leading-relaxed">Instantly trigger actions across your systems based on live events.</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-5">
                            <div className="mt-1 p-3 rounded-xl glass">
                                <ShieldCheck size={22} className="text-cyan-400" />
                            </div>
                            <div>
                                <h4 className="text-lg font-semibold text-gray-200">Secure AI Brain</h4>
                                <p className="text-gray-500 leading-relaxed">Your data remains yours with enterprise-grade privacy and control.</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="relative z-10">
                    <p className="text-gray-600 text-sm font-medium">© 2026 Must-b. Created by Auto Step.</p>
                </div>
            </div>

            {/* Right Side: Login Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8 relative z-10">
                <div className="w-full max-w-md space-y-10 glass p-10 rounded-3xl border-white/5 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 rounded-full blur-[60px] -mr-16 -mt-16 pointer-events-none" />

                    <div className="text-center">
                        <h1 className="text-4xl font-bold tracking-tight mb-3">Welcome back</h1>
                        <p className="text-gray-500 font-medium">Continue your journey with Must-b.</p>
                    </div>

                    <form className="space-y-6" onSubmit={handleLogin}>
                        {error && (
                            <div className="rounded-xl bg-red-500/10 p-4 text-sm text-red-400 border border-red-500/20 text-center animate-in fade-in zoom-in duration-300">
                                {error}
                            </div>
                        )}

                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Email address</label>
                                <div className="relative group">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-500 transition-colors" size={20} />
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="block w-full rounded-xl border border-white/10 bg-navy-950/50 pl-12 pr-4 py-4 text-white placeholder-gray-600 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all outline-none"
                                        placeholder="name@company.com"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between px-1">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Password</label>
                                    <Link href="#" className="text-xs font-bold text-blue-500 hover:text-blue-400 transition-colors uppercase tracking-widest">Forgot?</Link>
                                </div>
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-500 transition-colors" size={20} />
                                    <input
                                        type="password"
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="block w-full rounded-xl border border-white/10 bg-navy-950/50 pl-12 pr-4 py-4 text-white placeholder-gray-600 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all outline-none"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full group relative overflow-hidden rounded-xl bg-blue-600 py-4 text-[15px] font-bold text-white hover:bg-blue-500 focus:outline-none transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)] active:scale-[0.98]"
                        >
                            {loading ? "Signing in..." : "Sign in to Must-b"}
                            {!loading && <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />}
                        </button>
                    </form>

                    <p className="text-center text-sm text-gray-500">
                        Don&apos;t have an account?{' '}
                        <Link href="/register" className="text-white hover:text-blue-400 font-bold transition-colors">
                            Create account
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}

