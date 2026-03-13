"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Mail, Lock, User, Building, Bot, CheckCircle2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default function RegisterPage() {
    const [fullName, setFullName] = useState("");
    const [company, setCompany] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const supabase = createClient();

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName,
                    company: company || null,
                }
            }
        });

        if (error) {
            setError(error.message);
            setLoading(false);
        } else {
            setIsSubmitted(true);
            setLoading(false);
        }
    };

    if (isSubmitted) {
        return (
            <div className="flex min-h-screen bg-[#02040a] text-white font-sans items-center justify-center p-6 relative overflow-hidden">
                <div className="fixed inset-0 pointer-events-none z-0">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[120px]" />
                </div>

                <div className="max-w-md w-full glass p-10 rounded-3xl border-white/5 text-center relative z-10 animate-in fade-in zoom-in duration-500">
                    <div className="w-20 h-20 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-8 relative">
                        <div className="absolute inset-0 bg-blue-500 rounded-full blur-xl opacity-50 animate-pulse" />
                        <Mail size={40} className="text-blue-400 relative z-10" />
                    </div>
                    <h1 className="text-3xl font-bold mb-4">Check your email</h1>
                    <p className="text-gray-400 text-lg mb-8">
                        We&apos;ve sent a verification link to <span className="text-white font-semibold">{email}</span>. Please click it to activate your account.
                    </p>
                    <Link
                        href="/login"
                        className="inline-flex items-center gap-2 text-blue-500 hover:text-blue-400 font-bold transition-colors"
                    >
                        Back to Login <ArrowRight size={18} />
                    </Link>
                </div>
            </div>
        );
    }

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
                        Start your <br />
                        <span className="text-blue-500 drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]">AI journey.</span>
                    </h2>
                    <p className="text-gray-400 text-xl leading-relaxed mb-12">
                        Create an account to join thousands of innovators using Must-b to supercharge their productivity.
                    </p>

                    <div className="space-y-8">
                        <div className="flex items-start gap-5">
                            <div className="mt-1 p-3 rounded-xl glass">
                                <Bot size={22} className="text-blue-400" />
                            </div>
                            <div>
                                <h4 className="text-lg font-semibold text-gray-200">Personalized Assistant</h4>
                                <p className="text-gray-500 leading-relaxed">Tailored responses that learn from your preferences over time.</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-5">
                            <div className="mt-1 p-3 rounded-xl glass">
                                <CheckCircle2 size={22} className="text-emerald-400" />
                            </div>
                            <div>
                                <h4 className="text-lg font-semibold text-gray-200">Unlimited Potential</h4>
                                <p className="text-gray-500 leading-relaxed">Access to the latest AI models and workflow automation tools.</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="relative z-10">
                    <p className="text-gray-600 text-sm font-medium">© 2026 Must-b. Created by Auto Step.</p>
                </div>
            </div>

            {/* Right Side: Register Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8 relative z-10 overflow-y-auto scrollbar-hide py-12">
                <div className="w-full max-w-md space-y-10 glass p-10 rounded-3xl border-white/5 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 rounded-full blur-[60px] -mr-16 -mt-16 pointer-events-none" />

                    <div className="text-center">
                        <h1 className="text-4xl font-bold tracking-tight mb-3">Create account</h1>
                        <p className="text-gray-500 font-medium">Join Must-b and start building today.</p>
                    </div>

                    <form className="space-y-5" onSubmit={handleRegister}>
                        {error && (
                            <div className="rounded-xl bg-red-500/10 p-4 text-sm text-red-400 border border-red-500/20 text-center animate-in fade-in zoom-in duration-300">
                                {error}
                            </div>
                        )}

                        <div className="space-y-5">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Full Name</label>
                                <div className="relative group">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-500 transition-colors" size={20} />
                                    <input
                                        type="text"
                                        required
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        className="block w-full rounded-xl border border-white/10 bg-navy-950/50 pl-12 pr-4 py-3.5 text-white placeholder-gray-600 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all outline-none"
                                        placeholder="John Doe"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Company (Optional)</label>
                                <div className="relative group">
                                    <Building className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-500 transition-colors" size={20} />
                                    <input
                                        type="text"
                                        value={company}
                                        onChange={(e) => setCompany(e.target.value)}
                                        className="block w-full rounded-xl border border-white/10 bg-navy-950/50 pl-12 pr-4 py-3.5 text-white placeholder-gray-600 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all outline-none"
                                        placeholder="Acme Inc."
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Email address</label>
                                <div className="relative group">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-500 transition-colors" size={20} />
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="block w-full rounded-xl border border-white/10 bg-navy-950/50 pl-12 pr-4 py-3.5 text-white placeholder-gray-600 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all outline-none"
                                        placeholder="name@company.com"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Password</label>
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-500 transition-colors" size={20} />
                                    <input
                                        type="password"
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="block w-full rounded-xl border border-white/10 bg-navy-950/50 pl-12 pr-4 py-3.5 text-white placeholder-gray-600 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all outline-none"
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
                            {loading ? "Creating account..." : "Start your trial"}
                            {!loading && <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />}
                        </button>
                    </form>

                    <p className="text-center text-sm text-gray-500">
                        Already have an account?{' '}
                        <Link href="/login" className="text-white hover:text-blue-400 font-bold transition-colors">
                            Sign in here
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}

