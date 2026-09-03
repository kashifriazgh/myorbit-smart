import type { Metadata } from 'next';
import { Inter, Roboto, Noto_Nastaliq_Urdu } from 'next/font/google';
import './globals.css';

import { Suspense } from 'react';
import ClientThemeProvider from './components/global/ClientThemeProvider';
import Navbar from './components/global/Navbar';
import EmotionRegistry from './emotionRegistry';
import AppBarTop from './components/global/AppBarTop';
import OnBoardingInitializer from './components/global/initial-on-boarding/OnBoardingInitializer';
import FcmForegroundHandler from './components/global/FcmForegroundHandler';
import TopNavigationLoader from './components/global/TopNavigationLoader';


// Google Fonts
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const roboto = Roboto({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-roboto',
});

const notoUrdu = Noto_Nastaliq_Urdu({
  subsets: ['arabic'],
  weight: ['400', '700'],
  variable: '--font-noto-urdu',
});

export const metadata: Metadata = {
  title: 'My Orbit - Your Personal Productivity Tool',
  description:
    'Organize your tasks, track your habits, and boost your productivity with My Orbit.',
  manifest: '/manifest.json',
  themeColor: '#2563eb',
  icons: {
    icon: '/icons/icon-192x192.png',
    apple: '/icons/icon-192x192.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`
          ${inter.variable} ${roboto.variable} ${notoUrdu.variable}
          antialiased

          /* Layout */
          min-h-screen pb-30

          /* Light Mode */
          bg-gray-50 text-gray-900

          /* Dark Mode */
          dark:bg-gray-900 dark:text-gray-100

          /* Smooth transitions */
          transition-colors duration-300
        `}
      >
        <EmotionRegistry>
          <ClientThemeProvider>
            <Suspense fallback={null}>
              <TopNavigationLoader />
            </Suspense>
            <div className="flex min-h-screen flex-col  ">
              <OnBoardingInitializer />
              {/* FCM foreground notification handler — shows push notifications when app is focused */}
              <FcmForegroundHandler />
              {/* Top App Bar */}
              <AppBarTop />

              {/* Navigation */}
              <Navbar />

              {/* Main Content */}
              <main className="flex-1 ">{children}</main>
            </div>
          </ClientThemeProvider>
        </EmotionRegistry>
      </body>
    </html>
  );
}
