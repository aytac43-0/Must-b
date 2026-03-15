"use client"

import Link from 'next/link'
import Image from 'next/image'

export default function Navbar() {
    return (
        <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 md:px-12 backdrop-blur-md bg-navy-950/20 border-b border-white/5">
            <div className="flex items-center gap-8">
                <Link href="/" className="flex items-center gap-2 group">
                    <div className="relative w-8 h-8">
                        <div className="absolute inset-0 bg-blue-500 rounded-full blur-md opacity-50 group-hover:opacity-100 transition-opacity" />
                        <Image
                            src="/logo.png"
                            alt="Must-b Logo"
                            fill
                            className="object-contain relative z-10"
                        />
                    </div>
                    <span className="text-xl font-bold tracking-tight text-white">Must-b</span>
                </Link>

                <div className="hidden md:flex items-center gap-6">
                    <Link href="/#features" className="text-sm text-gray-400 hover:text-white transition-colors">Features</Link>
                    <Link href="/#pricing" className="text-sm text-gray-400 hover:text-white transition-colors">Pricing</Link>
                    <Link href="/#contact" className="text-sm text-gray-400 hover:text-white transition-colors">Contact</Link>
                </div>
            </div>

            <div className="flex items-center gap-4">
                <Link href="/login" className="text-sm text-gray-400 hover:text-white transition-colors">
                    Login
                </Link>
                <Link
                    href="/register"
                    className="px-5 py-2 text-sm font-medium text-white bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-all hover:scale-105 active:scale-95"
                >
                    Start Free
                </Link>
            </div>
        </nav>
    )
}
