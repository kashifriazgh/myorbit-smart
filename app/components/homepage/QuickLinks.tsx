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
    <div className="p-2">
      <div className="flex gap-3 overflow-x-auto no-scrollbar">
        {links.map((link) => (
          <Link
            key={link.name}
            href={link.href}
            className={`min-w-[90px] flex-shrink-0 flex flex-col items-center justify-center p-3 rounded-lg ${link.bg} hover:shadow-md transition`}
          >
            {link.icon}
            <span className="mt-1 text-xs font-medium text-gray-700 text-center leading-tight">
              {link.name}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default QuickLinks;
