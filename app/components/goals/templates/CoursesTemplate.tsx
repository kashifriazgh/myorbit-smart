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
} from '@mui/material';
import {
  School as CourseIcon,
  AccessTime as ClockIcon,
  CheckCircle,
  RadioButtonUnchecked,
  Add as AddIcon,
  Event as EventIcon,
  Checklist as TodoIcon,
  PlayCircleOutline as LessonIcon,
  Flag as CheckpointIcon,
} from '@mui/icons-material';
import { Goal } from '@/app/lib/interface';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { useAuth } from '@/app/lib/context/userContext';
import { useTodoContext } from '@/app/lib/context/todoContext';
import { useSchedules } from '@/app/lib/context/SchedulesContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';

export const PROFICIENCY_LEVELS = ['Beginner', 'Elementary', 'Intermediate', 'Advanced', 'Expert'];

export const UNIT_OPTIONS = [
  { key: 'proficiency', label: 'Proficiency Level', kind: 'categorical' },
  { key: 'hours', label: 'Hours Practiced', kind: 'numeric', suffix: 'hrs' },
  { key: 'lessons', label: 'Lessons / Lectures', kind: 'numeric', suffix: 'lessons' },
  { key: 'projects', label: 'Projects Completed', kind: 'numeric', suffix: 'projects' },
  { key: 'courses', label: 'Courses Completed', kind: 'numeric', suffix: 'courses' },
  { key: 'score', label: 'Score / Rating', kind: 'numeric', suffix: 'pts' },
];

export interface CourseLesson {
  id: string;
  title: string;
  durationMins?: number;
  completed: boolean;
  completedAt?: string;
}

export interface PracticeSession {
  id: string;
  activity: string;
  time?: string;
  frequencyPerWeek: number;
}

export interface LearningCheckpoint {
  id: string;
  label: string;
  done: boolean;
}

interface CoursesTemplateProps {
  goal: Goal;
  onUpdateGoal?: (goalId: string, updates: Partial<Goal>) => Promise<void>;
}

function clamp(n: number) {
  return Math.max(0, Math.min(100, n));
}

