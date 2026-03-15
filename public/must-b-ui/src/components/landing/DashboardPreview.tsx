"use client"

import Image from 'next/image'

export default function DashboardPreview() {
    return (
        <section className="py-20 px-6 relative overflow-hidden">
            {/* Background Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />

            <div className="max-w-6xl mx-auto">
                <div className="relative glass p-2 rounded-2xl md:rounded-3xl shadow-2xl group">
                    {/* Inner Glow */}
                    <div className="absolute inset-0 bg-blue-500/5 rounded-2xl md:rounded-3xl pointer-events-none" />

                    <div className="relative rounded-[14px] md:rounded-[22px] overflow-hidden border border-white/10 bg-navy-950">
                        {/* 
              Using a placeholder/simulated dashboard look. 
              The template shows a very dark, polished dashboard.
            */}
                        <div className="aspect-[16/10] w-full relative">
                            <div className="absolute inset-0 flex items-center justify-center bg-[#05070a]">
                                <div className="relative w-32 h-32 md:w-48 md:h-48">
                                    <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-2xl animate-glow-pulse" />
                                    <Image
                                        src="/logo.png"
                                        alt="Dashboard Preview central orb"
                                        fill
                                        className="object-contain relative z-10 opacity-80"
                                    />
                                </div>
                            </div>

                            {/* UI Mockup Overlays */}
                            <div className="absolute top-4 left-4 w-48 h-full hidden md:block border-r border-white/5 p-4 space-y-4">
                                <div className="h-4 w-3/4 bg-white/5 rounded" />
                                <div className="h-4 w-1/2 bg-white/5 rounded" />
                                <div className="pt-8 space-y-2">
                                    <div className="h-3 w-full bg-white/5 rounded" />
                                    <div className="h-3 w-full bg-white/5 rounded" />
                                    <div className="h-3 w-full bg-white/5 rounded" />
                                </div>
                            </div>
                        </div>

                        {/* Mirror effect overlay */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent pointer-events-none" />
                    </div>
                </div>
            </div>
        </section>
    )
}
