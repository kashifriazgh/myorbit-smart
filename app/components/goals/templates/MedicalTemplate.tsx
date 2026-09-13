'use client';

import React, { useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Chip,
  IconButton,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Tooltip,
} from '@mui/material';
import {
  LocalHospital as StethoscopeIcon,
  Science as FlaskIcon,
  Medication as PillIcon,
  AccessTime as ClockIcon,
  CalendarMonth as CalendarIcon,
  Add as AddIcon,
  CheckCircle,
  RadioButtonUnchecked,
  Event as EventIcon,
  Checklist as TodoIcon,
  ExpandMore,
  ExpandLess,
  Delete as DeleteIcon,
  PlaylistAdd as PlaylistAddIcon,
  MedicalServices as MedicalServicesIcon,
  EditCalendar as EditCalendarIcon,
  TaskAlt as TaskAltIcon,
  HelpOutline as HelpIcon,
} from '@mui/icons-material';
import { Goal } from '@/app/lib/interface';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { useAuth } from '@/app/lib/context/userContext';
import { useTodoContext } from '@/app/lib/context/todoContext';
import { useSchedules } from '@/app/lib/context/SchedulesContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';

export interface MedicalAppointment {
  id: string;
  doctor: string;
  clinic?: string;
  nextDate?: string;
  history?: Array<{
    id: string;
    date: string;
    note?: string;
    completedAt?: string;
    isScheduled?: boolean;
  }>;
}

export interface MedicalTest {
  id: string;
  name: string;
  nextDate?: string;
  lastDate?: string;
  result?: 'Normal' | 'Pending' | 'Abnormal' | string;
  history?: Array<{
    id: string;
    date: string;
    note?: string;
    result?: string;
    completedAt?: string;
  }>;
}

export interface MedicalMedicine {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  prescribedBy?: string;
  history?: Array<{
    id: string;
    date: string;
    action?: string;
    note?: string;
  }>;
}

export interface MedicalScheduleSlot {
  id: string;
  time: string; // Morning, Afternoon, Evening, Night
  label: string; // e.g. 8:00 AM
  taken: boolean;
}

export interface MedicalFollowUp {
  id: string;
  type: string;
  nextDate?: string;
  notes?: string;
  history?: Array<{
    id: string;
    date: string;
    note?: string;
    completedAt?: string;
  }>;
}

interface MedicalTemplateProps {
  goal: Goal;
  onUpdateGoal?: (goalId: string, updates: Partial<Goal>) => Promise<void>;
}

function formatDate(dateStr?: string) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(dateStr?: string) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getNowLocalIso() {
  const now = new Date();
  const tzOffset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - tzOffset).toISOString().slice(0, 16);
}

const PREDEFINED_MEDICINE_FREQUENCIES = [
  'Once a day',
  'Twice a day',
  'Thrice a day',
  'Four times a day',
  'Every 8 hours',
  'As needed (PRN)',
  'Custom...',
];

