'use client';

import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Stack,
  Chip,
  Button,
  Avatar,
  Checkbox,
  LinearProgress,
  Divider,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import TrackChangesIcon from '@mui/icons-material/TrackChanges';

import { useCustomTheme } from '@/app/lib/context/themeContext';

export default function GoalsGuide({ language = 'en' }: { language?: 'en' | 'ur' }) {
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';
  const isRtl = language === 'ur';

  // State for AI Parser Simulator
  const [inputText, setInputText] = useState('Save 50000 PKR in 3 months');
  const [parsedData, setParsedData] = useState({
    title: 'Save 50000 PKR in 3 months',
    targetValue: '50,000',
    targetUnit: 'PKR',
    dueDate: 'End of 3 Months',
    priority: 'High',
    category: 'Finance',
  });

  // Preset titles for AI simulator
  const presets = [
    {
      en: 'Save 50000 PKR in 3 months',
      ur: '3 ماہ میں 50000 روپے بچائیں',
      parsed: {
        title: 'Save 50000 PKR in 3 months',
        targetValue: '50,000',
        targetUnit: 'PKR',
        dueDate: '3 Months Later',
        priority: 'High',
        category: 'Finance',
      },
    },
    {
      en: 'Run 10 km in next 2 weeks',
      ur: 'اگلے 2 ہفتوں میں 10 کلومیٹر دوڑیں',
      parsed: {
        title: 'Run 10 km in next 2 weeks',
        targetValue: '10',
        targetUnit: 'km',
        dueDate: '2 Weeks Later',
        priority: 'Medium',
        category: 'Health',
      },
    },
    {
      en: 'Study React 40 hours',
      ur: '40 گھنٹے ری ایکٹ پڑھیں',
      parsed: {
        title: 'Study React 40 hours',
        targetValue: '40',
        targetUnit: 'hours',
        dueDate: 'End of month',
        priority: 'Medium',
        category: 'Learning',
      },
    },
  ];

  const handleSelectPreset = (idx: number) => {
    const p = presets[idx];
    setInputText(isRtl ? p.ur : p.en);
    setParsedData(p.parsed);
  };

  // State for Interactive Milestones mockup
  const [milestones, setMilestones] = useState([
    { id: 1, textEn: 'Research & project setup', textUr: 'ریسرچ اور پراجیکٹ کا آغاز', completed: true },
    { id: 2, textEn: 'Design layout wireframes', textUr: 'لے آؤٹ اور وائر فریم بنانا', completed: false },
    { id: 3, textEn: 'Develop frontend views', textUr: 'فرنٹ اینڈ ڈیزائن مکمل کرنا', completed: false },
  ]);

  const toggleMilestone = (id: number) => {
    setMilestones((prev) =>
      prev.map((m) => (m.id === id ? { ...m, completed: !m.completed } : m))
    );
  };

  const completedCount = milestones.filter((m) => m.completed).length;
  const progressPercent = Math.round((completedCount / milestones.length) * 100);

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
              {isRtl ? 'مائی اوربٹ گولز (اہداف) کیا ہیں؟' : 'What are MyOrbit Goals?'}
            </Typography>
            <Typography variant="body2" className="text-slate-600 dark:text-slate-300 leading-relaxed"
              sx={{ lineHeight: isRtl ? 1.8 : 1.6 }}
            >
              {isRtl
                ? 'اہداف بنیادی طور پر چھوٹے چھوٹے کاموں اور شیڈول کا مجموعہ ہیں جن سے وقت کے ساتھ بڑی کامیابیاں حاصل کی جاتی ہیں۔ ہم گولز اس لیے بناتے ہیں تاکہ معلوم ہو سکے کہ ہم روزمرہ کے کام اور شیڈول کس مقصد کے لیے کر رہے ہیں۔'
                : 'Goals are the composite structure of your daily tasks and schedules designed to achieve something major over time. They give purpose to your daily actions—defining the "why" behind your tasks and routines.'}
            </Typography>
          </div>
        </Stack>
      </Box>

      {/* Grid of Guide Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Side: Explanations */}
        <div className="lg:col-span-7 space-y-12">
          
          {/* Section 1: Dashboard and Access */}
          <section className="space-y-3">
            <div className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}>
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-sm">
                ۱
              </span>
              <Typography variant="h6" fontWeight="bold" className="text-slate-800 dark:text-slate-100">
                {isRtl ? 'اہداف کے سیکشن تک رسائی' : 'Accessing Goals'}
              </Typography>
            </div>
            <Typography variant="body1" className="text-slate-600 dark:text-slate-300 leading-relaxed"
              sx={{ lineHeight: isRtl ? 1.8 : 1.6, textAlign: isRtl ? 'right' : 'left' }}
            >
              {isRtl
                ? 'آپ سائیڈ نیویگیشن بار یا پاپ اوور کے ذریعے /goals پر جا کر اپنے اہداف دیکھ سکتے ہیں۔ اس کے علاوہ، ہوم پیج ڈیش بورڈ پر بھی ایک خصوصی وجیٹ موجود ہے جو آپ کے زیادہ سے زیادہ 4 اہم اہداف دکھاتا ہے اور وہیں سے نیا ہدف بنانے کا بٹن بھی فراہم کرتا ہے۔'
                : 'You can access your goals list by navigating to /goals. Additionally, a dedicated Goals widget is displayed on your Homepage Dashboard. It previews up to 4 high-priority goals and provides a quick action button to draft new goals.'}
            </Typography>
          </section>

          {/* Section 2: AI Evaluation & NLP Parser */}
          <section className="space-y-3">
            <div className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}>
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-sm">
                ۲
              </span>
              <Typography variant="h6" fontWeight="bold" className="text-slate-800 dark:text-slate-100">
                {isRtl ? 'مصنوعی ذہانت (AI) کا خودکار جائزہ' : 'AI-Powered Auto Parsing'}
              </Typography>
            </div>
            <Typography variant="body1" className="text-slate-600 dark:text-slate-300 leading-relaxed"
              sx={{ lineHeight: isRtl ? 1.8 : 1.6, textAlign: isRtl ? 'right' : 'left' }}
            >
              {isRtl
                ? 'نیا ہدف بناتے وقت صرف ٹائٹل (Title) لکھنا لازمی ہے۔ اگر آپ مزید کچھ نہیں لکھیں گے، تو ہماری اندرونی آرٹیفیشل انٹیلیجنس (AI) آپ کے لکھے گئے عنوان کا خود بخود تجزیہ کرے گی اور موزوں آخری تاریخ، ہدف کی مقدار، یونٹ، کیٹیگری اور ترجیحی درجہ خود ہی تجویز کر کے فارم پر بھر دے گی!'
                : 'Only a Title is mandatory to draft a goal. If you enter just a title, our internal NLP (Natural Language Processing) AI parses your text and automatically suggests/fills other parameters—like due date, target value, target unit, category, and priority levels!'}
            </Typography>
          </section>

          {/* Section 3: Milestones vs Trackers */}
          <section className="space-y-3">
            <div className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}>
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-sm">
                ۳
              </span>
              <Typography variant="h6" fontWeight="bold" className="text-slate-800 dark:text-slate-100">
                {isRtl ? 'سنگِ میل (Milestones) بمقابلہ ٹریکرز' : 'Milestones vs. Trackers'}
              </Typography>
            </div>
            <Typography variant="body1" className="text-slate-600 dark:text-slate-300 leading-relaxed"
              sx={{ lineHeight: isRtl ? 1.8 : 1.6, textAlign: isRtl ? 'right' : 'left' }}
            >
              {isRtl
                ? 'اپنے اہداف کو منظم انداز میں حاصل کرنے کے لیے مائی اوربٹ دو طریقے پیش کرتا ہے:'
                : 'To measure and achieve your goals effectively, you can track them in two formats:'}
            </Typography>
            <ul className={`list-disc pl-6 pr-6 space-y-1.5 text-slate-600 dark:text-slate-300 ${isRtl ? 'text-right' : 'text-left'}`}
              style={{ direction: isRtl ? 'rtl' : 'ltr' }}
            >
              <li>
                {isRtl
                  ? <span><strong>سنگِ میل (Milestones)</strong>: اپنے ہدف کو چھوٹے حصوں میں تقسیم کریں۔ جب بھی آپ کوئی سنگ میل مکمل نشان زد کریں گے، ہدف کی ترقی خود بخود حساب ہو کر بڑھ جائے گی۔</span>
                  : <span><strong>Milestones</strong>: Break down the goal into progressive steps.Ticking a milestone complete automatically increments and recalculates the overall goal progress.</span>}
              </li>
              <li>
                {isRtl
                  ? <span><strong>ٹریکرز (Trackers)</strong>: کسی مخصوص پیمائش کو باقاعدہ فریکوئنسی (جیسے روزانہ، ہفتہ وار، یا ماہانہ) پر ناپیں (مثال کے طور پر: وزن یا بچت کے اعداد و شمار)۔</span>
                  : <span><strong>Metric Trackers</strong>: Track numeric metrics over regular intervals (daily, weekly, bi-weekly, or monthly). Excellent for step counters, savings targets, or weight management.</span>}
              </li>
            </ul>
          </section>

          {/* Section 4: Inspiration */}
          <section className="space-y-3">
            <div className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}>
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-sm">
                ۴
              </span>
              <Typography variant="h6" fontWeight="bold" className="text-slate-800 dark:text-slate-100">
                {isRtl ? 'مستقل مزاجی اور حوصلہ افزائی' : 'Motivation & Consistency'}
              </Typography>
            </div>
            <Typography variant="body1" className="text-slate-600 dark:text-slate-300 leading-relaxed"
              sx={{ lineHeight: isRtl ? 1.8 : 1.6, textAlign: isRtl ? 'right' : 'left' }}
            >
              {isRtl
                ? 'اہداف مسلسل حوصلہ افزائی کا بہترین ذریعہ ہیں۔ روزانہ یا ہفتہ وار بنیادوں پر چھوٹے چھوٹے کاموں کو سرانجام دے کر آپ طویل مدتی اور بڑی فتوحات حاصل کر سکتے ہیں۔'
                : 'Goals are the ultimate fuel for motivation. By accomplishing small tasks on a daily or weekly basis, you compound efforts to unlock major achievements.'}
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

          {/* Mockup 1: AI Parser Simulator */}
          <Card
            elevation={4}
            className="border"
            sx={{
              borderColor: isDark ? 'rgba(51, 65, 85, 0.6)' : 'rgba(226, 232, 240, 0.9)',
              bgcolor: isDark ? '#1e293b' : '#ffffff',
              borderRadius: '16px',
            }}
          >
            <CardContent className="p-5" style={{ direction: isRtl ? 'rtl' : 'ltr' }}>
              <Box display="flex" justify-content="space-between" alignItems="center" mb={2} sx={{ flexDirection: isRtl ? 'row-reverse' : 'row' }}>
                <div className="flex items-center gap-2">
                  <Avatar sx={{ bgcolor: 'rgba(99, 102, 241, 0.15)', color: '#6366f1', width: 36, height: 36 }}>
                    <AutoAwesomeIcon sx={{ fontSize: 18 }} />
                  </Avatar>
                  <div className={isRtl ? 'text-right' : 'text-left'}>
                    <Typography variant="body1" fontWeight="bold" className="text-slate-800 dark:text-slate-100 leading-none">
                      {isRtl ? 'آرٹیفیشل انٹیلیجنس پارسر' : 'AI Parser Simulator'}
                    </Typography>
                    <Typography variant="caption" className="text-slate-400">
                      {isRtl ? 'خودکار فارم بھرنے کی سہولت' : 'Natural Language Parsing'}
                    </Typography>
                  </div>
                </div>
              </Box>

              <Typography variant="body2" className="text-slate-500 dark:text-slate-400 mb-3"
                sx={{ textAlign: isRtl ? 'right' : 'left' }}
              >
                {isRtl
                  ? 'نیچے دیے گئے کسی ایک عنوان پر کلک کریں اور دیکھیں کہ AI فارم کے خانوں کو کیسے خودکار طریقے سے سمجھتا ہے:'
                  : 'Click on a preset title below to see how our NLP AI automatically populates other fields:'}
              </Typography>

              {/* Presets Grid */}
              <div className="flex flex-wrap gap-1.5 mb-4 justify-center">
                {presets.map((preset, idx) => (
                  <Button
                    key={idx}
                    variant="outlined"
                    size="small"
                    onClick={() => handleSelectPreset(idx)}
                    sx={{
                      fontSize: '0.68rem',
                      textTransform: 'none',
                      borderColor: 'rgba(99, 102, 241, 0.4)',
                      color: '#6366f1',
                      borderRadius: '8px',
                      fontWeight: 600,
                    }}
                  >
                    {isRtl ? preset.ur.slice(0, 25) + '...' : preset.en.slice(0, 22) + '...'}
                  </Button>
                ))}
              </div>

              {/* Simulator Form Display */}
              <Box
                className="p-3 border rounded-xl space-y-2.5 relative overflow-hidden"
                sx={{
                  bgcolor: isDark ? '#0f172a' : '#f8fafc',
                  borderColor: isDark ? '#334155' : '#e2e8f0',
                }}
              >
                <div className="absolute top-2 right-2 flex gap-1 z-10">
                  <Chip
                    icon={<AutoAwesomeIcon style={{ fontSize: 10, color: '#fff' }} />}
                    label={isRtl ? 'اے آئی پارسڈ' : 'AI Parsed'}
                    size="small"
                    color="primary"
                    sx={{ fontSize: '9px', height: 18, '& .MuiChip-icon': { color: '#fff !important' } }}
                  />
                </div>

                <div>
                  <Typography variant="caption" className="text-slate-400 block font-bold">
                    {isRtl ? 'اہداف کا عنوان:' : 'Goal Title:'}
                  </Typography>
                  <Typography variant="body2" fontWeight="bold" className="text-slate-800 dark:text-slate-100 pr-12">
                    {inputText}
                  </Typography>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <Typography variant="caption" className="text-slate-400 block font-bold leading-none">
                      {isRtl ? 'ہدف کی مقدار:' : 'Target Value:'}
                    </Typography>
                    <Typography variant="body2" fontWeight="bold" className="text-blue-500">
                      {parsedData.targetValue} {parsedData.targetUnit}
                    </Typography>
                  </div>
                  <div>
                    <Typography variant="caption" className="text-slate-400 block font-bold leading-none">
                      {isRtl ? 'آخری تاریخ:' : 'Due Date Preset:'}
                    </Typography>
                    <Typography variant="body2" fontWeight="bold" className="text-slate-800 dark:text-slate-200">
                      {parsedData.dueDate}
                    </Typography>
                  </div>
                  <div>
                    <Typography variant="caption" className="text-slate-400 block font-bold leading-none">
                      {isRtl ? 'ترجیح:' : 'Priority:'}
                    </Typography>
                    <Typography variant="body2" fontWeight="bold" sx={{ color: parsedData.priority === 'High' ? '#ef4444' : '#f59e0b' }}>
                      {parsedData.priority}
                    </Typography>
                  </div>
                  <div>
                    <Typography variant="caption" className="text-slate-400 block font-bold leading-none">
                      {isRtl ? 'کیٹیگری:' : 'Suggested Category:'}
                    </Typography>
                    <Typography variant="body2" fontWeight="bold" className="text-purple-500">
                      {parsedData.category}
                    </Typography>
                  </div>
                </div>
              </Box>
            </CardContent>
          </Card>

          {/* Mockup 2: Interactive Milestones progress */}
          <Card
            elevation={4}
            className="border"
            sx={{
              borderColor: isDark ? 'rgba(51, 65, 85, 0.6)' : 'rgba(226, 232, 240, 0.9)',
              bgcolor: isDark ? '#1e293b' : '#ffffff',
              borderRadius: '16px',
            }}
          >
            <CardContent className="p-5" style={{ direction: isRtl ? 'rtl' : 'ltr' }}>
              <Box display="flex" justify-content="space-between" alignItems="flex-start" mb={2} sx={{ flexDirection: isRtl ? 'row-reverse' : 'row' }}>
                <Box>
                  <Typography variant="h6" fontWeight="bold" className="text-slate-850 dark:text-white"
                    sx={{ fontSize: isRtl ? '1.05rem' : '1.25rem' }}
                  >
                    {isRtl ? 'پروفیشنل پورٹ فولیو بنانا' : 'Build Professional Portfolio'}
                  </Typography>
                  <Typography variant="caption" className="text-slate-400">
                    {isRtl ? 'ٹارگٹ: اکتوبر 2026' : 'Target: Oct 2026'}
                  </Typography>
                </Box>
                <Chip
                  icon={<TrackChangesIcon sx={{ fontSize: '12px !important', color: 'white' }} />}
                  label={progressPercent === 100 ? (isRtl ? 'مکمل' : 'Completed') : (isRtl ? 'جاری ہے' : 'In Progress')}
                  size="small"
                  sx={{
                    bgcolor: progressPercent === 100 ? '#10b981' : '#3b82f6',
                    color: 'white',
                    fontWeight: 600,
                    flexDirection: isRtl ? 'row-reverse' : 'row',
                    '& .MuiChip-icon': { color: 'white !important', mx: 0.5 }
                  }}
                />
              </Box>

              <Divider className="my-3" />
              
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1} mt={1}
                sx={{ flexDirection: isRtl ? 'row-reverse' : 'row' }}
              >
                <Typography variant="body2" fontWeight="bold" className="text-slate-500 dark:text-slate-400">
                  {isRtl ? 'سنگِ میل لسٹ:' : 'Goal Milestones:'}
                </Typography>
                <Typography variant="body2" fontWeight="bold" className="text-blue-500">
                  {progressPercent}% {isRtl ? 'کامیابی' : 'Progress'}
                </Typography>
              </Box>

              <LinearProgress
                variant="determinate"
                value={progressPercent}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  mb: 3,
                  backgroundColor: isDark ? '#334155' : '#f1f5f9',
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 4,
                    backgroundColor: progressPercent === 100 ? '#10b981' : '#3b82f6',
                  },
                }}
              />

              <div className="space-y-1.5">
                {milestones.map((m) => (
                  <Box
                    key={m.id}
                    className={`flex items-center gap-2 p-2 rounded-lg transition-colors duration-200 cursor-pointer ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}
                    sx={{
                      '&:hover': {
                        bgcolor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                      },
                    }}
                    onClick={() => toggleMilestone(m.id)}
                  >
                    <Checkbox
                      checked={m.completed}
                      size="small"
                      sx={{ p: 0.5, color: '#3b82f6' }}
                    />
                    <Typography
                      variant="body2"
                      className={`transition-all duration-200 ${
                        m.completed
                          ? 'line-through text-slate-400 dark:text-slate-500'
                          : 'text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {isRtl ? m.textUr : m.textEn}
                    </Typography>
                  </Box>
                ))}
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}
