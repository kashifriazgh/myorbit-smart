'use client';

import { JournalProvider } from '@/app/lib/context/JournalContext';

export default function JournalsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <JournalProvider>{children}</JournalProvider>;
}
