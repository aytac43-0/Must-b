"use client"

import Link from 'next/link'
import Image from 'next/image'

export default function Hero() {
    return (
        <section className="relative pt-32 pb-20 px-6 flex flex-col items-center text-center overflow-hidden">
            {/* Background Glows */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none animate-glow-pulse" />

            {/* Central Orb Logo */}
            <div className="relative w-48 h-48 mb-8 group animate-float">
                <div className="absolute inset-x-0 bottom-0 h-1/4 bg-blue-500/50 blur-3xl rounded-full" />
                <div className="relative w-full h-full flex items-center justify-center p-4">
                    {/* Outer glow ring */}
                    <div className="absolute inset-0 border-[3px] border-blue-400/30 rounded-full blur-sm" />
                    <Image
                        src="/logo.png"
                        alt="Must-b Intelligence"
                        width={160}
                        height={160}
                        className="object-contain drop-shadow-[0_0_30px_rgba(59,130,246,0.8)]"
                        priority
                    />
                </div>
            </div>

            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight text-white max-w-4xl mb-6">
                Your Central AI Intelligence
            </h1>

            <p className="text-lg md:text-xl text-gray-400 max-w-2xl mb-10 leading-relaxed">
                Must-b connects, manages, and automates everything inside your digital world.
                From conversations to workflows — one AI brain in control.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-4">
                <Link
                    href="/register"
                    className="px-8 py-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-500 transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:shadow-[0_0_30px_rgba(37,99,235,0.6)] hover:scale-105 active:scale-95"
                >
                    Start With Must-b
                </Link>
                <Link
                    href="#how-it-works"
                    className="px-8 py-4 bg-white/5 text-gray-300 font-semibold rounded-lg border border-white/10 hover:bg-white/10 transition-all"
                >
                    See How It Works
                </Link>
            </div>
        </section>
    )
}
