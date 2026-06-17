'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Checkbox,
  Stack,
  Chip,
  Avatar,
  LinearProgress,
  Switch,
  Tooltip,
  IconButton,
  Divider,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import FlagIcon from '@mui/icons-material/Flag';
import ChecklistIcon from '@mui/icons-material/Checklist';
import HomeIcon from '@mui/icons-material/Home';
import AssignmentIcon from '@mui/icons-material/Assignment';
import PriceCheckIcon from '@mui/icons-material/PriceCheck';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import StarIcon from '@mui/icons-material/Star';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { useCustomTheme } from '@/app/lib/context/themeContext';

export default function TodosGuide({ language = 'en' }: { language?: 'en' | 'ur' }) {
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';
  const isRtl = language === 'ur';

  // State for Mockup 1: Interactive Task Card
  const [workStarted, setWorkStarted] = useState(false);

  // State for Mockup 2: Interactive Checklist
  const [steps, setSteps] = useState([
    {
      id: 1,
      textEn: 'Review daily targets',
      textUr: 'روزمرہ کے کاموں کا جائزہ لیں',
      completed: true,
    },
    {
      id: 2,
      textEn: 'Draft layout & outline',
      textUr: 'خاکہ اور ڈیزائن تیار کریں',
      completed: false,
    },
    {
      id: 3,
      textEn: 'Incorporate user feedback',
      textUr: 'صارفین کی آراء شامل کریں',
      completed: false,
    },
    {
      id: 4,
      textEn: 'Finalize and launch',
      textUr: 'آخری نظر ثانی اور لانچ کریں',
      completed: false,
    },
  ]);

  // State for Mockup 3: Premium WhatsApp reminder
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);

  // Calculation for Checklist Progress
  const completedSteps = steps.filter((s) => s.completed).length;
  const progressPercent = Math.round((completedSteps / steps.length) * 100);

  const toggleStep = (id: number) => {
    setSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, completed: !s.completed } : s))
    );
  };

  return (
    <div className="space-y-12">
      {/* Introduction Banner */}
      <Box
        className="p-6 rounded-2xl border mb-8"
        sx={{
          background: isDark
            ? 'rgba(30, 41, 59, 0.4)'
            : 'rgba(241, 245, 249, 0.6)',
          borderColor: isDark ? 'rgba(51, 65, 85, 0.5)' : 'rgba(226, 232, 240, 0.8)',
        }}
      >
        <Stack direction={isRtl ? 'row-reverse' : 'row'} spacing={2} alignItems="flex-start">
          <InfoOutlinedIcon className="text-blue-500 shrink-0 mt-0.5" sx={{ fontSize: 24 }} />
          <div className={isRtl ? 'text-right w-full' : 'text-left w-full'}>
            <Typography variant="subtitle1" fontWeight="bold" className="text-slate-800 dark:text-slate-100 mb-1"
              sx={{ lineHeight: isRtl ? 1.6 : 1.2 }}
            >
              {isRtl ? 'مائی اوربٹ ٹاسکس کیا ہیں؟' : 'What are MyOrbit To-Dos?'}
            </Typography>
            <Typography variant="body2" className="text-slate-600 dark:text-slate-300 leading-relaxed"
              sx={{ lineHeight: isRtl ? 1.8 : 1.6 }}
            >
              {isRtl
                ? 'کاموں کی فہرست (To-Dos) آپ کے روزمرہ کے معمولات کو منظم کرنے، آپ کو متحرک رکھنے اور مرحلہ وار ترقی کو ٹریک کرنے کے لیے بنائی گئی ہے۔ چاہے آپ کو آج کے لیے ایک سادہ سا کام درج کرنا ہو یا ہفتوں پر محیط کسی پروجیکٹ کی منصوبہ بندی کرنی ہو، مائی اوربٹ آپ کی مدد کرتا ہے۔'
                : 'Tasks and To-Dos are designed to structure your daily routine, keep you focused, and track progressive milestones. Whether you need a simple reminder for today or want to lay out a complex, multi-week project, MyOrbit helps you manage it seamlessly.'}
            </Typography>
          </div>
        </Stack>
      </Box>

      {/* Grid of Guide Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Side: Explanations */}
        <div className="lg:col-span-7 space-y-12">
          
          {/* Section 1: Flexible Scheduling */}
          <section className="space-y-3">
            <div className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}>
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-sm">
                ۱
              </span>
              <Typography variant="h6" fontWeight="bold" className="text-slate-800 dark:text-slate-100">
                {isRtl ? 'لچکدار شیڈولنگ اور سمارٹ ویو' : 'Flexible Scheduling & Smart View'}
              </Typography>
            </div>
            <Typography variant="body1" className="text-slate-600 dark:text-slate-300 leading-relaxed"
              sx={{ lineHeight: isRtl ? 1.8 : 1.6, textAlign: isRtl ? 'right' : 'left' }}
            >
              {isRtl
                ? 'ضروری نہیں ہے کہ ہر کام کی آخری تاریخ آج ہی ہو۔ آپ 1 سے 2 ہفتے آگے کی تاریخوں کے کام بھی بنا سکتے ہیں (یا انہیں بغیر کسی تاریخ کے لچکدار رکھ سکتے ہیں)۔'
                : 'It is not necessary that every task must be due today. You can create tasks with due dates stretching 1 to 2 weeks out (or make them flexible).'}
            </Typography>
            <Typography variant="body1" className="text-slate-600 dark:text-slate-300 leading-relaxed"
              sx={{ lineHeight: isRtl ? 1.8 : 1.6, textAlign: isRtl ? 'right' : 'left' }}
            >
              {isRtl
                ? 'غیر ضروری رش سے بچنے اور توجہ برقرار رکھنے کے لیے، ایپ ترجیحی طور پر صرف آج اور اگلے 4 دنوں کے کام دکھاتی ہے۔ آپ کے دوسرے تمام کام محفوظ رہیں گے اور ان کا وقت آنے پر وہ خود بخود نظر آئیں گے!'
                : 'To prevent clutter and help you focus, the app prefers to display tasks scheduled for today and the next 4 days. You can rest assured your future tasks are safe and will automatically bubble up when their time comes!'}
            </Typography>
          </section>

          {/* Section 2: Task Fields & Details */}
          <section className="space-y-3">
            <div className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}>
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-sm">
                ۲
              </span>
              <Typography variant="h6" fontWeight="bold" className="text-slate-800 dark:text-slate-100">
                {isRtl ? 'کام کی تفصیلات (ٹاسک فارم)' : 'Anatomy of a Task'}
              </Typography>
            </div>
            <Typography variant="body1" className="text-slate-600 dark:text-slate-300 leading-relaxed"
              sx={{ lineHeight: isRtl ? 1.8 : 1.6, textAlign: isRtl ? 'right' : 'left' }}
            >
              {isRtl
                ? 'کام تخلیق کرتے وقت صرف عنوان (Title) اور آخری تاریخ (Due Date) لازمی ہیں۔ اپنے کاموں کو ترجیح دینے کے لیے آپ درج ذیل اضافی معلومات بھی شامل کر سکتے ہیں:'
                : 'When creating a task, only a Title and a Due Date are mandatory. To prioritize and categorize your workspace, you can also set optional metadata:'}
            </Typography>
            <ul className={`list-disc pl-6 pr-6 space-y-1.5 text-slate-600 dark:text-slate-300 ${isRtl ? 'text-right' : 'text-left'}`}
              style={{ direction: isRtl ? 'rtl' : 'ltr' }}
            >
              <li>
                {isRtl
                  ? <span><strong>اہمیت (Priority)</strong>: کاموں کو ان کے درجے کے مطابق <em>Routine</em> (عام)، <em>Urgent</em> (فوری)، یا <em>Critical</em> (انتہائی اہم) پر نشان زد کریں۔</span>
                  : <span><strong>Priority Level</strong>: Mark tasks as <em>Routine</em>, <em>Urgent</em>, or <em>Critical</em> to sort by urgency.</span>}
              </li>
              <li>
                {isRtl
                  ? <span><strong>کام تفویض کرنا (Assignee)</strong>: کام کو کسی مخصوص پروفائل یا دوست کے ذمے لگائیں۔</span>
                  : <span><strong>Assignee</strong>: Delegate tasks to profiles or team members.</span>}
              </li>
              <li>
                {isRtl
                  ? <span><strong>کام کا ٹریکر (Work Tracker)</strong>: کام کی وقت کی پیمائش کے لیے اسٹارٹ اور اسٹاپ کے کنٹرولز استعمال کریں۔</span>
                  : <span><strong>Work Tracker</strong>: Toggle work status using the start/stop controls to track active engagements.</span>}
              </li>
            </ul>
          </section>

          {/* Section 3: Sub-Steps & Automatic Progress */}
          <section className="space-y-3">
            <div className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}>
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-sm">
                ۳
              </span>
              <Typography variant="h6" fontWeight="bold" className="text-slate-800 dark:text-slate-100">
                {isRtl ? 'ذیلی مراحل اور خودکار ترقی' : 'Sub-Steps & Progress Adjustments'}
              </Typography>
            </div>
            <Typography variant="body1" className="text-slate-600 dark:text-slate-300 leading-relaxed"
              sx={{ lineHeight: isRtl ? 1.8 : 1.6, textAlign: isRtl ? 'right' : 'left' }}
            >
              {isRtl
                ? 'بڑے اور پیچیدہ کاموں کو تخلیق کرنے کے بعد ان کے اندر چھوٹے چھوٹے ذیلی مراحل (Steps) بنائے جا سکتے ہیں۔'
                : 'Complex tasks can be broken down into steps and sub-steps after creation.'}
            </Typography>
            <Typography variant="body1" className="text-slate-600 dark:text-slate-300 leading-relaxed"
              sx={{ lineHeight: isRtl ? 1.8 : 1.6, textAlign: isRtl ? 'right' : 'left' }}
            >
              {isRtl
                ? 'جیسے جیسے آپ کسی بھی مرحلے کو مکمل کرتے ہیں، آپ کے کام کی مجموعی ترقی (Progress) کا تناسب خود بخود بڑھ جاتا ہے۔ نئے مراحل شامل کرنے یا پرانے ہٹانے سے یہ تناسب خودکار طور پر ایڈجسٹ ہو جاتا ہے۔'
                : 'By completing a step, your overall task progress percentage is automatically increased. Adding or removing steps will immediately recalculate the overall completion rate, keeping your project velocity perfectly aligned.'}
            </Typography>
          </section>

          {/* Section 4: Premium WhatsApp Reminders */}
          <section className="space-y-3">
            <div className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}>
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold text-sm">
                ۴
              </span>
              <Typography variant="h6" fontWeight="bold" className="text-slate-800 dark:text-slate-100">
                {isRtl ? 'پریمیم اطلاعات اور واٹس ایپ الرٹس' : 'Premium Notifications & Alerts'}
              </Typography>
            </div>
            <Typography variant="body1" className="text-slate-600 dark:text-slate-300 leading-relaxed"
              sx={{ lineHeight: isRtl ? 1.8 : 1.6, textAlign: isRtl ? 'right' : 'left' }}
            >
              {isRtl
                ? 'ہمارے پریمیم ممبرز کے لیے مائی اوربٹ براہ راست واٹس ایپ (WhatsApp) اور پش نوٹیفیکیشنز فراہم کرتا ہے تاکہ آپ کے اہم کام کبھی نہ چھوٹیں۔'
                : 'For our Paid Members, MyOrbit provides direct alerts so you never lose track of important responsibilities. You can configure automated WhatsApp notifications and immediate push notifications to remind you of due tasks.'}
            </Typography>
          </section>

          {/* Section 5: Access Points */}
          <section className="space-y-3">
            <div className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}>
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-sm">
                ۵
              </span>
              <Typography variant="h6" fontWeight="bold" className="text-slate-800 dark:text-slate-100">
                {isRtl ? 'اپنے کام کی فہرست کہاں تلاش کریں؟' : 'Where to Find Your To-Dos'}
              </Typography>
            </div>
            <Typography variant="body1" className="text-slate-600 dark:text-slate-300 leading-relaxed"
              sx={{ lineHeight: isRtl ? 1.8 : 1.6, textAlign: isRtl ? 'right' : 'left' }}
            >
              {isRtl
                ? 'آپ نیچے نیویگیشن بار میں ٹاسک (To-Do) آئیکن پر کلک کر کے مکمل ٹاسک مینیجر پر جا سکتے ہیں۔ یہ آئیکن چیک لسٹ کی شکل کا ہے۔'
                : 'You can navigate to the full tasks management module by visiting /to-do. Simply click the To-Do icon on the bottom navigation bar.'}
            </Typography>
            <Typography variant="body1" className="text-slate-600 dark:text-slate-300 leading-relaxed"
              sx={{ lineHeight: isRtl ? 1.8 : 1.6, textAlign: isRtl ? 'right' : 'left' }}
            >
              {isRtl
                ? 'اس کے علاوہ، آپ ہوم پیج ڈیش بورڈ پر بھی اپنے انتہائی اہم اور بقایا کاموں کو فوری طور پر دیکھ سکتے ہیں۔'
                : "Additionally, you can view your urgent, overdue, and today's tasks right on your Homepage Dashboard widgets."}
            </Typography>
          </section>

        </div>

        {/* Right Side: Interactive Mockups */}
        <div className="lg:col-span-5 space-y-8 lg:sticky lg:top-4">
          
          <Typography variant="subtitle2" className="text-slate-400 uppercase tracking-widest font-semibold text-center"
            sx={{ textAlign: isRtl ? 'right' : 'left' }}
          >
            {isRtl ? 'انٹرایکٹو ڈیمو (بذاتِ خود ٹیسٹ کریں)' : 'Interactive Demos (Try Them!)'}
          </Typography>

          {/* Mockup 1 & 2: The Task Item Card & Checklist */}
          <Card
            elevation={4}
            className="border transition-all duration-300"
            sx={{
              borderColor: isDark ? 'rgba(51, 65, 85, 0.6)' : 'rgba(226, 232, 240, 0.9)',
              bgcolor: isDark ? '#1e293b' : '#ffffff',
              borderRadius: '16px',
            }}
          >
            {/* Status indicator bar top of card */}
            <Box
              sx={{
                height: 4,
                backgroundColor: '#3b82f6',
                borderTopLeftRadius: '16px',
                borderTopRightRadius: '16px',
              }}
            />
            
            <CardContent className="p-5" style={{ direction: isRtl ? 'rtl' : 'ltr' }}>
              {/* Task Header */}
              <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                <Box>
                  <Stack direction={isRtl ? 'row-reverse' : 'row'} spacing={1} alignItems="center" mb={0.5}>
                    <Typography variant="h6" fontWeight="bold" className="text-slate-850 dark:text-white"
                      sx={{ fontSize: isRtl ? '1.05rem' : '1.25rem' }}
                    >
                      {isRtl ? 'مائی اوربٹ گائیڈ بنانا' : 'Build Guide Component'}
                    </Typography>
                    {/* Blinking indicator */}
                    {workStarted && (
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          bgcolor: 'success.main',
                          boxShadow: '0 0 0 0 rgba(34,197,94, 0.7)',
                          animation: 'pulse 1.2s infinite',
                          mx: 1,
                          '@keyframes pulse': {
                            '0%': { boxShadow: '0 0 0 0 rgba(34, 197, 94, 0.7)' },
                            '70%': { boxShadow: '0 0 0 6px rgba(34, 197, 94, 0)' },
                            '100%': { boxShadow: '0 0 0 0 rgba(34, 197, 94, 0)' },
                          },
                        }}
                      />
                    )}
                  </Stack>
                  <Typography variant="caption" className="text-slate-400 dark:text-slate-400 block"
                    sx={{ textAlign: isRtl ? 'right' : 'left' }}
                  >
                    {isRtl ? 'تخلیق: آج شام 8:00 بجے' : 'Created: Today at 8:00 PM'}
                  </Typography>
                </Box>

                {/* Work start toggle */}
                <Tooltip title={isRtl ? (workStarted ? 'کام روکیں' : 'کام شروع کریں') : (workStarted ? 'Pause Tracker' : 'Start Tracker')} arrow>
                  <IconButton
                    size="small"
                    onClick={() => setWorkStarted(!workStarted)}
                    sx={{
                      bgcolor: workStarted ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.1)',
                      color: workStarted ? '#10b981' : '#3b82f6',
                      '&:hover': {
                        bgcolor: workStarted ? 'rgba(16, 185, 129, 0.25)' : 'rgba(59, 130, 246, 0.2)',
                      },
                    }}
                  >
                    {workStarted ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
                  </IconButton>
                </Tooltip>
              </Box>

              {/* Task Meta Chips */}
              <Stack direction={isRtl ? 'row-reverse' : 'row'} spacing={1} mb={3} flexWrap="wrap" gap={1}>
                <Chip
                  icon={<FlagIcon sx={{ fontSize: '12px !important' }} />}
                  label={isRtl ? 'اہم کام' : 'Urgent'}
                  size="small"
                  variant="outlined"
                  sx={{
                    borderColor: '#f59e0b',
                    color: '#f59e0b',
                    fontWeight: 600,
                    flexDirection: isRtl ? 'row-reverse' : 'row',
                    '& .MuiChip-icon': { mx: 0.5 }
                  }}
                />
                <Chip
                  icon={<AccessTimeIcon sx={{ fontSize: '12px !important' }} />}
                  label={isRtl ? 'آخری تاریخ: 20 جون' : 'Due: Jun 20'}
                  size="small"
                  variant="outlined"
                  sx={{
                    borderColor: '#3b82f6',
                    color: '#3b82f6',
                    fontWeight: 600,
                    flexDirection: isRtl ? 'row-reverse' : 'row',
                    '& .MuiChip-icon': { mx: 0.5 }
                  }}
                />
                <Chip
                  label={isRtl ? 'کاشف ر۔' : 'Kashif R.'}
                  size="small"
                  variant="outlined"
                  avatar={<Avatar sx={{ width: 16, height: 16, fontSize: 10 }}>K</Avatar>}
                  sx={{ fontWeight: 600, flexDirection: isRtl ? 'row-reverse' : 'row' }}
                />
              </Stack>

              {/* Sub-steps checklist Header */}
              <Divider className="my-3" />
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1} mt={1}
                sx={{ flexDirection: isRtl ? 'row-reverse' : 'row' }}
              >
                <Typography variant="body2" fontWeight="bold" className="text-slate-500 dark:text-slate-400">
                  {isRtl ? 'ذیلی مراحل کی لسٹ' : 'Sub-steps checklist'}
                </Typography>
                <Typography variant="body2" fontWeight="bold" className="text-blue-500">
                  {progressPercent}% {isRtl ? 'مکمل' : 'Complete'}
                </Typography>
              </Box>

              {/* Progress bar */}
              <LinearProgress
                variant="determinate"
                value={progressPercent}
                sx={{
                  height: 6,
                  borderRadius: 3,
                  mb: 3,
                  backgroundColor: isDark ? '#334155' : '#f1f5f9',
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 3,
                    backgroundColor: progressPercent === 100 ? '#10b981' : '#3b82f6',
                  },
                }}
              />

              {/* Steps Checklist List */}
              <div className="space-y-1.5">
                {steps.map((step) => (
                  <Box
                    key={step.id}
                    className={`flex items-center gap-2 p-2 rounded-lg transition-colors duration-200 cursor-pointer ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}
                    sx={{
                      '&:hover': {
                        bgcolor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                      },
                    }}
                    onClick={() => toggleStep(step.id)}
                  >
                    <Checkbox
                      checked={step.completed}
                      size="small"
                      sx={{ p: 0.5, color: '#3b82f6' }}
                    />
                    <Typography
                      variant="body2"
                      className={`transition-all duration-200 ${
                        step.completed
                          ? 'line-through text-slate-400 dark:text-slate-500'
                          : 'text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {isRtl ? step.textUr : step.textEn}
                    </Typography>
                  </Box>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Mockup 3: Premium WhatsApp reminder */}
          <Card
            elevation={4}
            className="border overflow-hidden"
            sx={{
              borderColor: isDark ? 'rgba(51, 65, 85, 0.6)' : 'rgba(226, 232, 240, 0.9)',
              bgcolor: isDark ? '#1e293b' : '#ffffff',
              borderRadius: '16px',
            }}
          >
            <CardContent className="p-5" style={{ direction: isRtl ? 'rtl' : 'ltr' }}>
              <Box display="flex" alignItems="center" mb={2} sx={{ flexDirection: isRtl ? 'row-reverse' : 'row' }}>
                <div className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}>
                  <Avatar sx={{ bgcolor: 'rgba(168, 85, 247, 0.15)', color: '#a855f7', width: 36, height: 36 }}>
                    <StarIcon sx={{ fontSize: 20 }} />
                  </Avatar>
                  <div className={isRtl ? 'text-right' : 'text-left'}>
                    <Typography variant="body1" fontWeight="bold" className="text-slate-800 dark:text-slate-100 leading-none">
                      {isRtl ? 'واٹس ایپ نوٹیفیکیشن' : 'WhatsApp Integration'}
                    </Typography>
                    <Typography variant="caption" className="text-slate-400">
                      {isRtl ? 'پریمیم اکاؤنٹ کی خصوصیت' : 'Premium Member Feature'}
                    </Typography>
                  </div>
                </div>
                <div className={isRtl ? 'mr-auto ml-0' : 'ml-auto mr-0'}>
                  <Switch
                    checked={whatsappEnabled}
                    onChange={(e) => setWhatsappEnabled(e.target.checked)}
                    color="secondary"
                  />
                </div>
              </Box>

              <Typography variant="body2" className="text-slate-500 dark:text-slate-400 mb-4 leading-relaxed"
                sx={{ textAlign: isRtl ? 'right' : 'left' }}
              >
                {isRtl
                  ? 'واٹس ایپ پر مائی اوربٹ بوٹ سے موصول ہونے والے ریمائنڈر پیغام کا نظارہ کرنے کے لیے اوپر دیے گئے سوئچ کو آن کریں۔'
                  : 'Toggle the switch above to preview what a premium WhatsApp push reminder looks like on your phone!'}
              </Typography>

              <AnimatePresence>
                {whatsappEnabled ? (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    {/* Simulated Mobile WhatsApp Message */}
                    <Box
                      className="p-3 border rounded-xl"
                      sx={{
                        bgcolor: isDark ? '#0b141a' : '#efeae2',
                        borderColor: isDark ? '#222d34' : '#e1e1e1',
                      }}
                      style={{ direction: isRtl ? 'rtl' : 'ltr' }}
                    >
                      {/* WhatsApp Header Mockup */}
                      <div className={`flex items-center gap-2 mb-2 ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}>
                        <Avatar sx={{ bgcolor: '#128c7e', width: 24, height: 24, fontSize: 10 }}>OB</Avatar>
                        <div className={`leading-tight ${isRtl ? 'text-right' : 'text-left'}`}>
                          <Typography variant="caption" fontWeight="bold" className="text-slate-800 dark:text-slate-200 block leading-none">
                            {isRtl ? 'مائی اوربٹ بوٹ' : 'MyOrbit Bot'}
                          </Typography>
                          <Typography variant="caption" className="text-slate-400 text-[9px] block">
                            {isRtl ? 'آن لائن' : 'Active'}
                          </Typography>
                        </div>
                      </div>

                      {/* WhatsApp Speech Bubble */}
                      <Box
                        className={`p-2.5 rounded-lg rounded-tl-none max-w-[90%] shadow-sm relative ${isRtl ? 'mr-0 ml-auto rounded-tr-none rounded-tl-lg' : 'ml-0 mr-auto'}`}
                        sx={{
                          bgcolor: isDark ? '#005c4b' : '#d9fdd3',
                          color: isDark ? '#e9edef' : '#111b21',
                        }}
                      >
                        <Typography variant="body2" className="text-[12px] leading-relaxed"
                          sx={{ textAlign: isRtl ? 'right' : 'left' }}
                        >
                          {isRtl ? (
                            <span>
                              🔔 <strong>مائی ٹاسک ریمائنڈر!</strong><br />
                              السلام علیکم کاشف! آپ کو مطلع کیا جاتا ہے کہ آپ کا ٹاسک <strong>&quot;گائیڈ کمپوننٹ بنانا&quot;</strong> کل مکمل ہونا ہے۔ وقت پر مکمل کر کے اپنی کارکردگی برقرار رکھیں! 🚀
                            </span>
                          ) : (
                            <span>
                              🔔 <strong>MyTask Reminder!</strong><br />
                              Hi Kashif! Just a heads up that your task <strong>&quot;Build Guide Component&quot;</strong> is due tomorrow. Get it done to keep your momentum going! 🚀
                            </span>
                          )}
                        </Typography>
                        <Typography variant="caption" className="text-[8px] text-slate-400 text-right block mt-1">
                          9:00 AM ✓✓
                        </Typography>
                      </Box>
                    </Box>
                  </motion.div>
                ) : (
                  <Box className="h-12 border border-dashed rounded-xl flex items-center justify-center text-slate-400 dark:text-slate-600 text-xs">
                    {isRtl ? 'واٹس ایپ پری ویو بند ہے' : 'WhatsApp preview is disabled'}
                  </Box>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>

          {/* Mockup 4: Bottom Navigation Highlight */}
          <Card
            elevation={4}
            className="border"
            sx={{
              borderColor: isDark ? 'rgba(51, 65, 85, 0.6)' : 'rgba(226, 232, 240, 0.9)',
              bgcolor: isDark ? '#1e293b' : '#ffffff',
              borderRadius: '16px',
            }}
          >
            <CardContent className="p-4" style={{ direction: isRtl ? 'rtl' : 'ltr' }}>
              <Typography variant="body2" fontWeight="bold" className="text-slate-500 dark:text-slate-400 mb-3"
                sx={{ textAlign: isRtl ? 'right' : 'left' }}
              >
                {isRtl ? 'نیچے موجود نیویگیشن بار میں یہاں سے رسائی حاصل کریں:' : 'Find it in bottom navigation bar:'}
              </Typography>

              {/* Replica Bottom Nav Bar */}
              <Box
                className={`rounded-xl border flex items-center justify-around p-1 shadow-inner relative overflow-hidden ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}
                sx={{
                  bgcolor: isDark ? '#0f172a' : '#f8fafc',
                  borderColor: isDark ? '#334155' : '#e2e8f0',
                }}
              >
                {/* Home tab */}
                <div className="flex flex-col items-center p-2 opacity-40 cursor-not-allowed">
                  <HomeIcon sx={{ fontSize: 20 }} />
                  <span className="text-[9px] mt-0.5">{isRtl ? 'ہوم' : 'Home'}</span>
                </div>

                {/* To-Do tab (Active & highlighted) */}
                <div className="flex flex-col items-center p-2 text-blue-500 cursor-pointer relative z-10">
                  {/* Glowing background behind active icon */}
                  <span className="absolute inset-0 rounded-lg bg-blue-500/10 scale-125 animate-ping opacity-60 pointer-events-none" />
                  <span className="absolute inset-0 rounded-lg bg-blue-500/5 scale-150 pointer-events-none" />
                  <ChecklistIcon sx={{ fontSize: 22 }} />
                  <span className="text-[10px] font-bold mt-0.5">{isRtl ? 'ٹاسک' : 'To-Do'}</span>
                </div>

                {/* Projects tab */}
                <div className="flex flex-col items-center p-2 opacity-40 cursor-not-allowed">
                  <AssignmentIcon sx={{ fontSize: 20 }} />
                  <span className="text-[9px] mt-0.5">{isRtl ? 'پراجیکٹس' : 'Projects'}</span>
                </div>

                {/* Finance tab */}
                <div className="flex flex-col items-center p-2 opacity-40 cursor-not-allowed">
                  <PriceCheckIcon sx={{ fontSize: 20 }} />
                  <span className="text-[9px] mt-0.5">{isRtl ? 'مالیات' : 'Finance'}</span>
                </div>

                {/* More tab */}
                <div className="flex flex-col items-center p-2 opacity-40 cursor-not-allowed">
                  <MoreHorizIcon sx={{ fontSize: 20 }} />
                  <span className="text-[9px] mt-0.5">{isRtl ? 'مزید' : 'More'}</span>
                </div>
              </Box>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}