export default function MedicalTemplate({ goal, onUpdateGoal }: MedicalTemplateProps) {
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';
  const { user } = useAuth();
  const { todos, addTodo, updateTodo } = useTodoContext();
  const { allSchedules, addSchedule } = useSchedules();

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Care Plan Sections State (DEFAULT strictly to goal data or empty array)
  const [appointments, setAppointments] = useState<MedicalAppointment[]>(() => {
    if (Array.isArray(goal.medicalAppointments) && goal.medicalAppointments.length > 0) {
      return goal.medicalAppointments as unknown as MedicalAppointment[];
    }
    return [];
  });

  const [tests, setTests] = useState<MedicalTest[]>(() => {
    if (Array.isArray(goal.medicalTests) && goal.medicalTests.length > 0) {
      return goal.medicalTests as unknown as MedicalTest[];
    }
    return [];
  });

  const [medicines, setMedicines] = useState<MedicalMedicine[]>(() => {
    if (Array.isArray(goal.medicalMedicines) && goal.medicalMedicines.length > 0) {
      return goal.medicalMedicines as unknown as MedicalMedicine[];
    }
    return [];
  });

  const [medSchedule, setMedSchedule] = useState<MedicalScheduleSlot[]>(() => {
    if (Array.isArray(goal.medicalSchedule) && goal.medicalSchedule.length > 0) {
      return goal.medicalSchedule as unknown as MedicalScheduleSlot[];
    }
    return [];
  });

  const [followUps, setFollowUps] = useState<MedicalFollowUp[]>(() => {
    if (Array.isArray(goal.medicalFollowUps) && goal.medicalFollowUps.length > 0) {
      return goal.medicalFollowUps as unknown as MedicalFollowUp[];
    }
    return [];
  });

  // History Expand Toggles
  const [expandedHistory, setExpandedHistory] = useState<Record<string, boolean>>({});

  const toggleHistory = (key: string) => {
    setExpandedHistory((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Main "+ Add Plan" Picker Dialog State
  const [addPlanModalOpen, setAddPlanModalOpen] = useState(false);

  // Standalone Item Creation Dialog State
  const [addItemType, setAddItemType] = useState<'appointment' | 'test' | 'medicine' | 'followup' | null>(null);
  const [inputTitle, setInputTitle] = useState('');
  const [inputSub, setInputSub] = useState('');
  const [inputDate, setInputDate] = useState(new Date().toISOString().split('T')[0]);
  const [inputExtra, setInputExtra] = useState('');
  
  // Medicine frequency dropdown state
  const [medFreqSelect, setMedFreqSelect] = useState('Once a day');
  const [customMedFreq, setCustomMedFreq] = useState('');

  const [savingItem, setSavingItem] = useState(false);

  // Reschedule Modal State
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState<{
    type: 'appointment' | 'test' | 'followup';
    index: number;
  } | null>(null);
  const [rescheduleDateValue, setRescheduleDateValue] = useState(todayStr);

  // Nested In-Item Dialog States:
  // 1. Next Appointment Dialog for Parent Appointment
  const [nextApptModalOpen, setNextApptModalOpen] = useState(false);
  const [targetApptIndex, setTargetApptIndex] = useState<number | null>(null);
  const [nextApptDate, setNextApptDate] = useState(todayStr);
  const [_nextApptNote, setNextApptNote] = useState('');

  // 2. Add Test Result Dialog for Parent Test (Pre-filled test name, current datetime)
  const [testResultModalOpen, setTestResultModalOpen] = useState(false);
  const [targetTestIndex, setTargetTestIndex] = useState<number | null>(null);
  const [testResultStatus, setTestResultStatus] = useState<'Normal' | 'Pending' | 'Abnormal' | string>('Normal');
  const [testResultNotes, setTestResultNotes] = useState('');
  const [testResultTimestamp, setTestResultTimestamp] = useState(() => getNowLocalIso());

  // 3. Early / Forced Visit Prompt State
  const [forcedVisitPromptIdx, setForcedVisitPromptIdx] = useState<number | null>(null);

  // 4. Schedule / Task Reminder Dialog
  const [schedModalOpen, setSchedModalOpen] = useState(false);
  const [schedKind, setSchedKind] = useState<'schedule' | 'todo'>('schedule');
  const [schedTitle, setSchedTitle] = useState('');
  const [schedTime, setSchedTime] = useState('09:00');
  const [schedDate, setSchedDate] = useState(todayStr);
  const [savingSched, setSavingSched] = useState(false);

  // Total Plan Count
  const totalPlans = appointments.length + tests.length + medicines.length + medSchedule.length + followUps.length;

  // Persist helper
  const updateMedicalData = async (updates: {
    medicalAppointments?: MedicalAppointment[];
    medicalTests?: MedicalTest[];
    medicalMedicines?: MedicalMedicine[];
    medicalSchedule?: MedicalScheduleSlot[];
    medicalFollowUps?: MedicalFollowUp[];
  }) => {
    if (!goal.id) return;
    if (onUpdateGoal) {
      await onUpdateGoal(goal.id, updates);
    } else {
      await updateDoc(doc(db, 'goals', goal.id), updates);
    }
  };

  // -------------------------------------------------------------
  // Top-Level Standalone Item Creation
  // -------------------------------------------------------------
  const handleSaveStandaloneItem = async () => {
    if (!addItemType || !inputTitle.trim() || !goal.id) return;
    setSavingItem(true);
    try {
      if (addItemType === 'appointment') {
        const newAppt: MedicalAppointment = {
          id: String(Date.now()),
          doctor: inputTitle.trim(),
          clinic: inputSub.trim() || undefined,
          nextDate: inputDate,
          history: [],
        };
        const updated = [...appointments, newAppt];
        setAppointments(updated);
        await updateMedicalData({ medicalAppointments: updated });
      } else if (addItemType === 'test') {
        const newTest: MedicalTest = {
          id: String(Date.now()),
          name: inputTitle.trim(),
          nextDate: inputDate,
          result: 'Pending',
          history: [],
        };
        const updated = [...tests, newTest];
        setTests(updated);
        await updateMedicalData({ medicalTests: updated });
      } else if (addItemType === 'medicine') {
        const finalFreq = medFreqSelect === 'Custom...' ? (customMedFreq.trim() || 'Once a day') : medFreqSelect;
        const newMed: MedicalMedicine = {
          id: String(Date.now()),
          name: inputTitle.trim(),
          dosage: inputSub.trim() || '1 dose',
          frequency: finalFreq,
          prescribedBy: inputExtra.trim() || undefined,
          history: [],
        };
        const updated = [...medicines, newMed];
        setMedicines(updated);
        await updateMedicalData({ medicalMedicines: updated });
      } else if (addItemType === 'followup') {
        const newFollow: MedicalFollowUp = {
          id: String(Date.now()),
          type: inputTitle.trim(),
          nextDate: inputDate,
          notes: inputSub.trim() || undefined,
          history: [],
        };
        const updated = [...followUps, newFollow];
        setFollowUps(updated);
        await updateMedicalData({ medicalFollowUps: updated });
      }

      setInputTitle('');
      setInputSub('');
      setInputExtra('');
      setMedFreqSelect('Once a day');
      setCustomMedFreq('');
      setAddItemType(null);
    } catch (err) {
      console.error('Failed to save medical item:', err);
    } finally {
      setSavingItem(false);
    }
  };

  // Initialize Medication Schedule slots
  const handleInitializeMedSchedule = async () => {
    if (medSchedule.length > 0) return;
    const defaultSlots: MedicalScheduleSlot[] = [
      { id: '1', time: 'Morning', label: '8:00 AM', taken: false },
      { id: '2', time: 'Afternoon', label: '2:00 PM', taken: false },
      { id: '3', time: 'Evening', label: '6:00 PM', taken: false },
      { id: '4', time: 'Night', label: '9:00 PM', taken: false },
    ];
    setMedSchedule(defaultSlots);
    await updateMedicalData({ medicalSchedule: defaultSlots });
  };

  // Toggle medication slot
  const toggleMedSlot = async (idx: number) => {
    const updated = medSchedule.map((slot, i) =>
      i === idx ? { ...slot, taken: !slot.taken } : slot
    );
    setMedSchedule(updated);
    await updateMedicalData({ medicalSchedule: updated });
  };

  // -------------------------------------------------------------
  // Appointments Logic: Confirm Visited / Complete Visit
  // -------------------------------------------------------------
  const handleConfirmAppointmentVisited = async (index: number, customNote?: string) => {
    if (!appointments[index] || !goal.id) return;
    setSavingItem(true);
    try {
      const updated = [...appointments];
      const parent = { ...updated[index] };
      const currentHistory = parent.history || [];

      const completedDate = parent.nextDate || todayStr;
      const completedIso = new Date().toISOString();

      // Move current appt to history and clear nextDate
      parent.history = [
        {
          id: String(Date.now()),
          date: completedDate,
          note: customNote?.trim() || `Visited ${parent.doctor}${parent.clinic ? ` at ${parent.clinic}` : ''}`,
          completedAt: completedIso,
        },
        ...currentHistory,
      ];
      parent.nextDate = ''; // Clear active appt date so "+ Schedule Next Appointment" appears

      updated[index] = parent;
      setAppointments(updated);
      await updateMedicalData({ medicalAppointments: updated });

      setForcedVisitPromptIdx(null);
    } catch (err) {
      console.error('Failed to confirm appointment visited:', err);
    } finally {
      setSavingItem(false);
    }
  };

  // Reschedule Handler for any item
  const handleOpenReschedule = (type: 'appointment' | 'test' | 'followup', index: number, currentDate?: string) => {
    setRescheduleTarget({ type, index });
    setRescheduleDateValue(currentDate || todayStr);
    setRescheduleModalOpen(true);
  };

  const handleSaveReschedule = async () => {
    if (!rescheduleTarget || !goal.id || !rescheduleDateValue) return;
    setSavingItem(true);
    try {
      if (rescheduleTarget.type === 'appointment') {
        const updated = [...appointments];
        updated[rescheduleTarget.index].nextDate = rescheduleDateValue;
        setAppointments(updated);
        await updateMedicalData({ medicalAppointments: updated });
      } else if (rescheduleTarget.type === 'test') {
        const updated = [...tests];
        updated[rescheduleTarget.index].nextDate = rescheduleDateValue;
        setTests(updated);
        await updateMedicalData({ medicalTests: updated });
      } else if (rescheduleTarget.type === 'followup') {
        const updated = [...followUps];
        updated[rescheduleTarget.index].nextDate = rescheduleDateValue;
        setFollowUps(updated);
        await updateMedicalData({ medicalFollowUps: updated });
      }

      setRescheduleModalOpen(false);
      setRescheduleTarget(null);
    } catch (err) {
      console.error('Failed to reschedule:', err);
    } finally {
      setSavingItem(false);
    }
  };

  // 1. Add Next Appointment under Parent Appointment
  const handleAddNextAppointment = async () => {
    if (targetApptIndex === null || !appointments[targetApptIndex] || !goal.id) return;
    setSavingItem(true);
    try {
      const updated = [...appointments];
      const parent = { ...updated[targetApptIndex] };

      // Set new upcoming appointment date
      parent.nextDate = nextApptDate;

      updated[targetApptIndex] = parent;
      setAppointments(updated);
      await updateMedicalData({ medicalAppointments: updated });

      setNextApptModalOpen(false);
      setTargetApptIndex(null);
      setNextApptNote('');
    } catch (err) {
      console.error('Failed to add next appointment:', err);
    } finally {
      setSavingItem(false);
    }
  };

  // 2. Add Test Result under Parent Test (Pre-filled name, auto current timestamp)
  const handleAddTestResult = async () => {
    if (targetTestIndex === null || !tests[targetTestIndex] || !goal.id) return;
    setSavingItem(true);
    try {
      const updated = [...tests];
      const parent = { ...updated[targetTestIndex] };
      const currentHistory = parent.history || [];

      const completedIso = new Date(testResultTimestamp).toISOString();
      const dateStr = testResultTimestamp.split('T')[0];

      // Update parent test result and last done date
      parent.lastDate = dateStr;
      parent.result = testResultStatus;
      parent.history = [
        {
          id: String(Date.now()),
          date: dateStr,
          note: testResultNotes.trim() || `Result recorded for ${parent.name}`,
          result: testResultStatus,
          completedAt: completedIso,
        },
        ...currentHistory,
      ];

      updated[targetTestIndex] = parent;
      setTests(updated);
      await updateMedicalData({ medicalTests: updated });

      setTestResultModalOpen(false);
      setTargetTestIndex(null);
      setTestResultNotes('');
    } catch (err) {
      console.error('Failed to log test result:', err);
    } finally {
      setSavingItem(false);
    }
  };

  // 3. Log Dose Taken for Medicine
  const handleLogMedicineDose = async (idx: number) => {
    if (!medicines[idx] || !goal.id) return;
    setSavingItem(true);
    try {
      const updated = [...medicines];
      const parent = { ...updated[idx] };
      const hist = parent.history || [];
      parent.history = [
        {
          id: String(Date.now()),
          date: todayStr,
          action: 'Dose Taken',
          note: `Taken at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        },
        ...hist,
      ];
      updated[idx] = parent;
      setMedicines(updated);
      await updateMedicalData({ medicalMedicines: updated });
    } catch (err) {
      console.error('Failed to log medicine dose:', err);
    } finally {
      setSavingItem(false);
    }
  };

  // -------------------------------------------------------------
  // Deletion Actions
  // -------------------------------------------------------------
  const handleDeleteAppointment = async (index: number) => {
    if (!confirm('Are you sure you want to delete this appointment plan?')) return;
    const updated = appointments.filter((_, i) => i !== index);
    setAppointments(updated);
    await updateMedicalData({ medicalAppointments: updated });
  };

  const handleDeleteTest = async (index: number) => {
    if (!confirm('Are you sure you want to delete this test plan?')) return;
    const updated = tests.filter((_, i) => i !== index);
    setTests(updated);
    await updateMedicalData({ medicalTests: updated });
  };

  const handleDeleteMedicine = async (index: number) => {
    if (!confirm('Are you sure you want to delete this medicine?')) return;
    const updated = medicines.filter((_, i) => i !== index);
    setMedicines(updated);
    await updateMedicalData({ medicalMedicines: updated });
  };

  const handleDeleteFollowUp = async (index: number) => {
    if (!confirm('Are you sure you want to delete this follow-up plan?')) return;
    const updated = followUps.filter((_, i) => i !== index);
    setFollowUps(updated);
    await updateMedicalData({ medicalFollowUps: updated });
  };

  const handleDeleteHistoryLog = async (
    section: 'appointment' | 'test' | 'followup',
    parentIdx: number,
    logId: string
  ) => {
    if (!confirm('Delete this record?')) return;
    if (section === 'appointment') {
      const updated = [...appointments];
      const parent = { ...updated[parentIdx] };
      parent.history = (parent.history || []).filter((h) => h.id !== logId);
      updated[parentIdx] = parent;
      setAppointments(updated);
      await updateMedicalData({ medicalAppointments: updated });
    } else if (section === 'test') {
      const updated = [...tests];
      const parent = { ...updated[parentIdx] };
      parent.history = (parent.history || []).filter((h) => h.id !== logId);
      updated[parentIdx] = parent;
      setTests(updated);
      await updateMedicalData({ medicalTests: updated });
    } else if (section === 'followup') {
      const updated = [...followUps];
      const parent = { ...updated[parentIdx] };
      parent.history = (parent.history || []).filter((h) => h.id !== logId);
      updated[parentIdx] = parent;
      setFollowUps(updated);
      await updateMedicalData({ medicalFollowUps: updated });
    }
  };

  // Schedule Routine or Task
  const handleScheduleMedicalEvent = async () => {
    if (!schedTitle.trim() || !user || !goal.id) return;
    setSavingSched(true);
    try {
      if (schedKind === 'schedule') {
        await addSchedule({
          title: schedTitle.trim(),
          date: schedDate || todayStr,
          startTime: schedTime || '09:00',
          endTime: '10:00',
          projectId: goal.projectId || '',
          userId: user.uid,
          status: 'pending',
          priority: 'high',
          linkedGoalId: goal.id,
          goalTitle: goal.title,
          frequencyMode: 'daily',
        });
      } else {
        await addTodo({
          title: schedTitle.trim(),
          status: 'in_progress',
          priority: 'urgent',
          projectId: goal.projectId || '',
          authorId: user.uid,
          dueDate: schedDate ? new Date(schedDate) : new Date(),
          steps: [],
          tags: [],
          progressPercent: 0,
          assignedUsers: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          linkedGoalId: goal.id,
          goalTitle: goal.title,
        });
      }

      setSchedTitle('');
      setSchedModalOpen(false);
    } catch (err) {
      console.error('Failed to add medical schedule:', err);
    } finally {
      setSavingSched(false);
    }
  };

  // Linked items
  const linkedMedicalSchedules = useMemo(() => {
    if (!goal.id) return [];
    return allSchedules.filter((s) => (s as { linkedGoalId?: string }).linkedGoalId === goal.id);
  }, [allSchedules, goal.id]);

  const linkedMedicalTodos = useMemo(() => {
    if (!goal.id) return [];
    return todos.filter((t) => (t as { linkedGoalId?: string }).linkedGoalId === goal.id);
  }, [todos, goal.id]);

  const surfaceBg = isDark ? '#1e293b' : '#ffffff';
  const cardBorder = isDark ? '#334155' : '#e2e8f0';
  const textPrimary = isDark ? '#f1f5f9' : '#1e293b';
  const textMuted = isDark ? '#94a3b8' : '#64748b';

  return (
    <Box sx={{ width: '100%', maxWidth: 740, mx: 'auto' }}>
      {/* Header Medical Plan Card */}
      <Box
        sx={{
          borderRadius: '24px',
          border: `1px solid ${cardBorder}`,
          bgcolor: surfaceBg,
          p: 3,
          boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 20px rgba(15,23,42,0.06)',
          mb: 3,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
          <Box>
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: textMuted, textTransform: 'uppercase', letterSpacing: '.05em' }}>
              Medical Care Plan
            </Typography>
            <Typography sx={{ fontSize: 20, fontWeight: 800, color: textPrimary, mt: 0.5 }}>
              {goal.title}
            </Typography>
            {goal.description && (
              <Typography sx={{ fontSize: 13, color: textMuted, mt: 0.5 }}>
                {goal.description}
              </Typography>
            )}
          </Box>
          <Chip
            label={`${totalPlans} Active ${totalPlans === 1 ? 'Item' : 'Items'}`}
            size="small"
            sx={{ bgcolor: isDark ? '#0c4a6e' : '#e0f2fe', color: '#0284c7', fontWeight: 700, fontSize: 11 }}
          />
        </Box>

        {/* Action Buttons: Prominent "+ Add Plan" Button */}
        <Box sx={{ mt: 2.5, display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
          <Button
            variant="contained"
            onClick={() => setAddPlanModalOpen(true)}
            startIcon={<AddIcon sx={{ fontSize: 18 }} />}
            sx={{
              borderRadius: '12px',
              textTransform: 'none',
              fontSize: 13,
              fontWeight: 800,
              px: 2.5,
              py: 1,
              bgcolor: '#0284c7',
              '&:hover': { bgcolor: '#0369a1' },
              boxShadow: '0 4px 14px rgba(2,132,199,0.35)',
            }}
          >
            + Add Plan
          </Button>

          <Button
            size="small"
            variant="outlined"
            onClick={() => {
              setSchedTitle(`Medical Checkup: ${goal.title}`);
              setSchedModalOpen(true);
            }}
            startIcon={<EventIcon sx={{ fontSize: 16 }} />}
            sx={{ borderRadius: '12px', textTransform: 'none', fontSize: 12, fontWeight: 700, borderColor: cardBorder, color: textPrimary }}
          >
            + Schedule Reminder
          </Button>
        </Box>
      </Box>

      {/* Empty State Banner when no plans exist */}
      {totalPlans === 0 && (
        <Box
          sx={{
            borderRadius: '24px',
            border: `2px dashed ${cardBorder}`,
            p: 4,
            textAlign: 'center',
            bgcolor: isDark ? 'rgba(30,41,59,0.5)' : '#f8fafc',
            mb: 3,
          }}
        >
          <MedicalServicesIcon sx={{ fontSize: 48, color: '#0284c7', opacity: 0.8, mb: 1 }} />
          <Typography sx={{ fontSize: 16, fontWeight: 700, color: textPrimary }}>
            No Medical Care Plans Created Yet
          </Typography>
          <Typography sx={{ fontSize: 13, color: textMuted, mt: 0.5, mb: 2.5, maxWidth: 440, mx: 'auto' }}>
            Click &quot;+ Add Plan&quot; below to add your doctor appointments, lab tests, prescribed medicines, or follow-up reviews.
          </Typography>
          <Button
            variant="contained"
            onClick={() => setAddPlanModalOpen(true)}
            startIcon={<AddIcon />}
            sx={{
              borderRadius: '14px',
              textTransform: 'none',
              fontWeight: 800,
              fontSize: 14,
              px: 3,
              py: 1.2,
              bgcolor: '#0284c7',
              '&:hover': { bgcolor: '#0369a1' },
            }}
          >
            + Add Plan
          </Button>
        </Box>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 1. Appointments Section (DISPLAYED AT THE TOP) */}
      {/* ------------------------------------------------------------- */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, px: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: 99, bgcolor: '#0284c7' }} />
            <StethoscopeIcon sx={{ color: '#0284c7', fontSize: 18 }} />
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: textPrimary }}>
              Appointments ({appointments.length})
            </Typography>
          </Box>
          <Button
            size="small"
            onClick={() => {
              setInputTitle('');
              setInputSub('');
              setInputDate(todayStr);
              setAddItemType('appointment');
            }}
            startIcon={<AddIcon sx={{ fontSize: 15 }} />}
            sx={{ textTransform: 'none', fontSize: 12, fontWeight: 700, color: '#0284c7' }}
          >
            + New Appointment
          </Button>
        </Box>

        <Stack spacing={2}>
          {appointments.map((a, idx) => {
            const expKey = `appt_${idx}`;
            const isExp = !!expandedHistory[expKey];
            const histList = a.history || [];

            // Logic: Compare nextDate with todayStr
            const hasNextDate = Boolean(a.nextDate);
            const isApptDateReached = Boolean(hasNextDate && a.nextDate! <= todayStr);
            const isForcedPrompt = forcedVisitPromptIdx === idx;
            const showConfirmationPrompt = isApptDateReached || isForcedPrompt;

            // Completion distinction: If previous visits exist and no active upcoming appointment date
            const isFullyDone = !hasNextDate && histList.length > 0;

            return (
              <Box
                key={a.id || idx}
                sx={{
                  p: 2.5,
                  borderRadius: '20px',
                  bgcolor: isFullyDone
                    ? (isDark ? 'rgba(6,78,59,0.25)' : '#f0fdf4')
                    : surfaceBg,
                  border: isFullyDone
                    ? '1.5px solid #10b981'
                    : `1px solid ${cardBorder}`,
                  boxShadow: isDark ? '0 2px 10px rgba(0,0,0,0.2)' : '0 2px 10px rgba(0,0,0,0.03)',
                  transition: 'all 250ms ease',
                }}
              >
                {/* Header Row */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography sx={{ fontSize: 16, fontWeight: 800, color: textPrimary }}>
                        {a.doctor}
                      </Typography>
                      {isFullyDone && (
                        <Chip
                          icon={<TaskAltIcon sx={{ fontSize: '14px !important', color: '#10b981 !important' }} />}
                          label="Visited & Completed"
                          size="small"
                          sx={{ bgcolor: isDark ? '#064e3b' : '#d1fae5', color: '#10b981', fontWeight: 800, fontSize: 10 }}
                        />
                      )}
                    </Box>

                    {a.clinic && (
                      <Typography sx={{ fontSize: 12, color: textMuted, mt: 0.2 }}>
                        {a.clinic}
                      </Typography>
                    )}
                  </Box>

                  {/* Scheduled Date Display + Reschedule Button */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {hasNextDate ? (
                      <Box sx={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <Box>
                          <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#0284c7', textTransform: 'uppercase' }}>
                            Next Appointment
                          </Typography>
                          <Typography sx={{ fontSize: 13, fontWeight: 800, color: textPrimary }}>
                            {formatDate(a.nextDate)}
                          </Typography>
                        </Box>
                        <Tooltip title="Reschedule Appointment Date">
                          <IconButton
                            size="small"
                            onClick={() => handleOpenReschedule('appointment', idx, a.nextDate)}
                            sx={{ color: '#0284c7', bgcolor: isDark ? 'rgba(2,132,199,0.15)' : '#e0f2fe', p: 0.6 }}
                          >
                            <EditCalendarIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    ) : (
                      <Chip
                        label="No Active Date"
                        size="small"
                        sx={{ bgcolor: isDark ? '#334155' : '#f1f5f9', color: textMuted, fontSize: 10, fontWeight: 600 }}
                      />
                    )}

                    <IconButton size="small" onClick={() => handleDeleteAppointment(idx)} sx={{ color: textMuted, '&:hover': { color: '#ef4444' } }}>
                      <DeleteIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Box>
                </Box>

                {/* ------------------------------------------------------------- */}
                {/* PROMPT BANNER: "Have you visited [DrName] or [HospitalName]?" */}
                {/* Shown when appt date is reached/passed or when forced prompt   */}
                {/* ------------------------------------------------------------- */}
                {hasNextDate && showConfirmationPrompt && (
                  <Box
                    sx={{
                      mt: 2,
                      p: 2,
                      borderRadius: '14px',
                      bgcolor: isDark ? '#1e1b4b' : '#e0e7ff',
                      border: '1px solid #6366f1',
                    }}
                  >
                    <Typography sx={{ fontSize: 13, fontWeight: 700, color: isDark ? '#c7d2fe' : '#3730a3', mb: 1, display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <HelpIcon sx={{ fontSize: 18, color: '#6366f1' }} />
                      Have you visited {a.doctor}{a.clinic ? ` at ${a.clinic}` : ''}?
                    </Typography>

                    <Typography sx={{ fontSize: 11.5, color: isDark ? '#a5b4fc' : '#4338ca', mb: 1.5 }}>
                      Scheduled Date: <strong>{formatDate(a.nextDate)}</strong>. Confirm your visit to archive this appointment into history and schedule your next consultation.
                    </Typography>

                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => handleConfirmAppointmentVisited(idx)}
                        startIcon={<CheckCircle sx={{ fontSize: 15 }} />}
                        sx={{
                          borderRadius: '10px',
                          textTransform: 'none',
                          fontSize: 12,
                          fontWeight: 800,
                          bgcolor: '#10b981',
                          '&:hover': { bgcolor: '#059669' },
                        }}
                      >
                        Yes, I Visited
                      </Button>

                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => handleOpenReschedule('appointment', idx, a.nextDate)}
                        startIcon={<EditCalendarIcon sx={{ fontSize: 15 }} />}
                        sx={{
                          borderRadius: '10px',
                          textTransform: 'none',
                          fontSize: 12,
                          fontWeight: 700,
                          borderColor: '#6366f1',
                          color: isDark ? '#c7d2fe' : '#4338ca',
                        }}
                      >
                        Reschedule
                      </Button>
                    </Box>
                  </Box>
                )}

                {/* If appointment is in the future and prompt not visible yet, show optional "Mark Visited Early" link */}
                {hasNextDate && !showConfirmationPrompt && (
                  <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography sx={{ fontSize: 11.5, color: textMuted }}>
                      Upcoming visit on {formatDate(a.nextDate)}. Confirmation prompt will activate on or after this date.
                    </Typography>
                    <Button
                      size="small"
                      onClick={() => setForcedVisitPromptIdx(idx)}
                      sx={{ textTransform: 'none', fontSize: 11, color: '#0284c7', textDecoration: 'underline' }}
                    >
                      Visited Early?
                    </Button>
                  </Box>
                )}

                {/* In-Item Action Bar */}
                <Box sx={{ mt: 2, pt: 1.5, borderTop: `1px solid ${cardBorder}`, display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', justifyContent: 'space-between' }}>
                  <Button
                    size="small"
                    onClick={() => toggleHistory(expKey)}
                    endIcon={isExp ? <ExpandLess sx={{ fontSize: 16 }} /> : <ExpandMore sx={{ fontSize: 16 }} />}
                    sx={{ textTransform: 'none', fontSize: 12, color: textMuted, p: 0, '&:hover': { bgcolor: 'transparent', color: textPrimary } }}
                  >
                    {isExp ? 'Hide history' : `View history (${histList.length})`}
                  </Button>

                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {/* ONLY SHOW "+ Schedule Next Appointment" when earlier appointment is completed / clear */}
                    {!hasNextDate && (
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => {
                          setTargetApptIndex(idx);
                          setNextApptDate(todayStr);
                          setNextApptNote('');
                          setNextApptModalOpen(true);
                        }}
                        startIcon={<PlaylistAddIcon sx={{ fontSize: 15 }} />}
                        sx={{
                          borderRadius: '10px',
                          textTransform: 'none',
                          fontSize: 11,
                          fontWeight: 800,
                          bgcolor: '#0284c7',
                          '&:hover': { bgcolor: '#0369a1' },
                        }}
                      >
                        + Schedule Next Appointment
                      </Button>
                    )}
                  </Box>
                </Box>

                {/* Collapsible History List for this Doctor */}
                {isExp && (
                  <Box sx={{ mt: 2, pl: 1.5, borderLeft: '3px solid #0284c7' }}>
                    {histList.length === 0 ? (
                      <Typography sx={{ fontSize: 11, color: textMuted, fontStyle: 'italic' }}>
                        No past appointment history logged under this item.
                      </Typography>
                    ) : (
                      histList.map((h) => (
                        <Box key={h.id} sx={{ mb: 1.25, pb: 0.5, borderBottom: `1px dashed ${cardBorder}` }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <Box>
                              <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: textPrimary }}>
                                {h.note || 'Completed Consultation'}
                              </Typography>
                              {h.completedAt && (
                                <Typography sx={{ fontSize: 10, color: textMuted, fontStyle: 'italic' }}>
                                  Logged: {formatDateTime(h.completedAt)}
                                </Typography>
                              )}
                            </Box>

                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Typography sx={{ fontSize: 11, fontWeight: 600, color: textMuted }}>
                                {formatDate(h.date)}
                              </Typography>
                              <IconButton size="small" onClick={() => handleDeleteHistoryLog('appointment', idx, h.id)} sx={{ p: 0.2, color: textMuted }}>
                                <DeleteIcon sx={{ fontSize: 14 }} />
                              </IconButton>
                            </Box>
                          </Box>
                        </Box>
                      ))
                    )}
                  </Box>
                )}
              </Box>
            );
          })}
        </Stack>
      </Box>

      {/* ------------------------------------------------------------- */}
      {/* 2. Diagnostic Tests Section */}
      {/* ------------------------------------------------------------- */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, px: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: 99, bgcolor: '#8b5cf6' }} />
            <FlaskIcon sx={{ color: '#8b5cf6', fontSize: 18 }} />
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: textPrimary }}>
              Diagnostic Tests ({tests.length})
            </Typography>
          </Box>
          <Button
            size="small"
            onClick={() => {
              setInputTitle('');
              setInputSub('');
              setInputDate(todayStr);
              setAddItemType('test');
            }}
            startIcon={<AddIcon sx={{ fontSize: 15 }} />}
            sx={{ textTransform: 'none', fontSize: 12, fontWeight: 700, color: '#8b5cf6' }}
          >
            + New Test Item
          </Button>
        </Box>

        <Stack spacing={2}>
          {tests.map((t, idx) => {
            const expKey = `test_${idx}`;
            const isExp = !!expandedHistory[expKey];
            const histList = t.history || [];
            const resLower = (t.result || '').toLowerCase();
            const isTestRecorded = Boolean(t.result && t.result !== 'Pending');

            return (
              <Box
                key={t.id || idx}
                sx={{
                  p: 2.5,
                  borderRadius: '20px',
                  bgcolor: isTestRecorded
                    ? (isDark ? 'rgba(88,28,135,0.2)' : '#faf5ff')
                    : surfaceBg,
                  border: isTestRecorded
                    ? '1.5px solid #8b5cf6'
                    : `1px solid ${cardBorder}`,
                  boxShadow: isDark ? '0 2px 10px rgba(0,0,0,0.2)' : '0 2px 10px rgba(0,0,0,0.03)',
                  transition: 'all 250ms ease',
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography sx={{ fontSize: 16, fontWeight: 800, color: textPrimary }}>
                        {t.name}
                      </Typography>
                      {isTestRecorded && (
                        <Chip
                          icon={<TaskAltIcon sx={{ fontSize: '14px !important', color: '#8b5cf6 !important' }} />}
                          label="Result Recorded"
                          size="small"
                          sx={{ bgcolor: isDark ? '#4c1d95' : '#f3e8ff', color: '#8b5cf6', fontWeight: 800, fontSize: 10 }}
                        />
                      )}
                    </Box>

                    {t.lastDate && (
                      <Typography sx={{ fontSize: 12, color: textMuted, mt: 0.2 }}>
                        Last done: {formatDate(t.lastDate)}
                      </Typography>
                    )}
                  </Box>

                  {/* Next Test Date with Reschedule Button */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Box>
                        <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#8b5cf6', textTransform: 'uppercase' }}>
                          Next Test Date
                        </Typography>
                        <Typography sx={{ fontSize: 13, fontWeight: 800, color: textPrimary }}>
                          {formatDate(t.nextDate)}
                        </Typography>
                      </Box>
                      <Tooltip title="Reschedule Next Test Date">
                        <IconButton
                          size="small"
                          onClick={() => handleOpenReschedule('test', idx, t.nextDate)}
                          sx={{ color: '#8b5cf6', bgcolor: isDark ? 'rgba(139,92,246,0.15)' : '#f3e8ff', p: 0.6 }}
                        >
                          <EditCalendarIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>

                    <IconButton size="small" onClick={() => handleDeleteTest(idx)} sx={{ color: textMuted, '&:hover': { color: '#ef4444' } }}>
                      <DeleteIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Box>
                </Box>

                <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                  {t.result && (
                    <Chip
                      label={`Latest Result: ${t.result}`}
                      size="small"
                      sx={{
                        fontWeight: 700,
                        fontSize: 11,
                        bgcolor:
                          resLower === 'normal'
                            ? (isDark ? '#064e3b' : '#ecfdf5')
                            : resLower === 'abnormal'
                            ? (isDark ? '#4c0519' : '#fff1f2')
                            : (isDark ? '#451a03' : '#fff7ed'),
                        color:
                          resLower === 'normal'
                            ? '#10b981'
                            : resLower === 'abnormal'
                            ? '#f43f5e'
                            : '#f59e0b',
                      }}
                    />
                  )}
                </Box>

                {/* Nested In-Item Action Buttons: "+ Add Test Result" (REMOVED word 'log') */}
                <Box sx={{ mt: 2, pt: 1.5, borderTop: `1px solid ${cardBorder}`, display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', justifyContent: 'space-between' }}>
                  <Button
                    size="small"
                    onClick={() => toggleHistory(expKey)}
                    endIcon={isExp ? <ExpandLess sx={{ fontSize: 16 }} /> : <ExpandMore sx={{ fontSize: 16 }} />}
                    sx={{ textTransform: 'none', fontSize: 12, color: textMuted, p: 0, '&:hover': { bgcolor: 'transparent', color: textPrimary } }}
                  >
                    {isExp ? 'Hide history' : `View test history (${histList.length})`}
                  </Button>

                  <Button
                    size="small"
                    variant="contained"
                    onClick={() => {
                      setTargetTestIndex(idx);
                      setTestResultStatus('Normal');
                      setTestResultNotes('');
                      setTestResultTimestamp(getNowLocalIso());
                      setTestResultModalOpen(true);
                    }}
                    startIcon={<CheckCircle sx={{ fontSize: 14 }} />}
                    sx={{
                      borderRadius: '10px',
                      textTransform: 'none',
                      fontSize: 11,
                      fontWeight: 800,
                      bgcolor: '#8b5cf6',
                      '&:hover': { bgcolor: '#7c3aed' },
                    }}
                  >
                    + Add Test Result
                  </Button>
                </Box>

                {/* Embedded Test History for THIS Test item */}
                {isExp && (
                  <Box sx={{ mt: 2, pl: 1.5, borderLeft: '3px solid #8b5cf6' }}>
                    {histList.length === 0 ? (
                      <Typography sx={{ fontSize: 11, color: textMuted, fontStyle: 'italic' }}>
                        No past test history logged for {t.name}.
                      </Typography>
                    ) : (
                      histList.map((h) => (
                        <Box key={h.id} sx={{ mb: 1.25, pb: 0.5, borderBottom: `1px dashed ${cardBorder}` }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <Box>
                              <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: textPrimary }}>
                                Result: <span style={{ color: '#8b5cf6' }}>{h.result || 'Logged'}</span>
                              </Typography>
                              {h.note && (
                                <Typography sx={{ fontSize: 11, color: textMuted }}>
                                  {h.note}
                                </Typography>
                              )}
                              {h.completedAt && (
                                <Typography sx={{ fontSize: 10, color: textMuted, fontStyle: 'italic' }}>
                                  Logged at: {formatDateTime(h.completedAt)}
                                </Typography>
                              )}
                            </Box>

                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Typography sx={{ fontSize: 11, color: textMuted }}>
                                {formatDate(h.date)}
                              </Typography>
                              <IconButton size="small" onClick={() => handleDeleteHistoryLog('test', idx, h.id)} sx={{ p: 0.2, color: textMuted }}>
                                <DeleteIcon sx={{ fontSize: 14 }} />
                              </IconButton>
                            </Box>
                          </Box>
                        </Box>
                      ))
                    )}
                  </Box>
                )}
              </Box>
            );
          })}
        </Stack>
      </Box>

      {/* ------------------------------------------------------------- */}
      {/* 3. Prescribed Medicines List (ENHANCED ATTRACTIVE UI)          */}
      {/* ------------------------------------------------------------- */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, px: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: 99, bgcolor: '#f59e0b' }} />
            <PillIcon sx={{ color: '#f59e0b', fontSize: 18 }} />
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: textPrimary }}>
              Prescribed Medicines ({medicines.length})
            </Typography>
          </Box>
          <Button
            size="small"
            onClick={() => {
              setInputTitle('');
              setInputSub('');
              setInputExtra('');
              setMedFreqSelect('Once a day');
              setCustomMedFreq('');
              setAddItemType('medicine');
            }}
            startIcon={<AddIcon sx={{ fontSize: 15 }} />}
            sx={{ textTransform: 'none', fontSize: 12, fontWeight: 700, color: '#f59e0b' }}
          >
            + Add Medicine
          </Button>
        </Box>

        <Stack spacing={1.75}>
          {medicines.map((m, idx) => {
            const histList = m.history || [];
            const hasDoseLoggedToday = histList.some((h) => h.date === todayStr);

            return (
              <Box
                key={m.id || idx}
                sx={{
                  p: 2.25,
                  borderRadius: '20px',
                  bgcolor: hasDoseLoggedToday
                    ? (isDark ? 'rgba(120,53,15,0.25)' : '#fffbeb')
                    : surfaceBg,
                  border: hasDoseLoggedToday
                    ? '1.5px solid #f59e0b'
                    : `1px solid ${cardBorder}`,
                  boxShadow: isDark ? '0 2px 10px rgba(0,0,0,0.2)' : '0 2px 10px rgba(0,0,0,0.03)',
                  transition: 'all 250ms ease',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75 }}>
                    <Box
                      sx={{
                        width: 44,
                        height: 44,
                        borderRadius: '14px',
                        bgcolor: isDark ? 'rgba(245,158,11,0.15)' : '#fef3c7',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <PillIcon sx={{ color: '#f59e0b', fontSize: 24 }} />
                    </Box>
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography sx={{ fontSize: 15, fontWeight: 800, color: textPrimary }}>
                          {m.name}
                        </Typography>
                        <Chip
                          label={m.dosage}
                          size="small"
                          sx={{ bgcolor: isDark ? '#451a03' : '#fef3c7', color: '#d97706', fontWeight: 800, fontSize: 10 }}
                        />
                      </Box>

                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.3 }}>
                        <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#f59e0b' }}>
                          {m.frequency}
                        </Typography>
                        {m.prescribedBy && (
                          <Typography sx={{ fontSize: 11, color: textMuted }}>
                            · Prescribed by {m.prescribedBy}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Button
                      size="small"
                      variant={hasDoseLoggedToday ? 'contained' : 'outlined'}
                      onClick={() => handleLogMedicineDose(idx)}
                      startIcon={<CheckCircle sx={{ fontSize: 14 }} />}
                      sx={{
                        borderRadius: '10px',
                        textTransform: 'none',
                        fontSize: 11,
                        fontWeight: 800,
                        bgcolor: hasDoseLoggedToday ? '#f59e0b' : 'transparent',
                        borderColor: hasDoseLoggedToday ? '#f59e0b' : cardBorder,
                        color: hasDoseLoggedToday ? '#ffffff' : textPrimary,
                        '&:hover': { bgcolor: hasDoseLoggedToday ? '#d97706' : 'rgba(245,158,11,0.08)' },
                      }}
                    >
                      {hasDoseLoggedToday ? 'Dose Taken Today' : '+ Log Dose Taken'}
                    </Button>

                    <IconButton size="small" onClick={() => handleDeleteMedicine(idx)} sx={{ color: textMuted, '&:hover': { color: '#ef4444' } }}>
                      <DeleteIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Box>
                </Box>
              </Box>
            );
          })}
        </Stack>
      </Box>

      {/* ------------------------------------------------------------- */}
      {/* 4. Medication Schedule Checklist */}
      {/* ------------------------------------------------------------- */}
      {medSchedule.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, px: 0.5 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: 99, bgcolor: '#14b8a6' }} />
            <ClockIcon sx={{ color: '#14b8a6', fontSize: 18 }} />
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: textPrimary }}>
              Medication Schedule (Daily Timing)
            </Typography>
          </Box>

          <Box
            sx={{
              p: 2,
              borderRadius: '20px',
              bgcolor: medSchedule.every((s) => s.taken)
                ? (isDark ? 'rgba(13,148,136,0.2)' : '#f0fdf4')
                : surfaceBg,
              border: medSchedule.every((s) => s.taken)
                ? '1.5px solid #14b8a6'
                : `1px solid ${cardBorder}`,
              transition: 'all 250ms ease',
            }}
          >
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 1.5 }}>
              {medSchedule.map((slot, idx) => (
                <Button
                  key={slot.id || idx}
                  type="button"
                  onClick={() => toggleMedSlot(idx)}
                  sx={{
                    flexDirection: 'column',
                    alignItems: 'center',
                    p: 1.5,
                    borderRadius: '14px',
                    border: slot.taken ? '1px solid #14b8a6' : `1px solid ${cardBorder}`,
                    bgcolor: slot.taken ? '#14b8a6' : 'transparent',
                    color: slot.taken ? '#ffffff' : textPrimary,
                    textTransform: 'none',
                    '&:hover': { bgcolor: slot.taken ? '#0d9488' : isDark ? '#334155' : '#f8fafc' },
                  }}
                >
                  <Typography sx={{ fontSize: 12, fontWeight: 700 }}>
                    {slot.time}
                  </Typography>
                  <Typography sx={{ fontSize: 10, color: slot.taken ? '#ccfbf1' : textMuted, mt: 0.2 }}>
                    {slot.label} {slot.taken ? '✓ Taken' : ''}
                  </Typography>
                </Button>
              ))}
            </Box>
          </Box>
        </Box>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 5. Follow-ups Section */}
      {/* ------------------------------------------------------------- */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, px: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: 99, bgcolor: '#6366f1' }} />
            <CalendarIcon sx={{ color: '#6366f1', fontSize: 18 }} />
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: textPrimary }}>
              Follow-ups & Reviews ({followUps.length})
            </Typography>
          </Box>
          <Button
            size="small"
            onClick={() => {
              setInputTitle('');
              setInputSub('');
              setInputDate(todayStr);
              setAddItemType('followup');
            }}
            startIcon={<AddIcon sx={{ fontSize: 15 }} />}
            sx={{ textTransform: 'none', fontSize: 12, fontWeight: 700, color: '#6366f1' }}
          >
            + Add Follow-up Item
          </Button>
        </Box>

        <Stack spacing={2}>
          {followUps.map((f, idx) => {
            const expKey = `follow_${idx}`;
            const isExp = !!expandedHistory[expKey];
            const histList = f.history || [];
            const isFollowDone = histList.length > 0;

            return (
              <Box
                key={f.id || idx}
                sx={{
                  p: 2.5,
                  borderRadius: '20px',
                  bgcolor: isFollowDone
                    ? (isDark ? 'rgba(49,46,129,0.25)' : '#eef2ff')
                    : surfaceBg,
                  border: isFollowDone
                    ? '1.5px solid #6366f1'
                    : `1px solid ${cardBorder}`,
                  boxShadow: isDark ? '0 2px 10px rgba(0,0,0,0.2)' : '0 2px 10px rgba(0,0,0,0.03)',
                  transition: 'all 250ms ease',
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography sx={{ fontSize: 15, fontWeight: 800, color: textPrimary }}>
                        {f.type}
                      </Typography>
                      {isFollowDone && (
                        <Chip
                          icon={<TaskAltIcon sx={{ fontSize: '14px !important', color: '#6366f1 !important' }} />}
                          label="Follow-up Done"
                          size="small"
                          sx={{ bgcolor: isDark ? '#312e81' : '#e0e7ff', color: '#6366f1', fontWeight: 800, fontSize: 10 }}
                        />
                      )}
                    </Box>

                    {f.notes && (
                      <Typography sx={{ fontSize: 12, color: textMuted, mt: 0.3 }}>
                        {f.notes}
                      </Typography>
                    )}
                  </Box>

                  {/* Next Date with Reschedule Button */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Box>
                        <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#6366f1', textTransform: 'uppercase' }}>
                          Next Follow-up
                        </Typography>
                        <Typography sx={{ fontSize: 13, fontWeight: 800, color: textPrimary }}>
                          {formatDate(f.nextDate)}
                        </Typography>
                      </Box>
                      <Tooltip title="Reschedule Follow-up Date">
                        <IconButton
                          size="small"
                          onClick={() => handleOpenReschedule('followup', idx, f.nextDate)}
                          sx={{ color: '#6366f1', bgcolor: isDark ? 'rgba(99,102,241,0.15)' : '#e0e7ff', p: 0.6 }}
                        >
                          <EditCalendarIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>

                    <IconButton size="small" onClick={() => handleDeleteFollowUp(idx)} sx={{ color: textMuted, '&:hover': { color: '#ef4444' } }}>
                      <DeleteIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Box>
                </Box>

                {/* In-Item Action Bar */}
                <Box sx={{ mt: 2, pt: 1.5, borderTop: `1px solid ${cardBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Button
                    size="small"
                    onClick={() => toggleHistory(expKey)}
                    endIcon={isExp ? <ExpandLess sx={{ fontSize: 16 }} /> : <ExpandMore sx={{ fontSize: 16 }} />}
                    sx={{ textTransform: 'none', fontSize: 12, color: textMuted, p: 0, '&:hover': { bgcolor: 'transparent', color: textPrimary } }}
                  >
                    {isExp ? 'Hide history' : `View history (${histList.length})`}
                  </Button>

                  <Button
                    size="small"
                    variant="contained"
                    onClick={() => {
                      const updated = [...followUps];
                      const item = { ...updated[idx] };
                      const pastHist = item.history || [];
                      item.history = [
                        {
                          id: String(Date.now()),
                          date: todayStr,
                          note: 'Follow-up completed',
                          completedAt: new Date().toISOString(),
                        },
                        ...pastHist,
                      ];
                      updated[idx] = item;
                      setFollowUps(updated);
                      updateMedicalData({ medicalFollowUps: updated });
                    }}
                    startIcon={<CheckCircle sx={{ fontSize: 14 }} />}
                    sx={{
                      borderRadius: '10px',
                      textTransform: 'none',
                      fontSize: 11,
                      fontWeight: 800,
                      bgcolor: '#6366f1',
                      '&:hover': { bgcolor: '#4f46e5' },
                    }}
                  >
                    Mark Done / Add Record
                  </Button>
                </Box>

                {/* Embedded Follow-up History */}
                {isExp && (
                  <Box sx={{ mt: 2, pl: 1.5, borderLeft: '3px solid #6366f1' }}>
                    {histList.length === 0 ? (
                      <Typography sx={{ fontSize: 11, color: textMuted, fontStyle: 'italic' }}>
                        No past follow-up records logged under this item.
                      </Typography>
                    ) : (
                      histList.map((h) => (
                        <Box key={h.id} sx={{ mb: 1.25, pb: 0.5, borderBottom: `1px dashed ${cardBorder}` }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <Box>
                              <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: textPrimary }}>
                                {h.note || 'Follow-up Consultation'}
                              </Typography>
                              {h.completedAt && (
                                <Typography sx={{ fontSize: 10, color: textMuted, fontStyle: 'italic' }}>
                                  Completed at: {formatDateTime(h.completedAt)}
                                </Typography>
                              )}
                            </Box>

                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Typography sx={{ fontSize: 11, color: textMuted }}>
                                {formatDate(h.date)}
                              </Typography>
                              <IconButton size="small" onClick={() => handleDeleteHistoryLog('followup', idx, h.id)} sx={{ p: 0.2, color: textMuted }}>
                                <DeleteIcon sx={{ fontSize: 14 }} />
                              </IconButton>
                            </Box>
                          </Box>
                        </Box>
                      ))
                    )}
                  </Box>
                )}
              </Box>
            );
          })}
        </Stack>
      </Box>

      {/* Synced Reminders List */}
      {(linkedMedicalSchedules.length > 0 || linkedMedicalTodos.length > 0) && (
        <Box sx={{ mb: 3 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: textMuted, textTransform: 'uppercase', letterSpacing: '.05em', mb: 1.5, px: 0.5 }}>
            Synced Medical Reminders ({linkedMedicalSchedules.length + linkedMedicalTodos.length})
          </Typography>

          <Stack spacing={1.25}>
            {linkedMedicalSchedules.map((s) => (
              <Box
                key={s.id}
                sx={{
                  p: 2,
                  borderRadius: '16px',
                  bgcolor: surfaceBg,
                  border: `1px solid ${cardBorder}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <EventIcon sx={{ color: '#0284c7', fontSize: 20 }} />
                  <Box>
                    <Typography sx={{ fontSize: 13, fontWeight: 700, color: textPrimary }}>
                      {s.title}
                    </Typography>
                    <Typography sx={{ fontSize: 11, color: textMuted }}>
                      Scheduled Date: {formatDate(s.date)} · {s.startTime || '09:00 AM'}
                    </Typography>
                  </Box>
                </Box>
                <Chip label="Schedule" size="small" sx={{ bgcolor: isDark ? '#0c4a6e' : '#e0f2fe', color: '#0284c7', fontSize: 10, fontWeight: 700 }} />
              </Box>
            ))}

            {linkedMedicalTodos.map((todo) => {
              const isDone = todo.status === 'completed';
              return (
                <Box
                  key={todo.id}
                  onClick={() => todo.id && updateTodo(todo.id, { status: isDone ? 'in_progress' : 'completed' })}
                  sx={{
                    p: 2,
                    borderRadius: '16px',
                    bgcolor: surfaceBg,
                    border: `1px solid ${cardBorder}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    cursor: 'pointer',
                  }}
                >
                  <IconButton size="small" sx={{ p: 0, color: isDone ? '#10b981' : textMuted }}>
                    {isDone ? <CheckCircle sx={{ fontSize: 20 }} /> : <RadioButtonUnchecked sx={{ fontSize: 20 }} />}
                  </IconButton>
                  <Typography sx={{ fontSize: 13, fontWeight: 600, color: isDone ? textMuted : textPrimary, textDecoration: isDone ? 'line-through' : 'none' }}>
                    {todo.title}
                  </Typography>
                </Box>
              );
            })}
          </Stack>
        </Box>
      )}

      {/* ============================================================= */}
      {/* DIALOG 1: Main "+ Add Plan" Picker Dialog (5 Options Grid)    */}
      {/* ============================================================= */}
      <Dialog
        open={addPlanModalOpen}
        onClose={() => setAddPlanModalOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: '24px', p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 800, fontSize: 18, pb: 0.5 }}>
          Add Medical Care Plan
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 13, color: textMuted, mb: 2.5 }}>
            Select the type of medical plan item you want to create:
          </Typography>

          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 2 }}>
            {/* Option 1: Appointment */}
            <Box
              onClick={() => {
                setAddPlanModalOpen(false);
                setInputTitle('');
                setInputSub('');
                setInputDate(todayStr);
                setAddItemType('appointment');
              }}
              sx={{
                p: 2.5,
                borderRadius: '18px',
                border: `1px solid ${cardBorder}`,
                bgcolor: isDark ? '#1e293b' : '#f0f9ff',
                cursor: 'pointer',
                transition: 'all 200ms ease',
                '&:hover': {
                  borderColor: '#0284c7',
                  transform: 'translateY(-2px)',
                  boxShadow: '0 4px 16px rgba(2,132,199,0.15)',
                },
              }}
            >
              <StethoscopeIcon sx={{ color: '#0284c7', fontSize: 28, mb: 1 }} />
              <Typography sx={{ fontSize: 15, fontWeight: 800, color: textPrimary }}>
                Appointment
              </Typography>
              <Typography sx={{ fontSize: 12, color: textMuted, mt: 0.5 }}>
                Doctor consultation, specialist visit, or clinic appointment
              </Typography>
            </Box>

            {/* Option 2: Test */}
            <Box
              onClick={() => {
                setAddPlanModalOpen(false);
                setInputTitle('');
                setInputSub('');
                setInputDate(todayStr);
                setAddItemType('test');
              }}
              sx={{
                p: 2.5,
                borderRadius: '18px',
                border: `1px solid ${cardBorder}`,
                bgcolor: isDark ? '#1e293b' : '#f5f3ff',
                cursor: 'pointer',
                transition: 'all 200ms ease',
                '&:hover': {
                  borderColor: '#8b5cf6',
                  transform: 'translateY(-2px)',
                  boxShadow: '0 4px 16px rgba(139,92,246,0.15)',
                },
              }}
            >
              <FlaskIcon sx={{ color: '#8b5cf6', fontSize: 28, mb: 1 }} />
              <Typography sx={{ fontSize: 15, fontWeight: 800, color: textPrimary }}>
                Diagnostic Test
              </Typography>
              <Typography sx={{ fontSize: 12, color: textMuted, mt: 0.5 }}>
                Blood panel, MRI, X-Ray, CBC, or lab test screening
              </Typography>
            </Box>

            {/* Option 3: Medicine */}
            <Box
              onClick={() => {
                setAddPlanModalOpen(false);
                setInputTitle('');
                setInputSub('');
                setInputExtra('');
                setMedFreqSelect('Once a day');
                setCustomMedFreq('');
                setAddItemType('medicine');
              }}
              sx={{
                p: 2.5,
                borderRadius: '18px',
                border: `1px solid ${cardBorder}`,
                bgcolor: isDark ? '#1e293b' : '#fffbeb',
                cursor: 'pointer',
                transition: 'all 200ms ease',
                '&:hover': {
                  borderColor: '#f59e0b',
                  transform: 'translateY(-2px)',
                  boxShadow: '0 4px 16px rgba(245,158,11,0.15)',
                },
              }}
            >
              <PillIcon sx={{ color: '#f59e0b', fontSize: 28, mb: 1 }} />
              <Typography sx={{ fontSize: 15, fontWeight: 800, color: textPrimary }}>
                Medicine
              </Typography>
              <Typography sx={{ fontSize: 12, color: textMuted, mt: 0.5 }}>
                Prescribed medication, daily dosage, or vitamins
              </Typography>
            </Box>

            {/* Option 4: Medication Schedule */}
            <Box
              onClick={() => {
                setAddPlanModalOpen(false);
                handleInitializeMedSchedule();
              }}
              sx={{
                p: 2.5,
                borderRadius: '18px',
                border: `1px solid ${cardBorder}`,
                bgcolor: isDark ? '#1e293b' : '#f0fdf4',
                cursor: 'pointer',
                transition: 'all 200ms ease',
                '&:hover': {
                  borderColor: '#14b8a6',
                  transform: 'translateY(-2px)',
                  boxShadow: '0 4px 16px rgba(20,184,166,0.15)',
                },
              }}
            >
              <ClockIcon sx={{ color: '#14b8a6', fontSize: 28, mb: 1 }} />
              <Typography sx={{ fontSize: 15, fontWeight: 800, color: textPrimary }}>
                Medication Schedule
              </Typography>
              <Typography sx={{ fontSize: 12, color: textMuted, mt: 0.5 }}>
                Daily timing checklist (Morning, Afternoon, Evening, Night)
              </Typography>
            </Box>

            {/* Option 5: Follow-up */}
            <Box
              onClick={() => {
                setAddPlanModalOpen(false);
                setInputTitle('');
                setInputSub('');
                setInputDate(todayStr);
                setAddItemType('followup');
              }}
              sx={{
                gridColumn: '1 / -1',
                p: 2.5,
                borderRadius: '18px',
                border: `1px solid ${cardBorder}`,
                bgcolor: isDark ? '#1e293b' : '#eef2ff',
                cursor: 'pointer',
                transition: 'all 200ms ease',
                '&:hover': {
                  borderColor: '#6366f1',
                  transform: 'translateY(-2px)',
                  boxShadow: '0 4px 16px rgba(99,102,241,0.15)',
                },
              }}
            >
              <CalendarIcon sx={{ color: '#6366f1', fontSize: 28, mb: 1 }} />
              <Typography sx={{ fontSize: 15, fontWeight: 800, color: textPrimary }}>
                Follow-up & Review
              </Typography>
              <Typography sx={{ fontSize: 12, color: textMuted, mt: 0.5 }}>
                Post-checkup discussion, report review date, or routine follow-up
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setAddPlanModalOpen(false)} sx={{ textTransform: 'none', color: textMuted }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* ============================================================= */}
      {/* DIALOG 2: Add Standalone Top-Level Item                       */}
      {/* ============================================================= */}
      <Dialog open={!!addItemType} onClose={() => setAddItemType(null)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: '20px' } }}>
        <DialogTitle sx={{ fontWeight: 800, fontSize: 16, textTransform: 'capitalize' }}>
          Add New {addItemType}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label={
                addItemType === 'appointment'
                  ? 'Doctor Name *'
                  : addItemType === 'test'
                  ? 'Test Name *'
                  : addItemType === 'medicine'
                  ? 'Medicine Name *'
                  : 'Follow-up Description *'
              }
              placeholder={
                addItemType === 'appointment'
                  ? 'e.g. Dr. Sarah Jenkins'
                  : addItemType === 'test'
                  ? 'e.g. CBC Blood Panel'
                  : addItemType === 'medicine'
                  ? 'e.g. Paracetamol'
                  : 'e.g. Bi-monthly Review'
              }
              fullWidth
              size="small"
              value={inputTitle}
              onChange={(e) => setInputTitle(e.target.value)}
            />

            {(addItemType === 'appointment' || addItemType === 'medicine' || addItemType === 'followup') && (
              <TextField
                label={
                  addItemType === 'appointment'
                    ? 'Clinic / Hospital (Optional)'
                    : addItemType === 'medicine'
                    ? 'Dosage (e.g. 500mg)'
                    : 'Notes / Agenda (Optional)'
                }
                placeholder={
                  addItemType === 'appointment'
                    ? 'e.g. City Health Clinic'
                    : addItemType === 'medicine'
                    ? 'e.g. 1 tab (500mg)'
                    : 'e.g. Bring lab reports'
                }
                fullWidth
                size="small"
                value={inputSub}
                onChange={(e) => setInputSub(e.target.value)}
              />
            )}

            {/* PREDEFINED FREQUENCY SELECT FOR MEDICINES (REQ 4) */}
            {addItemType === 'medicine' && (
              <>
                <FormControl fullWidth size="small">
                  <InputLabel>Frequency *</InputLabel>
                  <Select
                    value={medFreqSelect}
                    label="Frequency *"
                    onChange={(e) => setMedFreqSelect(e.target.value)}
                  >
                    {PREDEFINED_MEDICINE_FREQUENCIES.map((freq) => (
                      <MenuItem key={freq} value={freq}>
                        {freq}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {medFreqSelect === 'Custom...' && (
                  <TextField
                    label="Specify Custom Frequency"
                    placeholder="e.g. Every 12 hours after food"
                    fullWidth
                    size="small"
                    value={customMedFreq}
                    onChange={(e) => setCustomMedFreq(e.target.value)}
                  />
                )}

                <TextField
                  label="Prescribed By (Optional)"
                  placeholder="e.g. Dr. Sarah Jenkins"
                  fullWidth
                  size="small"
                  value={inputExtra}
                  onChange={(e) => setInputExtra(e.target.value)}
                />
              </>
            )}

            {addItemType !== 'medicine' && (
              <TextField
                label={addItemType === 'test' ? 'Next Test Date' : 'Target Date'}
                type="date"
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
                value={inputDate}
                onChange={(e) => setInputDate(e.target.value)}
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setAddItemType(null)} sx={{ textTransform: 'none', color: textMuted }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={savingItem || !inputTitle.trim()}
            onClick={handleSaveStandaloneItem}
            sx={{ textTransform: 'none', fontWeight: 800, borderRadius: '10px', bgcolor: '#0284c7', '&:hover': { bgcolor: '#0369a1' } }}
          >
            {savingItem ? 'Saving...' : 'Add Item'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ============================================================= */}
      {/* DIALOG 3: UNIVERSAL RESCHEDULE DATE MODAL                     */}
      {/* ============================================================= */}
      <Dialog open={rescheduleModalOpen} onClose={() => setRescheduleModalOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: '20px' } }}>
        <DialogTitle sx={{ fontWeight: 800, fontSize: 16 }}>
          Reschedule Date
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography sx={{ fontSize: 13, color: textMuted }}>
              Select a new scheduled date for this care item:
            </Typography>

            <TextField
              label="New Scheduled Date"
              type="date"
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
              value={rescheduleDateValue}
              onChange={(e) => setRescheduleDateValue(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setRescheduleModalOpen(false)} sx={{ textTransform: 'none', color: textMuted }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={savingItem || !rescheduleDateValue}
            onClick={handleSaveReschedule}
            sx={{ textTransform: 'none', fontWeight: 800, borderRadius: '10px', bgcolor: '#0284c7', '&:hover': { bgcolor: '#0369a1' } }}
          >
            {savingItem ? 'Saving...' : 'Save New Date'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ============================================================= */}
      {/* DIALOG 4: IN-ITEM - Add Next Appointment under Parent Doctor  */}
      {/* ============================================================= */}
      <Dialog open={nextApptModalOpen} onClose={() => setNextApptModalOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: '20px' } }}>
        <DialogTitle sx={{ fontWeight: 800, fontSize: 16 }}>
          Schedule Next Appointment
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {targetApptIndex !== null && appointments[targetApptIndex] && (
              <Box sx={{ p: 1.5, borderRadius: '12px', bgcolor: isDark ? '#334155' : '#f0f9ff' }}>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#0284c7', textTransform: 'uppercase' }}>
                  Doctor / Provider
                </Typography>
                <Typography sx={{ fontSize: 14, fontWeight: 800, color: textPrimary }}>
                  {appointments[targetApptIndex].doctor}
                </Typography>
                {appointments[targetApptIndex].clinic && (
                  <Typography sx={{ fontSize: 11, color: textMuted }}>
                    {appointments[targetApptIndex].clinic}
                  </Typography>
                )}
              </Box>
            )}

            <TextField
              label="Next Appointment Date *"
              type="date"
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
              value={nextApptDate}
              onChange={(e) => setNextApptDate(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setNextApptModalOpen(false)} sx={{ textTransform: 'none', color: textMuted }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={savingItem || !nextApptDate}
            onClick={handleAddNextAppointment}
            sx={{ textTransform: 'none', fontWeight: 800, borderRadius: '10px', bgcolor: '#0284c7', '&:hover': { bgcolor: '#0369a1' } }}
          >
            {savingItem ? 'Saving...' : 'Save Next Appointment'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ============================================================= */}
      {/* DIALOG 5: IN-ITEM - Add Test Result under Parent Test         */}
      {/* (Pre-filled Test Name, default current datetime)               */}
      {/* ============================================================= */}
      <Dialog open={testResultModalOpen} onClose={() => setTestResultModalOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: '20px' } }}>
        <DialogTitle sx={{ fontWeight: 800, fontSize: 16 }}>
          Add Test Result
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {targetTestIndex !== null && tests[targetTestIndex] && (
              <Box sx={{ p: 1.5, borderRadius: '12px', bgcolor: isDark ? '#334155' : '#f5f3ff' }}>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#8b5cf6', textTransform: 'uppercase' }}>
                  Target Diagnostic Test
                </Typography>
                <Typography sx={{ fontSize: 15, fontWeight: 800, color: textPrimary }}>
                  {tests[targetTestIndex].name}
                </Typography>
              </Box>
            )}

            <FormControl fullWidth size="small">
              <InputLabel>Test Result Status *</InputLabel>
              <Select value={testResultStatus} label="Test Result Status *" onChange={(e) => setTestResultStatus(e.target.value)}>
                <MenuItem value="Normal">Normal</MenuItem>
                <MenuItem value="Pending">Pending</MenuItem>
                <MenuItem value="Abnormal">Abnormal / Review Required</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Result Details / Lab Values (Optional)"
              placeholder="e.g. HbA1c: 5.6%, Cholesterol: 180 mg/dL"
              fullWidth
              multiline
              rows={2}
              size="small"
              value={testResultNotes}
              onChange={(e) => setTestResultNotes(e.target.value)}
            />

            <TextField
              label="Completed Date & Time (Defaults to Current)"
              type="datetime-local"
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
              value={testResultTimestamp}
              onChange={(e) => setTestResultTimestamp(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setTestResultModalOpen(false)} sx={{ textTransform: 'none', color: textMuted }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={savingItem || !testResultStatus}
            onClick={handleAddTestResult}
            sx={{ textTransform: 'none', fontWeight: 800, borderRadius: '10px', bgcolor: '#8b5cf6', '&:hover': { bgcolor: '#7c3aed' } }}
          >
            {savingItem ? 'Saving...' : 'Save Result'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ============================================================= */}
      {/* DIALOG 6: Schedule Medical Reminder / Task                    */}
      {/* ============================================================= */}
      <Dialog open={schedModalOpen} onClose={() => setSchedModalOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: '20px' } }}>
        <DialogTitle sx={{ fontWeight: 800, fontSize: 16 }}>Schedule Medical Reminder</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                fullWidth
                variant={schedKind === 'schedule' ? 'contained' : 'outlined'}
                onClick={() => setSchedKind('schedule')}
                startIcon={<EventIcon />}
                size="small"
                sx={{ textTransform: 'none', borderRadius: '10px' }}
              >
                Schedule Visit
              </Button>
              <Button
                fullWidth
                variant={schedKind === 'todo' ? 'contained' : 'outlined'}
                onClick={() => setSchedKind('todo')}
                startIcon={<TodoIcon />}
                size="small"
                sx={{ textTransform: 'none', borderRadius: '10px' }}
              >
                Task Reminder
              </Button>
            </Box>

            <TextField
              label="Reminder Title"
              placeholder="e.g. Doctor Consultation or Take Blood Test"
              fullWidth
              size="small"
              value={schedTitle}
              onChange={(e) => setSchedTitle(e.target.value)}
            />

            <TextField
              label="Time"
              type="time"
              fullWidth
              size="small"
              value={schedTime}
              onChange={(e) => setSchedTime(e.target.value)}
            />

            <TextField
              label="Date"
              type="date"
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
              value={schedDate}
              onChange={(e) => setSchedDate(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setSchedModalOpen(false)} sx={{ textTransform: 'none', color: textMuted }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={savingSched || !schedTitle.trim()}
            onClick={handleScheduleMedicalEvent}
            sx={{ textTransform: 'none', fontWeight: 800, borderRadius: '10px', bgcolor: '#0284c7', '&:hover': { bgcolor: '#0369a1' } }}
          >
            {savingSched ? 'Saving...' : 'Save Reminder'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