function formatDate(dateStr?: string) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function CoursesTemplate({ goal, onUpdateGoal }: CoursesTemplateProps) {
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';
  const { user } = useAuth();
  const { todos, addTodo, updateTodo } = useTodoContext();
  const { allSchedules, addSchedule } = useSchedules();

  const answers = goal.questionnaireAnswers || {};

  const skillName = goal.title || String(answers.skill_name || answers.course_name || 'Web Development');
  const unitKey = String(goal.overallTargetUnit || answers.unit || 'hours').toLowerCase();
  const unitDef = UNIT_OPTIONS.find((u) => u.key === unitKey) || UNIT_OPTIONS[1];

  const targetLevel = Number(goal.overallTargetValue || answers.target_level || answers.target_amount || 50);
  const [currentLevel, setCurrentLevel] = useState<number>(goal.currentValue || Number(answers.current_level || 12));
  const [profLevel, setProfLevel] = useState<string>(String(answers.proficiency_level || 'Elementary'));

  const resource = String(answers.resource || answers.learning_source || 'Online Course / Self Study');
  const instructor = String(answers.instructor || answers.author || '');

  // Lessons / Lectures State
  const [lessons, setLessons] = useState<CourseLesson[]>(() => {
    if (Array.isArray(goal.courseLessons) && goal.courseLessons.length > 0) {
      return goal.courseLessons.map((l, i) => ({
        id: l.id || String(i),
        title: l.title,
        durationMins: l.durationMins,
        completed: !!l.completed,
        completedAt: l.completedAt,
      }));
    }
    return [
      { id: '1', title: 'Course Overview & Setup', durationMins: 20, completed: true, completedAt: new Date().toISOString() },
      { id: '2', title: 'Core Principles & Fundamentals', durationMins: 45, completed: true, completedAt: new Date().toISOString() },
      { id: '3', title: 'Hands-on Practice Session 1', durationMins: 60, completed: false },
      { id: '4', title: 'Advanced Concepts & Capstone Project', durationMins: 90, completed: false },
    ];
  });

  // Practice Schedules State
  const [practiceList, setPracticeList] = useState<PracticeSession[]>(() => {
    if (Array.isArray(goal.practiceSchedules) && goal.practiceSchedules.length > 0) {
      return goal.practiceSchedules.map((p, i) => ({
        id: p.id || String(i),
        activity: p.activity,
        time: p.time,
        frequencyPerWeek: p.frequencyPerWeek || 3,
      }));
    }
    return [
      { id: '1', activity: 'Daily Practice / Coding Session', time: '08:00 PM', frequencyPerWeek: 5 },
      { id: '2', activity: 'Weekly Project Review & Quiz', time: '10:00 AM', frequencyPerWeek: 1 },
    ];
  });

  // Checkpoints State
  const [checkpoints, setCheckpoints] = useState<LearningCheckpoint[]>(() => {
    if (Array.isArray(goal.learningCheckpoints) && goal.learningCheckpoints.length > 0) {
      return goal.learningCheckpoints.map((c, i) => ({
        id: c.id || String(i),
        label: c.label,
        done: !!c.done,
      }));
    }
    return [
      { id: '1', label: 'Finish introductory module & setup environment', done: true },
      { id: '2', label: 'Complete first 5 practice exercises', done: true },
      { id: '3', label: 'Build midterm mini project', done: false },
      { id: '4', label: 'Earn course certificate / Pass final assessment', done: false },
    ];
  });

  // Modal States
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [logVal, setLogVal] = useState<number | ''>('');
  const [savingLog, setSavingLog] = useState(false);

  const [addLessonOpen, setAddLessonOpen] = useState(false);
  const [lessonTitleInput, setLessonTitleInput] = useState('');
  const [lessonDurationInput, setLessonDurationInput] = useState<number | ''>(30);
  const [savingLesson, setSavingLesson] = useState(false);

  const [addPracticeOpen, setAddPracticeOpen] = useState(false);
  const [practiceActivity, setPracticeActivity] = useState('');
  const [practiceTime, setPracticeTime] = useState('08:00 PM');
  const [practiceFreq, setPracticeFreq] = useState(3);
  const [savingPractice, setSavingPractice] = useState(false);

  const [addCheckpointOpen, setAddCheckpointOpen] = useState(false);
  const [checkpointLabel, setCheckpointLabel] = useState('');
  const [savingCheckpoint, setSavingCheckpoint] = useState(false);

  // Schedule Routine Modal State
  const [schedModalOpen, setSchedModalOpen] = useState(false);
  const [schedKind, setSchedKind] = useState<'schedule' | 'todo'>('schedule');
  const [schedTitle, setSchedTitle] = useState('');
  const [schedTime, setSchedTime] = useState('20:00');
  const [schedDate, setSchedDate] = useState(new Date().toISOString().split('T')[0]);
  const [savingSched, setSavingSched] = useState(false);

  // Progress Computations
  const mainProgress = useMemo(() => {
    if (unitDef.kind === 'categorical') {
      const idx = PROFICIENCY_LEVELS.indexOf(profLevel);
      return Math.round(((idx >= 0 ? idx + 1 : 1) / PROFICIENCY_LEVELS.length) * 100);
    }
    if (!targetLevel || targetLevel <= 0) return 0;
    return clamp(Math.round((currentLevel / targetLevel) * 100));
  }, [unitDef.kind, profLevel, currentLevel, targetLevel]);

  const lessonsDoneCnt = useMemo(() => lessons.filter((l) => l.completed).length, [lessons]);
  const checkpointsDoneCnt = useMemo(() => checkpoints.filter((c) => c.done).length, [checkpoints]);

  // Persist Goal Helpers
  const persistCourseData = async (updates: Partial<Goal>) => {
    if (!goal.id) return;
    if (onUpdateGoal) {
      await onUpdateGoal(goal.id, updates);
    } else {
      await updateDoc(doc(db, 'goals', goal.id), updates);
    }
  };

  // Quick Log
  const handleSaveLog = async () => {
    if (typeof logVal !== 'number' || logVal < 0 || !goal.id) return;
    setSavingLog(true);
    try {
      const newTotal = currentLevel + logVal;
      setCurrentLevel(newTotal);
      await persistCourseData({ currentValue: newTotal });
      setLogModalOpen(false);
      setLogVal('');
    } catch (err) {
      console.error('Failed to log learning progress:', err);
    } finally {
      setSavingLog(false);
    }
  };

  // Toggle Lesson
  const toggleLesson = async (id: string) => {
    const updated = lessons.map((l) =>
      l.id === id ? { ...l, completed: !l.completed, completedAt: !l.completed ? new Date().toISOString() : undefined } : l
    );
    setLessons(updated);

    // If unit is lessons/lectures, auto-update current level count!
    if (unitDef.key === 'lessons') {
      const newDoneCount = updated.filter((l) => l.completed).length;
      setCurrentLevel(newDoneCount);
      await persistCourseData({ courseLessons: updated, currentValue: newDoneCount });
    } else {
      await persistCourseData({ courseLessons: updated });
    }
  };

  // Add Lesson
  const handleAddLesson = async () => {
    if (!lessonTitleInput.trim() || !goal.id) return;
    setSavingLesson(true);
    try {
      const newLesson: CourseLesson = {
        id: String(Date.now()),
        title: lessonTitleInput.trim(),
        durationMins: typeof lessonDurationInput === 'number' ? lessonDurationInput : 30,
        completed: false,
      };
      const updated = [...lessons, newLesson];
      setLessons(updated);
      await persistCourseData({ courseLessons: updated });
      setAddLessonOpen(false);
      setLessonTitleInput('');
    } catch (err) {
      console.error('Failed to add lesson:', err);
    } finally {
      setSavingLesson(false);
    }
  };

  // Add Practice Session
  const handleAddPractice = async () => {
    if (!practiceActivity.trim() || !goal.id) return;
    setSavingPractice(true);
    try {
      const newSession: PracticeSession = {
        id: String(Date.now()),
        activity: practiceActivity.trim(),
        time: practiceTime,
        frequencyPerWeek: practiceFreq,
      };
      const updated = [...practiceList, newSession];
      setPracticeList(updated);
      await persistCourseData({ practiceSchedules: updated });
      setAddPracticeOpen(false);
      setPracticeActivity('');
    } catch (err) {
      console.error('Failed to add practice session:', err);
    } finally {
      setSavingPractice(false);
    }
  };

  // Toggle Checkpoint
  const toggleCheckpoint = async (id: string) => {
    const updated = checkpoints.map((c) => (c.id === id ? { ...c, done: !c.done } : c));
    setCheckpoints(updated);
    await persistCourseData({ learningCheckpoints: updated });
  };

  // Add Checkpoint
  const handleAddCheckpoint = async () => {
    if (!checkpointLabel.trim() || !goal.id) return;
    setSavingCheckpoint(true);
    try {
      const newCp: LearningCheckpoint = {
        id: String(Date.now()),
        label: checkpointLabel.trim(),
        done: false,
      };
      const updated = [...checkpoints, newCp];
      setCheckpoints(updated);
      await persistCourseData({ learningCheckpoints: updated });
      setAddCheckpointOpen(false);
      setCheckpointLabel('');
    } catch (err) {
      console.error('Failed to add checkpoint:', err);
    } finally {
      setSavingCheckpoint(false);
    }
  };

  // Schedule Routine or Task
  const handleScheduleRoutine = async () => {
    if (!schedTitle.trim() || !user || !goal.id) return;
    setSavingSched(true);
    try {
      if (schedKind === 'schedule') {
        await addSchedule({
          title: schedTitle.trim(),
          date: schedDate || new Date().toISOString().split('T')[0],
          startTime: schedTime || '20:00',
          endTime: '21:00',
          projectId: goal.projectId || '',
          userId: user.uid,
          status: 'pending',
          priority: 'medium',
          linkedGoalId: goal.id,
          goalTitle: goal.title,
          frequencyMode: 'daily',
        });
      } else {
        await addTodo({
          title: schedTitle.trim(),
          status: 'in_progress',
          priority: 'routine',
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
      console.error('Failed to add course schedule:', err);
    } finally {
      setSavingSched(false);
    }
  };

  // Linked items
  const linkedCourseSchedules = useMemo(() => {
    if (!goal.id) return [];
    return allSchedules.filter((s) => (s as { linkedGoalId?: string }).linkedGoalId === goal.id);
  }, [allSchedules, goal.id]);

  const linkedCourseTodos = useMemo(() => {
    if (!goal.id) return [];
    return todos.filter((t) => (t as { linkedGoalId?: string }).linkedGoalId === goal.id);
  }, [todos, goal.id]);

  const surfaceBg = isDark ? '#1e293b' : '#ffffff';
  const cardBorder = isDark ? '#334155' : '#e2e8f0';
  const textPrimary = isDark ? '#f1f5f9' : '#1e293b';
  const textMuted = isDark ? '#94a3b8' : '#64748b';

  return (
    <Box sx={{ width: '100%', maxWidth: 720, mx: 'auto' }}>
      {/* Course / Skill Hero Card */}
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: '14px',
                bgcolor: isDark ? 'rgba(217, 70, 239, 0.15)' : '#fae8ff',
                color: '#d946ef',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CourseIcon sx={{ fontSize: 24 }} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: textMuted, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                Course & Skill Tracker
              </Typography>
              <Typography sx={{ fontSize: 18, fontWeight: 800, color: textPrimary, mt: 0.2 }}>
                {skillName}
              </Typography>
              {(resource || instructor) && (
                <Typography sx={{ fontSize: 12, color: textMuted, mt: 0.2 }}>
                  {resource} {instructor ? `· ${instructor}` : ''}
                </Typography>
              )}
            </Box>
          </Box>
          <Chip
            label={unitDef.label}
            size="small"
            sx={{ bgcolor: isDark ? '#4c1d95' : '#f3e8ff', color: '#a855f7', fontWeight: 700, fontSize: 11 }}
          />
        </Box>

        {/* Level / Gauge Indicator */}
        <Box sx={{ mt: 3.5 }}>
          {unitDef.kind === 'categorical' ? (
            <>
              <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mb: 1 }}>
                <Typography sx={{ fontSize: 24, fontWeight: 800, color: textPrimary }}>
                  {profLevel}
                </Typography>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#d946ef' }}>
                  {mainProgress}% Proficiency
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {PROFICIENCY_LEVELS.map((level, i) => {
                  const filled = i <= PROFICIENCY_LEVELS.indexOf(profLevel);
                  return (
                    <Box key={level} sx={{ flex: 1 }}>
                      <Box
                        onClick={() => {
                          setProfLevel(level);
                          persistCourseData({ questionnaireAnswers: { ...answers, proficiency_level: level } });
                        }}
                        sx={{
                          height: 8,
                          borderRadius: 99,
                          bgcolor: filled ? '#d946ef' : isDark ? '#334155' : '#f1f5f9',
                          cursor: 'pointer',
                          transition: 'all 0.3s ease',
                          '&:hover': { opacity: 0.8 },
                        }}
                      />
                      <Typography sx={{ fontSize: 9, color: filled ? '#d946ef' : textMuted, textAlign: 'center', mt: 0.5, fontWeight: filled ? 700 : 500 }}>
                        {level}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
            </>
          ) : (
            <>
              <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mb: 1 }}>
                <Typography sx={{ fontSize: 28, fontWeight: 800, color: textPrimary, fontFamily: 'monospace' }}>
                  {currentLevel.toLocaleString()} <span style={{ fontSize: 14, fontWeight: 600, color: textMuted }}>{unitDef.suffix || goal.unit}</span>
                </Typography>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#d946ef' }}>
                  {mainProgress}% of Target ({targetLevel} {unitDef.suffix || goal.unit})
                </Typography>
              </Box>
              <Box sx={{ height: 8, borderRadius: 99, bgcolor: isDark ? '#334155' : '#f1f5f9', overflow: 'hidden' }}>
                <Box
                  sx={{
                    height: '100%',
                    width: `${mainProgress}%`,
                    bgcolor: '#d946ef',
                    borderRadius: 99,
                    transition: 'width 0.5s ease',
                  }}
                />
              </Box>
            </>
          )}
        </Box>

        {/* Quick Actions Row */}
        <Box sx={{ mt: 3, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {unitDef.kind !== 'categorical' && (
            <Button
              size="small"
              variant="contained"
              onClick={() => setLogModalOpen(true)}
              startIcon={<AddIcon sx={{ fontSize: 16 }} />}
              sx={{ borderRadius: '12px', textTransform: 'none', fontSize: 12, fontWeight: 700, bgcolor: '#d946ef', '&:hover': { bgcolor: '#c026d3' } }}
            >
              + Log {unitDef.label}
            </Button>
          )}
          <Button
            size="small"
            variant="outlined"
            onClick={() => {
              setSchedTitle(`Study / Practice Session: ${skillName}`);
              setSchedModalOpen(true);
            }}
            startIcon={<EventIcon sx={{ fontSize: 16 }} />}
            sx={{ borderRadius: '12px', textTransform: 'none', fontSize: 12, fontWeight: 700 }}
          >
            + Schedule Study Session
          </Button>
        </Box>
      </Box>

      {/* Course Modules / Lectures Checklist Section */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, px: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LessonIcon sx={{ color: '#a855f7', fontSize: 20 }} />
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: textPrimary }}>
              Lessons & Lectures ({lessonsDoneCnt}/{lessons.length})
            </Typography>
          </Box>
          <Button
            size="small"
            onClick={() => setAddLessonOpen(true)}
            startIcon={<AddIcon sx={{ fontSize: 15 }} />}
            sx={{ textTransform: 'none', fontSize: 12, fontWeight: 700, color: '#a855f7' }}
          >
            + Add Lesson
          </Button>
        </Box>

        <Stack spacing={1.25}>
          {lessons.map((lesson) => (
            <Box
              key={lesson.id}
              onClick={() => toggleLesson(lesson.id)}
              sx={{
                p: 2,
                borderRadius: '16px',
                bgcolor: surfaceBg,
                border: `1px solid ${cardBorder}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                '&:hover': { borderColor: '#a855f7' },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <IconButton size="small" sx={{ p: 0, color: lesson.completed ? '#10b981' : textMuted }}>
                  {lesson.completed ? <CheckCircle sx={{ fontSize: 20 }} /> : <RadioButtonUnchecked sx={{ fontSize: 20 }} />}
                </IconButton>
                <Box>
                  <Typography
                    sx={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: lesson.completed ? textMuted : textPrimary,
                      textDecoration: lesson.completed ? 'line-through' : 'none',
                    }}
                  >
                    {lesson.title}
                  </Typography>
                  {lesson.durationMins && (
                    <Typography sx={{ fontSize: 11, color: textMuted }}>
                      {lesson.durationMins} mins
                    </Typography>
                  )}
                </Box>
              </Box>
              {lesson.completedAt && (
                <Typography sx={{ fontSize: 10, color: textMuted, fontStyle: 'italic' }}>
                  Completed {formatDate(lesson.completedAt)}
                </Typography>
              )}
            </Box>
          ))}
        </Stack>
      </Box>

      {/* Practice Schedules Section */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, px: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ClockIcon sx={{ color: '#0284c7', fontSize: 20 }} />
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: textPrimary }}>
              Practice Schedule ({practiceList.length})
            </Typography>
          </Box>
          <Button
            size="small"
            onClick={() => setAddPracticeOpen(true)}
            startIcon={<AddIcon sx={{ fontSize: 15 }} />}
            sx={{ textTransform: 'none', fontSize: 12, fontWeight: 700, color: '#0284c7' }}
          >
            + Add Practice
          </Button>
        </Box>

        <Stack spacing={1.25}>
          {practiceList.map((p) => (
            <Box
              key={p.id}
              sx={{
                p: 2,
                borderRadius: '16px',
                bgcolor: surfaceBg,
                border: `1px solid ${cardBorder}`,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography sx={{ fontSize: 14, fontWeight: 700, color: textPrimary }}>
                    {p.activity}
                  </Typography>
                  {p.time && (
                    <Typography sx={{ fontSize: 11, color: textMuted }}>
                      Routine Time: {p.time}
                    </Typography>
                  )}
                </Box>
                <Chip
                  label={`${p.frequencyPerWeek}x/week`}
                  size="small"
                  sx={{ bgcolor: isDark ? '#0c4a6e' : '#e0f2fe', color: '#0284c7', fontWeight: 700, fontSize: 11 }}
                />
              </Box>

              {/* 7-day dot indicator */}
              <Box sx={{ mt: 1.5, display: 'flex', gap: 0.75 }}>
                {Array.from({ length: 7 }).map((_, i) => (
                  <Box
                    key={i}
                    sx={{
                      height: 6,
                      flex: 1,
                      borderRadius: 99,
                      bgcolor: i < p.frequencyPerWeek ? '#0284c7' : isDark ? '#334155' : '#f1f5f9',
                    }}
                  />
                ))}
              </Box>
            </Box>
          ))}
        </Stack>
      </Box>

      {/* Learning Checkpoints Section */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, px: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CheckpointIcon sx={{ color: '#eab308', fontSize: 20 }} />
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: textPrimary }}>
              Checkpoints ({checkpointsDoneCnt}/{checkpoints.length})
            </Typography>
          </Box>
          <Button
            size="small"
            onClick={() => setAddCheckpointOpen(true)}
            startIcon={<AddIcon sx={{ fontSize: 15 }} />}
            sx={{ textTransform: 'none', fontSize: 12, fontWeight: 700, color: '#eab308' }}
          >
            + Add Checkpoint
          </Button>
        </Box>

        <Stack spacing={1.25}>
          {checkpoints.map((cp) => (
            <Box
              key={cp.id}
              onClick={() => toggleCheckpoint(cp.id)}
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
              <IconButton size="small" sx={{ p: 0, color: cp.done ? '#10b981' : textMuted }}>
                {cp.done ? <CheckCircle sx={{ fontSize: 20 }} /> : <RadioButtonUnchecked sx={{ fontSize: 20 }} />}
              </IconButton>
              <Typography
                sx={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: cp.done ? textMuted : textPrimary,
                  textDecoration: cp.done ? 'line-through' : 'none',
                }}
              >
                {cp.label}
              </Typography>
            </Box>
          ))}
        </Stack>
      </Box>

      {/* Linked Schedules & Tasks */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, px: 0.5 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: textMuted, textTransform: 'uppercase', letterSpacing: '.05em' }}>
            Synced Study Reminders ({linkedCourseSchedules.length + linkedCourseTodos.length})
          </Typography>
        </Box>

        <Stack spacing={1.25}>
          {linkedCourseSchedules.map((s) => (
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
                <EventIcon sx={{ color: '#d946ef', fontSize: 20 }} />
                <Box>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, color: textPrimary }}>
                    {s.title}
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: textMuted }}>
                    Time: {s.startTime || '08:00 PM'} · Daily Study
                  </Typography>
                </Box>
              </Box>
              <Chip label="Scheduled" size="small" sx={{ bgcolor: isDark ? '#4c1d95' : '#f3e8ff', color: '#d946ef', fontSize: 10, fontWeight: 700 }} />
            </Box>
          ))}

          {linkedCourseTodos.map((todo) => {
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

      {/* Dialog: Quick Log Progress */}
      <Dialog open={logModalOpen} onClose={() => setLogModalOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: 16 }}>Log {unitDef.label}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label={`Logged ${unitDef.label} Count`}
              type="number"
              placeholder="e.g. 2 (hours / lessons)"
              fullWidth
              size="small"
              value={logVal}
              onChange={(e) => setLogVal(e.target.value ? Number(e.target.value) : '')}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setLogModalOpen(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={savingLog || typeof logVal !== 'number' || logVal <= 0}
            onClick={handleSaveLog}
            sx={{ textTransform: 'none', bgcolor: '#d946ef', '&:hover': { bgcolor: '#c026d3' } }}
          >
            Save Progress
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Add Lesson */}
      <Dialog open={addLessonOpen} onClose={() => setAddLessonOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: 16 }}>Add Course Lesson / Lecture</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Lesson Title"
              placeholder="e.g. Chapter 4: State Management"
              fullWidth
              size="small"
              value={lessonTitleInput}
              onChange={(e) => setLessonTitleInput(e.target.value)}
            />
            <TextField
              label="Estimated Duration (minutes)"
              type="number"
              fullWidth
              size="small"
              value={lessonDurationInput}
              onChange={(e) => setLessonDurationInput(e.target.value ? Number(e.target.value) : '')}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setAddLessonOpen(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={savingLesson || !lessonTitleInput.trim()}
            onClick={handleAddLesson}
            sx={{ textTransform: 'none', bgcolor: '#a855f7', '&:hover': { bgcolor: '#9333ea' } }}
          >
            Add Lesson
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Add Practice */}
      <Dialog open={addPracticeOpen} onClose={() => setAddPracticeOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: 16 }}>Add Practice Routine</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Activity Name"
              placeholder="e.g. Coding Challenges / Portfolio Design"
              fullWidth
              size="small"
              value={practiceActivity}
              onChange={(e) => setPracticeActivity(e.target.value)}
            />
            <TextField
              label="Routine Time"
              placeholder="e.g. 08:00 PM"
              fullWidth
              size="small"
              value={practiceTime}
              onChange={(e) => setPracticeTime(e.target.value)}
            />
            <TextField
              label="Frequency (days per week)"
              type="number"
              fullWidth
              size="small"
              value={practiceFreq}
              onChange={(e) => setPracticeFreq(Number(e.target.value))}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setAddPracticeOpen(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={savingPractice || !practiceActivity.trim()}
            onClick={handleAddPractice}
            sx={{ textTransform: 'none', bgcolor: '#0284c7', '&:hover': { bgcolor: '#0369a1' } }}
          >
            Add Practice
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Add Checkpoint */}
      <Dialog open={addCheckpointOpen} onClose={() => setAddCheckpointOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: 16 }}>Add Learning Checkpoint</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Checkpoint Description"
              placeholder="e.g. Complete mid-course evaluation exam"
              fullWidth
              size="small"
              value={checkpointLabel}
              onChange={(e) => setCheckpointLabel(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setAddCheckpointOpen(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={savingCheckpoint || !checkpointLabel.trim()}
            onClick={handleAddCheckpoint}
            sx={{ textTransform: 'none', bgcolor: '#eab308', '&:hover': { bgcolor: '#ca8a04' } }}
          >
            Add Checkpoint
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Schedule Routine / Task */}
      <Dialog open={schedModalOpen} onClose={() => setSchedModalOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: 16 }}>Schedule Study Session</DialogTitle>
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
                Schedule Session
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
              label="Study Title"
              placeholder="e.g. 1-Hour Daily Study Routine"
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
            onClick={handleScheduleRoutine}
            sx={{ textTransform: 'none', bgcolor: '#d946ef', '&:hover': { bgcolor: '#c026d3' } }}
          >
            Save Routine
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
