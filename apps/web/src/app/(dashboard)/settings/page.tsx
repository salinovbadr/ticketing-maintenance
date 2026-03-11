"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { settingsApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Save, Clock, ShieldAlert, Sliders, Bell, Globe, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
    const queryClient = useQueryClient();
    const { data: slaConfigs, isLoading } = useQuery({
        queryKey: ['settings', 'sla'],
        queryFn: () => settingsApi.getSla(),
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: number, data: any }) => settingsApi.updateSla(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['settings', 'sla'] });
            toast.success("SLA updated successfully");
        },
        onError: () => {
            toast.error("Failed to update SLA");
        }
    });

    const [editingSlas, setEditingSlas] = useState<any[]>([]);

    useEffect(() => {
        if (slaConfigs) {
            setEditingSlas(slaConfigs);
        }
    }, [slaConfigs]);

    const handleChange = (id: number, field: string, value: string) => {
        setEditingSlas(prev => prev.map(s =>
            s.id === id ? { ...s, [field]: parseInt(value) || 0 } : s
        ));
    };

    const handleSave = (id: number) => {
        const sla = editingSlas.find(s => s.id === id);
        if (sla) {
            updateMutation.mutate({ id, data: sla });
        }
    };

    if (isLoading) return (
        <div className="flex items-center justify-center p-20">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
    );

    return (
        <div className="space-y-12 max-w-5xl mx-auto pb-20">
            {/* Page Header */}
            <div className="flex bg-white/50 backdrop-blur-sm p-2 rounded-[2rem] shadow-sm border border-white/50 items-center gap-4 px-6 py-4 w-fit">
                <div className="w-12 h-12 bg-indigo-500 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
                    <Sliders className="text-white" size={24} />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-slate-800">System Preferences</h1>
                    <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">Global configuration & SLA targets</p>
                </div>
            </div>

            <div className="grid grid-cols-12 gap-10">
                {/* Sidebar Navigation (Visual Only) */}
                <div className="col-span-12 lg:col-span-3 space-y-2">
                    {[
                        { name: "SLA Targets", icon: Clock, active: true },
                        { name: "Notifications", icon: Bell, active: false },
                        { name: "Integration", icon: Globe, active: false },
                        { name: "Security", icon: Lock, active: false },
                    ].map((item) => (
                        <button
                            key={item.name}
                            className={cn(
                                "w-full flex items-center gap-3 px-6 py-4 rounded-2xl text-sm font-bold transition-all",
                                item.active
                                    ? "bg-white text-blue-600 shadow-sm border border-white/50"
                                    : "text-slate-400 hover:text-slate-600 hover:bg-white/30"
                            )}
                        >
                            <item.icon size={18} />
                            {item.name}
                        </button>
                    ))}
                </div>

                {/* Main Content Area */}
                <div className="col-span-12 lg:col-span-9 space-y-10">
                    {/* SLA Section */}
                    <div className="bg-white rounded-[3rem] p-10 shadow-sm border border-white/50">
                        <div className="mb-10">
                            <h2 className="text-xl font-bold text-slate-800">SLA Configurations</h2>
                            <p className="text-xs text-slate-400 mt-1">Define response and resolution targets for different ticket priorities.</p>
                        </div>

                        <div className="space-y-10">
                            {editingSlas.map((sla) => (
                                <div key={sla.id} className="relative group">
                                    <div className="flex items-center justify-between mb-6">
                                        <div className="flex items-center gap-4">
                                            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shadow-sm",
                                                sla.priority === 'critical' ? 'bg-red-50 text-red-500' :
                                                    sla.priority === 'high' ? 'bg-orange-50 text-orange-500' :
                                                        sla.priority === 'medium' ? 'bg-amber-50 text-amber-500' : 'bg-blue-50 text-blue-500'
                                            )}>
                                                <div className="w-2 h-2 rounded-full bg-current" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-slate-800 tracking-tight">{sla.priority.charAt(0).toUpperCase() + sla.priority.slice(1)} Priority</h3>
                                                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">SLA Targets</p>
                                            </div>
                                        </div>
                                        <Button
                                            className="rounded-xl bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200 gap-2 h-10 px-6 font-bold text-xs"
                                            onClick={() => handleSave(sla.id)}
                                            disabled={updateMutation.isPending}
                                        >
                                            <Save size={14} /> Update
                                        </Button>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                        {[
                                            { label: "Response Target", field: "responseTargetMinutes" },
                                            { label: "Response Max", field: "responseMaxMinutes" },
                                            { label: "Resolution Target", field: "resolutionTargetMinutes" },
                                            { label: "Resolution Max", field: "resolutionMaxMinutes" },
                                        ].map((input) => (
                                            <div key={input.field} className="space-y-2">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-2">{input.label}</label>
                                                <div className="relative">
                                                    <Input
                                                        type="number"
                                                        value={sla[input.field]}
                                                        onChange={(e) => handleChange(sla.id, input.field, e.target.value)}
                                                        className="h-12 bg-slate-50 border-none rounded-xl focus-visible:ring-blue-500/20 font-bold text-slate-700 pl-4"
                                                    />
                                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-300 uppercase">min</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-10 h-px bg-slate-50 last:hidden" />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Safety Section */}
                    <div className="bg-white rounded-[3rem] p-10 shadow-sm border border-white/50">
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center shadow-sm">
                                    <ShieldAlert className="text-red-500" size={24} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-slate-800">System Safety</h2>
                                    <p className="text-xs text-slate-400 mt-1">High-risk operations and maintenance mode</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-red-50/50 rounded-[2rem] p-8 border border-red-100/50 flex items-center justify-between">
                            <div className="max-w-md">
                                <h4 className="font-bold text-red-900">Maintenance Mode</h4>
                                <p className="text-xs text-red-700/70 mt-1 font-medium leading-relaxed">
                                    When enabled, the system will pause all incoming webhooks, AI ticket classifications, and external integrations. Recommended during major updates.
                                </p>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest">Disabled</span>
                                <Switch className="data-[state=checked]:bg-red-500" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
