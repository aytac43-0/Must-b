'use client'

import { Sidebar } from "@/components/sidebar";
import { Toaster } from "sonner";

export default function AppSegmentLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex bg-[#0A0A0A] min-h-screen relative font-sans text-white">
            <Toaster position="top-right" theme="dark" closeButton />
            <Sidebar />
            <main className="flex-1 flex flex-col relative overflow-hidden h-screen">
                {children}
            </main>
        </div>
    );
}
