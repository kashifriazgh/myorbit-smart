"use client";

import React, { useState, useRef, useEffect } from "react";

interface TimePickerProps {
    value: Date | null;
    onChange: (date: Date) => void;
    className?: string;
    isDark?: boolean;
}

// Generate static arrays for hours (1-12), minutes (00-59), and AM/PM outside the component to prevent recreating them on every render
const HOURS_LIST = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
const MINUTES_LIST = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));
const AMPMS_LIST = ["AM", "PM"];

export default function TimePicker({ value, onChange, className = "", isDark = false }: TimePickerProps) {
    const hourRef = useRef<HTMLDivElement>(null);
    const minuteRef = useRef<HTMLDivElement>(null);
    const ampmRef = useRef<HTMLDivElement>(null);

    // Track the active scroll states
    const [selectedHour, setSelectedHour] = useState("12");
    const [selectedMinute, setSelectedMinute] = useState("00");
    const [selectedAmPm, setSelectedAmPm] = useState("AM");

    // Extract time components from Date value
    const getTimeFromDate = (date: Date) => {
        let h = date.getHours();
        const m = String(date.getMinutes()).padStart(2, "0");
        const ampm = h >= 12 ? "PM" : "AM";
        h = h % 12;
        h = h ? h : 12; // convert 0 to 12
        const hourStr = String(h).padStart(2, "0");
        return { hourStr, minuteStr: m, ampmStr: ampm };
    };

    // Initialize/Sync internal state from prop
    useEffect(() => {
        const activeDate = value || new Date();
        const { hourStr, minuteStr, ampmStr } = getTimeFromDate(activeDate);
        setSelectedHour(hourStr);
        setSelectedMinute(minuteStr);
        setSelectedAmPm(ampmStr);

        // Center scroll positions after state update
        const timer = setTimeout(() => {
            const itemHeight = 40;
            if (hourRef.current) {
                const hIndex = HOURS_LIST.indexOf(hourStr);
                if (hIndex !== -1) hourRef.current.scrollTop = hIndex * itemHeight;
            }
            if (minuteRef.current) {
                const mIndex = MINUTES_LIST.indexOf(minuteStr);
                if (mIndex !== -1) minuteRef.current.scrollTop = mIndex * itemHeight;
            }
            if (ampmRef.current) {
                const aIndex = AMPMS_LIST.indexOf(ampmStr);
                if (aIndex !== -1) ampmRef.current.scrollTop = aIndex * itemHeight;
            }
        }, 50);

        return () => clearTimeout(timer);
    }, [value]);

    // Handle scroll snap selection
    const handleScroll = (
        e: React.UIEvent<HTMLDivElement>,
        type: "hour" | "minute" | "ampm"
    ) => {
        const container = e.currentTarget;
        const itemHeight = 40;
        const scrollTop = container.scrollTop;

        // Calculate active index
        const index = Math.round(scrollTop / itemHeight);
        let currentH = selectedHour;
        let currentM = selectedMinute;
        let currentAP = selectedAmPm;

        if (type === "hour" && index >= 0 && index < HOURS_LIST.length) {
            const nextH = HOURS_LIST[index];
            if (nextH !== selectedHour) {
                currentH = nextH;
                setSelectedHour(nextH);
                triggerChange(nextH, currentM, currentAP);
            }
        } else if (type === "minute" && index >= 0 && index < MINUTES_LIST.length) {
            const nextM = MINUTES_LIST[index];
            if (nextM !== selectedMinute) {
                currentM = nextM;
                setSelectedMinute(nextM);
                triggerChange(currentH, nextM, currentAP);
            }
        } else if (type === "ampm" && index >= 0 && index < AMPMS_LIST.length) {
            const nextAP = AMPMS_LIST[index];
            if (nextAP !== selectedAmPm) {
                currentAP = nextAP;
                setSelectedAmPm(nextAP);
                triggerChange(currentH, currentM, nextAP);
            }
        }
    };

    // Calculate new date and call onChange
    const triggerChange = (hStr: string, mStr: string, apStr: string) => {
        const currentDate = new Date(value || new Date());
        let h = parseInt(hStr, 10);
        const m = parseInt(mStr, 10);

        if (apStr === "PM" && h < 12) h += 12;
        if (apStr === "AM" && h === 12) h = 0;

        currentDate.setHours(h, m, 0, 0);
        onChange(currentDate);
    };

    return (
        <div className={`relative h-[180px] flex items-center justify-center overflow-hidden px-6 select-none border transition-all ${
            isDark 
                ? "bg-slate-900 border-slate-800 text-slate-100" 
                : "bg-slate-50 border-slate-100 text-slate-850"
        } ${className}`}>
            {/* Subtle Ruler-style Ticks on Sides */}
            <div className="absolute left-4 top-0 bottom-0 w-3 flex flex-col justify-between py-6 opacity-20 pointer-events-none">
                {Array.from({ length: 7 }).map((_, i) => (
                    <div key={i} className={`h-[1px] ${isDark ? "bg-white" : "bg-slate-800"} ${i % 2 === 0 ? "w-3" : "w-1.5"}`} />
                ))}
            </div>
            <div className="absolute right-4 top-0 bottom-0 w-3 flex flex-col justify-between py-6 opacity-20 pointer-events-none">
                {Array.from({ length: 7 }).map((_, i) => (
                    <div key={i} className={`h-[1px] ${isDark ? "bg-white" : "bg-slate-800"} ${i % 2 === 0 ? "w-3" : "w-1.5"}`} />
                ))}
            </div>

            {/* Central Highlight Selection Indicator */}
            <div className="absolute left-6 right-6 h-11 top-[69px] bg-teal-500/5 dark:bg-teal-400/5 border-y border-teal-500/20 dark:border-teal-400/20 rounded-xl pointer-events-none" />

            {/* Wheels Columns Container */}
            <div className="flex items-center justify-center w-full h-full relative z-10 gap-2">
                {/* Hours Column */}
                <div
                    ref={hourRef}
                    onScroll={(e) => handleScroll(e, "hour")}
                    className="w-16 h-[120px] overflow-y-scroll snap-y snap-mandatory scrollbar-none py-[40px] text-center"
                    style={{ scrollBehavior: "smooth" }}
                >
                    {HOURS_LIST.map((hour) => {
                        const isSelected = hour === selectedHour;
                        return (
                            <div
                                key={hour}
                                className={`h-[40px] flex items-center justify-center snap-center text-2xl font-bold transition-all duration-200 ${
                                    isSelected
                                        ? "text-teal-600 dark:text-teal-400 scale-110 font-black"
                                        : isDark
                                            ? "text-slate-600 hover:text-slate-400"
                                            : "text-slate-300 hover:text-slate-400"
                                }`}
                            >
                                {hour}
                            </div>
                        );
                    })}
                </div>

                {/* Separator */}
                <div className="text-xl font-black text-slate-300 dark:text-slate-700 select-none pb-1">:</div>

                {/* Minutes Column */}
                <div
                    ref={minuteRef}
                    onScroll={(e) => handleScroll(e, "minute")}
                    className="w-16 h-[120px] overflow-y-scroll snap-y snap-mandatory scrollbar-none py-[40px] text-center"
                    style={{ scrollBehavior: "smooth" }}
                >
                    {MINUTES_LIST.map((minute) => {
                        const isSelected = minute === selectedMinute;
                        return (
                            <div
                                key={minute}
                                className={`h-[40px] flex items-center justify-center snap-center text-2xl font-bold transition-all duration-200 ${
                                    isSelected
                                        ? "text-teal-600 dark:text-teal-400 scale-110 font-black"
                                        : isDark
                                            ? "text-slate-600 hover:text-slate-400"
                                            : "text-slate-300 hover:text-slate-400"
                                }`}
                            >
                                {minute}
                            </div>
                        );
                    })}
                </div>

                {/* Space Separator */}
                <div className="w-1" />

                {/* AM/PM Column */}
                <div
                    ref={ampmRef}
                    onScroll={(e) => handleScroll(e, "ampm")}
                    className="w-16 h-[120px] overflow-y-scroll snap-y snap-mandatory scrollbar-none py-[40px] text-center"
                    style={{ scrollBehavior: "smooth" }}
                >
                    {AMPMS_LIST.map((ampm) => {
                        const isSelected = ampm === selectedAmPm;
                        return (
                            <div
                                key={ampm}
                                className={`h-[40px] flex items-center justify-center snap-center text-lg font-extrabold transition-all duration-200 ${
                                    isSelected
                                        ? "text-teal-600 dark:text-teal-400 scale-110 font-black"
                                        : isDark
                                            ? "text-slate-600 hover:text-slate-400"
                                            : "text-slate-300 hover:text-slate-400"
                                }`}
                            >
                                {ampm}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Top & Bottom Vignette Gradient Blur */}
            <div className={`absolute top-0 inset-x-0 h-10 bg-gradient-to-b to-transparent pointer-events-none z-20 ${
                isDark ? "from-slate-900" : "from-slate-50"
            }`} />
            <div className={`absolute bottom-0 inset-x-0 h-10 bg-gradient-to-t to-transparent pointer-events-none z-20 ${
                isDark ? "from-slate-900" : "from-slate-50"
            }`} />
        </div>
    );
}