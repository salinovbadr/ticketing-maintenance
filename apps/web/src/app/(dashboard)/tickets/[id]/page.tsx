"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ticketsApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import {
    ArrowLeft,
    Send,
    User,
    Clock,
    CheckCircle2,
    AlertCircle,
    MoreVertical
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SLACountdown } from "@/components/sla-countdown";

export default function TicketDetailPage() {
    const { id } = useParams();
    const queryClient = useQueryClient();
    const [replyText, setReplyText] = useState("");

    const { data: ticket, isLoading } = useQuery({
        queryKey: ['ticket', id],
        queryFn: () => ticketsApi.get(id as string),
    });

    const updateMutation = useMutation({
        mutationFn: (data: any) => ticketsApi.update(id as string, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ticket', id] });
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
        },
    });

    const handleStatusChange = (status: string) => {
        updateMutation.mutate({ status });
    };

    const handleAssigneeChange = (assignedTo: number) => {
        updateMutation.mutate({ assignedTo });
    };

    if (isLoading) return <div className="p-8">Loading ticket details...</div>;
    if (!ticket) return <div className="p-8">Ticket not found.</div>;

    return (
        <div className="flex flex-col h-[calc(100vh-8rem)]">
            <div className="mb-6">
                <div className="flex items-center gap-4 mb-2">
                    <Link href="/tickets">
                        <Button variant="ghost" size="icon" className="hover:bg-slate-100 rounded-full">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div className="flex gap-2">
                        <SLACountdown
                            reportedAt={ticket.reportedAt}
                            targetMinutes={ticket.slaResponseTargetMinutes}
                            isBreached={ticket.slaResponseBreached}
                            type="Response"
                        />
                        <SLACountdown
                            reportedAt={ticket.reportedAt}
                            targetMinutes={ticket.slaResolutionTargetMinutes}
                            isBreached={ticket.slaResolutionBreached}
                            type="Resolution"
                        />
                    </div>
                </div>

                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                        {ticket.ticketNumber}: {ticket.subject}
                    </h1>
                    <div className="flex gap-2 items-center">
                        <Badge variant="outline" className="bg-slate-100">{ticket.category}</Badge>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className={cn(
                                    "h-7 capitalize",
                                    ticket.status === 'open' ? "bg-red-50 text-red-700 border-red-200" : "bg-green-50 text-green-700 border-green-200"
                                )}>
                                    {ticket.status}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Change Status</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleStatusChange('open')}>Open</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleStatusChange('acknowledged')}>Acknowledged</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleStatusChange('resolved')}>Resolved</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleStatusChange('closed')}>Closed</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-6 flex-1 overflow-hidden">
                {/* Messages / Conversation Area */}
                <div className="col-span-2 flex flex-col bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                        {ticket.messages?.map((msg: any) => (
                            <div
                                key={msg.id}
                                className={cn(
                                    "flex flex-col max-w-[80%]",
                                    msg.isFromTeam ? "ml-auto items-end" : "mr-auto items-start"
                                )}
                            >
                                <div className="flex items-center gap-2 mb-1 px-1">
                                    <span className="text-xs font-semibold text-slate-500">{msg.senderName}</span>
                                    <span className="text-[10px] text-slate-400">
                                        {format(new Date(msg.createdAt), 'HH:mm')}
                                    </span>
                                </div>
                                <div
                                    className={cn(
                                        "rounded-2xl px-4 py-2 text-sm shadow-sm",
                                        msg.isFromTeam
                                            ? "bg-blue-600 text-white rounded-tr-none"
                                            : "bg-slate-100 text-slate-800 rounded-tl-none"
                                    )}
                                >
                                    {msg.messageText}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="p-4 border-t border-slate-100">
                        <form
                            className="flex gap-2"
                            onSubmit={(e) => {
                                e.preventDefault();
                                alert("Manual response sending would be implemented here.");
                                setReplyText("");
                            }}
                        >
                            <input
                                type="text"
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                placeholder="Type a manual response/note..."
                                className="flex-1 bg-slate-50 border-none rounded-lg px-4 py-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                            />
                            <Button size="icon" disabled={!replyText.trim()}>
                                <Send className="h-4 w-4" />
                            </Button>
                        </form>
                    </div>
                </div>

                {/* Sidebar Info Area */}
                <div className="space-y-6">
                    <Card className="border-none shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-sm font-medium">Ticket Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500">Priority</span>
                                <Badge className="bg-orange-100 text-orange-700">{ticket.priority}</Badge>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500">Assignee</span>
                                <div className="flex items-center gap-2">
                                    <User size={14} className="text-slate-400" />
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="sm" className="h-7 px-2 font-normal">
                                                {ticket.assignedTo || 'Unassigned'}
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuLabel>Assign To</DropdownMenuLabel>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem onClick={() => handleAssigneeChange(1)}>Admin User</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleAssigneeChange(2)}>Maintenance Team</DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500">Reported</span>
                                <span>{format(new Date(ticket.reportedAt), 'MMM dd, HH:mm')}</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-sm pb-2">
                        <CardHeader>
                            <CardTitle className="text-sm font-medium">SLA Tracking</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <div className="flex justify-between text-[10px] text-slate-500 font-bold uppercase">
                                    <span>Response Time</span>
                                </div>
                                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <div className={cn("h-full", ticket.slaResponseBreached ? "bg-red-500" : "bg-green-500")} style={{ width: '100%' }} />
                                </div>
                                <SLACountdown
                                    reportedAt={ticket.reportedAt}
                                    targetMinutes={ticket.slaResponseTargetMinutes}
                                    isBreached={ticket.slaResponseBreached}
                                    type="Response"
                                />
                            </div>

                            <div className="space-y-2 pt-2 border-t border-slate-50">
                                <div className="flex justify-between text-[10px] text-slate-500 font-bold uppercase">
                                    <span>Resolution Time</span>
                                </div>
                                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <div className={cn("h-full", ticket.slaResolutionBreached ? "bg-red-500" : "bg-green-500")} style={{ width: '80%' }} />
                                </div>
                                <SLACountdown
                                    reportedAt={ticket.reportedAt}
                                    targetMinutes={ticket.slaResolutionTargetMinutes}
                                    isBreached={ticket.slaResolutionBreached}
                                    type="Resolution"
                                />
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
