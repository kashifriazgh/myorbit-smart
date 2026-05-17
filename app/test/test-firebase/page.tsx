'use client';

import { useState } from 'react';
import { ref, push, set } from 'firebase/database';
import { database } from '@/app/lib/firebase';
export default function TestFirebasePage() {
    const [status, setStatus] = useState('');
    const [loading, setLoading] = useState(false);

    const createTestNotification = async () => {
        setLoading(true);
        setStatus('Creating notification...');

        try {
            // Create notification in Firebase RTDB
            const notificationsRef = ref(database, 'notifications');
            const newNotifRef = push(notificationsRef);

            const now = Date.now();
            const reminderTime = now + (30 * 1000); // 30 seconds from now

            await set(newNotifRef, {
                clientId: 'test_user_123',
                phone: '923231516371', // Replace with your number
                message: '⏰ Test notification from My Orbit Next.js app!',
                reminderTime: reminderTime,
                sent: false,
                createdAt: now
            });

           const sendAtTime = new Date(reminderTime).toLocaleString('en-US', {
    timeZone: 'Asia/Karachi',
    hour12: true,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
});

            setStatus(`✅ Success! Notification created.
Will send at: ${sendAtTime} (Pakistan time)
Check your WhatsApp in 30 seconds!`);
        } catch (error) {
            setStatus(`❌ Error: ${(error as Error).message}`);
        } finally {
            setLoading(false);
        }
    };

    const createTaskReminder = async () => {
        setLoading(true);
        setStatus('Creating task reminder...');

        try {
            const notificationsRef = ref(database, 'notifications');
            const newNotifRef = push(notificationsRef);

            // Simulate a task due in 2 minutes
            const taskDeadline = Date.now() + (2 * 60 * 1000); // 2 mins
            const remindBefore = 30; // remind 30 seconds before
            const reminderTime = taskDeadline - (remindBefore * 1000);

            await set(newNotifRef, {
                clientId: 'test_user_123',
                phone: '923231516371',
                message: `⏰ Task "Submit Report" is due in ${remindBefore} seconds!`,
                reminderTime: reminderTime,
                sent: false,
                createdAt: Date.now()
            });

            const sendAtTime = new Date(reminderTime).toLocaleString('en-PK', {
                timeZone: 'Asia/Karachi'
            });

            setStatus(`✅ Task reminder created!
Will send at: ${sendAtTime} (Pakistan time)
Message will say task is due in 30 seconds.`);
        } catch (error) {
            setStatus(`❌ Error: ${(error as Error).message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-2xl mx-auto">
                <h1 className="text-3xl font-bold mb-8">Test Firebase RTDB</h1>

                <div className="bg-white rounded-lg shadow p-8 space-y-4">
                    <h2 className="text-xl font-semibold mb-4">
                        Create Test Notifications
                    </h2>

                    <button
                        onClick={createTestNotification}
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                    >
                        {loading ? 'Creating...' : 'Send Test Notification (in 30s)'}
                    </button>

                    <button
                        onClick={createTaskReminder}
                        disabled={loading}
                        className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                    >
                        {loading ? 'Creating...' : 'Create Task Reminder (2 min task)'}
                    </button>

                    {status && (
                        <div className="mt-6 p-4 bg-gray-100 rounded-lg">
                            <pre className="whitespace-pre-wrap text-sm">
                                {status}
                            </pre>
                        </div>
                    )}
                </div>

                <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="font-semibold mb-2">Instructions:</h3>
                    <ol className="list-decimal list-inside space-y-1 text-sm">
                        <li>Make sure WhatsApp service is running (localhost:3001)</li>
                        <li>Make sure you&apos;ve scanned QR code in /settings/whatsapp</li>
                        <li>Click one of the buttons above</li>
                        <li>Wait for the specified time</li>
                        <li>Check your WhatsApp! 📱</li>
                    </ol>
                </div>
            </div>
        </div>
    );
}