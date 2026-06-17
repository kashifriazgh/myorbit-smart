'use client';

import { useState, useEffect } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase, ref, set, get } from 'firebase/database';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db as firestoreDb, app as firestoreApp } from '@/app/lib/firebase';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AppSnapshot {
  name: string;
  projectId: string | undefined;
  apiKey: string | undefined;
  authDomain: string | undefined;
  databaseURL: string | undefined;
  appId: string | undefined;
  isDefault: boolean;
}

interface EnvSnapshot {
  key: string;
  value: string;
  present: boolean;
}

type Status = 'idle' | 'running' | 'ok' | 'error';

interface CheckResult {
  status: Status;
  message: string;
  detail?: string;
}

// ─── Hardcoded RTDB config (same as fcm.ts / firestore.ts) ───────────────────

const hardcodedRtdbConfig = {
  apiKey: 'AIzaSyDZFNapAjmnS0TZIM1lK8wNA4PDgedVnRo',
  authDomain: 'forms-389a6.firebaseapp.com',
  databaseURL:
    'https://forms-389a6-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'forms-389a6',
  storageBucket: 'forms-389a6.firebasestorage.app',
  messagingSenderId: '721032079467',
  appId: '1:721032079467:web:b525c93448811b8bf4292e',
};

function getHardcodedRtdb() {
  const appName = 'diagnostic-rtdb-app';
  const existingApp = getApps().find((a) => a.name === appName);
  const app = existingApp || initializeApp(hardcodedRtdbConfig, appName);
  return getDatabase(app);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function maskKey(val: string | undefined): string {
  if (!val) return '—';
  if (val.length <= 8) return '••••••••';
  return val.slice(0, 6) + '••••' + val.slice(-4);
}

function badge(present: boolean) {
  return present
    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
    : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400';
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function TestDiagnosticsPage() {
  const [registeredApps, setRegisteredApps] = useState<AppSnapshot[]>([]);
  const [envVars, setEnvVars] = useState<EnvSnapshot[]>([]);
  const [defaultAppMatchesEnv, setDefaultAppMatchesEnv] = useState<
    boolean | null
  >(null);
  const [firestoreResult, setFirestoreResult] = useState<CheckResult>({
    status: 'idle',
    message: 'Not tested yet.',
  });
  const [rtdbResult, setRtdbResult] = useState<CheckResult>({
    status: 'idle',
    message: 'Not tested yet.',
  });
  const [conflictWarnings, setConflictWarnings] = useState<string[]>([]);

  // ── Snapshot all Firebase apps on mount ──
  useEffect(() => {
    const envMap: EnvSnapshot[] = [
      {
        key: 'NEXT_PUBLIC_FIREBASE_API_KEY',
        value: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
        present: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      },
      {
        key: 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
        value: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
        present: !!process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      },
      {
        key: 'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
        value: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
        present: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      },
      {
        key: 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
        value: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
        present: !!process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      },
      {
        key: 'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
        value: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
        present: !!process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      },
      {
        key: 'NEXT_PUBLIC_FIREBASE_APP_ID',
        value: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
        present: !!process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      },
    ];
    setEnvVars(envMap);

    // Snapshot all currently registered Firebase apps
    const apps = getApps();
    const snapshots: AppSnapshot[] = apps.map((a) => ({
      name: a.name,
      projectId: a.options.projectId,
      apiKey: a.options.apiKey,
      authDomain: a.options.authDomain,
      databaseURL: a.options.databaseURL,
      appId: a.options.appId,
      isDefault: a.name === '[DEFAULT]',
    }));
    setRegisteredApps(snapshots);

    // ── Conflict detection ──
    const warnings: string[] = [];
    const envProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const envApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

    // 1. Check if default app's projectId matches env
    let defaultApp: AppSnapshot | undefined;
    try {
      const da = getApp(); // throws if no default app
      defaultApp = {
        name: da.name,
        projectId: da.options.projectId,
        apiKey: da.options.apiKey,
        authDomain: da.options.authDomain,
        databaseURL: da.options.databaseURL,
        appId: da.options.appId,
        isDefault: true,
      };
    } catch {
      warnings.push(
        'No DEFAULT Firebase app found. Firestore/Auth may not be initialised.',
      );
    }

    if (defaultApp) {
      const match = defaultApp.projectId === envProjectId;
      setDefaultAppMatchesEnv(match);
      if (!match) {
        warnings.push(
          `⚠️ DEFAULT app projectId "${defaultApp.projectId}" does NOT match env var "${envProjectId}". Firestore will use the wrong project!`,
        );
      }
      if (defaultApp.apiKey !== envApiKey) {
        warnings.push(
          `⚠️ DEFAULT app apiKey does not match NEXT_PUBLIC_FIREBASE_API_KEY. Possible stale build cache or env var mismatch.`,
        );
      }
    }

    // 2. Check firestoreApp (imported) matches env
    try {
      const importedProjectId = firestoreApp?.options?.projectId;
      if (importedProjectId && importedProjectId !== envProjectId) {
        warnings.push(
          `⚠️ Imported firestoreApp projectId "${importedProjectId}" !== env "${envProjectId}". The firebase.ts module may have been initialised with stale/wrong credentials.`,
        );
      }
    } catch {
      warnings.push('Could not inspect imported firestoreApp options.');
    }

    // 3. Detect duplicate projectIds across named apps
    const projectIds = snapshots.map((s) => s.projectId).filter(Boolean);
    const unique = new Set(projectIds);
    if (unique.size < projectIds.length) {
      warnings.push(
        `⚠️ Multiple Firebase apps share the same projectId. This may indicate unintentional duplication.`,
      );
    }

    // 4. Any named app with the RTDB projectId that is also the default?
    const rtdbProjectId = hardcodedRtdbConfig.projectId;
    const defaultIsRtdb = defaultApp?.projectId === rtdbProjectId;
    if (defaultIsRtdb) {
      warnings.push(
        `🔴 CRITICAL: The DEFAULT app is using the shared RTDB project ("${rtdbProjectId}") instead of the client Firestore project. This is the root cause of the offline error.`,
      );
    }

    setConflictWarnings(warnings);
  }, []);

  // ── Firestore check ──
  const checkFirestore = async () => {
    setFirestoreResult({ status: 'running', message: 'Connecting…' });
    try {
      const testRef = doc(firestoreDb, 'diagnostics', 'connection-test');
      const ts = new Date().toISOString();
      await setDoc(testRef, { checkedAt: ts, source: 'env-firestore' });
      const snap = await getDoc(testRef);
      if (!snap.exists())
        throw new Error('Write succeeded but read returned empty.');
      setFirestoreResult({
        status: 'ok',
        message: 'Firestore connected successfully.',
        detail: JSON.stringify(snap.data(), null, 2),
      });
    } catch (err) {
      setFirestoreResult({
        status: 'error',
        message: (err as Error).message,
        detail: (err as Error).stack?.split('\n').slice(0, 4).join('\n'),
      });
    }
  };

  // ── RTDB check ──
  const checkRtdb = async () => {
    setRtdbResult({ status: 'running', message: 'Connecting…' });
    try {
      const rtdb = getHardcodedRtdb();
      const testRef = ref(rtdb, 'diagnostics/connection-test');
      const payload = {
        checkedAt: new Date().toISOString(),
        source: 'hardcoded-rtdb',
      };
      await set(testRef, payload);
      const snap = await get(testRef);
      if (!snap.exists())
        throw new Error('Write succeeded but read returned no data.');
      setRtdbResult({
        status: 'ok',
        message: 'RTDB connected successfully.',
        detail: JSON.stringify(snap.val(), null, 2),
      });
    } catch (err) {
      setRtdbResult({
        status: 'error',
        message: (err as Error).message,
        detail: (err as Error).stack?.split('\n').slice(0, 4).join('\n'),
      });
    }
  };

  const anyBusy =
    firestoreResult.status === 'running' || rtdbResult.status === 'running';

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50 p-4 dark:bg-slate-950 sm:p-8">
      <div className="mx-auto max-w-5xl space-y-6 font-mono text-sm">
        {/* Header */}
        <div className="rounded-2xl border border-slate-200 bg-white px-8 py-6 dark:border-slate-800 dark:bg-slate-900">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            🔬 Firebase Initialization Diagnostics
          </h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">
            Detects app-override conflicts, env var mismatches, and connectivity
            issues.
          </p>
        </div>

        {/* ── Conflict Warnings ── */}
        {conflictWarnings.length > 0 && (
          <div className="rounded-2xl border border-red-300 bg-red-50 px-6 py-5 dark:border-red-800 dark:bg-red-950/40">
            <h2 className="mb-3 font-bold text-red-700 dark:text-red-400">
              🚨 Conflict / Mismatch Warnings
            </h2>
            <ul className="space-y-2">
              {conflictWarnings.map((w, i) => (
                <li key={i} className="text-red-800 dark:text-red-300">
                  {w}
                </li>
              ))}
            </ul>
          </div>
        )}

        {conflictWarnings.length === 0 && registeredApps.length > 0 && (
          <div className="rounded-2xl border border-emerald-300 bg-emerald-50 px-6 py-5 dark:border-emerald-800 dark:bg-emerald-950/40">
            <p className="font-bold text-emerald-700 dark:text-emerald-400">
              ✅ No initialization conflicts detected. App names and projectIds
              look clean.
            </p>
          </div>
        )}

        {/* ── DEFAULT app vs env match ── */}
        {defaultAppMatchesEnv !== null && (
          <div
            className={`rounded-2xl border px-6 py-4 ${
              defaultAppMatchesEnv
                ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
                : 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30'
            }`}
          >
            <span
              className={
                defaultAppMatchesEnv
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-amber-700 dark:text-amber-400'
              }
            >
              {defaultAppMatchesEnv
                ? '✅ DEFAULT app projectId matches NEXT_PUBLIC_FIREBASE_PROJECT_ID'
                : '⚠️ DEFAULT app projectId does NOT match NEXT_PUBLIC_FIREBASE_PROJECT_ID — Firestore is using the wrong project'}
            </span>
          </div>
        )}

        {/* ── Registered Apps ── */}
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-4 font-bold text-slate-800 dark:text-slate-200">
            📦 All Registered Firebase Apps ({registeredApps.length})
          </h2>
          {registeredApps.length === 0 ? (
            <p className="text-slate-500">
              No apps registered yet (module not imported?).
            </p>
          ) : (
            <div className="space-y-4">
              {registeredApps.map((a) => (
                <div
                  key={a.name}
                  className={`rounded-xl border p-4 ${
                    a.isDefault
                      ? 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/30'
                      : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/40'
                  }`}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      {a.name}
                    </span>
                    {a.isDefault && (
                      <span className="rounded-full bg-blue-200 px-2 py-0.5 text-xs text-blue-800 dark:bg-blue-800 dark:text-blue-200">
                        DEFAULT
                      </span>
                    )}
                    {a.projectId === hardcodedRtdbConfig.projectId &&
                      !a.isDefault && (
                        <span className="rounded-full bg-orange-200 px-2 py-0.5 text-xs text-orange-800 dark:bg-orange-800 dark:text-orange-200">
                          RTDB PROJECT
                        </span>
                      )}
                    {a.projectId === hardcodedRtdbConfig.projectId &&
                      a.isDefault && (
                        <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
                          ⚠️ WRONG DEFAULT
                        </span>
                      )}
                  </div>
                  <table className="w-full text-xs">
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                      {[
                        ['projectId', a.projectId],
                        ['apiKey', maskKey(a.apiKey)],
                        ['authDomain', a.authDomain],
                        ['databaseURL', a.databaseURL ?? '—'],
                        ['appId', maskKey(a.appId)],
                      ].map(([k, v]) => (
                        <tr key={k}>
                          <td className="py-1 pr-4 font-medium text-slate-500 dark:text-slate-400 w-48">
                            {k}
                          </td>
                          <td className="py-1 text-slate-800 dark:text-slate-200 break-all">
                            {v || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Env Vars ── */}
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-4 font-bold text-slate-800 dark:text-slate-200">
            🌍 Environment Variables (baked at build time)
          </h2>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="pb-2 text-left font-semibold text-slate-600 dark:text-slate-400 w-80">
                  Key
                </th>
                <th className="pb-2 text-left font-semibold text-slate-600 dark:text-slate-400">
                  Value (masked)
                </th>
                <th className="pb-2 text-left font-semibold text-slate-600 dark:text-slate-400">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {envVars.map((e) => (
                <tr key={e.key}>
                  <td className="py-2 pr-4 text-slate-700 dark:text-slate-300">
                    {e.key}
                  </td>
                  <td className="py-2 pr-4 text-slate-800 dark:text-slate-200 break-all">
                    {e.key.toLowerCase().includes('key') ||
                    e.key.toLowerCase().includes('id') ||
                    e.key.toLowerCase().includes('sender')
                      ? maskKey(e.value)
                      : e.value || '—'}
                  </td>
                  <td className="py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge(e.present)}`}
                    >
                      {e.present ? 'PRESENT' : 'MISSING'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-slate-400">
            ⓘ These are baked in at build time by Next.js. If any show MISSING
            or wrong values, trigger a fresh deploy on Netlify after saving env
            vars.
          </p>
        </div>

        {/* ── Connectivity Tests ── */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Firestore */}
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-1 font-bold text-slate-800 dark:text-slate-200">
              🔥 Firestore Write/Read Test
            </h2>
            <p className="mb-4 text-xs text-slate-500">
              Uses the imported <code>db</code> from{' '}
              <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">
                @/app/lib/firebase
              </code>
            </p>
            <button
              type="button"
              onClick={checkFirestore}
              disabled={anyBusy}
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-40 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
            >
              {firestoreResult.status === 'running'
                ? '⏳ Testing…'
                : 'Run Firestore Test'}
            </button>
            <ResultBlock result={firestoreResult} />
          </div>

          {/* RTDB */}
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-1 font-bold text-slate-800 dark:text-slate-200">
              🗄️ RTDB Write/Read Test
            </h2>
            <p className="mb-4 text-xs text-slate-500">
              Uses hardcoded config → <code>diagnostic-rtdb-app</code>
            </p>
            <button
              type="button"
              onClick={checkRtdb}
              disabled={anyBusy}
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-40 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
            >
              {rtdbResult.status === 'running'
                ? '⏳ Testing…'
                : 'Run RTDB Test'}
            </button>
            <ResultBlock result={rtdbResult} />
          </div>
        </div>

        {/* ── Imported firestoreApp Inspection ── */}
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-4 font-bold text-slate-800 dark:text-slate-200">
            🔍 Imported <code>firestoreApp</code> Inspection
          </h2>
          <table className="w-full text-xs">
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {[
                ['name', firestoreApp?.name],
                ['projectId', firestoreApp?.options?.projectId],
                ['apiKey', maskKey(firestoreApp?.options?.apiKey)],
                ['authDomain', firestoreApp?.options?.authDomain],
                ['databaseURL', firestoreApp?.options?.databaseURL ?? '—'],
              ].map(([k, v]) => {
                const envProjectId =
                  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
                const mismatch = k === 'projectId' && v && v !== envProjectId;
                return (
                  <tr key={k}>
                    <td className="py-1.5 pr-4 font-medium text-slate-500 dark:text-slate-400 w-40">
                      {k}
                    </td>
                    <td
                      className={`py-1.5 break-all ${
                        mismatch
                          ? 'font-bold text-red-600 dark:text-red-400'
                          : 'text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      {v || '—'}
                      {mismatch && (
                        <span className="ml-2 rounded bg-red-100 px-1 text-red-700 dark:bg-red-900/40 dark:text-red-400">
                          ≠ env ({envProjectId})
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Result Block ─────────────────────────────────────────────────────────────

function ResultBlock({ result }: { result: CheckResult }) {
  const colors: Record<Status, string> = {
    idle: 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400',
    running:
      'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300',
    ok: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300',
    error:
      'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300',
  };

  return (
    <div
      className={`mt-4 rounded-xl border p-4 text-xs ${colors[result.status]}`}
    >
      <p className="font-semibold">{result.message}</p>
      {result.detail && (
        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap opacity-80">
          {result.detail}
        </pre>
      )}
    </div>
  );
}
