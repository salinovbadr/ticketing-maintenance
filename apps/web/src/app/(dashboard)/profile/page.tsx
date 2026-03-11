"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usersApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { User, Phone, Mail, Shield, Camera, Calendar, Hash } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ProfilePage() {
    const queryClient = useQueryClient();
    const { data: user, isLoading } = useQuery({
        queryKey: ['profile'],
        queryFn: () => usersApi.getMe(),
    });

    const updateProfile = useMutation({
        mutationFn: (data: any) => usersApi.updateMe(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['profile'] });
            toast.success("Profile updated");
        }
    });

    const [formData, setFormData] = useState({
        name: "",
        phone: "",
    });

    useEffect(() => {
        if (user) {
            setFormData({
                name: user.name || "",
                phone: user.phone || "",
            });
        }
    }, [user]);

    if (isLoading) return (
        <div className="flex items-center justify-center p-20">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
    );

    return (
        <div className="space-y-12 max-w-4xl mx-auto pb-20">
            {/* Page Header */}
            <div className="flex bg-white/50 backdrop-blur-sm p-2 rounded-[2rem] shadow-sm border border-white/50 items-center gap-4 px-6 py-4 w-fit">
                <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
                    <User className="text-white" size={24} />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-slate-800">My Account</h1>
                    <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">Personal information & identity</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
                {/* Profile Card */}
                <div className="md:col-span-4 space-y-6">
                    <div className="bg-white rounded-[3rem] p-10 shadow-sm border border-white/50 flex flex-col items-center text-center">
                        <div className="relative mb-6">
                            <div className="w-32 h-32 rounded-full bg-slate-50 border-4 border-white shadow-xl flex items-center justify-center overflow-hidden">
                                <User size={64} className="text-slate-200" />
                            </div>
                            <button className="absolute bottom-0 right-0 w-10 h-10 bg-blue-600 rounded-full border-4 border-white shadow-lg flex items-center justify-center text-white hover:bg-blue-700 transition-colors">
                                <Camera size={16} />
                            </button>
                        </div>
                        <h2 className="text-xl font-bold text-slate-800">{user?.name}</h2>
                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-[10px] font-bold uppercase tracking-wider mt-2 border border-blue-100">
                            {user?.role}
                        </span>

                        <div className="w-full mt-10 pt-10 border-t border-slate-50 space-y-4">
                            <div className="flex items-center justify-between text-left">
                                <div className="flex items-center gap-3">
                                    <Calendar size={14} className="text-slate-300" />
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Joined</span>
                                </div>
                                <span className="text-xs font-bold text-slate-700">
                                    {new Date(user?.createdAt).toLocaleDateString()}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Edit Form */}
                <div className="md:col-span-8 bg-white rounded-[3rem] p-10 shadow-sm border border-white/50">
                    <div className="mb-10">
                        <h3 className="text-lg font-bold text-slate-800">Account Details</h3>
                        <p className="text-xs text-slate-400 mt-1">Update your basic information to stay connected.</p>
                    </div>

                    <div className="space-y-8">
                        <div className="grid grid-cols-1 gap-8">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-2">Display Name</label>
                                <div className="relative">
                                    <User className="absolute left-6 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                                    <Input
                                        className="pl-14 h-14 bg-slate-50 border-none rounded-[1.5rem] focus-visible:ring-blue-500/20 text-sm font-bold text-slate-700 shadow-inner"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="Full Name"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-2">WhatsApp JID</label>
                                <div className="relative">
                                    <Hash className="absolute left-6 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                                    <Input
                                        className="pl-14 h-14 bg-slate-100 border-none rounded-[1.5rem] text-sm font-bold text-slate-500 cursor-not-allowed"
                                        value={user?.whatsappJid}
                                        disabled
                                    />
                                </div>
                                <p className="text-[10px] text-slate-400 pl-2">Your unique WhatsApp identifier (read-only).</p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-2">Phone Number</label>
                                <div className="relative">
                                    <Phone className="absolute left-6 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                                    <Input
                                        className="pl-14 h-14 bg-slate-50 border-none rounded-[1.5rem] focus-visible:ring-blue-500/20 text-sm font-bold text-slate-700 shadow-inner"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        placeholder="0812..."
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-2">Access Role</label>
                                <div className="relative">
                                    <Shield className="absolute left-6 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                                    <Input
                                        className="pl-14 h-14 bg-slate-100 border-none rounded-[1.5rem] text-sm font-bold text-slate-500 capitalize cursor-not-allowed"
                                        value={user?.role}
                                        disabled
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="pt-6">
                            <Button
                                className="w-full h-14 rounded-[1.5rem] bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-200 font-bold transition-all text-sm"
                                onClick={() => updateProfile.mutate(formData)}
                                disabled={updateProfile.isPending}
                            >
                                {updateProfile.isPending ? "Updating..." : "Save Profile Changes"}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
