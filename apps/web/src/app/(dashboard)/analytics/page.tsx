"use client";

import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "@/lib/api";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell
} from "recharts";
import { UserCheck, Zap, Target, Award, TrendingUp, Users, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function AnalyticsPage() {
    const { data: performance } = useQuery({
        queryKey: ['team-performance'],
        queryFn: dashboardApi.getTeamPerformance,
    });

    const metrics = [
        {
            title: "Avg Response",
            subtitle: "Team Speed",
            value: "18m",
            target: "Target: 30m",
            icon: Zap,
            color: "text-blue-500",
            bg: "bg-blue-100/50"
        },
        {
            title: "System Uptime",
            subtitle: "Overall Health",
            value: "99.9%",
            target: "Target: 99.5%",
            icon: Target,
            color: "text-green-500",
            bg: "bg-green-100/50"
        },
        {
            title: "Resolved Today",
            subtitle: "Team Efficiency",
            value: "12 / 15",
            target: "Efficiency: 80%",
            icon: UserCheck,
            color: "text-indigo-500",
            bg: "bg-indigo-100/50"
        },
        {
            title: "SLA Compliance",
            subtitle: "Quality Score",
            value: "94.2%",
            target: "Top Tier",
            icon: Award,
            color: "text-purple-500",
            bg: "bg-purple-100/50"
        }
    ];

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
                            <p className="text-[10px] text-slate-400 mt-1">{metric.target}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Main Charts Grid */}
            <div className="grid grid-cols-12 gap-8">
                <div className="col-span-12 lg:col-span-8 bg-white rounded-[3rem] p-10 shadow-sm border border-white/50">
                    <div className="flex justify-between items-center mb-10">
                        <div>
                            <h3 className="font-bold text-slate-800 text-xl">Workload Distribution</h3>
                            <p className="text-xs text-slate-400 mt-1">Total tickets handled per staff member</p>
                        </div>
                        <div className="flex bg-slate-50 p-1 rounded-2xl">
                            <button className="px-6 py-2 text-xs font-bold bg-white rounded-xl shadow-sm text-slate-800">Count</button>
                            <button className="px-6 py-2 text-xs font-bold text-slate-400">Percentage</button>
                        </div>
                    </div>
                    <div className="h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={performance}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickMargin={10} />
                                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                                <Tooltip
                                    cursor={{ fill: '#f8fafc' }}
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar dataKey="totalHandled" name="Tickets" radius={[12, 12, 0, 0]} barSize={40}>
                                    {performance?.map((_: any, index: number) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="col-span-12 lg:col-span-4 bg-white rounded-[3rem] p-10 shadow-sm border border-white/50">
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="font-bold text-slate-800 text-xl">Leaderboard</h3>
                        <Users size={20} className="text-slate-400" />
                    </div>
                    <div className="space-y-6">
                        {performance?.sort((a: any, b: any) => b.slaCompliance - a.slaCompliance).map((p: any, i: number) => (
                            <div key={p.userId} className="flex items-center justify-between group px-2 py-1 hover:bg-slate-50 rounded-2xl transition-all cursor-pointer">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 text-sm">
                                        {i + 1}
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-800">{p.name}</p>
                                        <p className="text-[10px] text-slate-400 flex items-center gap-1">
                                            <Clock size={10} /> {Math.round(p.avgResolutionMinutes || 0)}m response
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className={cn("text-sm font-bold", p.slaCompliance >= 90 ? "text-green-500" : "text-amber-500")}>
                                        {parseFloat(p.slaCompliance).toFixed(1)}%
                                    </p>
                                    <p className="text-[10px] text-slate-300 font-medium uppercase tracing-wider">SLA</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
