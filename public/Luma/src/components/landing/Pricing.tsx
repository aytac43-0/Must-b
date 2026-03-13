"use client"

import { Check } from "lucide-react"
import clsx from "clsx"

const tiers = [
    {
        name: "Starter",
        price: "50",
        description: "Perfect for individual entrepreneurs and beginners starting their journey.",
        features: [
            "1 User",
            "3 Basic Automations",
            "Daily Data Sync",
            "Email Support",
            "Basic Reporting"
        ],
        cta: "Start Now",
        highlight: false,
        badge: "7 DAY FREE TRIAL"
    },
    {
        name: "Pro",
        price: "89",
        description: "Full power for growing teams and professional businesses.",
        features: [
            "5 Users",
            "Unlimited Automations",
            "Instant Data Sync",
            "Priority Live Support",
            "Advanced Analytics & API",
            "1 Custom Integration"
        ],
        cta: "Start Now",
        highlight: true,
        badge: "MOST POPULAR"
    },
    {
        name: "Enterprise",
        price: "Custom",
        description: "Scalable infrastructure for corporate needs and large teams.",
        features: [
            "Unlimited Users",
            "All Features Unlimited",
            "Custom Server Infrastructure",
            "24/7 Dedicated Support",
            "Dedicated Account Manager",
            "SLA Guarantee"
        ],
        cta: "Request Quote",
        highlight: false,
        badge: "7 DAY FREE TRIAL"
    }
]

export default function Pricing() {
    return (
        <section id="pricing" className="py-24 relative overflow-hidden">
            <div className="max-w-7xl mx-auto px-6">
                <div className="text-center mb-16">
                    <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-4 tracking-tight">
                        ONE-TIME PAYMENT, <span className="text-blue-500">LIFETIME ACCESS</span>
                    </h2>
                    <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                        No subscriptions, no surprise bills. Choose the plan that fits your needs and try it free for 7 days.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
                    {tiers.map((tier) => (
                        <div
                            key={tier.name}
                            className={clsx(
                                "relative rounded-[32px] p-8 transition-all duration-500 hover:scale-[1.02]",
                                tier.highlight
                                    ? "bg-[#0A0C10] border-2 border-blue-500/50 shadow-[0_0_40px_rgba(59,130,246,0.1)] scale-105 z-10"
                                    : "bg-white/[0.02] border border-white/10 backdrop-blur-xl"
                            )}
                        >
                            {tier.badge && (
                                <div className={clsx(
                                    "absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase",
                                    tier.highlight ? "bg-blue-600 text-white" : "bg-white/10 text-gray-400"
                                )}>
                                    {tier.badge}
                                </div>
                            )}

                            <div className="mb-8 text-center md:text-left">
                                <h3 className="text-2xl font-bold text-white mb-2">{tier.name}</h3>
                                <p className="text-gray-500 text-sm leading-relaxed mb-6">{tier.description}</p>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-gray-400 text-lg">$</span>
                                    <span className="text-5xl font-black text-white">{tier.price}</span>
                                    {tier.price !== "Custom" && <span className="text-gray-500 text-xs ml-2 font-bold uppercase tracking-widest">ONE-TIME PAYMENT</span>}
                                </div>
                            </div>

                            <ul className="space-y-4 mb-10">
                                {tier.features.map((feature) => (
                                    <li key={feature} className="flex items-center gap-3 text-sm text-gray-300">
                                        <div className={clsx("p-1 rounded-full", tier.highlight ? "bg-blue-500/20 text-blue-400" : "bg-white/5 text-gray-500")}>
                                            <Check size={14} strokeWidth={3} />
                                        </div>
                                        <span>{feature}</span>
                                    </li>
                                ))}
                            </ul>

                            <button className={clsx(
                                "w-full py-4 rounded-2xl font-bold transition-all active:scale-95",
                                tier.highlight
                                    ? "bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-500/20"
                                    : "bg-white text-black hover:bg-gray-200"
                            )}>
                                {tier.cta}
                            </button>

                            <p className="text-center mt-4 text-[10px] text-gray-600 font-medium">No credit card required.</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}
