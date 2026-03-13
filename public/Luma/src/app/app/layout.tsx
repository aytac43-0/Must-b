import { createClient } from "@/utils/supabase/server";
import { Sidebar } from "@/components/sidebar";
import { redirect } from "next/navigation";
import { Toaster } from "sonner";

export default async function AppSegmentLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

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
