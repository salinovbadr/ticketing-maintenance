"use client";

import { useEffect, useState } from "react";
import { formatDistanceToNow, addMinutes, isBefore } from "date-fns";
import { cn } from "@/lib/utils";
import { Clock } from "lucide-react";

interface SLACountdownProps {
    reportedAt: string;
    targetMinutes: number;
    isBreached: boolean;
    type: "Response" | "Resolution";
}

export function SLACountdown({ reportedAt, targetMinutes, isBreached, type }: SLACountdownProps) {
    const [timeLeft, setTimeLeft] = useState<string>("");
    const targetDate = addMinutes(new Date(reportedAt), targetMinutes);

    useEffect(() => {
        const updateTime = () => {
            if (isBreached) {
                setTimeLeft("Breached");
                return;
            }

            const now = new Date();
            if (isBefore(targetDate, now)) {
                setTimeLeft("Breached");
                return;
            }

            setTimeLeft(formatDistanceToNow(targetDate, { addSuffix: false }));
        };

        updateTime();
        const interval = setInterval(updateTime, 60000);
        return () => clearInterval(interval);
    }, [reportedAt, targetMinutes, isBreached, targetDate]);

    return (
        <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider">
            <Clock size={10} className={cn(isBreached ? "text-red-500" : "text-slate-400")} />
            <span className="text-slate-500">{type}:</span>
            <span className={cn(
                isBreached ? "text-red-600 font-bold" : "text-blue-600"
            )}>
                {timeLeft}
            </span>
        </div>
    );
}
