'use client';

import { useEffect, useState } from 'react';

// Define proper type for the beforeinstallprompt event
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export default function InstallPage() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installable, setInstallable] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const choiceResult = await deferredPrompt.userChoice;
    console.log('User choice:', choiceResult.outcome);

    setDeferredPrompt(null);
    setInstallable(false);
  };

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-6">
      <h1 className="text-2xl font-bold mb-4">Install My Orbit App</h1>
      <p className="text-gray-600 mb-6 text-center max-w-md">
        Install this app on your device for a better, full-screen experience.
        <br />
        On iPhone, use <strong>Share → Add to Home Screen</strong>.
      </p>

      {installable ? (
        <button
          onClick={handleInstallClick}
          className="px-6 py-3 bg-blue-600 dark:bg-blue-700 text-white rounded-xl shadow hover:bg-blue-700 dark:hover:bg-blue-800 transition"
        >
          Install App
        </button>
      ) : (
        <p className="text-gray-500 dark:text-gray-400 text-center">
          Open this page in Chrome (Android) or Edge (Desktop) to install.
        </p>
      )}
    </main>
  );
}
