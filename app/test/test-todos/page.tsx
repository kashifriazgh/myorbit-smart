'use client';

import { useEffect, useState } from 'react';
import {
    collection,
    addDoc,
    query,
    onSnapshot,
    updateDoc,
    doc,
    deleteDoc,
    orderBy
} from 'firebase/firestore';
import {
    ref as rtdbRef,
    onValue,
    remove
} from 'firebase/database';
import {
    Dialog,
    DialogContent,
    DialogActions,
    Button,
    IconButton,
    LinearProgress,
    CircularProgress,
    Snackbar,
    Alert,
    Tooltip
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import UncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import CalendarIcon from '@mui/icons-material/CalendarToday';
import SettingsIcon from '@mui/icons-material/Settings';
import AlarmIcon from '@mui/icons-material/Alarm';
import NoReminderIcon from '@mui/icons-material/NotificationsNone';
import NotificationsIcon from '@mui/icons-material/Notifications';
import PushIcon from '@mui/icons-material/NotificationsActive';
import HistoryIcon from '@mui/icons-material/History';

import { db } from '@/app/lib/firebase';
import { getSharedDatabase, requestNotificationPermissionAndGetToken, getSharedMessaging } from '@/app/lib/utils/fcm';
import {
    createWhatsAppReminder,
    updateWhatsAppReminder,
    deleteWhatsAppReminder,
    getUserWhatsAppConfig
} from '@/app/lib/utils/whatsapp-reminder';

interface Task {
    id: string;
    title: string;
    dueDate: string;
    reminderOption: 'custom' | 'none';
    customReminderTime: string;
    reminderDate?: string; // Stored as ISO string
    reminderMethod?: 'whatsapp' | 'push';
    priority?: 'low' | 'medium' | 'high';
    completed: boolean;
    createdAt: number;
    updatedAt: number;
    completedAt?: number;
    completedViaWhatsApp?: boolean;
}

interface LogEntry {
    id: string;
    time: string;
    text: string;
    type: 'info' | 'success' | 'warning' | 'error';
}

export default function TestTodosPage() {
    // States
    const [tasks, setTasks] = useState<Task[]>([]);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [pageLoading, setPageLoading] = useState(true);
    const [opLoading, setOpLoading] = useState(false);

    // Form fields
    const [formTitle, setFormTitle] = useState('');
    const [formDueDate, setFormDueDate] = useState('');
    const [formHasReminder, setFormHasReminder] = useState(false);
    const [formCustomReminderTime, setFormCustomReminderTime] = useState('');
    const [formReminderMethod, setFormReminderMethod] = useState<'whatsapp' | 'push'>('whatsapp');

    // Previews / Validation
    const [computedReminderTimeStr, setComputedReminderTimeStr] = useState<string>('');
    const [reminderIsPast, setReminderIsPast] = useState<boolean>(false);

    // Test Config States
    const [testPhone, setTestPhone] = useState('923164709208');
    const [testClientId, setTestClientId] = useState(() => {
        return process.env.NEXT_PUBLIC_CLIENT_ID || 'client-a-prod';
    });

    // SnackBar notification state
    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
        open: false,
        message: '',
        severity: 'success'
    });

    // Helper to log actions
    const addLog = (text: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
        const newLog: LogEntry = {
            id: Math.random().toString(),
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            text,
            type
        };
        setLogs(prev => [newLog, ...prev].slice(0, 15));
    };

    // Trigger Snackbar toast
    const showToast = (message: string, severity: 'success' | 'error' | 'info' = 'success') => {
        setSnackbar({ open: true, message, severity });
    };

    // Calculate dynamic reminder time
    const calculateReminderDate = (customStr: string): Date | null => {
        return customStr ? new Date(customStr) : null;
    };

    // Real-time recalculation of preview reminder time
    useEffect(() => {
        if (!formHasReminder) {
            setComputedReminderTimeStr('');
            setReminderIsPast(false);
            return;
        }

        const computedDate = calculateReminderDate(formCustomReminderTime);
        if (computedDate) {
            setComputedReminderTimeStr(computedDate.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }));
            setReminderIsPast(computedDate.getTime() <= Date.now());
        } else {
            setComputedReminderTimeStr('');
            setReminderIsPast(false);
        }
    }, [formHasReminder, formCustomReminderTime]);

    // Firestore Tasks Listener
    useEffect(() => {
        addLog('🔄 Connecting to Firestore "test-todos" stream...', 'info');
        const q = query(collection(db, 'test-todos'), orderBy('createdAt', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data: Task[] = [];
            snapshot.forEach((d) => {
                data.push({
                    id: d.id,
                    ...d.data()
                } as Task);
            });
            setTasks(data);
            setPageLoading(false);
            addLog(`📋 Loaded ${data.length} tasks from Firestore`, 'success');
        }, (err) => {
            addLog(`❌ Firestore Connection Error: ${err.message}`, 'error');
            setPageLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // RTDB task completions listener
    useEffect(() => {
        addLog('🔄 Connecting to shared RTDB for "task-completions" events...', 'info');
        let unsubscribe: (() => void) | undefined;
        let isCancelled = false;

        async function setupListener() {
            try {
                const dbInstance = await getSharedDatabase();
                if (isCancelled) return;
                
                const completionsRef = rtdbRef(dbInstance, 'task-completions');
                
                unsubscribe = onValue(completionsRef, async (snapshot) => {
                    const completions = snapshot.val();
                    if (!completions) return;

                    // Process completions
                    for (const [key, completion] of Object.entries(completions) as [string, { itemId?: string; taskId?: string; completedAt?: number; clientId?: string }][]) {
                        const targetTaskId = completion.itemId || completion.taskId;
                        
                        // SECURITY CHECK: Only process completions matching our own clientId!
                        if (completion.clientId && completion.clientId !== testClientId) {
                            continue; // Skip completions belonging to other clients
                        }

                        if (targetTaskId) {
                            try {
                                addLog(`📩 Detected WhatsApp Completion signal for Task ID: ${targetTaskId}`, 'warning');
                                
                                const taskRef = doc(db, 'test-todos', targetTaskId);
                                
                                await updateDoc(taskRef, {
                                    completed: true,
                                    completedAt: completion.completedAt || Date.now(),
                                    completedViaWhatsApp: true,
                                    updatedAt: Date.now()
                                });

                                addLog(`✅ Firestore Updated: Task "${targetTaskId}" completed via response!`, 'success');

                                // Remove event from RTDB using dbInstance
                                await remove(rtdbRef(dbInstance, `task-completions/${key}`));
                                addLog(`🗑️ RTDB Cleared: Removed completion signal "${key}"`, 'success');
                                showToast('Task completed via response!', 'success');
                                
                            } catch (err) {
                                addLog(`❌ Sync Error: ${(err as Error).message}`, 'error');
                            }
                        }
                    }
                });
            } catch (err) {
                addLog(`❌ RTDB Connection Error: ${(err as Error).message}`, 'error');
            }
        }

        setupListener();

        return () => {
            isCancelled = true;
            if (unsubscribe) unsubscribe();
        };
    }, [testClientId]);

    // FCM Foreground Notification Listener
    useEffect(() => {
        addLog('🔄 Setting up FCM foreground notification listener...', 'info');
        let unsubscribe: (() => void) | undefined;
        let isCancelled = false;

        async function setupFCMListener() {
            try {
                const messagingInstance = await getSharedMessaging();
                if (isCancelled) return;

                if (messagingInstance) {
                    const { onMessage } = await import('firebase/messaging');
                    unsubscribe = onMessage(messagingInstance, (payload) => {
                        console.log('Foreground message received in page:', payload);
                        const title = payload.notification?.title || 'FCM Reminder';
                        const body = payload.notification?.body || payload.data?.message || '';
                        
                        addLog(`🔔 Foreground FCM: "${title}" - ${body}`, 'success');
                        showToast(`🔔 ${title}: ${body}`, 'info');
                    });
                    addLog('✅ FCM foreground notification listener active!', 'success');
                } else {
                    addLog('⚠️ FCM not supported or initialized in this browser context.', 'warning');
                }
            } catch (err) {
                addLog(`❌ FCM Foreground Listener Error: ${(err as Error).message}`, 'error');
            }
        }

        setupFCMListener();

        return () => {
            isCancelled = true;
            if (unsubscribe) unsubscribe();
        };
    }, []);

    // Create a new task
    const handleCreateTask = async () => {
        if (!formTitle.trim()) return;

        setOpLoading(true);
        try {
            const computedReminderDate = formHasReminder 
                ? calculateReminderDate(formCustomReminderTime)
                : null;

            const todoData = {
                title: formTitle.trim(),
                dueDate: formDueDate,
                reminderOption: formHasReminder ? 'custom' : 'none',
                customReminderTime: formHasReminder ? formCustomReminderTime : '',
                reminderDate: computedReminderDate ? computedReminderDate.toISOString() : null,
                reminderMethod: formHasReminder ? formReminderMethod : 'whatsapp',
                completed: false,
                createdAt: Date.now(),
                updatedAt: Date.now()
            };

            addLog(`📝 Saving task "${todoData.title}" to Firestore...`, 'info');
            const todoRef = await addDoc(collection(db, 'test-todos'), todoData);
            addLog(`✅ Saved: Firestore ID is ${todoRef.id}`, 'success');

            // Save to RTDB Reminder if date is set
            if (computedReminderDate) {
                // If it is past, skip with warning
                if (computedReminderDate.getTime() <= Date.now()) {
                    addLog('⚠️ Reminder date is in the past! Skipping reminder creation.', 'warning');
                } else {
                    addLog(`⏰ Creating reminder (${todoData.reminderMethod}) in Firebase RTDB...`, 'info');
                    
                    const config = getUserWhatsAppConfig(testClientId, testPhone);
                    config.itemType = 'todo';
                    config.clientId = testClientId;
                    config.method = todoData.reminderMethod;

                    await createWhatsAppReminder(
                        {
                            title: todoData.title,
                            reminderDate: computedReminderDate,
                            id: todoRef.id,
                            dueDate: todoData.dueDate
                        },
                        config
                    );
                    addLog('✅ Reminder scheduled successfully!', 'success');
                }
            }

            showToast('Task created successfully!');
            handleCloseModal();
        } catch (err) {
            const errMsg = (err as Error).message;
            addLog(`❌ Creation Failed: ${errMsg}`, 'error');
            showToast(errMsg, 'error');
        } finally {
            setOpLoading(false);
        }
    };

    // Update existing task
    const handleUpdateTask = async () => {
        if (!editingTask || !formTitle.trim()) return;

        setOpLoading(true);
        try {
            const computedReminderDate = formHasReminder 
                ? calculateReminderDate(formCustomReminderTime)
                : null;

            const updatedTodoData = {
                title: formTitle.trim(),
                dueDate: formDueDate,
                reminderOption: formHasReminder ? 'custom' : 'none',
                customReminderTime: formHasReminder ? formCustomReminderTime : '',
                reminderDate: computedReminderDate ? computedReminderDate.toISOString() : null,
                reminderMethod: formHasReminder ? formReminderMethod : 'whatsapp',
                updatedAt: Date.now()
            };

            addLog(`📝 Updating Firestore task "${editingTask.id}"...`, 'info');
            await updateDoc(doc(db, 'test-todos', editingTask.id), updatedTodoData);
            addLog('✅ Firestore document updated', 'success');

            // Update reminder in RTDB
            const oldReminderDate = editingTask.reminderDate ? new Date(editingTask.reminderDate) : undefined;
            const config = getUserWhatsAppConfig(testClientId, testPhone);
            config.itemType = 'todo';
            config.clientId = testClientId;
            config.method = updatedTodoData.reminderMethod;

            addLog(`⏰ Syncing/Updating reminder (${updatedTodoData.reminderMethod}) in RTDB...`, 'info');
            await updateWhatsAppReminder(
                oldReminderDate,
                {
                    title: updatedTodoData.title,
                    reminderDate: computedReminderDate || undefined,
                    id: editingTask.id,
                    dueDate: updatedTodoData.dueDate
                },
                config
            );
            addLog('✅ Reminder updated in RTDB', 'success');

            showToast('Task updated successfully!');
            handleCloseModal();
        } catch (err) {
            const errMsg = (err as Error).message;
            addLog(`❌ Update Failed: ${errMsg}`, 'error');
            showToast(errMsg, 'error');
        } finally {
            setOpLoading(false);
        }
    };

    // Delete a task
    const handleDeleteTask = async (task: Task) => {
        if (!window.confirm(`Are you sure you want to delete task "${task.title}"?`)) return;

        setOpLoading(true);
        try {
            const reminderDate = task.reminderDate ? new Date(task.reminderDate) : undefined;

            addLog(`🗑️ Deleting task "${task.id}"...`, 'info');
            
            // 1. Delete WhatsApp reminder first
            if (reminderDate) {
                addLog('⏰ Deleting scheduled WhatsApp reminder from RTDB...', 'info');
                await deleteWhatsAppReminder(reminderDate, task.id, 'todo');
                addLog('🗑️ Scheduled WhatsApp reminder deleted', 'success');
            }

            // 2. Delete Firestore
            await deleteDoc(doc(db, 'test-todos', task.id));
            addLog('🗑️ Firestore document deleted', 'success');

            showToast('Task deleted successfully!');
        } catch (err) {
            const errMsg = (err as Error).message;
            addLog(`❌ Deletion Failed: ${errMsg}`, 'error');
            showToast(errMsg, 'error');
        } finally {
            setOpLoading(false);
        }
    };

    // Toggle Task completion directly
    const handleToggleComplete = async (task: Task) => {
        setOpLoading(true);
        try {
            const newCompleted = !task.completed;
            addLog(`📝 Marking task "${task.title}" as ${newCompleted ? 'Completed' : 'Pending'}...`, 'info');
            
            await updateDoc(doc(db, 'test-todos', task.id), {
                completed: newCompleted,
                completedAt: newCompleted ? Date.now() : null,
                completedViaWhatsApp: false, // marked manually
                updatedAt: Date.now()
            });

            addLog(`✅ Task marked ${newCompleted ? 'Completed' : 'Pending'} in Firestore`, 'success');
            showToast(`Task marked as ${newCompleted ? 'completed' : 'pending'}`);
        } catch (err) {
            const errMsg = (err as Error).message;
            addLog(`❌ Toggle Failed: ${errMsg}`, 'error');
            showToast(errMsg, 'error');
        } finally {
            setOpLoading(false);
        }
    };

    // Helper to format datetime-local input value
    const formatDateTimeLocal = (date: Date): string => {
        const pad = (n: number) => n.toString().padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    };

    // Open creation modal
    const handleOpenCreateModal = () => {
        setModalMode('create');
        setEditingTask(null);
        
        // Set default values for 1-click test task creation
        const now = new Date();
        const defaultTitle = `Test Task No #${tasks.length + 1} - ${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        const defaultDueDate = formatDateTimeLocal(now);
        
        // Calculate reminder time: current time + 2 or 3 minutes based on seconds
        const reminderDate = new Date(now);
        if (now.getSeconds() < 30) {
            reminderDate.setMinutes(reminderDate.getMinutes() + 2);
        } else {
            reminderDate.setMinutes(reminderDate.getMinutes() + 3);
        }
        const defaultReminderTime = formatDateTimeLocal(reminderDate);
        
        setFormTitle(defaultTitle);
        setFormDueDate(defaultDueDate);
        setFormHasReminder(true); // Reminder ON by default
        setFormCustomReminderTime(defaultReminderTime);
        setFormReminderMethod('whatsapp');
        setIsModalOpen(true);
    };

    // Open edit modal
    const handleOpenEditModal = (task: Task) => {
        setModalMode('edit');
        setEditingTask(task);
        setFormTitle(task.title);
        setFormDueDate(task.dueDate || '');
        setFormHasReminder(!!task.reminderDate);
        setFormCustomReminderTime(task.customReminderTime || '');
        setFormReminderMethod(task.reminderMethod || 'whatsapp');
        setIsModalOpen(true);
    };

    // Close modal
    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingTask(null);
    };

    // Quick set test phone suggestions
    const setQuickPhone = (num: string) => {
        setTestPhone(num);
        addLog(`🧪 Switched active testing number to: ${num}`, 'info');
    };

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 font-sans selection:bg-teal-500 selection:text-white pb-20">
            {/* Top Micro Loading Indicator */}
            {opLoading && <LinearProgress className="fixed top-0 left-0 right-0 z-50 bg-teal-900/50" sx={{ '& .MuiLinearProgress-bar': { backgroundColor: '#14b8a6' } }} />}

            {/* Glowing Premium Header */}
            <div className="relative overflow-hidden bg-gradient-to-b from-slate-950 to-slate-900 border-b border-slate-800 py-8 px-6 lg:px-16">
                {/* Background decorative glows */}
                <div className="absolute top-[-20%] left-[10%] w-[400px] h-[400px] bg-teal-500/10 rounded-full blur-[120px] pointer-events-none" />
                <div className="absolute top-[-10%] right-[10%] w-[350px] h-[350px] bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none" />

                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
                    <div>
                        <div className="flex items-center gap-3">
                            <span className="px-3 py-1 bg-teal-500/15 border border-teal-500/30 text-teal-400 text-xs font-extrabold tracking-widest rounded-full uppercase">
                                Testing & Diagnostic Lab
                            </span>
                        </div>
                        <h1 className="text-3xl lg:text-4xl font-black mt-2 bg-gradient-to-r from-teal-200 via-cyan-300 to-emerald-200 bg-clip-text text-transparent tracking-tight">
                            WhatsApp Reminders & Tasks 🚀
                        </h1>
                        <p className="text-slate-400 text-sm mt-1 max-w-2xl font-medium">
                            Create tasks, schedule automated WhatsApp warnings, and witness real-time completions synced via Firebase Realtime Database.
                        </p>
                    </div>

                    <Button
                        variant="contained"
                        onClick={handleOpenCreateModal}
                        startIcon={<AddIcon />}
                        className="rounded-2xl bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 shadow-xl shadow-teal-500/25 px-6 py-3 font-extrabold normal-case transition-all scale-100 hover:scale-105 active:scale-95"
                    >
                        Create Test Task
                    </Button>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 lg:px-8 mt-10 grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* Left Side: Todo List & Status (8 Columns) */}
                <div className="lg:col-span-8 space-y-8">
                    
                    {/* Diagnostic Statistics Panel */}
                    <div className="bg-slate-950/40 border border-slate-800 rounded-[28px] p-6 backdrop-blur-xl">
                        <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 mb-4 flex items-center gap-2">
                            <span>📈 Live Diagnostic Dashboard</span>
                        </h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="p-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl">
                                <div className="text-2xl font-black text-white">{tasks.length}</div>
                                <div className="text-xs font-bold text-slate-400 mt-1">Total Tasks</div>
                            </div>
                            <div className="p-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl">
                                <div className="text-2xl font-black text-emerald-400">
                                    {tasks.filter(t => t.completed).length}
                                </div>
                                <div className="text-xs font-bold text-slate-400 mt-1">Completed Tasks</div>
                            </div>
                            <div className="p-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl">
                                <div className="text-2xl font-black text-teal-400">
                                    {tasks.filter(t => t.completed && t.completedViaWhatsApp).length}
                                </div>
                                <div className="text-xs font-bold text-slate-400 mt-1">via WhatsApp 💬</div>
                            </div>
                            <div className="p-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl">
                                <div className="text-2xl font-black text-amber-400">
                                    {tasks.filter(t => t.reminderDate && !t.completed).length}
                                </div>
                                <div className="text-xs font-bold text-slate-400 mt-1">Active Reminders</div>
                            </div>
                        </div>
                    </div>

                    {/* Todos List Section */}
                    <div>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                                <span>📋 Task Inventory</span>
                                {tasks.length > 0 && (
                                    <span className="text-xs px-2.5 py-0.5 bg-slate-800 text-slate-300 font-extrabold rounded-full">
                                        {tasks.length}
                                    </span>
                                )}
                            </h2>
                        </div>

                        {pageLoading ? (
                            <div className="flex flex-col items-center justify-center py-20 bg-slate-950/20 border border-slate-800 rounded-[28px] gap-4">
                                <CircularProgress className="text-teal-500" />
                                <p className="text-slate-400 text-sm font-semibold animate-pulse">Streaming database records...</p>
                            </div>
                        ) : tasks.length === 0 ? (
                            <div className="flex flex-col items-center justify-center text-center py-16 px-6 bg-slate-950/20 border border-slate-800/80 border-dashed rounded-[28px]">
                                <span className="text-4xl mb-4">💤</span>
                                <h3 className="text-lg font-bold text-slate-300">No diagnostic tasks found</h3>
                                <p className="text-slate-500 text-sm max-w-sm mt-1 font-medium">
                                    Create a test task using the button at the top right to start testing your real-time synchronization.
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {tasks.map((task) => {
                                    const hasReminder = !!task.reminderDate;
                                    const isReminderPast = hasReminder && new Date(task.reminderDate!).getTime() < Date.now();

                                    return (
                                        <div
                                            key={task.id}
                                            className={`
                                                group relative bg-slate-950/40 rounded-2xl p-5 hover:bg-slate-950/60 
                                                transition-all duration-300 hover:shadow-xl hover:shadow-slate-950/40 hover:-translate-y-0.5
                                                border border-slate-800 ${task.completed ? 'opacity-70' : ''}
                                            `}
                                        >
                                            {/* Header Section of card */}
                                            <div className="flex justify-between items-start gap-3">
                                                <div className="flex items-start gap-3 flex-1">
                                                    <IconButton
                                                        onClick={() => handleToggleComplete(task)}
                                                        className="p-0 text-slate-500 hover:text-teal-400 transition-colors"
                                                    >
                                                        {task.completed ? (
                                                            <CheckCircleIcon className="text-emerald-500" fontSize="medium" />
                                                        ) : (
                                                            <UncheckedIcon className="text-slate-600 group-hover:text-slate-500" fontSize="medium" />
                                                        )}
                                                    </IconButton>
                                                    <div className="flex-1">
                                                        <h3 className={`text-base font-bold text-white tracking-tight ${task.completed ? 'line-through text-slate-400' : ''}`}>
                                                            {task.title}
                                                        </h3>

                                                        {/* Due info */}
                                                        {task.dueDate && (
                                                            <div className="flex items-center gap-2 flex-wrap mt-2">
                                                                <span className="flex items-center gap-1 text-slate-400 text-xs font-semibold">
                                                                    <CalendarIcon className="text-[14px]" />
                                                                    {new Date(task.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Reminder status details */}
                                            <div className="mt-4 pt-3 border-t border-slate-900 flex items-center justify-between flex-wrap gap-2 text-xs">
                                                {hasReminder ? (
                                                    <Tooltip title={`Triggering at: ${new Date(task.reminderDate!).toLocaleString()}`}>
                                                        <span className={`
                                                            flex items-center gap-1.5 px-2.5 py-1 rounded-full font-bold
                                                            ${isReminderPast 
                                                                ? 'bg-slate-800 text-slate-400' 
                                                                : task.reminderMethod === 'push'
                                                                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                                                    : 'bg-teal-500/10 text-teal-400 border border-teal-500/20'}
                                                        `}>
                                                            {task.reminderMethod === 'push' ? (
                                                                <>
                                                                    <PushIcon className="text-[14px] text-amber-400" />
                                                                    {isReminderPast 
                                                                        ? 'Push Sent/Passed' 
                                                                        : `Push: ${new Date(task.reminderDate!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <WhatsAppIcon className="text-[14px] text-teal-400" />
                                                                    {isReminderPast 
                                                                        ? 'Reminder Sent/Passed' 
                                                                        : `WhatsApp: ${new Date(task.reminderDate!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                                                                </>
                                                            )}
                                                        </span>
                                                    </Tooltip>
                                                ) : (
                                                    <span className="flex items-center gap-1 text-slate-500 font-bold px-2.5 py-1">
                                                        <NoReminderIcon className="text-[14px]" />
                                                        No Reminder
                                                    </span>
                                                )}

                                                {/* WhatsApp completion confirmation badge */}
                                                {task.completed && (
                                                    <span className={`
                                                        px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wide
                                                        ${task.completedViaWhatsApp 
                                                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 flex items-center gap-1' 
                                                            : 'bg-slate-800 text-slate-400'}
                                                    `}>
                                                        {task.completedViaWhatsApp && <WhatsAppIcon className="text-[11px]" />}
                                                        {task.completedViaWhatsApp ? 'via WhatsApp' : 'Manually Done'}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Action hovering hover-buttons */}
                                            <div className="absolute right-3 top-3 flex items-center opacity-0 group-hover:opacity-100 transition-opacity bg-slate-950/90 rounded-xl p-1 border border-slate-800 shadow-md">
                                                <IconButton
                                                    onClick={() => handleOpenEditModal(task)}
                                                    size="small"
                                                    className="text-slate-400 hover:text-white p-1.5"
                                                    title="Edit / Reschedule Task"
                                                >
                                                    <EditIcon fontSize="small" />
                                                </IconButton>
                                                <IconButton
                                                    onClick={() => handleDeleteTask(task)}
                                                    size="small"
                                                    className="text-slate-400 hover:text-red-400 p-1.5"
                                                    title="Delete Task & Reminders"
                                                >
                                                    <DeleteIcon fontSize="small" />
                                                </IconButton>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Side: Lab Controls & Diagnostic Terminal (4 Columns) */}
                <div className="lg:col-span-4 space-y-8">
                    
                    {/* WhatsApp Device Emulator Control Panel */}
                    <div className="bg-slate-950/40 border border-slate-800 rounded-[28px] p-6 backdrop-blur-xl space-y-5">
                        <div>
                            <h2 className="text-base font-bold text-white flex items-center gap-2">
                                <SettingsIcon className="text-teal-400" />
                                <span>🧪 Diagnostic Simulator</span>
                            </h2>
                            <p className="text-slate-400 text-xs mt-1">
                                Configure the target WhatsApp account and client session to test notifications.
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-500 mb-2">
                                    Target WhatsApp Phone
                                </label>
                                <input
                                    type="text"
                                    value={testPhone}
                                    onChange={(e) => setTestPhone(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-teal-500 transition-colors"
                                    placeholder="Phone with country code (e.g. 92...)"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-500 mb-2">
                                    Client Session ID
                                </label>
                                <input
                                    type="text"
                                    value={testClientId}
                                    onChange={(e) => setTestClientId(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm font-bold text-slate-300 focus:outline-none focus:border-teal-500 transition-colors"
                                    placeholder="Session identification"
                                />
                            </div>

                            {/* Shortcut config suggestions */}
                                <div>
                                    <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-500 mb-2">
                                        🎯 Quick-Load Presets
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            onClick={() => setQuickPhone('923164709208')}
                                            className="text-[10px] font-extrabold bg-slate-900 hover:bg-teal-500/10 hover:text-teal-400 border border-slate-800 rounded-lg px-2.5 py-1.5 transition-colors"
                                        >
                                            kashif (+92 316...)
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Push Notifications Configuration */}
                            <div className="pt-4 border-t border-slate-900 space-y-3">
                                <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
                                    🔔 Web Push Notifications
                                </label>
                                <button
                                    onClick={async () => {
                                        addLog('🔔 Requesting Push Notification permissions & token...', 'info');
                                        try {
                                            const token = await requestNotificationPermissionAndGetToken(testClientId, testClientId);
                                            if (token) {
                                                addLog('✅ Push notifications enabled! Token saved to RTDB.', 'success');
                                                showToast('Push Notifications enabled successfully!', 'success');
                                            }
                                        } catch (err) {
                                            addLog(`❌ FCM Permission Error: ${(err as Error).message}`, 'error');
                                            showToast((err as Error).message, 'error');
                                        }
                                    }}
                                    className="w-full bg-slate-900 hover:bg-teal-500/15 hover:text-teal-400 border border-slate-800 hover:border-teal-500/30 text-teal-300 font-bold py-2.5 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-2"
                                >
                                    <NotificationsIcon className="text-[14px]" />
                                    Enable Push (Request Token)
                                </button>
                            </div>
                        </div>

                    {/* Live Diagnostic Logs Terminal */}
                    <div className="bg-slate-950/40 border border-slate-800 rounded-[28px] p-6 backdrop-blur-xl flex flex-col h-[400px]">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-base font-bold text-white flex items-center gap-2">
                                <HistoryIcon className="text-teal-400" />
                                <span>📟 Activity Console</span>
                            </h2>
                            <button
                                onClick={() => setLogs([])}
                                className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 hover:text-teal-400 transition-colors"
                            >
                                Clear logs
                            </button>
                        </div>

                        {/* Scrolling log contents */}
                        <div className="flex-1 bg-slate-950/80 border border-slate-900 rounded-2xl p-4 font-mono text-[11px] overflow-y-auto space-y-3 custom-scrollbar">
                            {logs.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-slate-600 text-center italic">
                                    Interactive events and telemetry will stream here in real-time.
                                </div>
                            ) : (
                                logs.map((log) => {
                                    const colors = {
                                        info: 'text-sky-400',
                                        success: 'text-emerald-400',
                                        warning: 'text-amber-400',
                                        error: 'text-red-400'
                                    };

                                    return (
                                        <div key={log.id} className="leading-5 border-b border-slate-900/50 pb-1.5 last:border-0 last:pb-0">
                                            <span className="text-slate-600 mr-2">[{log.time}]</span>
                                            <span className={`${colors[log.type]} font-medium`}>{log.text}</span>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                </div>

            </div>

            {/* Premium Create / Edit Modal Dialog */}
            <Dialog
                open={isModalOpen}
                onClose={handleCloseModal}
                maxWidth="sm"
                fullWidth
                PaperProps={{
                    className: "rounded-[28px] overflow-hidden shadow-2xl bg-slate-900 border border-slate-800 text-slate-100",
                    sx: { borderRadius: '28px', backgroundImage: 'none' }
                }}
            >
                {/* Header Gradient */}
                <div className="p-6 bg-gradient-to-br from-teal-500 to-cyan-700 text-white flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-extrabold tracking-tight">
                            {modalMode === 'create' ? 'Create Diagnostic Task 📝' : 'Edit & Reschedule Task ✏️'}
                        </h3>
                        <p className="text-xs text-teal-100 mt-1">
                            Set parameters to verify live real-time notifications
                        </p>
                    </div>
                    <IconButton onClick={handleCloseModal} className="text-white hover:bg-white/20 transition-colors">
                        <CloseIcon />
                    </IconButton>
                </div>

                <DialogContent className="p-6 space-y-6">
                    {/* Task Title */}
                    <div>
                        <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2">
                            Task Title <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={formTitle}
                            onChange={(e) => setFormTitle(e.target.value)}
                            placeholder="What task needs to be tested?"
                            className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-2xl px-4 py-3.5 text-sm font-semibold text-white focus:outline-none transition-all placeholder:text-slate-600"
                        />
                    </div>

                    {/* Due Date */}
                    <div>
                        <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2">
                            Due Date & Time <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="datetime-local"
                            value={formDueDate}
                            onChange={(e) => setFormDueDate(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-2xl px-4 py-3.5 text-sm font-semibold text-white focus:outline-none transition-all"
                        />
                    </div>

                    {/* Task Reminder Section */}
                    <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                {formReminderMethod === 'push' ? (
                                    <PushIcon className="text-amber-400" />
                                ) : (
                                    <WhatsAppIcon className="text-teal-400" />
                                )}
                                <span className="text-sm font-bold text-slate-200">Set Task Reminder</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setFormHasReminder(!formHasReminder)}
                                className={`
                                    px-4 py-1.5 rounded-full text-xs font-black uppercase transition-all
                                    ${formHasReminder 
                                        ? 'bg-teal-500 text-slate-950 shadow-lg shadow-teal-500/25' 
                                        : 'bg-slate-800 text-slate-400 border border-slate-700/50'}
                                `}
                            >
                                {formHasReminder ? 'Enabled ✓' : 'Disabled'}
                            </button>
                        </div>

                        {formHasReminder && (
                            <div className="space-y-4 pt-3 border-t border-slate-900 animate-fadeIn">
                                {/* Reminder Method Selection */}
                                <div>
                                    <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2">
                                        Reminder Dispatch Method
                                    </label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setFormReminderMethod('whatsapp')}
                                            className={`
                                                py-2.5 px-2 rounded-xl text-xs font-extrabold border transition-all flex items-center justify-center gap-1.5
                                                ${formReminderMethod === 'whatsapp'
                                                    ? 'bg-teal-500/10 text-teal-400 border-teal-500/50 shadow-inner'
                                                    : 'bg-slate-900 text-slate-500 border-slate-800/80 hover:text-slate-400'}
                                            `}
                                        >
                                            <WhatsAppIcon className="text-[14px]" />
                                            WhatsApp Message
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setFormReminderMethod('push')}
                                            className={`
                                                py-2.5 px-2 rounded-xl text-xs font-extrabold border transition-all flex items-center justify-center gap-1.5
                                                ${formReminderMethod === 'push'
                                                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/50 shadow-inner'
                                                    : 'bg-slate-900 text-slate-500 border-slate-800/80 hover:text-slate-400'}
                                            `}
                                        >
                                            <PushIcon className="text-[14px]" />
                                            Push Notification
                                        </button>
                                    </div>
                                </div>

                                {/* Custom Reminder Time */}
                                <div>
                                    <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2">
                                        Reminder Date & Time
                                    </label>
                                    <input
                                        type="datetime-local"
                                        value={formCustomReminderTime}
                                        onChange={(e) => setFormCustomReminderTime(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl px-4 py-3 text-sm font-semibold text-white focus:outline-none transition-all"
                                    />
                                </div>

                                {/* Live preview text */}
                                {computedReminderTimeStr && (
                                    <div className={`
                                        p-3.5 rounded-xl border flex items-start gap-2.5 text-xs font-semibold leading-5
                                        ${reminderIsPast 
                                            ? 'bg-red-500/10 border-red-500/20 text-red-400' 
                                            : 'bg-teal-500/10 border-teal-500/20 text-teal-300'}
                                    `}>
                                        <AlarmIcon className="text-[16px] mt-0.5 flex-shrink-0" />
                                        <div>
                                            {reminderIsPast ? (
                                                <span>
                                                    <strong>Skipped!</strong> Trigger is set for <strong>{computedReminderTimeStr}</strong>, which is in the past! WhatsApp notifications only send for future tasks.
                                                </span>
                                            ) : (
                                                <span>
                                                    Trigger scheduled for <strong>{computedReminderTimeStr}</strong> (WhatsApp reminder will push at this exact minute).
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </DialogContent>

                <DialogActions className="p-6 bg-slate-950/20 border-t border-slate-850 gap-3">
                    <Button
                        onClick={handleCloseModal}
                        className="rounded-xl font-bold px-5 py-2.5 normal-case text-slate-400 hover:bg-slate-800 transition-colors"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={modalMode === 'create' ? handleCreateTask : handleUpdateTask}
                        disabled={opLoading || !formTitle.trim() || !formDueDate || (formHasReminder && !formCustomReminderTime)}
                        variant="contained"
                        className="rounded-xl font-extrabold px-6 py-2.5 normal-case bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 shadow-lg shadow-teal-500/20 disabled:opacity-50 transition-all"
                    >
                        {opLoading ? <CircularProgress size={20} className="text-slate-950" /> : modalMode === 'create' ? 'Create Task' : 'Save Changes'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Custom styled snackbar toast */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={4000}
                onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            >
                <Alert
                    onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
                    severity={snackbar.severity}
                    className="rounded-xl shadow-xl font-bold bg-slate-950 text-white border border-slate-800"
                    sx={{
                        '& .MuiAlert-icon': {
                            color: snackbar.severity === 'success' ? '#10b981' : '#f43f5e'
                        }
                    }}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </div>
    );
}