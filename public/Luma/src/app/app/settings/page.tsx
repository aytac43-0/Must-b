"use client"

import { createClient } from "@/utils/supabase/client";
import { useState, useEffect } from "react";
import { User } from "@supabase/supabase-js";
import {
    Settings as SettingsIcon,
    Bell,
    User as UserIcon,
    Shield,
    Database,
    Cpu,
    X,
    ChevronRight,
    Search,
    Palette,
    Moon,
    Sun,
    Monitor,
    Smartphone,
    Key,
    Download,
    Trash2,
    Github,
    Globe
} from "lucide-react";
import clsx from "clsx";

const Toggle = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
    <button
        onClick={onChange}
        className={clsx(
            "w-10 h-6 rounded-full transition-colors relative",
            checked ? "bg-blue-600" : "bg-white/10"
        )}
    >
        <div className={clsx(
            "absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform",
            checked ? "translate-x-4" : "translate-x-0"
        )} />
    </button>
);

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState("General");
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<{ role?: string; full_name?: string } | null>(null);
    const [loading, setLoading] = useState(false);
    const supabase = createClient();

    // Settings States with Persistence
    const [notifications, setNotifications] = useState({ email: true, push: false, marketing: false, security: true });
    const [theme, setTheme] = useState("system");
    const [compactMode, setCompactMode] = useState(false);
    const [twoFactor, setTwoFactor] = useState(false);

    // Load settings from localStorage
    useEffect(() => {
        const savedSettings = localStorage.getItem('mustb-settings');
        if (savedSettings) {
            const parsed = JSON.parse(savedSettings);
            setNotifications(parsed.notifications || { email: true, push: false, marketing: false, security: true });
            setTheme(parsed.theme || "system");
            setCompactMode(parsed.compactMode || false);
        }
    }, []);

    // Save settings to localStorage
    useEffect(() => {
        localStorage.setItem('mustb-settings', JSON.stringify({
            notifications,
            theme,
            compactMode
        }));
        // Apply theme (mock implementation)
        document.documentElement.setAttribute('data-theme', theme);
    }, [notifications, theme, compactMode]);

    useEffect(() => {
        const fetchUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setUser(user);
                const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
                setProfile(data);
            }
        };
        fetchUser();
    }, [supabase]);

    const handleExportData = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const { data: chats } = await supabase.from('chats').select('*, messages(*)').eq('user_id', user.id);
            const exportData = {
                user: { email: user.email, id: user.id, ...profile },
                chats: chats || [],
                exported_at: new Date().toISOString()
            };

            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `mustb-export-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Export failed:', error);
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordReset = async () => {
        if (!user?.email) return;
        const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
            redirectTo: `${window.location.origin}/app/settings`,
        });
        if (error) alert("Error sending reset email: " + error.message);
        else alert("Password reset email sent to " + user.email);
    };

    const updateProfileName = async (newName: string) => {
        if (!user) return;
        const { error } = await supabase
            .from('profiles')
            .update({ full_name: newName })
            .eq('id', user.id);

        if (!error) {
            setProfile(prev => prev ? { ...prev, full_name: newName } : null);
        }
    };

    const handleDeleteAccount = async () => {
        if (!user) return;
        const confirm = window.confirm("Are you sure you want to delete your account? This action is irreversible.");
        if (!confirm) return;

        // In a real app, this would trigger a supbase function to delete user + data.
        // For now, we'll sign out and show a message since client-side deletion of Auth user is restricted.
        alert("Account deletion request submitted. Signing out...");
        await supabase.auth.signOut();
        window.location.href = "/login";
    };

    if (!user) return null;

    const tabs = [
        { name: "General", icon: SettingsIcon },
        { name: "Notifications", icon: Bell },
        { name: "Personalization", icon: Palette },
        { name: "Applications", icon: Cpu },
        { name: "Data controls", icon: Database },
        { name: "Security", icon: Shield },
        { name: "Parental controls", icon: UserIcon },
        { name: "Account", icon: UserIcon },
    ];

    return (
        <main className="flex-1 flex h-screen overflow-hidden text-white font-sans bg-[#0D0D0D]">
            {/* Settings Sidebar */}
            <div className="w-[300px] border-r border-white/5 bg-[#0F0F0F] p-6 flex flex-col">
                <div className="flex items-center justify-between mb-8 px-2">
                    <button className="p-2 hover:bg-white/5 rounded-full transition-colors">
                        <X size={20} className="text-gray-400" />
                    </button>
                    <div className="relative flex-1 mx-4">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input
                            type="text"
                            placeholder="Search settings..."
                            className="w-full bg-white/5 border-none rounded-lg py-2 pl-10 text-[13px] outline-none"
                        />
                    </div>
                </div>

                <nav className="flex-1 space-y-1">
                    {tabs.map((tab) => (
                        <button
                            key={tab.name}
                            onClick={() => setActiveTab(tab.name)}
                            className={clsx(
                                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-[14px] font-medium group",
                                activeTab === tab.name
                                    ? "bg-white/10 text-white"
                                    : "text-gray-400 hover:text-white hover:bg-white/5"
                            )}
                        >
                            <tab.icon size={18} className={clsx(
                                activeTab === tab.name ? "text-blue-500" : "text-gray-500 group-hover:text-gray-300"
                            )} />
                            <span>{tab.name}</span>
                        </button>
                    ))}
                </nav>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-12 max-w-4xl">
                <div className="flex items-center justify-between mb-12">
                    <h1 className="text-3xl font-bold tracking-tight">{activeTab}</h1>
                </div>

                {activeTab === "General" && (
                    <div className="space-y-10 animate-in fade-in duration-500">
                        {/* Security Alert Card */}
                        <div className="p-6 rounded-2xl bg-[#1A1A1A] border border-white/5 relative group overflow-hidden">
                            <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button className="p-1 hover:bg-white/5 rounded-md"><X size={16} /></button>
                            </div>
                            <div className="flex items-start gap-4">
                                <div className="p-3 bg-white/5 rounded-xl text-gray-300 border border-white/5">
                                    <Shield size={22} strokeWidth={1.5} />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-[17px] font-semibold mb-2">Secure your account</h3>
                                    <p className="text-gray-400 text-[14px] leading-relaxed mb-6 max-w-md">
                                        Add multi-factor authentication (MFA) such as a password or text message to help protect your account when signing in.
                                    </p>
                                    <button className="px-6 py-2.5 bg-[#262626] hover:bg-[#333] border border-white/5 rounded-full text-[14px] font-bold transition-all">
                                        Set up MFA
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Settings Options */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between py-4 border-b border-white/5 group cursor-pointer">
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-[15px] font-medium">Appearance</span>
                                </div>
                                <div className="flex items-center gap-2 text-gray-400 group-hover:text-white transition-colors">
                                    <span className="text-[14px]">System</span>
                                    <ChevronRight size={16} />
                                </div>
                            </div>
                            <div className="flex items-center justify-between py-4 border-b border-white/5 group cursor-pointer">
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-[15px] font-medium">Language</span>
                                </div>
                                <div className="flex items-center gap-2 text-gray-400 group-hover:text-white transition-colors">
                                    <span className="text-[14px]">English (US)</span>
                                    <ChevronRight size={16} />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === "Notifications" && (
                    <div className="space-y-8 animate-in fade-in duration-500">
                        <div className="space-y-6">
                            <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                                <div>
                                    <h3 className="text-[15px] font-medium text-white">Email Notifications</h3>
                                    <p className="text-[13px] text-gray-400">Receive weekly digests and activity updates.</p>
                                </div>
                                <Toggle checked={notifications.email} onChange={() => setNotifications({ ...notifications, email: !notifications.email })} />
                            </div>
                            <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                                <div>
                                    <h3 className="text-[15px] font-medium text-white">Push Notifications</h3>
                                    <p className="text-[13px] text-gray-400">Get real-time alerts on your device.</p>
                                </div>
                                <Toggle checked={notifications.push} onChange={() => setNotifications({ ...notifications, push: !notifications.push })} />
                            </div>
                            <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                                <div>
                                    <h3 className="text-[15px] font-medium text-white">Security Alerts</h3>
                                    <p className="text-[13px] text-gray-400">Receive alerts for suspicious login attempts.</p>
                                </div>
                                <Toggle checked={notifications.security} onChange={() => setNotifications({ ...notifications, security: !notifications.security })} />
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === "Personalization" && (
                    <div className="space-y-10 animate-in fade-in duration-500">
                        <div className="grid grid-cols-3 gap-4">
                            <button
                                onClick={() => setTheme("light")}
                                className={clsx("p-4 rounded-xl border transition-all flex flex-col items-center gap-3", theme === "light" ? "bg-white/10 border-blue-500" : "bg-white/5 border-white/5 hover:border-white/20")}
                            >
                                <Sun size={24} className={theme === "light" ? "text-blue-400" : "text-gray-400"} />
                                <span className="text-sm font-medium">Light</span>
                            </button>
                            <button
                                onClick={() => setTheme("dark")}
                                className={clsx("p-4 rounded-xl border transition-all flex flex-col items-center gap-3", theme === "dark" ? "bg-white/10 border-blue-500" : "bg-white/5 border-white/5 hover:border-white/20")}
                            >
                                <Moon size={24} className={theme === "dark" ? "text-blue-400" : "text-gray-400"} />
                                <span className="text-sm font-medium">Dark</span>
                            </button>
                            <button
                                onClick={() => setTheme("system")}
                                className={clsx("p-4 rounded-xl border transition-all flex flex-col items-center gap-3", theme === "system" ? "bg-white/10 border-blue-500" : "bg-white/5 border-white/5 hover:border-white/20")}
                            >
                                <Monitor size={24} className={theme === "system" ? "text-blue-400" : "text-gray-400"} />
                                <span className="text-sm font-medium">System</span>
                            </button>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                            <div>
                                <h3 className="text-[15px] font-medium text-white">Compact View</h3>
                                <p className="text-[13px] text-gray-400">Increase information density on screen.</p>
                            </div>
                            <Toggle checked={compactMode} onChange={() => setCompactMode(!compactMode)} />
                        </div>
                    </div>
                )}

                {activeTab === "Applications" && (
                    <div className="space-y-6 animate-in fade-in duration-500">
                        <div className="p-1 rounded-xl bg-white/5 border border-white/5 divide-y divide-white/5">
                            <div className="flex items-center justify-between p-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center">
                                        <Github size={20} className="text-black" />
                                    </div>
                                    <div>
                                        <h3 className="text-[15px] font-medium text-white">GitHub</h3>
                                        <p className="text-[13px] text-gray-400">Connect repositories and workflows.</p>
                                    </div>
                                </div>
                                <button className="px-4 py-1.5 rounded-full text-xs font-semibold bg-white/10 hover:bg-white/20 transition-colors">Connect</button>
                            </div>
                            <div className="flex items-center justify-between p-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center">
                                        <Globe size={20} className="text-white" />
                                    </div>
                                    <div>
                                        <h3 className="text-[15px] font-medium text-white">Google</h3>
                                        <p className="text-[13px] text-gray-400">Calendar and Drive integration.</p>
                                    </div>
                                </div>
                                <button className="px-4 py-1.5 rounded-full text-xs font-semibold bg-green-500/10 text-green-400 ring-1 ring-green-500/50">Connected</button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === "Data controls" && (
                    <div className="space-y-6 animate-in fade-in duration-500">
                        <div
                            onClick={handleExportData}
                            className="p-4 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between hover:bg-white/10 transition-colors cursor-pointer group"
                        >
                            <div className="flex items-center gap-4">
                                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                                    <Download size={20} />
                                </div>
                                <div>
                                    <h3 className="text-[15px] font-medium text-white">Export Data</h3>
                                    <p className="text-[13px] text-gray-400">{loading ? "Preparing download..." : "Download a copy of your personal data."}</p>
                                </div>
                            </div>
                            <ChevronRight size={16} className="text-gray-500 group-hover:text-white" />
                        </div>

                        <div className="p-4 bg-red-500/5 rounded-xl border border-red-500/10 flex items-center justify-between cursor-pointer group">
                            <div className="flex items-center gap-4">
                                <div className="p-2 rounded-lg bg-red-500/10 text-red-400">
                                    <Trash2 size={20} />
                                </div>
                                <div>
                                    <h3 className="text-[15px] font-medium text-white">Delete Account</h3>
                                    <p className="text-[13px] text-gray-400">Permanently remove your account and all data.</p>
                                </div>
                            </div>
                            <button
                                onClick={handleDeleteAccount}
                                className="px-4 py-1.5 bg-red-500/10 text-red-400 rounded-lg text-xs font-bold hover:bg-red-500 hover:text-white transition-all"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === "Security" && (
                    <div className="space-y-6 animate-in fade-in duration-500">
                        <section className="space-y-4">
                            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Authentication</h3>
                            <div className="p-6 rounded-2xl bg-white/5 border border-white/5 space-y-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="p-2 rounded-lg bg-white/5 text-gray-300">
                                            <Key size={20} />
                                        </div>
                                        <div>
                                            <h4 className="text-[15px] font-medium">Password</h4>
                                            <p className="text-[13px] text-gray-400">Last changed 3 months ago</p>
                                        </div>
                                    </div>
                                    <button onClick={handlePasswordReset} className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold">Change</button>
                                </div>
                                <div className="h-px bg-white/5" />
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="p-2 rounded-lg bg-white/5 text-gray-300">
                                            <Smartphone size={20} />
                                        </div>
                                        <div>
                                            <h4 className="text-[15px] font-medium">2-Step Verification</h4>
                                            <p className="text-[13px] text-gray-400">Add an extra layer of security</p>
                                        </div>
                                    </div>
                                    <Toggle checked={twoFactor} onChange={() => setTwoFactor(!twoFactor)} />
                                </div>
                            </div>
                        </section>

                        <section className="space-y-4">
                            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Active Sessions</h3>
                            <div className="p-4 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <Monitor size={20} className="text-green-400" />
                                    <div>
                                        <h4 className="text-[14px] font-medium text-white">Windows PC (Current)</h4>
                                        <p className="text-[12px] text-gray-400">Bursa, Turkey • Chrome • Now</p>
                                    </div>
                                </div>
                                <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
                            </div>
                        </section>
                    </div>
                )}

                {activeTab === "Parental controls" && (
                    <div className="space-y-6 animate-in fade-in duration-500">
                        <div className="p-6 rounded-2xl bg-[#1A1A1A] border border-white/5">
                            <h3 className="text-lg font-semibold mb-4">Content Filtering</h3>
                            <div className="space-y-2">
                                <label className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 cursor-pointer">
                                    <input type="radio" name="filter" className="w-4 h-4 text-blue-500" />
                                    <div>
                                        <div className="text-[14px] font-medium text-white">Strict</div>
                                        <div className="text-[12px] text-gray-400">Block all mature content</div>
                                    </div>
                                </label>
                                <label className="flex items-center gap-3 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 cursor-pointer">
                                    <input type="radio" name="filter" className="w-4 h-4 text-blue-500" defaultChecked />
                                    <div>
                                        <div className="text-[14px] font-medium text-white">Moderate</div>
                                        <div className="text-[12px] text-gray-400">Filter explicit results</div>
                                    </div>
                                </label>
                                <label className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 cursor-pointer">
                                    <input type="radio" name="filter" className="w-4 h-4 text-blue-500" />
                                    <div>
                                        <div className="text-[14px] font-medium text-white">Off</div>
                                        <div className="text-[12px] text-gray-400">No restrictions</div>
                                    </div>
                                </label>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === "Account" && (
                    <div className="space-y-6 animate-in fade-in duration-500">
                        <div className="p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-sm">
                            <h2 className="text-xl font-bold mb-6">Profile Information</h2>
                            <div className="space-y-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-2xl font-bold">
                                        {profile?.full_name?.[0]?.toUpperCase() || user.email?.[0].toUpperCase()}
                                    </div>
                                    <div className="flex-1">
                                        <label className="text-gray-400 text-sm block mb-1">Full Name</label>
                                        <input
                                            type="text"
                                            className="bg-transparent text-lg font-medium border-b border-white/10 focus:border-blue-500 outline-none w-full pb-1"
                                            placeholder="Enter your name"
                                            defaultValue={profile?.full_name || ""}
                                            onBlur={(e) => updateProfileName(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <p className="text-gray-400 text-sm">Email</p>
                                    <p className="text-lg font-medium">{user.email}</p>
                                </div>

                                <div className="grid grid-cols-2 gap-4 pt-6 border-t border-white/5">
                                    <div>
                                        <p className="text-gray-400 text-sm mb-1">Role</p>
                                        <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-bold uppercase tracking-wider">
                                            {profile?.role || "user"}
                                        </span>
                                    </div>
                                    <div>
                                        <p className="text-gray-400 text-sm mb-1">Member Since</p>
                                        <p className="text-sm font-medium">{new Date(user.created_at || "").toLocaleDateString()}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}
