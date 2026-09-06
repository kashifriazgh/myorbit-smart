"use client";

import { GlassWater, Bike, StretchHorizontal, Clock, Check } from "lucide-react";

type TaskStatus = "done" | "upcoming";

interface Task {
  id: string;
  title: string;
  streak: number;
  duration: string;
  status: TaskStatus;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
}

const tasks: Task[] = [
  {
    id: "water",
    title: "Drink a glass of water",
    streak: 3,
    duration: "5 min",
    status: "done",
    icon: GlassWater,
    iconBg: "bg-orange-100",
    iconColor: "text-orange-500",
  },
  {
    id: "meditate",
    title: "Meditate to relax",
    streak: 6,
    duration: "15 min",
    status: "done",
    icon: Bike,
    iconBg: "bg-lime-100",
    iconColor: "text-lime-700",
  },
  {
    id: "stretch",
    title: "Stretch for 10 minutes",
    streak: 5,
    duration: "10 min",
    status: "upcoming",
    icon: StretchHorizontal,
    iconBg: "bg-pink-100",
    iconColor: "text-pink-600",
  },
];

export default function SchedulePage() {
  return (
    <main className="min-h-screen bg-[#FBF3EE] px-4 py-10">
      <div className="mx-auto max-w-md">
        <ol className="relative">
          {tasks.map((task, index) => {
            const Icon = task.icon;
            const isLast = index === tasks.length - 1;

            return (
              <li key={task.id} className="relative pl-10">
                {/* connecting dotted line */}
                {!isLast && (
                  <span
                    className="absolute left-[7px] top-4 h-full w-px border-l-2 border-dotted border-orange-300"
                    aria-hidden="true"
                  />
                )}

                {/* status marker */}
                <span
                  className={`absolute left-0 top-4 flex h-4 w-4 items-center justify-center rounded-full ${
                    task.status === "done"
                      ? "bg-orange-500"
                      : "border-2 border-gray-300 bg-white"
                  }`}
                >
                  {task.status === "done" && (
                    <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                  )}
                </span>

                {/* card */}
                <div className="mb-4 flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm">
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${task.iconBg}`}
                  >
                    <Icon className={`h-6 w-6 ${task.iconColor}`} strokeWidth={2} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-gray-800">
                      {task.title}
                    </p>
                    <p className="text-sm text-gray-400">
                      Streak {task.streak} days
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-col items-center gap-1 pl-2">
                    <Clock className="h-4 w-4 text-gray-400" />
                    <span className="text-xs text-gray-400">{task.duration}</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </main>
  );
}