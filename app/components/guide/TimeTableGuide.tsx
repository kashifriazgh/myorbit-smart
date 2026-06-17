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
  TextField,
  Divider,
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import AddIcon from '@mui/icons-material/Add';
import DirectionsBusIcon from '@mui/icons-material/DirectionsBus';
import MosqueIcon from '@mui/icons-material/Mosque';

import { useCustomTheme } from '@/app/lib/context/themeContext';

interface TimetableStep {
  titleEn: string;
  titleUr: string;
  startTime: string;
  endTime?: string;
}

export default function TimeTableGuide({ language = 'en' }: { language?: 'en' | 'ur' }) {
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';
  const isRtl = language === 'ur';

  // Preset Timetables for Mockup
  const masjidTimetable: TimetableStep[] = [
    { titleEn: 'Fajr', titleUr: 'فجر', startTime: '04:30 AM' },
    { titleEn: 'Dhuhr', titleUr: 'ظہر', startTime: '01:30 PM' },
    { titleEn: 'Asr', titleUr: 'عصر', startTime: '05:15 PM' },
    { titleEn: 'Maghrib', titleUr: 'مغرب', startTime: '07:15 PM' },
    { titleEn: 'Isha', titleUr: 'عشاء', startTime: '09:00 PM' },
  ];

  const transitTimetable: TimetableStep[] = [
    { titleEn: 'Morning Express Bus', titleUr: 'صبح کی ایکسپریس بس', startTime: '07:45 AM', endTime: '08:30 AM' },
    { titleEn: 'Mid-Day Shuttle', titleUr: 'دوپہر کی شٹل بس', startTime: '01:15 PM', endTime: '02:00 PM' },
    { titleEn: 'Evening Return Route', titleUr: 'شام کی واپسی کا روٹ', startTime: '05:30 PM', endTime: '06:15 PM' },
  ];

  const [activePreset, setActivePreset] = useState<'masjid' | 'transit'>('masjid');
  const [customSteps, setCustomSteps] = useState<TimetableStep[]>([]);
  
  // Step Adder Form State
  const [newTitle, setNewTitle] = useState('');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');

  const activeTimetableSteps = activePreset === 'masjid' 
    ? [...masjidTimetable, ...customSteps.filter((_, i) => i % 2 === 0)]
    : [...transitTimetable, ...customSteps.filter((_, i) => i % 2 !== 0)];

  const handleAddStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newStart.trim()) return;

    const newStep: TimetableStep = {
      titleEn: newTitle.trim(),
      titleUr: newTitle.trim(), // fallback
      startTime: newStart.trim(),
      endTime: newEnd.trim() || undefined,
    };

    setCustomSteps((prev) => [...prev, newStep]);
    setNewTitle('');
    setNewStart('');
    setNewEnd('');
  };

  const handleResetCustomSteps = () => {
    setCustomSteps([]);
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
              {isRtl ? 'ٹائم ٹیبل مانیٹر کیا ہے؟' : 'What is the Timetable Module?'}
            </Typography>
            <Typography variant="body2" className="text-slate-600 dark:text-slate-300 leading-relaxed"
              sx={{ lineHeight: isRtl ? 1.8 : 1.6 }}
            >
              {isRtl
                ? 'ٹائم ٹیبل مانیٹر آپ کو تفصیلی یا پیچیدہ شیڈولز کو محفوظ اور یاد رکھنے کی سہولت فراہم کرتا ہے جو روزمرہ کی زندگی میں بھولنا آسان ہوتے ہیں۔ یہ مستقل یا سست تبدیل ہونے والے معمولات کے حوالہ چارٹ کے طور پر کام کرتا ہے۔'
                : 'The Timetable module helps you log and reference structured schedules that are complex or hard to remember. It acts as a static guidebook or directory for recurrent routines in your daily layout.'}
            </Typography>
          </div>
        </Stack>
      </Box>

      {/* Grid of Guide Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Side: Explanations */}
        <div className="lg:col-span-7 space-y-12">
          
          {/* Section 1: Use Cases */}
          <section className="space-y-3">
            <div className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}>
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-sm">
                ۱
              </span>
              <Typography variant="h6" fontWeight="bold" className="text-slate-800 dark:text-slate-100">
                {isRtl ? 'اہم اور عملی استعمال کی مثالیں' : 'Practical Use Cases'}
              </Typography>
            </div>
            <Typography variant="body1" className="text-slate-600 dark:text-slate-300 leading-relaxed"
              sx={{ lineHeight: isRtl ? 1.8 : 1.6, textAlign: isRtl ? 'right' : 'left' }}
            >
              {isRtl ? (
                <span>
                  یہ ان معمولات کو یاد رکھنے کے لیے بہترین ہے جو طویل اور بار بار دہرائے جاتے ہیں:
                  <br />
                  • <strong>نماز کے اوقات</strong>: مختلف مساجد (مثلاً: محلے کی مسجد اور دفتر کے قریب کی مسجد) میں باجماعت نماز کا وقت الگ ہو سکتا ہے۔ آپ دونوں کے الگ الگ ٹائم ٹیبل بنا سکتے ہیں۔
                  <br />
                  • <strong>بس اور ٹرانسپورٹ روٹ</strong>: روزانہ یا ہفتہ وار بسوں، ٹرینوں یا شٹل سروسز کے روانہ ہونے کے پیچیدہ اوقات کو یاد رکھنا مشکل ہوتا ہے۔
                  <br />
                  • <strong>طلباء کے مطالعہ کا اوقات</strong>: اسکول، کالج یا ذاتی مطالعہ کے لیے روزانہ کے مضامین اور کلاسز کا ٹائم ٹیبل ترتیب دیں۔
                </span>
              ) : (
                <span>
                  Timetables are perfect for recurrent schedules that are difficult to commit to memory:
                  <br />
                  • <strong>Masjid Prayer Times</strong>: Prayer slots often vary. You can create separate timetables for different mosques (e.g. &quot;Workplace Masjid&quot; and &quot;Hometown Masjid&quot;).
                  <br />
                  • <strong>Transit & Bus Routines</strong>: Easily log local bus departure times, shuttle links, or office vans schedules.
                  <br />
                  • <strong>Study Schedules</strong>: Students can construct their class timetables, tuition hours, or self-study subject slots.
                </span>
              )}
            </Typography>
          </section>

          {/* Section 2: Structure of a Timetable */}
          <section className="space-y-3">
            <div className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}>
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-sm">
                ۲
              </span>
              <Typography variant="h6" fontWeight="bold" className="text-slate-800 dark:text-slate-100">
                {isRtl ? 'ٹائم ٹیبل کی بناوٹ اور مراحل (Steps)' : 'Anatomy of a Timetable'}
              </Typography>
            </div>
            <Typography variant="body1" className="text-slate-600 dark:text-slate-300 leading-relaxed"
              sx={{ lineHeight: isRtl ? 1.8 : 1.6, textAlign: isRtl ? 'right' : 'left' }}
            >
              {isRtl
                ? 'ہر ٹائم ٹیبل کا ایک بنیادی عنوان (Title) اور قسم (Type) ہوتی ہے۔ ٹائم ٹیبل بنانے کے بعد آپ اس کے اندر متعدد مراحل یا اوقات (Steps) شامل کرتے ہیں:'
                : 'Each timetable is structured with a Title, Description, and a specific Type. Within a timetable, you add multiple schedule Steps:'}
            </Typography>
            <ul className={`list-disc pl-6 pr-6 space-y-1.5 text-slate-600 dark:text-slate-300 ${isRtl ? 'text-right' : 'text-left'}`}
              style={{ direction: isRtl ? 'rtl' : 'ltr' }}
            >
              <li>
                {isRtl
                  ? <span><strong>عنوان (Step Title)</strong>: اس مخصوص مرحلے کا نام (مثلاً: <em>فجر</em> یا <em>آفس شٹل بس</em>)۔</span>
                  : <span><strong>Step Title</strong>: The name of the specific slot (e.g. <em>Fajr Prayer</em> or <em>Transit Bus A</em>).</span>}
              </li>
              <li>
                {isRtl
                  ? <span><strong>شروع کا وقت (Start Time)</strong>: جس وقت یہ عمل شروع ہوتا ہے۔</span>
                  : <span><strong>Start Time</strong>: The designated starting hour.</span>}
              </li>
              <li>
                {isRtl
                  ? <span><strong>آخری وقت (End Time)</strong>: اختیاری طور پر عمل کے ختم ہونے کا وقت بھی درج کریں۔</span>
                  : <span><strong>End Time (Optional)</strong>: The hour when the slot concludes.</span>}
              </li>
            </ul>
          </section>

          {/* Section 3: Navigation */}
          <section className="space-y-3">
            <div className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}>
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-sm">
                ۳
              </span>
              <Typography variant="h6" fontWeight="bold" className="text-slate-800 dark:text-slate-100">
                {isRtl ? 'رسائی کا طریقہ' : 'Where to Find Timetables'}
              </Typography>
            </div>
            <Typography variant="body1" className="text-slate-600 dark:text-slate-300 leading-relaxed"
              sx={{ lineHeight: isRtl ? 1.8 : 1.6, textAlign: isRtl ? 'right' : 'left' }}
            >
              {isRtl
                ? 'آپ مائی اوربٹ کے نیچے موجود نیویگیشن بار میں "More" (مزید) پر کلک کر کے مینو سے ٹائم ٹیبل (/time-table) کے سیکشن تک جا سکتے ہیں۔ وہاں آپ نئے ٹائم ٹیبل بنا بھی سکتے ہیں اور پرانوں کو ایڈٹ بھی کر سکتے ہیں۔'
                : 'You can access the module by clicking "More" on the bottom navigation bar and selecting "Time Table" from the popover menu. This routes you to /time-table.'}
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

          {/* Mockup 1: Timetable profile switcher */}
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
              <Typography variant="body2" fontWeight="bold" className="text-slate-500 dark:text-slate-400 mb-3"
                sx={{ textAlign: isRtl ? 'right' : 'left' }}
              >
                {isRtl ? 'ٹائم ٹیبل پروفائل منتخب کریں:' : 'Select Timetable Profile:'}
              </Typography>

              {/* Toggle tabs */}
              <Box className="flex gap-2 mb-4">
                <Button
                  size="small"
                  variant={activePreset === 'masjid' ? 'contained' : 'outlined'}
                  onClick={() => setActivePreset('masjid')}
                  startIcon={<MosqueIcon fontSize="small" />}
                  sx={{ textTransform: 'none', borderRadius: '8px', flex: 1 }}
                >
                  {isRtl ? 'مسجد کے اوقات' : 'Mosque'}
                </Button>
                <Button
                  size="small"
                  variant={activePreset === 'transit' ? 'contained' : 'outlined'}
                  onClick={() => setActivePreset('transit')}
                  startIcon={<DirectionsBusIcon fontSize="small" />}
                  sx={{ textTransform: 'none', borderRadius: '8px', flex: 1 }}
                >
                  {isRtl ? 'بس کا روٹ' : 'Transit'}
                </Button>
              </Box>

              {/* Render Selected Timetable */}
              <Box
                className="p-4 rounded-xl border space-y-2"
                sx={{
                  bgcolor: isDark ? '#0f172a' : '#f8fafc',
                  borderColor: isDark ? '#334155' : '#e2e8f0',
                }}
              >
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1} sx={{ flexDirection: isRtl ? 'row-reverse' : 'row' }}>
                  <Typography variant="subtitle2" fontWeight="extrabold">
                    {activePreset === 'masjid'
                      ? (isRtl ? 'جامع مسجد الفلاح (اوقاتِ نماز)' : 'Al-Falah Mosque (Prayer Times)')
                      : (isRtl ? 'دفتر شٹل روٹ (ایکسپریس)' : 'Office Shuttle (Express Bus)')}
                  </Typography>
                  <Chip
                    label={`${activeTimetableSteps.length} ${isRtl ? 'مراحل' : 'steps'}`}
                    size="small"
                    sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700 }}
                  />
                </Box>

                <Divider className="my-2" />

                <Stack spacing={1}>
                  {activeTimetableSteps.map((step, idx) => (
                    <Box
                      key={idx}
                      className="flex justify-between items-center p-2 rounded-lg"
                      sx={{
                        bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#ffffff',
                        border: '1px solid',
                        borderColor: isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9',
                        flexDirection: isRtl ? 'row-reverse' : 'row'
                      }}
                    >
                      <Typography variant="body2" fontWeight="700">
                        {isRtl ? step.titleUr : step.titleEn}
                      </Typography>
                      <Typography variant="caption" className="text-blue-500 font-bold">
                        {step.startTime} {step.endTime ? ` - ${step.endTime}` : ''}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </Box>
            </CardContent>
          </Card>

          {/* Mockup 2: Add Step Simulator */}
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
              <Typography variant="body2" fontWeight="bold" className="text-slate-500 dark:text-slate-400 mb-3"
                sx={{ textAlign: isRtl ? 'right' : 'left' }}
              >
                {isRtl ? 'نیا مرحلہ (Step) شامل کریں:' : 'Simulate Adding a Time Slot Step:'}
              </Typography>

              <form onSubmit={handleAddStep} className="space-y-3">
                <TextField
                  fullWidth
                  size="small"
                  label={isRtl ? 'عنوان (مثلاً: فجر یا بس روانگی)' : 'Step Title (e.g. Fajr or Bus Departure)'}
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
                />
                
                <div className="grid grid-cols-2 gap-2">
                  <TextField
                    size="small"
                    label={isRtl ? 'شروع وقت (مثلاً: 05:15)' : 'Start Time (e.g. 05:15)'}
                    value={newStart}
                    onChange={(e) => setNewStart(e.target.value)}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
                  />
                  <TextField
                    size="small"
                    label={isRtl ? 'آخری وقت (اختیاری)' : 'End Time (Optional)'}
                    value={newEnd}
                    onChange={(e) => setNewEnd(e.target.value)}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
                  />
                </div>

                <div className="flex gap-2 justify-end pt-1">
                  {customSteps.length > 0 && (
                    <Button
                      size="small"
                      variant="text"
                      color="inherit"
                      onClick={handleResetCustomSteps}
                      sx={{ textTransform: 'none', borderRadius: '6px' }}
                    >
                      {isRtl ? 'دوبارہ شروع کریں' : 'Reset Form'}
                    </Button>
                  )}
                  <Button
                    type="submit"
                    size="small"
                    variant="contained"
                    startIcon={<AddIcon />}
                    sx={{ textTransform: 'none', borderRadius: '8px', bgcolor: '#2563eb' }}
                  >
                    {isRtl ? 'مرحلہ شامل کریں' : 'Add Slot'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}
