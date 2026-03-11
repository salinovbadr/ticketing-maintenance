"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
    LayoutDashboard,
    Ticket,
    Settings,
    BarChart3,
    Activity,
    LogOut
} from "lucide-react";

const navItems = [
    { name: "Overview", href: "/", icon: LayoutDashboard },
    { name: "Tickets", href: "/tickets", icon: Ticket },
    { name: "Analytics", href: "/analytics", icon: BarChart3 },
    { name: "Service Health", href: "/health", icon: Activity },
    { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
    const pathname = usePathname();

    return (
        <div className="flex h-screen w-72 flex-col bg-[#1e3a8a] text-white p-6">
            <div className="mb-10 px-2 font-bold text-2xl tracking-tight">
                MetaHome
            </div>

            <nav className="flex-1 space-y-2">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-4 px-4 py-3.5 rounded-2xl text-[15px] font-medium transition-all duration-200",
                                isActive
                                    ? "bg-[#2c467a] shadow-lg shadow-black/10 scale-[1.02]"
                                    : "text-white/60 hover:text-white hover:bg-white/5"
                            )}
                        >
                            <item.icon className={cn("h-5 w-5", isActive ? "text-white" : "text-white/60")} strokeWidth={isActive ? 2.5 : 2} />
                            {item.name}
                        </Link>
                    );
                })}
            </nav>

            <div className="mt-auto pt-6 border-t border-white/10">
                <Link
                    href="/settings"
                    className="flex items-center gap-4 px-4 py-3.5 rounded-2xl text-[15px] font-medium text-white/60 hover:text-white hover:bg-white/5 transition-all"
                >
                    <Settings className="h-5 w-5" />
                    Settings
                </Link>
                <button className="flex w-full items-center gap-4 px-4 py-3.5 rounded-2xl text-[15px] font-medium text-white/60 hover:text-white hover:bg-white/5 transition-all mt-1">
                    <LogOut className="h-5 w-5" />
                    Logout
                </button>
            </div>
        </div>
    );
}
