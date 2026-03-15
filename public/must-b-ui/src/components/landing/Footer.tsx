"use client"

import Link from 'next/link'
import { Twitter, Linkedin, Mail } from 'lucide-react'

export default function Footer() {
    return (
        <footer className="py-12 px-6 border-t border-white/5 bg-navy-950/20">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8">
                    <Link href="/" className="text-xl font-bold text-white">Must-b</Link>
                    <span className="text-sm text-gray-500 hidden md:block">|</span>
                    <p className="text-sm text-gray-500">Created by Auto Step</p>
                </div>

                <div className="flex items-center gap-8">
                    <Link href="/privacy" className="text-sm text-gray-500 hover:text-white transition-colors">Privacy</Link>
                    <Link href="/terms" className="text-sm text-gray-500 hover:text-white transition-colors">Terms</Link>
                </div>

                <div className="flex items-center gap-6">
                    <Link href="#" className="text-gray-500 hover:text-white transition-colors">
                        <Twitter className="w-5 h-5" />
                    </Link>
                    <Link href="#" className="text-gray-500 hover:text-white transition-colors">
                        <Linkedin className="w-5 h-5" />
                    </Link>
                    <Link href="#" className="text-gray-500 hover:text-white transition-colors">
                        <Mail className="w-5 h-5" />
                    </Link>
                </div>
            </div>
        </footer>
    )
}
