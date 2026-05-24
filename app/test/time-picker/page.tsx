"use client";

import React, { useState, useEffect } from "react";
import TimePicker from "./TimePicker";
import {
    CalendarMonth as CalendarIcon,
    AccessTime as TimeIcon,
    NotificationsActive as ReminderIcon,
    CheckCircle as CheckIcon,
    DateRange as CustomDateIcon,
} from "@mui/icons-material";

export default function TimePickerTestPage() {
    const [selectedDateTime, setSelectedDateTime] = useState<Date | null>(new Date());
    const [activePreset, setActivePreset] = useState<string>("custom");
    const [showCustomTime, setShowCustomTime] = useState<boolean>(true);
    const [relativeTimeString, setRelativeTimeString] = useState<string>("");

    // Generate next 14 days for the horizontal slider
    const [datesList, setDatesList] = useState<{ dayName: string; dayNum: string; fullDate: Date }[]>([]);

    useEffect(() => {
        const list = [];
        const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        for (let i = 0; i < 14; i++) {
            const d = new Date();
            d.setDate(d.getDate() + i);
            list.push({
                dayName: days[d.getDay()],
                dayNum: String(d.getDate()).padStart(2, "0"),
                fullDate: d,
            });
        }
        setDatesList(list);
    }, []);

    // Calculate relative time friendly text
    useEffect(() => {
        if (!selectedDateTime) {
            setRelativeTimeString("No reminder scheduled");
            return;
        }

        const now = new Date();
        const diffMs = selectedDateTime.getTime() - now.getTime();
        if (diffMs < 0) {
            setRelativeTimeString("Time is in the past!");
            return;
        }

        const diffMins = Math.round(diffMs / 60000);
        if (diffMins === 0) {
            setRelativeTimeString("Firing right now!");
        } else if (diffMins < 60) {
            setRelativeTimeString(`Firing in ${diffMins} min${diffMins > 1 ? "s" : ""}`);
        } else {
            const diffHours = Math.floor(diffMins / 60);
            const remMins = diffMins % 60;
            if (diffHours < 24) {
                setRelativeTimeString(
                    `Firing in ${diffHours} hr${diffHours > 1 ? "s" : ""}${
                        remMins > 0 ? ` ${remMins} min${remMins > 1 ? "s" : ""}` : ""
                    }`
                );
            } else {
                const diffDays = Math.floor(diffHours / 24);
                setRelativeTimeString(`Firing in ${diffDays} day${diffDays > 1 ? "s" : ""}`);
            }
        }
    }, [selectedDateTime]);

    // Check if a list date matches the selectedDate
    const isSameDay = (d1: Date, d2: Date | null) => {
        if (!d2) return false;
        return (
            d1.getDate() === d2.getDate() &&
            d1.getMonth() === d2.getMonth() &&
            d1.getFullYear() === d2.getFullYear()
        );
    };

    // Handler when selecting a quick date slider item
    const handleDateSelect = (date: Date) => {
        const current = selectedDateTime ? new Date(selectedDateTime) : new Date();
        current.setFullYear(date.getFullYear());
        current.setMonth(date.getMonth());
        current.setDate(date.getDate());
        setSelectedDateTime(current);
        setActivePreset("custom"); // Mark as custom timing
    };

    // Apply time preset slot
    const handleApplyPreset = (preset: string) => {
        setActivePreset(preset);
        const newD = new Date();

        switch (preset) {
            case "none":
                setSelectedDateTime(null);
                setShowCustomTime(false);
                break;
            case "15m":
                newD.setMinutes(newD.getMinutes() + 15);
                setSelectedDateTime(newD);
                setShowCustomTime(false);
                break;
            case "30m":
                newD.setMinutes(newD.getMinutes() + 30);
                setSelectedDateTime(newD);
                setShowCustomTime(false);
                break;
            case "1h":
                newD.setHours(newD.getHours() + 1);
                setSelectedDateTime(newD);
                setShowCustomTime(false);
                break;
            case "2h":
                newD.setHours(newD.getHours() + 2);
                setSelectedDateTime(newD);
                setShowCustomTime(false);
                break;
            case "tomorrow":
                newD.setDate(newD.getDate() + 1);
                newD.setHours(9, 0, 0, 0); // 9:00 AM Tomorrow
                setSelectedDateTime(newD);
                setShowCustomTime(false);
                break;
            case "custom":
                setShowCustomTime(true);
                if (!selectedDateTime) {
                    setSelectedDateTime(new Date());
                }
                break;
            default:
                break;
        }
    };

    // Format display string
    const formatDateTimeString = (date: Date | null) => {
        if (!date) return "No Reminder Scheduled";
        return date.toLocaleDateString("en-US", {
            weekday: "long",
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
        });
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-slate-950 p-4 md:p-8">
            <div className="w-full max-w-[450px] bg-slate-900 border border-slate-800 rounded-[32px] overflow-hidden shadow-2xl font-sans text-white p-6 md:p-8 select-none">
                
                {/* Header Section */}
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2.5 rounded-2xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
                        <ReminderIcon className="animate-pulse" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black tracking-tight">Set Reminder</h2>
                        <p className="text-xs text-slate-400 font-medium">Schedule task alerts in real-time</p>
                    </div>
                </div>

                {/* Date Picker Header */}
                <div className="flex items-center justify-between mb-3 px-1">
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                        <CalendarIcon style={{ fontSize: 13 }} />
                        1. Select Date
                    </span>
                    {selectedDateTime && (
                        <span className="text-[10px] font-bold text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-full border border-teal-500/20">
                            {selectedDateTime.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                    )}
                </div>

                {/* Premium Horizontal Day Slider */}
                <div className="flex gap-2 overflow-x-auto pb-3 mb-6 no-scrollbar snap-x">
                    {datesList.map((item, idx) => {
                        const isSelected = isSameDay(item.fullDate, selectedDateTime);
                        const isToday = isSameDay(item.fullDate, new Date());
                        return (
                            <button
                                key={idx}
                                onClick={() => handleDateSelect(item.fullDate)}
                                className={`flex flex-col items-center justify-center min-w-[56px] h-[72px] rounded-2xl border transition-all duration-300 snap-center cursor-pointer ${
                                    isSelected
                                        ? "bg-gradient-to-br from-teal-500 to-cyan-600 border-teal-400 text-slate-950 shadow-lg shadow-teal-500/20 scale-105"
                                        : "bg-slate-800/50 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-800"
                                }`}
                            >
                                <span className={`text-[10px] font-bold uppercase ${isSelected ? "text-slate-950/80" : "text-slate-400"}`}>
                                    {item.dayName}
                                </span>
                                <span className="text-lg font-black mt-0.5 tracking-tight">{item.dayNum}</span>
                                {isToday && !isSelected && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-teal-400 mt-1" />
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Predefined Time Slots & Trigger Button */}
                <div className="mb-6">
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-3 px-1">
                        <TimeIcon style={{ fontSize: 13 }} />
                        2. Predefined Time Slots & Presets
                    </span>
                    
                    <div className="flex flex-wrap gap-2">
                        {[
                            { id: "none", label: "No Reminder" },
                            { id: "15m", label: "In 15m" },
                            { id: "30m", label: "In 30m" },
                            { id: "1h", label: "In 1h" },
                            { id: "2h", label: "In 2h" },
                            { id: "tomorrow", label: "Tomorrow Morning (9 AM)" },
                        ].map((preset) => (
                            <button
                                key={preset.id}
                                onClick={() => handleApplyPreset(preset.id)}
                                className={`px-3.5 py-2.5 rounded-xl font-bold text-xs transition-all duration-200 cursor-pointer ${
                                    activePreset === preset.id
                                        ? "bg-white border border-slate-200 text-slate-900 shadow-md scale-102"
                                        : "bg-slate-800 text-slate-300 border border-transparent hover:bg-slate-700/80"
                                }`}
                            >
                                {preset.label}
                            </button>
                        ))}

                        {/* Set Custom Time Button */}
                        <button
                            onClick={() => handleApplyPreset("custom")}
                            className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all duration-200 flex items-center gap-1.5 cursor-pointer border ${
                                activePreset === "custom" && showCustomTime
                                    ? "bg-gradient-to-r from-teal-400 to-cyan-500 text-slate-950 border-teal-300 font-black shadow-md shadow-teal-500/10"
                                    : "bg-slate-800 text-teal-400 border-teal-500/20 hover:bg-slate-700/80"
                            }`}
                        >
                            <CustomDateIcon style={{ fontSize: 14 }} />
                            ⏰ Set Custom
                        </button>
                    </div>
                </div>

                {/* Animated Reusable custom wheel Time Picker Container */}
                {showCustomTime && selectedDateTime && (
                    <div className="mb-6 transition-all duration-300 animate-fadeIn">
                        <div className="flex justify-between items-center mb-2 px-1">
                            <span className="text-[10px] font-black text-teal-400/90 uppercase tracking-widest">
                                Drag or Scroll to Select Time
                            </span>
                            <button
                                onClick={() => setShowCustomTime(false)}
                                className="text-[10px] font-bold text-slate-400 hover:text-white transition-colors"
                            >
                                Hide
                            </button>
                        </div>
                        <TimePicker
                            value={selectedDateTime}
                            onChange={(nextDate) => {
                                setSelectedDateTime(nextDate);
                                setActivePreset("custom");
                            }}
                            className="shadow-inner"
                        />
                    </div>
                )}

                {/* Live Preview Sync Summary Card */}
                {selectedDateTime ? (
                    <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-800 rounded-2xl p-4 mt-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-teal-500/10 text-teal-400">
                                <CheckIcon style={{ fontSize: 18 }} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                                    Reminder Active & Synced
                                </span>
                                <span className="text-[13px] font-extrabold text-white truncate block mt-0.5">
                                    {formatDateTimeString(selectedDateTime)}
                                </span>
                                <span className="text-xs font-bold text-teal-400 block mt-0.5">
                                    {relativeTimeString}
                                </span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl p-4 mt-6 text-center text-slate-400 text-xs font-bold py-5">
                        🚫 Reminders are disabled (No Reminder selected)
                    </div>
                )}

                {/* Action Controls */}
                <div className="flex gap-3 mt-6">
                    <button
                        onClick={() => {
                            setSelectedDateTime(new Date());
                            setActivePreset("custom");
                            setShowCustomTime(true);
                        }}
                        className="flex-1 py-3.5 border border-slate-800 rounded-2xl font-bold text-slate-400 hover:bg-slate-800 hover:text-white transition-all cursor-pointer text-sm"
                    >
                        Reset
                    </button>
                    <button
                        onClick={() => alert(`Reminder set successfully for: ${formatDateTimeString(selectedDateTime)}`)}
                        disabled={!selectedDateTime}
                        className="flex-1 py-3.5 bg-gradient-to-r from-teal-400 to-cyan-500 text-slate-950 font-black rounded-2xl shadow-lg shadow-teal-500/10 hover:opacity-95 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer text-sm"
                    >
                        Save Alert
                    </button>
                </div>

            </div>
        </div>
    );
}