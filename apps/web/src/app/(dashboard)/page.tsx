"use client";

import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "@/lib/api";
import {
    Ticket,
    CheckCircle2,
    Clock,
    AlertTriangle,
    Activity,
    Wifi,
    Zap,
    Thermometer,
    CloudRain,
    Bell,
    Settings,
    Music,
    Video,
    Lock
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Switch } from "@/components/ui/switch";

export default function OverviewPage() {
    const { data: stats } = useQuery({
        queryKey: ['dashboard-stats'],
        queryFn: dashboardApi.getStats,
    });

    const { data: uptimeData } = useQuery({
        queryKey: ['dashboard-uptime'],
        queryFn: dashboardApi.getUptime,
    });

    const cards = [
        {
            title: "System Status",
            subtitle: "Overall Health",
            value: uptimeData?.percentage >= 99 ? "Operational" : "Degraded",
            icon: CloudRain, // Weather equivalent
            color: "text-blue-500",
            bg: "bg-blue-100/50",
            percentage: uptimeData?.percentage || 0,
            unit: "%"
        },
        {
            title: "Avg Response",
            subtitle: "Team Speed",
            value: "14",
            icon: Thermometer, // Temperature equivalent
            color: "text-orange-500",
            bg: "bg-orange-100/50",
            unit: "mins"
        },
        {
            title: "Network",
            subtitle: "Connected",
            value: "Active",
            icon: Wifi, // Wi-Fi equivalent
            color: "text-green-500",
            bg: "bg-green-100/50",
            detail: "Uptime: 99.9%"
        },
        {
            title: "Urgent Jobs",
            subtitle: "SLA Status",
            value: stats?.slaBreached || "0",
            icon: Zap, // Electricity equivalent
            color: "text-purple-500",
            bg: "bg-purple-100/50",
            detail: "Daily Target"
        },
    ];

    return (
        <div className="grid grid-cols-12 gap-8">
            {/* Top 4 Cards */}
            <div className="col-span-12 lg:col-span-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {cards.map((card) => (
                    <div key={card.title} className="bg-white rounded-[2rem] p-6 shadow-sm border border-white/50 flex flex-col justify-between group cursor-pointer hover:shadow-md transition-all">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <p className="text-xs font-semibold text-slate-400 tracing-wide uppercase">{card.title}</p>
                                <p className="text-[10px] text-slate-300">{card.subtitle}</p>
                            </div>
                            <div className={cn("p-2 rounded-xl", card.bg)}>
                                <card.icon className={card.color} size={18} />
                            </div>
                        </div>
                        <div>
                            <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-bold text-slate-800">{card.value}</span>
                                {card.unit && <span className="text-xs text-slate-400">{card.unit}</span>}
                            </div>
                            {card.detail && <p className="text-[10px] text-slate-400 mt-1">{card.detail}</p>}
                        </div>
                    </div>
                ))}
            </div>

            {/* Main Content Area */}
            <div className="col-span-12 lg:col-span-9 space-y-8">
                {/* Large Featured Card */}
                <div className="relative h-[400px] rounded-[3rem] overflow-hidden group shadow-xl">
                    <img
                        src="https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80&w=2070"
                        alt="Background"
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent" />
                    <div className="absolute bottom-10 left-10 right-10 flex flex-col items-start gap-4">
                        <div>
                            <p className="text-white/80 font-medium text-lg leading-none mb-4">Urgent Maintenance Required</p>
                            <h2 className="text-4xl font-bold text-white mb-2 tracking-tight">CCTV System Down in Block A</h2>
                            <p className="text-white/60 max-w-2xl text-sm leading-relaxed">
                                Identified 2 hours ago. Team is currently on site investigating the power supply unit. Estimated resolution in 45 minutes.
                            </p>
                        </div>
                        <button className="bg-white text-slate-900 px-8 py-3 rounded-2xl font-bold text-sm hover:bg-slate-100 transition-colors mt-4">
                            View Details
                        </button>
                    </div>
                </div>

                {/* Secondary Cards Grid */}
                <div className="grid grid-cols-2 gap-8">
                    <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-white/50">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-slate-800 text-lg">System Activity</h3>
                            <div className="flex gap-2">
                                <span className="text-[10px] bg-slate-100 px-3 py-1 rounded-full text-slate-500 font-bold uppercase tracking-wider">Daily</span>
                                <span className="text-[10px] border px-3 py-1 rounded-full text-slate-300 font-bold uppercase tracking-wider">Weekly</span>
                            </div>
                        </div>
                        <div className="h-24 flex items-end gap-1 px-2">
                            {Array.from({ length: 24 }).map((_, i) => (
                                <div
                                    key={i}
                                    className="flex-1 bg-slate-100 rounded-full hover:bg-blue-500 transition-colors cursor-pointer"
                                    style={{ height: `${Math.random() * 80 + 20}%` }}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-white/50 flex flex-col justify-center items-center text-center">
                        <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                            <Activity className="text-blue-500" size={32} />
                        </div>
                        <h3 className="font-bold text-slate-800">All Systems Normal</h3>
                        <p className="text-xs text-slate-400 mt-2">No critical issues detected in the last 24 hours. Great job!</p>
                    </div>
                </div>
            </div>

            {/* Right Panel */}
            <div className="col-span-12 lg:col-span-3 space-y-8">
                {/* Notifications Panel */}
                <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-white/50">
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="font-bold text-slate-800">Notifications</h3>
                        <Bell size={18} className="text-slate-400" />
                    </div>
                    <div className="space-y-6">
                        {[
                            { color: "bg-red-500", text: "New breach detected in Server #1", time: "2 min ago" },
                            { color: "bg-green-500", text: "Maintenance complete: Block B", time: "15 min ago" },
                            { color: "bg-blue-500", text: "SLA target updated for Tier 1", time: "1 hour ago" },
                        ].map((notif, i) => (
                            <div key={i} className="flex gap-4">
                                <div className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", notif.color)} />
                                <div className="space-y-1">
                                    <p className="text-xs font-medium text-slate-700 leading-tight">{notif.text}</p>
                                    <p className="text-[10px] text-slate-400">{notif.time}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Quick actions panel */}
                <div className="bg-white rounded-[3rem] p-8 shadow-sm border border-white/50 space-y-8">
                    <h3 className="font-bold text-slate-800">Quick Actions</h3>
                    <div className="space-y-6">
                        {[
                            { icon: Music, label: "Report Issue", checked: true },
                            { icon: Video, label: "Live Feed", checked: false },
                            { icon: Lock, label: "Security Lock", checked: true },
                            { icon: Settings, label: "Auto Guard", checked: true },
                        ].map((item, i) => (
                            <div key={i} className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="p-2 border rounded-xl text-slate-400">
                                        <item.icon size={16} />
                                    </div>
                                    <span className="text-sm font-medium text-slate-600">{item.label}</span>
                                </div>
                                <Switch checked={item.checked} />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
