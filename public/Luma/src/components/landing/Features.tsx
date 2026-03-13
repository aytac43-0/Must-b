"use client"

import { Brain, Globe, Zap } from 'lucide-react'

const features = [
    {
        title: "One Brain",
        description: "Single AI core that remembers and adapts to your personal data and needs.",
        icon: Brain,
        color: "text-blue-400",
        bg: "bg-blue-400/10"
    },
    {
        title: "Full Integration",
        description: "Connected inside Auto Step workflows, APIs, channels, and your favorite tools.",
        icon: Globe,
        color: "text-cyan-400",
        bg: "bg-cyan-400/10"
    },
    {
        title: "Real-Time Automation",
        description: "Trigger actions instantly across your systems based on live triggers and events.",
        icon: Zap,
        color: "text-blue-500",
        bg: "bg-blue-500/10"
    }
]

export default function Features() {
    return (
        <section id="features" className="py-24 px-6 relative">
            <div className="max-w-7xl mx-auto flex flex-col items-center">
                <h2 className="text-3xl md:text-5xl font-bold text-white mb-16 text-center tracking-tight">
                    One AI. Full Control.
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-5xl">
                    {features.map((feature, index) => (
                        <div
                            key={index}
                            className="glass p-8 rounded-2xl flex flex-col items-center text-center group hover:scale-[1.02] transition-transform duration-300"
                        >
                            <div className={`w-14 h-14 ${feature.bg} rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                                <feature.icon className={`w-8 h-8 ${feature.color}`} />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-3">{feature.title}</h3>
                            <p className="text-gray-400 leading-relaxed text-sm">
                                {feature.description}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}
