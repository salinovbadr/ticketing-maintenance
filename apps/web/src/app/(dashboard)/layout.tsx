import { Sidebar } from "@/components/layout/sidebar";
import { RealtimeProvider } from "@/components/realtime-provider";
import { Bell, Search, User, LogOut, ChevronDown } from "lucide-react";
import { format } from "date-fns";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const now = new Date();

    return (
        <RealtimeProvider>
            <div className="flex h-screen overflow-hidden bg-[#eef2f7]">
                <Sidebar />
                <div className="flex flex-1 flex-col overflow-hidden">
                    {/* Header */}
                    <header className="flex h-20 items-center justify-between px-10 bg-transparent">
                        <div className="flex items-center gap-12">
                            <div className="flex flex-col">
                                <span className="text-sm font-bold text-slate-800">
                                    {format(now, "HH:mm:ss bb")}
                                </span>
                                <span className="text-xs text-slate-400">
                                    {format(now, "EEEE, d MMMM, yyyy")}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-8">
                            <button className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
                                Customize Dashboard
                            </button>

                            <div className="flex items-center gap-4 border-l pl-8 border-slate-200">
                                <div className="flex items-center gap-2 cursor-pointer group">
                                    <ChevronDown size={14} className="text-slate-400 group-hover:text-slate-600 transition-colors" />
                                    <span className="text-sm font-medium text-slate-700">Hello Iman</span>
                                    <div className="w-10 h-10 rounded-full bg-slate-300 overflow-hidden ring-2 ring-white shadow-sm">
                                        <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Iman" alt="User" className="w-full h-full object-cover" />
                                    </div>
                                </div>
                                <button className="p-2 text-slate-400 hover:text-red-500 transition-colors">
                                    <LogOut size={20} />
                                </button>
                            </div>
                        </div>
                    </header>

                    <main className="flex-1 overflow-y-auto px-10 pb-10">
                        {children}
                    </main>
                </div>
            </div>
        </RealtimeProvider>
    );
}
