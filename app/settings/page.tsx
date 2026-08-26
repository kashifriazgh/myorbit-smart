'use client';

import Link from 'next/link';
import PushIcon from '@mui/icons-material/Notifications';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import TuneIcon from '@mui/icons-material/Tune';
import AccountIcon from '@mui/icons-material/AccountCircle';
import SecurityIcon from '@mui/icons-material/Security';
import PaletteIcon from '@mui/icons-material/Palette';
import PeopleIcon from '@mui/icons-material/People';

const settingsSections = [
  {
    category: 'Notifications',
    items: [
      {
        href: '/settings/push-notifications',
        icon: <PushIcon className="text-amber-400" />,
        title: 'Push Notifications',
        description: 'Subscribe for web push alerts on tasks & schedules',
        badge: 'FCM',
        badgeColor: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
      },
      {
        href: '/settings/whatsapp',
        icon: <WhatsAppIcon className="text-emerald-400" />,
        title: 'WhatsApp Notifications',
        description: 'Link your WhatsApp account for task reminders',
        badge: 'WhatsApp',
        badgeColor: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
      },
      {
        href: '/settings/sharing',
        icon: <PeopleIcon className="text-sky-400" />,
        title: 'Device Sharing',
        description: 'Connect with other users to exchange push notification alerts',
        badge: 'NEW',
        badgeColor: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
      },
    ],
  },
  {
    category: 'Preferences',
    items: [
      {
        href: '/settings/appearance',
        icon: <PaletteIcon className="text-violet-400" />,
        title: 'Appearance',
        description: 'Customize theme, colors and display preferences',
        badge: null,
        badgeColor: '',
      },
      {
        href: '/settings/account',
        icon: <AccountIcon className="text-sky-400" />,
        title: 'Account',
        description: 'Manage your profile and personal information',
        badge: null,
        badgeColor: '',
      },
      {
        href: '/settings/security',
        icon: <SecurityIcon className="text-rose-400" />,
        title: 'Security & Privacy',
        description: 'Passwords, two-factor auth and privacy controls',
        badge: null,
        badgeColor: '',
      },
    ],
  },
];

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-teal-500 selection:text-white pb-24">
      {/* Ambient glow effects */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] bg-teal-500/5 rounded-full blur-[120px]" />
        <div className="absolute top-[30%] right-[10%] w-[400px] h-[400px] bg-violet-500/5 rounded-full blur-[100px]" />
      </div>

      {/* Header */}
      <div className="relative border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl px-6 lg:px-12 py-10">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-2xl bg-teal-500/10 border border-teal-500/20">
              <TuneIcon className="text-teal-400 text-[22px]" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-teal-500/80 bg-teal-500/10 border border-teal-500/20 px-3 py-1 rounded-full">
              Control Center
            </span>
          </div>
          <h1 className="text-4xl font-black mt-3 bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent tracking-tight">
            Settings
          </h1>
          <p className="text-slate-400 mt-2 text-sm font-medium max-w-md">
            Manage your notification preferences, account settings, and app behavior.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="relative max-w-3xl mx-auto px-6 lg:px-12 mt-10 space-y-10">
        {settingsSections.map((section) => (
          <div key={section.category}>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 mb-4 ml-1">
              {section.category}
            </p>
            <div className="space-y-3">
              {section.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group flex items-center justify-between gap-4 p-5 bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 hover:border-slate-700 rounded-[20px] transition-all duration-200 hover:shadow-xl hover:shadow-slate-950/60 hover:-translate-y-0.5"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-slate-800/80 group-hover:bg-slate-800 border border-slate-700/50 transition-colors flex-shrink-0">
                      {item.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="text-sm font-bold text-white group-hover:text-teal-300 transition-colors">
                          {item.title}
                        </span>
                        {item.badge && (
                          <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${item.badgeColor}`}>
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 font-medium">
                        {item.description}
                      </p>
                    </div>
                  </div>
                  <ChevronRightIcon className="text-slate-600 group-hover:text-slate-300 group-hover:translate-x-1 transition-all flex-shrink-0" />
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
