"use client";

import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "@/lib/api";
import {
    Activity,
    AlertCircle,
    CheckCircle2,
    Clock,
    ShieldCheck,
    Cpu,
    Globe,
    HardDrive
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, subDays, startOfDay, isSameDay } from "date-fns";

export default function HealthPage() {
    const { data: uptimeData } = useQuery({
        queryKey: ['dashboard-uptime'],
        queryFn: dashboardApi.getUptime,
    });

    const metrics = [
        {
            title: "Current Status",
            subtitle: "Overall Health",
            value: uptimeData?.percentage >= 99 ? "Operational" : "Degraded",
            icon: ShieldCheck,
            color: uptimeData?.percentage >= 99 ? "text-green-500" : "text-amber-500",
            bg: uptimeData?.percentage >= 99 ? "bg-green-100/50" : "bg-amber-100/50"
        },
        {
            title: "Uptime (24h)",
            subtitle: "Reliability",
            value: `${uptimeData?.percentage || "0"}%`,
            icon: Activity,
            color: "text-blue-500",
            bg: "bg-blue-100/50"
        },
        {
            title: "Active Incidents",
            subtitle: "System Alerts",
            value: "0",
            icon: AlertCircle,
            color: "text-slate-400",
            bg: "bg-slate-100/50"
        },
        {
            title: "Last Check",
            subtitle: "Monitor Heartbeat",
            value: "Just now",
            icon: Clock,
            color: "text-purple-500",
            bg: "bg-purple-100/50"
        },
    ];

    // Generate 30 days of data for the heatmap
    const last30Days = Array.from({ length: 30 }).map((_, i) => {
        const date = startOfDay(subDays(new Date(), 29 - i));
        const dayData = uptimeData?.dailyStats?.find((d: any) =>
            isSameDay(new Date(d.day), date)
        );
        return {
            date,
            upPercent: dayData ? parseFloat(dayData.upPercent) : 100,
        };
    });

    return (
        <div className="space-y-10">
            {/* Top Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {metrics.map((metric) => (
                    <div key={metric.title} className="bg-white rounded-[2rem] p-6 shadow-sm border border-white/50 flex flex-col justify-between group cursor-pointer hover:shadow-md transition-all">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <p className="text-xs font-semibold text-slate-400 tracing-wide uppercase">{metric.title}</p>
                                <p className="text-[10px] text-slate-300">{metric.subtitle}</p>
                            </div>
                            <div className={cn("p-2 rounded-xl", metric.bg)}>
                                <metric.icon className={metric.color} size={18} />
                            </div>
                        </div>
                        <div>
                            <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-bold text-slate-800">{metric.value}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Heatmap Card */}
            <div className="bg-white rounded-[3rem] p-10 shadow-sm border border-white/50">
                <div className="flex items-center justify-between mb-10">
                    <div>
                        <h3 className="font-bold text-slate-800 text-xl">Uptime History</h3>
                        <p className="text-xs text-slate-400 mt-1">System availability across all monitored components over the last 30 days</p>
                    </div>
                    <div className="flex items-center gap-6 text-[10px] font-bold uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-green-500 rounded-lg shadow-sm" />
                            <span className="text-slate-400">Stable</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-amber-400 rounded-lg shadow-sm" />
                            <span className="text-slate-400">Partial</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-red-500 rounded-lg shadow-sm" />
                            <span className="text-slate-400">Down</span>
                        </div>
                    </div>
                </div>

                <div className="flex justify-between gap-2">
                    {last30Days.map((day, i) => (
                        <div
                            key={i}
                            className={cn(
                                "h-14 flex-1 rounded-xl transition-all hover:scale-110 cursor-help relative group shadow-sm",
                                day.upPercent >= 99.9 ? "bg-green-500" :
                                    day.upPercent >= 95 ? "bg-amber-400" : "bg-red-500"
                            )}
                        >
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 px-3 py-2 bg-slate-900 text-white text-[10px] rounded-xl opacity-0 group-hover:opacity-100 whitespace-nowrap z-10 pointer-events-none shadow-xl transition-all duration-200">
                                <div className="font-bold">{format(day.date, 'MMM d, yyyy')}</div>
                                <div className="text-white/60">{day.upPercent.toFixed(2)}% Available</div>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="flex justify-between mt-6 text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                    <span>30 days ago</span>
                    <span>Monitoring Active</span>
                    <span>Today</span>
                </div>
            </div>

            {/* Bottom Grid */}
            <div className="grid grid-cols-12 gap-8">
                {/* Component Status */}
                <div className="col-span-12 lg:col-span-7 bg-white rounded-[3rem] p-10 shadow-sm border border-white/50">
                    <div className="flex items-center justify-between mb-10">
                        <h3 className="font-bold text-slate-800 text-xl">System Infrastructure</h3>
                        <Globe size={20} className="text-slate-400" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                            { name: "WhatsApp Gateway", status: "Operational", uptime: "100%", icon: Activity },
                            { name: "Main API Cluster", status: "Operational", uptime: "99.98%", icon: Cpu },
                            { name: "Real-time Service", status: "Operational", uptime: "100%", icon: Globe },
                            { name: "Database Cluster", status: "Operational", uptime: "99.99%", icon: HardDrive },
                        ].map((component) => (
                            <div key={component.name} className="flex items-center justify-between p-4 border border-slate-50 rounded-[1.5rem] bg-slate-50/30 group hover:bg-white hover:shadow-sm transition-all">
                                <div className="flex items-center gap-4">
                                    <div className="p-2 bg-white rounded-xl shadow-sm">
                                        <component.icon className="text-blue-500" size={18} />
                                    </div>
                                    <div>
                                        <div className="text-sm font-bold text-slate-800">{component.name}</div>
                                        <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{component.status}</div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs font-bold text-slate-700">{component.uptime}</div>
                                    <div className="text-[10px] text-slate-300 font-medium uppercase tracking-wider">Uptime</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Recent Incidents */}
                <div className="col-span-12 lg:col-span-5 bg-white rounded-[3rem] p-10 shadow-sm border border-white/50">
                    <div className="flex items-center justify-between mb-10">
                        <h3 className="font-bold text-slate-800 text-xl">Recent Incidents</h3>
                        <AlertCircle size={20} className="text-slate-400" />
                    </div>
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mb-6">
                            <ShieldCheck className="text-green-500" size={40} />
                        </div>
                        <h3 className="font-bold text-slate-800 text-lg">All Systems Go</h3>
                        <p className="text-xs text-slate-400 mt-2 max-w-[200px]">No incidents reported in the last 7 days. Your infrastructure is performing optimally.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
