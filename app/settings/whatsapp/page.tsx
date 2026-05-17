'use client';

import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';

const WHATSAPP_API = 'http://localhost:3001';
const CLIENT_ID = 'test_user_123'; // In production, this will be dynamic per user

export default function WhatsAppSettingsPage() {
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Initialize session on mount
    useEffect(() => {
        initializeSession();
    }, []);

    // Poll for QR code and status
    useEffect(() => {
        if (isReady) return; // Stop polling once ready

        const interval = setInterval(async () => {
            await checkStatus();
        }, 2000); // Check every 2 seconds

        return () => clearInterval(interval);
    }, [isReady]);

    const initializeSession = async () => {
        try {
            setIsLoading(true);
            const response = await fetch(`${WHATSAPP_API}/test-init/${CLIENT_ID}`);
            const data = await response.json();
            console.log('Session initialized:', data);
            setIsLoading(false);
        } catch {
            setError('Failed to connect to WhatsApp service');
            setIsLoading(false);
        }
    };

    const checkStatus = async () => {
        try {
            // Get QR code
            const qrResponse = await fetch(`${WHATSAPP_API}/qr/${CLIENT_ID}`);
            const qrData = await qrResponse.json();

            if (qrData.qr) {
                setQrCode(qrData.qr);
            }

            if (qrData.ready) {
                setIsReady(true);
                setQrCode(null);
            }
        } catch (err) {
            console.error('Status check failed:', err);
        }
    };

    const sendTestMessage = async () => {
        try {
            const phone = '923231516371'; // Your number
            const message = '✅ Test message from My Orbit app!';

            const response = await fetch(`${WHATSAPP_API}/send-message`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clientId: CLIENT_ID,
                    phone,
                    message
                })
            });

            const result = await response.json();
            if (result.success) {
                alert('Message sent successfully!');
            } else {
                alert('Failed to send message');
            }
        } catch {
            alert('Error sending message');
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-2xl mx-auto">
                <h1 className="text-3xl font-bold mb-8">WhatsApp Notifications</h1>

                {/* Loading State */}
                {isLoading && (
                    <div className="bg-white rounded-lg shadow p-8 text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <p className="text-gray-600">Initializing WhatsApp service...</p>
                    </div>
                )}

                {/* Error State */}
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                        <p className="text-red-800">{error}</p>
                        <p className="text-sm text-red-600 mt-2">
                            Make sure WhatsApp service is running on localhost:3001
                        </p>
                    </div>
                )}

                {/* QR Code Display */}
                {!isLoading && !isReady && qrCode && (
                    <div className="bg-white rounded-lg shadow p-8">
                        <h2 className="text-xl font-semibold mb-4 text-center">
                            Scan QR Code
                        </h2>
                        <p className="text-gray-600 mb-6 text-center">
                            Open WhatsApp on your phone → Settings → Linked Devices → Link a Device
                        </p>
                        <div className="flex justify-center mb-6">
                            <div className="bg-white p-4 rounded-lg border-2 border-gray-200">
                                <QRCodeSVG value={qrCode} size={256} />
                            </div>
                        </div>
                        <p className="text-sm text-gray-500 text-center">
                            Waiting for you to scan...
                        </p>
                    </div>
                )}

                {/* Connected State */}
                {!isLoading && isReady && (
                    <div className="bg-white rounded-lg shadow p-8">
                        <div className="flex items-center justify-center mb-6">
                            <div className="bg-green-100 rounded-full p-3">
                                <svg
                                    className="w-8 h-8 text-green-600"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M5 13l4 4L19 7"
                                    />
                                </svg>
                            </div>
                        </div>
                        <h2 className="text-xl font-semibold mb-2 text-center">
                            WhatsApp Connected!
                        </h2>
                        <p className="text-gray-600 mb-6 text-center">
                            You&apos;ll now receive task notifications on WhatsApp
                        </p>

                        <button
                            onClick={sendTestMessage}
                            className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                        >
                            Send Test Message
                        </button>
                    </div>
                )}

                {/* Instructions */}
                {!isLoading && !isReady && !qrCode && (
                    <div className="bg-white rounded-lg shadow p-8 text-center">
                        <p className="text-gray-600">Generating QR code...</p>
                    </div>
                )}
            </div>
        </div>
    );
}