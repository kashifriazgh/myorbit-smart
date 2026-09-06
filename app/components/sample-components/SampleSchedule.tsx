"use client";

function GlassWaterIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M15.2 22H8.8a2 2 0 0 1-2-1.79L5 3h14l-1.8 17.21a2 2 0 0 1-2 1.79z" />
      <path d="M6 12a5 5 0 0 1 6 0 5 5 0 0 0 6 0" />
    </svg>
  );
}

function BikeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="5.5" cy="17.5" r="3.5" />
      <circle cx="18.5" cy="17.5" r="3.5" />
      <path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 11.5L9.5 12l3-4.5h4l2 5" />
      <path d="M12 17.5V14" />
    </svg>
  );
}

function StretchIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21 12H3M21 12l-4-4m4 4l-4 4M3 12l4-4m-4 4l4 4" />
    </svg>
  );
}

function ClockIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

function CheckIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

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
    icon: GlassWaterIcon,
    iconBg: "bg-orange-100",
    iconColor: "text-orange-500",
  },
  {
    id: "meditate",
    title: "Meditate to relax",
    streak: 6,
    duration: "15 min",
    status: "done",
    icon: BikeIcon,
    iconBg: "bg-lime-100",
    iconColor: "text-lime-700",
  },
  {
    id: "stretch",
    title: "Stretch for 10 minutes",
    streak: 5,
    duration: "10 min",
    status: "upcoming",
    icon: StretchIcon,
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
                    <CheckIcon className="h-2.5 w-2.5 text-white" strokeWidth={3} />
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
                    <ClockIcon className="h-4 w-4 text-gray-400" />
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