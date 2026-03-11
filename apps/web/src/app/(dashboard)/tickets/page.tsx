"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ticketsApi } from "@/lib/api";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { formatDistanceToNow } from "date-fns";
import {
    Search,
    Filter,
    ExternalLink,
    Plus,
    FileDown,
    RefreshCw
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const statusColors: Record<string, string> = {
    open: "bg-red-100/50 text-red-600 border-red-200",
    acknowledged: "bg-orange-100/50 text-orange-600 border-orange-200",
    resolved: "bg-green-100/50 text-green-600 border-green-200",
    closed: "bg-slate-100/50 text-slate-600 border-slate-200",
};

const priorityColors: Record<string, string> = {
    low: "bg-blue-50 text-blue-500 border-blue-100",
    medium: "bg-amber-50 text-amber-500 border-amber-100",
    high: "bg-orange-50 text-orange-500 border-orange-100",
    critical: "bg-red-500 text-white border-red-600",
};

export default function TicketsPage() {
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState<string>("all");
    const [priority, setPriority] = useState<string>("all");

    const { data: tickets, isLoading, refetch } = useQuery({
        queryKey: ['tickets', { search, status, priority }],
        queryFn: () => ticketsApi.list({
            search: search || undefined,
            status: status === 'all' ? undefined : status,
            priority: priority === 'all' ? undefined : priority
        }),
    });

    return (
        <div className="space-y-10">
            {/* Header with Actions */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex bg-white/50 backdrop-blur-sm p-2 rounded-[2rem] shadow-sm border border-white/50 items-center gap-4 px-6 py-4">
                    <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
                        <Filter className="text-white" size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-800">Support Center</h1>
                        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">Manage maintenance requests</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Button variant="outline" className="rounded-2xl border-white bg-white/50 shadow-sm hover:bg-white px-6 h-12 text-slate-600 gap-2 font-bold text-xs">
                        <FileDown size={16} /> Export
                    </Button>
                    <Button className="rounded-2xl bg-blue-600 shadow-lg shadow-blue-200 hover:bg-blue-700 px-8 h-12 gap-2 font-bold text-xs">
                        <Plus size={16} /> New Ticket
                    </Button>
                </div>
            </div>

            {/* Filters Row */}
            <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-white/50 flex flex-col lg:flex-row gap-6 items-center">
                <div className="w-full lg:flex-1 relative">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                    <Input
                        placeholder="Quick search tickets..."
                        className="pl-14 h-14 bg-slate-50 border-none rounded-[1.5rem] focus-visible:ring-blue-500/20 text-sm font-medium"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-4 w-full lg:w-auto">
                    <Select value={status} onValueChange={setStatus}>
                        <SelectTrigger className="h-14 w-full lg:w-[180px] bg-slate-50 border-none rounded-[1.5rem] px-6 text-sm font-medium text-slate-600">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-slate-100">
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="open">Open</SelectItem>
                            <SelectItem value="acknowledged">Acknowledged</SelectItem>
                            <SelectItem value="resolved">Resolved</SelectItem>
                            <SelectItem value="closed">Closed</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={priority} onValueChange={setPriority}>
                        <SelectTrigger className="h-14 w-full lg:w-[180px] bg-slate-50 border-none rounded-[1.5rem] px-6 text-sm font-medium text-slate-600">
                            <SelectValue placeholder="Priority" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-slate-100">
                            <SelectItem value="all">All Priority</SelectItem>
                            <SelectItem value="critical">Critical</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="low">Low</SelectItem>
                        </SelectContent>
                    </Select>

                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-14 w-14 rounded-[1.5rem] bg-slate-50 hover:bg-slate-100 shrink-0"
                        onClick={() => {
                            setSearch("");
                            setStatus("all");
                            setPriority("all");
                            refetch();
                        }}
                    >
                        <RefreshCw className="h-4 w-4 text-slate-400" />
                    </Button>
                </div>
            </div>

            {/* Table Card */}
            <div className="bg-white rounded-[3rem] shadow-sm border border-white/50 overflow-hidden">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-slate-50 hover:bg-transparent">
                                <TableHead className="py-8 px-10 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ticket ID</TableHead>
                                <TableHead className="py-8 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Subject</TableHead>
                                <TableHead className="py-8 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</TableHead>
                                <TableHead className="py-8 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Priority</TableHead>
                                <TableHead className="py-8 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Reported</TableHead>
                                <TableHead className="py-8 px-10 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Details</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i} className="border-slate-50">
                                        <TableCell colSpan={6} className="h-20 px-10">
                                            <div className="h-full w-full bg-slate-50 animate-pulse rounded-2xl" />
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : tickets?.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-64 text-center">
                                        <div className="flex flex-col items-center justify-center">
                                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                                <Search className="text-slate-200" size={32} />
                                            </div>
                                            <p className="text-sm font-bold text-slate-400">No tickets matching your criteria</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                tickets?.map((ticket: any) => (
                                    <TableRow key={ticket.id} className="border-slate-50 hover:bg-slate-50/30 transition-all group">
                                        <TableCell className="py-6 px-10">
                                            <span className="text-xs font-bold text-blue-500 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">
                                                #{ticket.ticketNumber}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <div className="max-w-[320px]">
                                                <p className="text-sm font-bold text-slate-800 truncate">{ticket.subject}</p>
                                                <p className="text-[10px] text-slate-400 font-medium uppercase mt-1">{ticket.category}</p>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={cn("rounded-lg px-3 py-1 text-[10px] font-bold uppercase tracking-wider border", statusColors[ticket.status])}>
                                                {ticket.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={cn("rounded-lg px-3 py-1 text-[10px] font-bold uppercase tracking-wider border", priorityColors[ticket.priority])}>
                                                {ticket.priority}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-xs font-bold text-slate-500">
                                            {formatDistanceToNow(new Date(ticket.reportedAt), { addSuffix: true })}
                                        </TableCell>
                                        <TableCell className="text-right px-10">
                                            <Link href={`/tickets/${ticket.id}`}>
                                                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl bg-slate-50 group-hover:bg-blue-500 group-hover:text-white transition-all overflow-hidden group-hover:shadow-lg group-hover:shadow-blue-200">
                                                    <ExternalLink className="h-4 w-4" />
                                                </Button>
                                            </Link>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
                {/* Pagination Placeholder */}
                <div className="px-10 py-8 border-t border-slate-50 flex items-center justify-between">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Showing <span className="text-slate-800">{tickets?.length || 0}</span> Results
                    </p>
                    <div className="flex gap-2">
                        <Button disabled variant="outline" className="rounded-xl border-slate-100 h-9 px-4 text-[10px] font-bold uppercase tracking-wider">Previous</Button>
                        <Button disabled variant="outline" className="rounded-xl border-slate-100 h-9 px-4 text-[10px] font-bold uppercase tracking-wider">Next</Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
