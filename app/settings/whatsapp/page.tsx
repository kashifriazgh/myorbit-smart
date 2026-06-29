'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import BackIcon from '@mui/icons-material/ArrowBack';
import InfoIcon from '@mui/icons-material/InfoOutlined';
import QrCodeIcon from '@mui/icons-material/QrCode';
import SendIcon from '@mui/icons-material/Send';
import { useAuth } from '@/app/lib/context/userContext';
import { isPremiumClient, getPremiumDetails } from '@/app/lib/members';

const WHATSAPP_API = process.env.NEXT_PUBLIC_WHATSAPP_SERVER_URL || 'https://myorbit-whatsapp-service-production.up.railway.app';

export default function WhatsAppSettingsPage() {
    const { user, loading: authLoading } = useAuth();
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sessionInitialized, setSessionInitialized] = useState(false);
    const [testPhone, setTestPhone] = useState('923231516371');
    const [isTesting, setIsTesting] = useState(false);
    const [isResetting, setIsResetting] = useState(false);

    const CLIENT_ID = process.env.NEXT_PUBLIC_CLIENT_ID || (user ? `user_${user.uid}` : null);
    const isPremium = isPremiumClient(CLIENT_ID);
    const premiumDetails = getPremiumDetails(CLIENT_ID);

    // Initialize session when CLIENT_ID is ready
    useEffect(() => {
        if (!CLIENT_ID || sessionInitialized || authLoading) return;

        const initializeSession = async () => {
            try {
                setIsLoading(true);
                setError(null);
                const response = await fetch(`${WHATSAPP_API}/test-init/${CLIENT_ID}`);
                if (!response.ok) {
                    throw new Error(`Server returned status ${response.status}`);
                }
                const data = await response.json();
                console.log('Session initialized:', data);
                setIsLoading(false);
                setSessionInitialized(true);
            } catch {
                setError('Failed to connect to WhatsApp service. Make sure the server is online.');
                setIsLoading(false);
            }
        };

        initializeSession();
    }, [CLIENT_ID, sessionInitialized, authLoading]);

    // Poll for QR code and status
    useEffect(() => {
        if (!CLIENT_ID || !sessionInitialized || isReady || authLoading) return;

        const checkStatus = async () => {
            try {
                const qrResponse = await fetch(`${WHATSAPP_API}/qr/${CLIENT_ID}`);
                if (!qrResponse.ok) {
                    console.warn(`Status check returned ${qrResponse.status}`);
                    return;
                }
                const qrData = await qrResponse.json();

                if (qrData.qr) {
                    setQrCode(qrData.qr);
                } else {
                    setQrCode(null);
                }

                if (qrData.ready) {
                    setIsReady(true);
                    setQrCode(null);
                }
            } catch (err) {
                console.error('Status check failed:', err);
            }
        };

        // Run immediately
        checkStatus();

        const interval = setInterval(checkStatus, 2000); // Check every 2 seconds

        return () => clearInterval(interval);
    }, [CLIENT_ID, sessionInitialized, isReady, authLoading]);

    const handleResetSession = async () => {
        if (!CLIENT_ID) return;
        setIsResetting(true);
        setError(null);
        try {
            console.log(`Resetting session for ${CLIENT_ID}...`);
            const response = await fetch(`${WHATSAPP_API}/disconnect/${CLIENT_ID}`, {
                method: 'POST'
            });
            if (!response.ok) {
                throw new Error(`Reset failed with status ${response.status}`);
            }
            const data = await response.json();
            console.log('Session reset result:', data);
        } catch (err) {
            console.error('Failed to reset session on server, forcing local reset:', err);
        } finally {
            // Force reset local state to trigger a fresh initialization
            setQrCode(null);
            setIsReady(false);
            setSessionInitialized(false);
            setIsLoading(false);
            setIsResetting(false);
        }
    };

    const sendTestMessage = async () => {
        if (!CLIENT_ID) return;
        if (!testPhone.trim()) {
            alert('Please enter a valid phone number');
            return;
        }
        setIsTesting(true);
        try {
            const message = '✅ Test message from My Orbit app!';

            const response = await fetch(`${WHATSAPP_API}/send-message`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clientId: CLIENT_ID,
                    phone: testPhone.trim(),
                    message
                })
            });

            const result = await response.json();
            if (result.success) {
                alert('Test message sent successfully!');
            } else {
                alert(`Failed to send message: ${result.error || 'Unknown error'}`);
            }
        } catch {
            alert('Error sending message. Please make sure the service is connected.');
        } finally {
            setIsTesting(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 pb-24 selection:bg-emerald-500 selection:text-white">
            {/* Ambient glows */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-5%] left-[30%] w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[130px]" />
                <div className="absolute bottom-[10%] right-[10%] w-[350px] h-[350px] bg-teal-500/5 rounded-full blur-[100px]" />
            </div>

            {/* Header */}
            <div className="relative border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl px-6 lg:px-12 py-8">
                <div className="max-w-2xl mx-auto">
                    <Link
                        href="/settings"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-200 transition-colors mb-6 group"
                    >
                        <BackIcon className="text-[16px] group-hover:-translate-x-0.5 transition-transform" />
                        Back to Settings
                    </Link>
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                            <WhatsAppIcon className="text-emerald-400 text-[26px]" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black bg-gradient-to-r from-emerald-200 to-teal-300 bg-clip-text text-transparent tracking-tight">
                                WhatsApp Notifications
                            </h1>
                            <p className="text-slate-400 text-sm mt-0.5 font-medium">
                                Link your WhatsApp account for real-time task and schedule reminders
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="relative max-w-2xl mx-auto px-6 lg:px-12 mt-10 space-y-6">
                {/* Premium Banner */}
                {user && !authLoading && (
                    isPremium ? (
                        <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-[20px] p-4 flex items-center gap-3">
                            <span className="text-xl">✨</span>
                            <div className="text-sm">
                                <p className="font-extrabold text-emerald-400">Premium Account Active</p>
                                <p className="text-slate-400 text-xs mt-0.5">Your project ID <code className="text-emerald-400 font-mono text-[11px]">{CLIENT_ID}</code> is verified. WhatsApp reminders are active until {premiumDetails?.membershipTill}.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-red-950/20 border border-red-500/30 rounded-[20px] p-4 flex items-center gap-3">
                            <span className="text-xl">⚠️</span>
                            <div className="text-sm">
                                <p className="font-extrabold text-red-450 text-red-400">Premium Membership Required</p>
                                <p className="text-slate-400 text-xs mt-0.5">Your project ID <code className="text-red-450 text-red-400 font-mono text-[11px]">{CLIENT_ID || 'undefined'}</code> is not registered on a premium plan. Reminders are disabled. Please contact support to upgrade.</p>
                            </div>
                        </div>
                    )
                )}
                {/* Authentication Loading or Initial Setup Loading */}
                {(authLoading || isResetting || (isLoading && !error && !sessionInitialized)) ? (
                    <div className="bg-slate-900/60 border border-slate-800 rounded-[28px] p-8 text-center flex flex-col items-center gap-4">
                        <span className="inline-block w-8 h-8 border-2 border-slate-800 border-t-emerald-500 rounded-full animate-spin" />
                        <span className="text-slate-400 text-xs font-bold animate-pulse">
                            {authLoading 
                                ? 'Loading user authentication...' 
                                : isResetting 
                                ? 'Resetting WhatsApp session...' 
                                : 'Connecting to WhatsApp service...'}
                        </span>
                    </div>
                ) : !user ? (
                    /* Not logged in */
                    <div className="bg-slate-900/60 border border-slate-800 rounded-[28px] p-8 text-center flex flex-col items-center gap-4">
                        <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                            <InfoIcon className="text-amber-400 text-[32px]" />
                        </div>
                        <h2 className="text-xl font-extrabold text-white">Authentication Required</h2>
                        <p className="text-slate-400 text-sm max-w-sm leading-relaxed">
                            Please sign in or register to set up WhatsApp notifications. Guest accounts also support reminders automatically.
                        </p>
                        <Link
                            href="/user/login"
                            className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-extrabold rounded-xl transition-all hover:scale-105 active:scale-95 text-xs shadow-lg shadow-amber-500/20"
                        >
                            Sign In / Sign Up
                        </Link>
                    </div>
                ) : error ? (
                    /* Error State */
                    <div className="bg-red-950/20 border border-red-500/30 rounded-[28px] p-6 space-y-4">
                        <div className="flex items-center gap-2">
                            <InfoIcon className="text-red-400" />
                            <h2 className="text-lg font-bold text-red-300">Connection Failed</h2>
                        </div>
                        <p className="text-slate-400 text-sm leading-relaxed font-medium text-red-400/90">
                            {error}
                        </p>
                        <div className="text-xs text-slate-500 bg-slate-900/50 p-4 rounded-xl border border-slate-800 space-y-2">
                            <p><strong>Attempted Endpoint:</strong> <code className="text-emerald-400 font-mono">{WHATSAPP_API}</code></p>
                            <p><strong>Client ID:</strong> <code className="text-emerald-400 font-mono">{CLIENT_ID}</code></p>
                            <p className="leading-relaxed mt-2 text-[10px] text-slate-400">
                                💡 Make sure your backend service environment variable <code className="text-red-400 font-mono">NEXT_PUBLIC_WHATSAPP_SERVER_URL</code> is correctly set.
                            </p>
                        </div>
                        <button
                            onClick={handleResetSession}
                            className="w-full bg-slate-800 hover:bg-slate-700 text-white font-semibold py-3 rounded-2xl transition-all border border-slate-700 hover:border-slate-600 hover:scale-[1.02] active:scale-95 text-sm"
                        >
                            Try Reinitializing Session
                        </button>
                    </div>
                ) : !isReady && qrCode ? (
                    /* QR Code Display */
                    <div className="bg-slate-900/60 border border-slate-800 rounded-[28px] p-8">
                        <div className="flex flex-col items-center text-center gap-6">
                            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 animate-pulse">
                                <QrCodeIcon className="text-emerald-400 text-[32px]" />
                            </div>
                            <div>
                                <h2 className="text-xl font-extrabold text-white">Link WhatsApp</h2>
                                <p className="text-slate-400 text-sm mt-2 max-w-sm leading-relaxed font-medium">
                                    Open WhatsApp on your phone → Settings/Menu → Linked Devices → Link a Device, and scan the QR code below.
                                </p>
                            </div>
                            
                            <div className="bg-white p-4 rounded-2xl border-4 border-slate-800 shadow-2xl flex items-center justify-center">
                                <QRCodeSVG value={qrCode} size={224} />
                            </div>
                            
                            <div className="flex flex-col items-center gap-2">
                                <p className="text-xs text-slate-400 font-bold animate-pulse">
                                    Waiting for you to scan...
                                </p>
                                <p className="text-[10px] text-slate-500 max-w-xs leading-relaxed">
                                    Your interface will refresh automatically once connection is established.
                                </p>
                            </div>

                            <button
                                onClick={handleResetSession}
                                className="mt-4 px-6 py-2.5 rounded-xl border border-slate-800 hover:border-slate-700 bg-slate-900/40 hover:bg-slate-900 text-slate-400 hover:text-white text-xs font-bold transition-all"
                            >
                                🔄 Regenerate QR / Reset Session
                            </button>
                        </div>
                    </div>
                ) : !isReady && !qrCode ? (
                    /* Generating QR State */
                    <div className="bg-slate-900/60 border border-slate-800 rounded-[28px] p-8 text-center flex flex-col items-center gap-6">
                        <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                            <WhatsAppIcon className="text-emerald-400 text-[32px] animate-bounce" />
                        </div>
                        <div>
                            <h2 className="text-xl font-extrabold text-white">Generating QR Code</h2>
                            <p className="text-slate-400 text-sm mt-2 max-w-sm leading-relaxed font-medium">
                                The WhatsApp service is initializing a private session. This can take up to 20 seconds.
                            </p>
                        </div>
                        <span className="inline-block w-8 h-8 border-2 border-slate-800 border-t-emerald-500 rounded-full animate-spin" />
                        
                        <div className="text-xs text-slate-500 bg-slate-900/50 p-4 rounded-xl border border-slate-800 w-full max-w-md space-y-1.5">
                            <p><strong>Session ID:</strong> <code className="text-emerald-400 font-mono">{CLIENT_ID}</code></p>
                            <p><strong>Server Endpoint:</strong> <code className="text-emerald-400 font-mono">{WHATSAPP_API}</code></p>
                        </div>

                        <button
                            onClick={handleResetSession}
                            className="px-6 py-2.5 rounded-xl border border-slate-800 hover:border-slate-700 bg-slate-900/40 hover:bg-slate-900 text-slate-400 hover:text-white text-xs font-bold transition-all"
                        >
                            🔄 Reset Stuck Session
                        </button>
                    </div>
                ) : (
                    /* Connected State */
                    <div className="bg-slate-900/60 border border-emerald-500/30 rounded-[28px] p-8 relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent pointer-events-none" />
                        <div className="flex flex-col items-center text-center gap-6">
                            <div className="relative w-20 h-20 rounded-full bg-emerald-500/15 border-2 border-emerald-500/40 shadow-lg shadow-emerald-500/20 flex items-center justify-center">
                                <WhatsAppIcon className="text-emerald-400 text-[36px]" />
                                <div className="absolute inset-0 rounded-full border-2 border-emerald-400/30 animate-ping" />
                            </div>
                            
                            <div>
                                <h2 className="text-xl font-extrabold text-emerald-300">WhatsApp Connected ✓</h2>
                                <p className="text-slate-400 text-sm mt-2 max-w-sm leading-relaxed font-medium">
                                    Your account is linked. You will now receive task notifications, schedule reminders, and goal check-ins directly on WhatsApp.
                                </p>
                            </div>

                            <div className="w-full max-w-sm border border-slate-800 bg-slate-950/50 rounded-2xl p-5 space-y-4 text-left">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                                    <SendIcon className="text-[14px] text-emerald-400" />
                                    Send Test Message
                                </h3>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Recipient Phone Number</label>
                                    <input
                                        type="text"
                                        value={testPhone}
                                        onChange={(e) => setTestPhone(e.target.value)}
                                        placeholder="e.g. 923231516371"
                                        className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-200 outline-none transition-all"
                                    />
                                    <p className="text-[10px] text-slate-500">
                                        Include country code without + or spaces. Example: 923231516371 (Pakistan) or 15551234567 (US).
                                    </p>
                                </div>
                                <button
                                    onClick={sendTestMessage}
                                    disabled={isTesting}
                                    className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold py-2.5 px-4 rounded-xl shadow-lg shadow-emerald-500/10 hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:scale-100 transition-all text-xs flex items-center justify-center gap-1.5"
                                >
                                    {isTesting ? (
                                        <>
                                            <span className="inline-block w-3 h-3 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                                            Sending...
                                        </>
                                    ) : (
                                        <>
                                            <SendIcon className="text-[14px]" />
                                            Send Test Message
                                        </>
                                    )}
                                </button>
                            </div>
                            
                            <button
                                onClick={handleResetSession}
                                className="w-full max-w-sm bg-slate-900/80 hover:bg-slate-900 text-slate-400 hover:text-red-400 font-bold py-3 px-6 rounded-2xl border border-slate-800 hover:border-red-950/50 hover:scale-[1.02] active:scale-95 transition-all text-xs"
                            >
                                Disconnect WhatsApp Account
                            </button>
                        </div>
                    </div>
                )}

                {/* How it works card */}
                <div className="bg-slate-900/40 border border-slate-800/80 rounded-[24px] p-6 space-y-4">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
                        <InfoIcon className="text-[15px] text-slate-600" />
                        How WhatsApp Reminders Work
                    </h3>
                    <ul className="space-y-3">
                        {[
                            { icon: '💬', text: 'Alerts are automatically sent to your linked WhatsApp number at the reminder time.' },
                            { icon: '✅', text: 'Reply "yes", "done", or "completed" to a reminder, and My Orbit will automatically mark the task done.' },
                            { icon: '🎯', text: 'For goals, reply "progress" to quickly record progress updates directly.' },
                            { icon: '🔒', text: 'Secure session handling ensures client instances remain isolated and secure.' },
                        ].map((item, i) => (
                            <li key={i} className="flex items-start gap-3 text-sm text-slate-400 font-medium">
                                <span className="text-base flex-shrink-0">{item.icon}</span>
                                <span>{item.text}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
}