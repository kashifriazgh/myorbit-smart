// components/QuickLinks.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import {
  FlagOutlined,
  NotesOutlined,
  LightbulbOutlined,
  ScheduleOutlined,
  WhatshotOutlined,
  ShoppingCartOutlined,
  AccountBalanceWalletOutlined,
  ReceiptLongOutlined,
  RequestQuoteOutlined,
} from '@mui/icons-material';

const links = [
  {
    name: 'Goals',
    icon: <FlagOutlined className="text-blue-600" />,
    href: '/goals',
    bg: 'bg-blue-50',
  },
  {
    name: 'Notes',
    icon: <NotesOutlined className="text-purple-600" />,
    href: '/notes',
    bg: 'bg-purple-50',
  },
  {
    name: 'Ideas',
    icon: <LightbulbOutlined className="text-yellow-600" />,
    href: '/ideas',
    bg: 'bg-yellow-50',
  },
  {
    name: 'Loan',
    icon: <RequestQuoteOutlined className="text-teal-600" />,
    href: '/finance/loans',
    bg: 'bg-teal-50',
  },
  {
    name: 'Time Table',
    icon: <ScheduleOutlined className="text-indigo-600" />,
    href: '/time-table',
    bg: 'bg-indigo-50',
  },
  {
    name: 'Streaks',
    icon: <WhatshotOutlined className="text-orange-600" />,
    href: '/streaks',
    bg: 'bg-orange-50',
  },
  {
    name: 'Shopping List',
    icon: <ShoppingCartOutlined className="text-pink-600" />,
    href: '/finance/things-to-buy',
    bg: 'bg-pink-50',
  },
  {
    name: 'Income',
    icon: <AccountBalanceWalletOutlined className="text-green-600" />,
    href: '/finance/income-sources',
    bg: 'bg-green-50',
  },
  {
    name: 'Expenses',
    icon: <ReceiptLongOutlined className="text-red-600" />,
    href: '/finance/expenditures',
    bg: 'bg-red-50',
  },
];

const QuickLinks = () => {
  return (
    <div className="w-full py-8 px-4 md:px-6">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="flex items-center gap-2 mb-6 ml-1">
          <div className="w-2 h-6 bg-gradient-to-b from-violet-500 to-indigo-600 rounded-full" />
          <h2 className="text-sm font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">
            Quick Launchpad
          </h2>
        </div>

        {/* Links Grid/Flex */}
        <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
          {links.map((link) => (
            <Link
              key={link.name}
              href={link.href}
              className={`
                group relative w-[80px] h-[80px] sm:w-[90px] sm:h-[90px] 
                flex flex-col items-center justify-center 
                rounded-2xl transition-all duration-300 ease-out
                hover:scale-105 hover:-translate-y-1 hover:shadow-xl hover:z-10
                ${link.bg} dark:bg-slate-800/40 
                border border-transparent hover:border-white/50 dark:hover:border-slate-700
                backdrop-blur-sm shadow-md shadow-slate-200/50 dark:shadow-none
              `}
            >
              {/* Icon Container with Glow */}
              <div className="relative mb-1.5 transition-transform duration-300 group-hover:scale-110">
                <div className="absolute inset-0 blur-lg opacity-0 group-hover:opacity-40 transition-opacity bg-current" />
                <div className="relative transform transition-transform group-hover:rotate-12">
                  {React.cloneElement(link.icon as React.ReactElement<{ style?: React.CSSProperties }>, { 
                    style: { fontSize: '1.5rem' } 
                  })}
                </div>
              </div>

              {/* Label */}
              <span className="text-[11px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 text-center leading-tight px-2 transition-colors group-hover:text-slate-900 dark:group-hover:text-white">
                {link.name}
              </span>

              {/* Subtle Indicator */}
              <div className="absolute bottom-2 w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600 opacity-0 group-hover:opacity-100 transition-all duration-300" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default QuickLinks;
