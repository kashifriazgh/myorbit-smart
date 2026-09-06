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
} from '@mui/icons-material';
import { Goal } from '@/app/lib/interface';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { useAuth } from '@/app/lib/context/userContext';
import { useTodoContext } from '@/app/lib/context/todoContext';
import { useSchedules } from '@/app/lib/context/SchedulesContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';

export interface MedicalAppointment {
  id?: string;
  doctor: string;
  clinic?: string;
  nextDate?: string;
  history?: Array<{
    id?: string;
    date: string;
    note?: string;
    completedAt?: string;
  }>;
}

export interface MedicalTest {
  id?: string;
  name: string;
  nextDate?: string;
  lastDate?: string;
  result?: 'Normal' | 'Pending' | 'Abnormal' | string;
  history?: Array<{
    id?: string;
    date: string;
    note?: string;
    result?: string;
    completedAt?: string;
  }>;
}

export interface MedicalMedicine {
  id?: string;
  name: string;
  dosage: string;
  frequency: string;
  prescribedBy?: string;
}

export interface MedicalScheduleSlot {
  id?: string;
  time: string; // Morning, Afternoon, Evening, Night
  label: string; // e.g. 8:00 AM
  taken: boolean;
}

export interface MedicalFollowUp {
  id?: string;
  type: string;
  nextDate?: string;
  notes?: string;
  history?: Array<{
    id?: string;
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

export default function MedicalTemplate({ goal, onUpdateGoal }: MedicalTemplateProps) {
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';
  const { user } = useAuth();
  const { todos, addTodo, updateTodo } = useTodoContext();
  const { allSchedules, addSchedule } = useSchedules();

  const answers = goal.questionnaireAnswers || {};

  // Care Plan Sections State
  const [appointments, setAppointments] = useState<MedicalAppointment[]>(() => {
    if (Array.isArray(goal.medicalAppointments) && goal.medicalAppointments.length > 0) {
      return goal.medicalAppointments;
    }
    const docName = String(answers.doctor_name || answers.doctor || 'Dr. Ahsan Raza');
    const clinicName = String(answers.clinic_name || answers.clinic || 'City Health Clinic');
    const apptDate = String(answers.next_appointment || answers.appointment_date || '2026-09-15');
    return [
      {
        id: '1',
        doctor: docName,
        clinic: clinicName,
        nextDate: apptDate,
        history: [
          { id: 'h1', date: '2026-08-20', note: 'Initial consultation', completedAt: new Date().toISOString() },
        ],
      },
    ];
  });

  const [tests, setTests] = useState<MedicalTest[]>(() => {
    if (Array.isArray(goal.medicalTests) && goal.medicalTests.length > 0) {
      return goal.medicalTests;
    }
    const testName = String(answers.test_name || answers.medical_test || 'Blood Test / MRI');
    return [
      {
        id: '1',
        name: testName,
        nextDate: '2026-09-18',
        lastDate: '2026-08-22',
        result: 'Normal',
        history: [
          { id: 'h1', date: '2026-08-22', note: 'Routine Screening', result: 'Normal', completedAt: new Date().toISOString() },
        ],
      },
    ];
  });

  const [medicines, setMedicines] = useState<MedicalMedicine[]>(() => {
    if (Array.isArray(goal.medicalMedicines) && goal.medicalMedicines.length > 0) {
      return goal.medicalMedicines;
    }
    const medName = String(answers.medicine_name || answers.prescription || 'Vitamin D3 & B12');
    return [
      {
        id: '1',
        name: medName,
        dosage: '1000 IU',
        frequency: '1x/day',
        prescribedBy: appointments[0]?.doctor || 'Consultant Doctor',
      },
    ];
  });

  const [medSchedule, setMedSchedule] = useState<MedicalScheduleSlot[]>(() => {
    if (Array.isArray(goal.medicalSchedule) && goal.medicalSchedule.length > 0) {
      return goal.medicalSchedule;
    }
    return [
      { id: '1', time: 'Morning', label: '8:00 AM', taken: true },
      { id: '2', time: 'Afternoon', label: '2:00 PM', taken: false },
      { id: '3', time: 'Night', label: '9:00 PM', taken: false },
    ];
  });

  const [followUps, setFollowUps] = useState<MedicalFollowUp[]>(() => {
    if (Array.isArray(goal.medicalFollowUps) && goal.medicalFollowUps.length > 0) {
      return goal.medicalFollowUps;
    }
    return [
      {
        id: '1',
        type: 'Doctor Review & Result Discussion',
        nextDate: '2026-09-25',
        notes: 'Bring previous lab test results',
        history: [],
      },
    ];
  });

  // History Expand Toggles
  const [expandedHistory, setExpandedHistory] = useState<Record<string, boolean>>({});

  const toggleHistory = (key: string) => {
    setExpandedHistory((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // State for adding history entry modal
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyTarget, setHistoryTarget] = useState<{
    type: 'appointment' | 'test' | 'followup';
    index: number;
  } | null>(null);
  const [histNote, setHistNote] = useState('');
  const [histResult, setHistResult] = useState<'Normal' | 'Pending' | 'Abnormal' | string>('Normal');
  const [histTimestamp, setHistTimestamp] = useState(() => getNowLocalIso());
  const [savingHist, setSavingHist] = useState(false);

  // State for Add item dialogs
  const [addItemType, setAddItemType] = useState<'appointment' | 'test' | 'medicine' | 'followup' | null>(null);
  const [inputTitle, setInputTitle] = useState('');
  const [inputSub, setInputSub] = useState('');
  const [inputDate, setInputDate] = useState(new Date().toISOString().split('T')[0]);
  const [inputExtra, setInputExtra] = useState('');
  const [savingItem, setSavingItem] = useState(false);

  // State for Schedule / Task Modal
  const [schedModalOpen, setSchedModalOpen] = useState(false);
  const [schedKind, setSchedKind] = useState<'schedule' | 'todo'>('schedule');
  const [schedTitle, setSchedTitle] = useState('');
  const [schedTime, setSchedTime] = useState('09:00');
  const [schedDate, setSchedDate] = useState(new Date().toISOString().split('T')[0]);
  const [savingSched, setSavingSched] = useState(false);

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

  // Handle medication schedule toggle
  const toggleMedSlot = async (idx: number) => {
    const updated = medSchedule.map((slot, i) =>
      i === idx ? { ...slot, taken: !slot.taken } : slot
    );
    setMedSchedule(updated);
    await updateMedicalData({ medicalSchedule: updated });
  };

  // Open modal to add history log to item (defaulting to current date & time)
  const openAddHistoryModal = (type: 'appointment' | 'test' | 'followup', index: number) => {
    setHistoryTarget({ type, index });
    setHistNote('');
    setHistResult('Normal');
    setHistTimestamp(getNowLocalIso());
    setHistoryModalOpen(true);
  };

  // Save history log (with exact date & time)
  const handleSaveHistory = async () => {
    if (!historyTarget || !goal.id) return;
    setSavingHist(true);
    try {
      const completedIso = new Date(histTimestamp).toISOString();
      const dateStr = histTimestamp.split('T')[0];

      if (historyTarget.type === 'appointment') {
        const updated = [...appointments];
        const item = { ...updated[historyTarget.index] };
        const pastHist = item.history || [];
        item.history = [
          {
            id: String(Date.now()),
            date: dateStr,
            note: histNote.trim() || 'Appointment Completed',
            completedAt: completedIso,
          },
          ...pastHist,
        ];
        updated[historyTarget.index] = item;
        setAppointments(updated);
        await updateMedicalData({ medicalAppointments: updated });
      } else if (historyTarget.type === 'test') {
        const updated = [...tests];
        const item = { ...updated[historyTarget.index] };
        const pastHist = item.history || [];
        item.lastDate = dateStr;
        item.result = histResult;
        item.history = [
          {
            id: String(Date.now()),
            date: dateStr,
            note: histNote.trim() || 'Test Completed',
            result: histResult,
            completedAt: completedIso,
          },
          ...pastHist,
        ];
        updated[historyTarget.index] = item;
        setTests(updated);
        await updateMedicalData({ medicalTests: updated });
      } else if (historyTarget.type === 'followup') {
        const updated = [...followUps];
        const item = { ...updated[historyTarget.index] };
        const pastHist = item.history || [];
        item.history = [
          {
            id: String(Date.now()),
            date: dateStr,
            note: histNote.trim() || 'Follow-up Done',
            completedAt: completedIso,
          },
          ...pastHist,
        ];
        updated[historyTarget.index] = item;
        setFollowUps(updated);
        await updateMedicalData({ medicalFollowUps: updated });
      }

      setHistoryModalOpen(false);
    } catch (err) {
      console.error('Failed to save history log:', err);
    } finally {
      setSavingHist(false);
    }
  };

  // Add generic new item
  const handleSaveItem = async () => {
    if (!addItemType || !inputTitle.trim() || !goal.id) return;
    setSavingItem(true);
    try {
      if (addItemType === 'appointment') {
        const newAppt: MedicalAppointment = {
          id: String(Date.now()),
          doctor: inputTitle.trim(),
          clinic: inputSub.trim(),
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
        const newMed: MedicalMedicine = {
          id: String(Date.now()),
          name: inputTitle.trim(),
          dosage: inputSub.trim() || '1 tab',
          frequency: inputExtra.trim() || '1x/day',
        };
        const updated = [...medicines, newMed];
        setMedicines(updated);
        await updateMedicalData({ medicalMedicines: updated });
      } else if (addItemType === 'followup') {
        const newFollow: MedicalFollowUp = {
          id: String(Date.now()),
          type: inputTitle.trim(),
          nextDate: inputDate,
          notes: inputSub.trim(),
          history: [],
        };
        const updated = [...followUps, newFollow];
        setFollowUps(updated);
        await updateMedicalData({ medicalFollowUps: updated });
      }

      setAddItemType(null);
    } catch (err) {
      console.error('Failed to save medical item:', err);
    } finally {
      setSavingItem(false);
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
          date: schedDate || new Date().toISOString().split('T')[0],
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
    <Box sx={{ width: '100%', maxWidth: 720, mx: 'auto' }}>
      {/* Header Plan Card */}
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
            label={goal.status || 'Active Plan'}
            size="small"
            sx={{ bgcolor: isDark ? '#0c4a6e' : '#e0f2fe', color: '#0284c7', fontWeight: 700, fontSize: 11 }}
          />
        </Box>

        {/* Action button row */}
        <Box sx={{ mt: 2.5, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <Button
            size="small"
            variant="outlined"
            onClick={() => {
              setSchedTitle(`Medical Checkup: ${goal.title}`);
              setSchedModalOpen(true);
            }}
            startIcon={<EventIcon sx={{ fontSize: 16 }} />}
            sx={{ borderRadius: '12px', textTransform: 'none', fontSize: 12, fontWeight: 700 }}
          >
            + Schedule Visit / Task
          </Button>
        </Box>
      </Box>

      {/* 1. Appointments Section */}
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
              setInputDate(new Date().toISOString().split('T')[0]);
              setAddItemType('appointment');
            }}
            startIcon={<AddIcon sx={{ fontSize: 15 }} />}
            sx={{ textTransform: 'none', fontSize: 12, fontWeight: 700, color: '#0284c7' }}
          >
            + Add
          </Button>
        </Box>

        <Stack spacing={1.5}>
          {appointments.map((a, idx) => {
            const expKey = `appt_${idx}`;
            const isExp = !!expandedHistory[expKey];
            const histList = a.history || [];

            return (
              <Box
                key={a.id || idx}
                sx={{
                  p: 2.5,
                  borderRadius: '18px',
                  bgcolor: surfaceBg,
                  border: `1px solid ${cardBorder}`,
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box>
                    <Typography sx={{ fontSize: 15, fontWeight: 700, color: textPrimary }}>
                      {a.doctor}
                    </Typography>
                    {a.clinic && (
                      <Typography sx={{ fontSize: 12, color: textMuted, mt: 0.2 }}>
                        {a.clinic}
                      </Typography>
                    )}
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#0284c7', textTransform: 'uppercase' }}>
                      Next Appointment
                    </Typography>
                    <Typography sx={{ fontSize: 13, fontWeight: 700, color: textPrimary }}>
                      {formatDate(a.nextDate)}
                    </Typography>
                  </Box>
                </Box>

                {/* History & Mark Complete Buttons */}
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
                    onClick={() => openAddHistoryModal('appointment', idx)}
                    startIcon={<CheckCircle sx={{ fontSize: 14 }} />}
                    sx={{
                      borderRadius: '10px',
                      textTransform: 'none',
                      fontSize: 11,
                      fontWeight: 700,
                      bgcolor: '#0284c7',
                      '&:hover': { bgcolor: '#0369a1' },
                    }}
                  >
                    Mark Completed / Add Log
                  </Button>
                </Box>

                {/* Embedded History List */}
                {isExp && (
                  <Box sx={{ mt: 1.5, pl: 1, borderLeft: '2px solid #0284c7', spaceY: 1 }}>
                    {histList.length === 0 ? (
                      <Typography sx={{ fontSize: 11, color: textMuted, fontStyle: 'italic' }}>
                        No past appointment history logged.
                      </Typography>
                    ) : (
                      histList.map((h, hIdx) => (
                        <Box key={h.id || hIdx} sx={{ mb: 1 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography sx={{ fontSize: 12, fontWeight: 600, color: textPrimary }}>
                              {h.note || 'Consultation'}
                            </Typography>
                            <Typography sx={{ fontSize: 11, color: textMuted }}>
                              {formatDate(h.date)}
                            </Typography>
                          </Box>
                          {h.completedAt && (
                            <Typography sx={{ fontSize: 10, color: textMuted, fontStyle: 'italic' }}>
                              Logged: {formatDateTime(h.completedAt)}
                            </Typography>
                          )}
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

      {/* 2. Medical Tests Section */}
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
              setInputDate(new Date().toISOString().split('T')[0]);
              setAddItemType('test');
            }}
            startIcon={<AddIcon sx={{ fontSize: 15 }} />}
            sx={{ textTransform: 'none', fontSize: 12, fontWeight: 700, color: '#8b5cf6' }}
          >
            + Add
          </Button>
        </Box>

        <Stack spacing={1.5}>
          {tests.map((t, idx) => {
            const expKey = `test_${idx}`;
            const isExp = !!expandedHistory[expKey];
            const histList = t.history || [];
            const resLower = (t.result || '').toLowerCase();

            return (
              <Box
                key={t.id || idx}
                sx={{
                  p: 2.5,
                  borderRadius: '18px',
                  bgcolor: surfaceBg,
                  border: `1px solid ${cardBorder}`,
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box>
                    <Typography sx={{ fontSize: 15, fontWeight: 700, color: textPrimary }}>
                      {t.name}
                    </Typography>
                    {t.lastDate && (
                      <Typography sx={{ fontSize: 12, color: textMuted, mt: 0.2 }}>
                        Last done {formatDate(t.lastDate)}
                      </Typography>
                    )}
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#8b5cf6', textTransform: 'uppercase' }}>
                      Next Test Date
                    </Typography>
                    <Typography sx={{ fontSize: 13, fontWeight: 700, color: textPrimary }}>
                      {formatDate(t.nextDate)}
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                  {t.result && (
                    <Chip
                      label={`Result: ${t.result}`}
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

                {/* History & Complete Bar */}
                <Box sx={{ mt: 2, pt: 1.5, borderTop: `1px solid ${cardBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
                    onClick={() => openAddHistoryModal('test', idx)}
                    startIcon={<CheckCircle sx={{ fontSize: 14 }} />}
                    sx={{
                      borderRadius: '10px',
                      textTransform: 'none',
                      fontSize: 11,
                      fontWeight: 700,
                      bgcolor: '#8b5cf6',
                      '&:hover': { bgcolor: '#7c3aed' },
                    }}
                  >
                    Mark Done / Add Result
                  </Button>
                </Box>

                {/* Embedded Test History */}
                {isExp && (
                  <Box sx={{ mt: 1.5, pl: 1, borderLeft: '2px solid #8b5cf6', spaceY: 1 }}>
                    {histList.length === 0 ? (
                      <Typography sx={{ fontSize: 11, color: textMuted, fontStyle: 'italic' }}>
                        No past test history logged.
                      </Typography>
                    ) : (
                      histList.map((h, hIdx) => (
                        <Box key={h.id || hIdx} sx={{ mb: 1 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography sx={{ fontSize: 12, fontWeight: 600, color: textPrimary }}>
                              {h.note || t.name}
                            </Typography>
                            <Typography sx={{ fontSize: 11, color: textMuted }}>
                              {formatDate(h.date)}
                            </Typography>
                          </Box>
                          {h.result && (
                            <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#8b5cf6' }}>
                              Result: {h.result}
                            </Typography>
                          )}
                          {h.completedAt && (
                            <Typography sx={{ fontSize: 10, color: textMuted, fontStyle: 'italic' }}>
                              Completed at: {formatDateTime(h.completedAt)}
                            </Typography>
                          )}
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

      {/* 3. Medicines List */}
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
              setAddItemType('medicine');
            }}
            startIcon={<AddIcon sx={{ fontSize: 15 }} />}
            sx={{ textTransform: 'none', fontSize: 12, fontWeight: 700, color: '#f59e0b' }}
          >
            + Add Medicine
          </Button>
        </Box>

        <Stack spacing={1.25}>
          {medicines.map((m, idx) => (
            <Box
              key={m.id || idx}
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
              <Box>
                <Typography sx={{ fontSize: 14, fontWeight: 700, color: textPrimary }}>
                  {m.name} <span style={{ fontWeight: 500, color: textMuted }}>({m.dosage})</span>
                </Typography>
                {m.prescribedBy && (
                  <Typography sx={{ fontSize: 11, color: textMuted }}>
                    Prescribed by {m.prescribedBy}
                  </Typography>
                )}
              </Box>
              <Chip
                label={m.frequency}
                size="small"
                sx={{ bgcolor: isDark ? '#451a03' : '#fff7ed', color: '#f59e0b', fontWeight: 700, fontSize: 11 }}
              />
            </Box>
          ))}
        </Stack>
      </Box>

      {/* 4. Medication Schedule Checklist */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, px: 0.5 }}>
          <Box sx={{ width: 8, height: 8, borderRadius: 99, bgcolor: '#14b8a6' }} />
          <ClockIcon sx={{ color: '#14b8a6', fontSize: 18 }} />
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: textPrimary }}>
            Medication Schedule (Daily Timing)
          </Typography>
        </Box>

        <Box sx={{ p: 2, borderRadius: '18px', bgcolor: surfaceBg, border: `1px solid ${cardBorder}` }}>
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

      {/* 5. Follow-ups Section */}
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
              setInputDate(new Date().toISOString().split('T')[0]);
              setAddItemType('followup');
            }}
            startIcon={<AddIcon sx={{ fontSize: 15 }} />}
            sx={{ textTransform: 'none', fontSize: 12, fontWeight: 700, color: '#6366f1' }}
          >
            + Add
          </Button>
        </Box>

        <Stack spacing={1.5}>
          {followUps.map((f, idx) => {
            const expKey = `follow_${idx}`;
            const isExp = !!expandedHistory[expKey];
            const histList = f.history || [];

            return (
              <Box
                key={f.id || idx}
                sx={{
                  p: 2.5,
                  borderRadius: '18px',
                  bgcolor: surfaceBg,
                  border: `1px solid ${cardBorder}`,
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box>
                    <Typography sx={{ fontSize: 14, fontWeight: 700, color: textPrimary }}>
                      {f.type}
                    </Typography>
                    {f.notes && (
                      <Typography sx={{ fontSize: 12, color: textMuted, mt: 0.3 }}>
                        {f.notes}
                      </Typography>
                    )}
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#6366f1', textTransform: 'uppercase' }}>
                      Next Follow-up
                    </Typography>
                    <Typography sx={{ fontSize: 13, fontWeight: 700, color: textPrimary }}>
                      {formatDate(f.nextDate)}
                    </Typography>
                  </Box>
                </Box>

                {/* History Bar */}
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
                    onClick={() => openAddHistoryModal('followup', idx)}
                    startIcon={<CheckCircle sx={{ fontSize: 14 }} />}
                    sx={{
                      borderRadius: '10px',
                      textTransform: 'none',
                      fontSize: 11,
                      fontWeight: 700,
                      bgcolor: '#6366f1',
                      '&:hover': { bgcolor: '#4f46e5' },
                    }}
                  >
                    Mark Done / Add Record
                  </Button>
                </Box>

                {/* Embedded Follow-up History */}
                {isExp && (
                  <Box sx={{ mt: 1.5, pl: 1, borderLeft: '2px solid #6366f1', spaceY: 1 }}>
                    {histList.length === 0 ? (
                      <Typography sx={{ fontSize: 11, color: textMuted, fontStyle: 'italic' }}>
                        No past follow-up records.
                      </Typography>
                    ) : (
                      histList.map((h, hIdx) => (
                        <Box key={h.id || hIdx} sx={{ mb: 1 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography sx={{ fontSize: 12, fontWeight: 600, color: textPrimary }}>
                              {h.note || 'Follow-up consultation'}
                            </Typography>
                            <Typography sx={{ fontSize: 11, color: textMuted }}>
                              {formatDate(h.date)}
                            </Typography>
                          </Box>
                          {h.completedAt && (
                            <Typography sx={{ fontSize: 10, color: textMuted, fontStyle: 'italic' }}>
                              Completed at: {formatDateTime(h.completedAt)}
                            </Typography>
                          )}
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

      {/* Linked Schedules & Tasks Sync List */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, px: 0.5 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: textMuted, textTransform: 'uppercase', letterSpacing: '.05em' }}>
            Synced Medical Reminders ({linkedMedicalSchedules.length + linkedMedicalTodos.length})
          </Typography>
        </Box>

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

      {/* Dialog: Mark Completed / Add History Log */}
      <Dialog open={historyModalOpen} onClose={() => setHistoryModalOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: 16 }}>
          Mark Completed & Log History
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography sx={{ fontSize: 12, color: textMuted }}>
              Log completion notes or test results for this care item. Timestamp defaults to the exact current time now.
            </Typography>

            <TextField
              label="Completion Notes / History Details"
              placeholder="e.g. Completed appointment, Dr recommended vitamin supplements"
              fullWidth
              multiline
              rows={2}
              size="small"
              value={histNote}
              onChange={(e) => setHistNote(e.target.value)}
            />

            {historyTarget?.type === 'test' && (
              <FormControl fullWidth size="small">
                <InputLabel>Test Result Status</InputLabel>
                <Select value={histResult} label="Test Result Status" onChange={(e) => setHistResult(e.target.value)}>
                  <MenuItem value="Normal">Normal</MenuItem>
                  <MenuItem value="Pending">Pending</MenuItem>
                  <MenuItem value="Abnormal">Abnormal / Review Required</MenuItem>
                </Select>
              </FormControl>
            )}

            <TextField
              label="Completed Date & Time (Defaults to Now)"
              type="datetime-local"
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
              value={histTimestamp}
              onChange={(e) => setHistTimestamp(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setHistoryModalOpen(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={savingHist}
            onClick={handleSaveHistory}
            sx={{ textTransform: 'none', bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }}
          >
            Save History Record
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Add Medical Item */}
      <Dialog open={!!addItemType} onClose={() => setAddItemType(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: 16, textTransform: 'capitalize' }}>
          Add {addItemType}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label={
                addItemType === 'appointment'
                  ? 'Doctor Name'
                  : addItemType === 'test'
                  ? 'Test Name'
                  : addItemType === 'medicine'
                  ? 'Medicine Name'
                  : 'Follow-up Type'
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
                    ? 'Clinic / Hospital'
                    : addItemType === 'medicine'
                    ? 'Dosage (e.g. 500mg)'
                    : 'Notes / Reminders'
                }
                fullWidth
                size="small"
                value={inputSub}
                onChange={(e) => setInputSub(e.target.value)}
              />
            )}

            {addItemType === 'medicine' && (
              <TextField
                label="Frequency (e.g. 2x/day)"
                fullWidth
                size="small"
                value={inputExtra}
                onChange={(e) => setInputExtra(e.target.value)}
              />
            )}

            {addItemType !== 'medicine' && (
              <TextField
                label="Target / Scheduled Date"
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
          <Button onClick={() => setAddItemType(null)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={savingItem || !inputTitle.trim()}
            onClick={handleSaveItem}
            sx={{ textTransform: 'none', bgcolor: '#0284c7', '&:hover': { bgcolor: '#0369a1' } }}
          >
            Add Item
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Schedule Routine or Task */}
      <Dialog open={schedModalOpen} onClose={() => setSchedModalOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: 16 }}>Schedule Medical Reminder</DialogTitle>
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
          <Button onClick={() => setSchedModalOpen(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={savingSched || !schedTitle.trim()}
            onClick={handleScheduleMedicalEvent}
            sx={{ textTransform: 'none', bgcolor: '#0284c7', '&:hover': { bgcolor: '#0369a1' } }}
          >
            Save Reminder
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
