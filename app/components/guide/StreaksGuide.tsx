'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Stack,
  Chip,
  Button,
  TextField,
  Tooltip,
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

import { useCustomTheme } from '@/app/lib/context/themeContext';

export default function StreaksGuide({ language = 'en' }: { language?: 'en' | 'ur' }) {
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';
  const isRtl = language === 'ur';

  // State for Mockup 1: Interactive Streak log
  const [streakCount, setStreakCount] = useState(24);
  const [doneToday, setDoneToday] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [logs, setLogs] = useState([
    { date: 'Jun 14', progress: 'Surah Baqarah, ayat 15' },
    { date: 'Jun 15', progress: 'Surah Al-Imran, ayat 100' },
  ]);

  const handleOpenDialog = () => {
    setDialogOpen(true);
  };

  const handleSaveProgress = () => {
    const text = progressText.trim() || (isRtl ? 'مکمل کیا گیا' : 'Completed');
    setLogs((prev) => [...prev, { date: 'Today', progress: text }]);
    setStreakCount((prev) => prev + 1);
    setDoneToday(true);
    setDialogOpen(false);
    setProgressText('');
  };

  // Mockup 2: Timeline items
  const timelineDays = [
    { labelEn: 'June 10', labelUr: '10 جون', isDone: true, isMissed: false, short: '10 Jun' },
    { labelEn: 'June 11', labelUr: '11 جون', isDone: true, isMissed: false, short: '11 Jun' },
    { labelEn: 'June 12', labelUr: '12 جون', isDone: false, isMissed: true, short: '12 Jun' },
    { labelEn: 'June 13', labelUr: '13 جون', isDone: true, isMissed: false, short: '13 Jun' },
    { labelEn: 'June 14', labelUr: '14 جون', isDone: true, isMissed: false, short: '14 Jun' },
    { labelEn: 'June 15', labelUr: '15 جون', isDone: false, isMissed: false, short: '15 Jun' },
    { labelEn: 'Today', labelUr: 'آج', isDone: doneToday, isMissed: false, short: 'Today' },
  ];

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
              {isRtl ? 'مائی اوربٹ سٹريکس کیا ہیں؟' : 'What are MyOrbit Streaks?'}
            </Typography>
            <Typography variant="body2" className="text-slate-600 dark:text-slate-300 leading-relaxed"
              sx={{ lineHeight: isRtl ? 1.8 : 1.6 }}
            >
              {isRtl
                ? 'سٹريکس آپ کے معمولات اور عادات کو مستقل مزاجی سے ٹریک کرنے کا ایک انتہائی آسان اور دلچسپ طریقہ ہیں۔ یہ صرف ہدف کو پورا کرنے تک محدود نہیں، بلکہ روزمرہ کی پیشرفت کو محفوظ کرنے کا بھی ایک بہترین نظام ہے۔'
                : 'Streaks are a simple and visual way to track routines and habits. It is not just about ticking off a box; Streaks allow you to save your progression notes for any routine, ensuring consistency.'}
            </Typography>
          </div>
        </Stack>
      </Box>

      {/* Grid of Guide Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Side: Explanations */}
        <div className="lg:col-span-7 space-y-12">
          
          {/* Section 1: Flexible Frequencies */}
          <section className="space-y-3">
            <div className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}>
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-sm">
                ۱
              </span>
              <Typography variant="h6" fontWeight="bold" className="text-slate-800 dark:text-slate-100">
                {isRtl ? 'عادات اور معمولات کی ٹریکنگ' : 'Tracking Frequencies'}
              </Typography>
            </div>
            <Typography variant="body1" className="text-slate-600 dark:text-slate-300 leading-relaxed"
              sx={{ lineHeight: isRtl ? 1.8 : 1.6, textAlign: isRtl ? 'right' : 'left' }}
            >
              {isRtl
                ? 'کوئی بھی عادت روزانہ، ہفتہ وار، یا ماہانہ بنیادوں پر ہو سکتی ہے۔ مائی اوربٹ آپ کو ان تمام فریکوئنسیوں پر عادات بنانے کی سہولت دیتا ہے۔ آپ کسی بھی کام کے مسلسل ریکارڈ کے لیے سٹريک بنا سکتے ہیں۔'
                : 'Whether your habit is daily, weekly, or monthly, MyOrbit Streaks handles it. You can define any routine that requires building long-term momentum.'}
            </Typography>
          </section>

          {/* Section 2: Progress notes */}
          <section className="space-y-3">
            <div className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}>
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-sm">
                ۲
              </span>
              <Typography variant="h6" fontWeight="bold" className="text-slate-800 dark:text-slate-100">
                {isRtl ? 'پیشرفت اور نوٹس کو محفوظ کرنا' : 'Saving Progress Checkpoints'}
              </Typography>
            </div>
            <Typography variant="body1" className="text-slate-600 dark:text-slate-300 leading-relaxed"
              sx={{ lineHeight: isRtl ? 1.8 : 1.6, textAlign: isRtl ? 'right' : 'left' }}
            >
              {isRtl ? (
                <span>
                  سٹريک کو صرف &quot;مکمل&quot; مارک کرنے کے بجائے آپ اس میں اپنی پیشرفت لکھ سکتے ہیں:
                  <br />
                  • <strong>تلاوتِ قرآنِ پاک</strong>: آپ قرآن پاک کی روزانہ تلاوت مکمل کرتے وقت لکھ سکتے ہیں کہ آپ کس جگہ پہنچے (مثلاً: <em>سورہ توبہ، آیت نمبر 30 مکمل</em>)۔ یہ کل آپ کو وہیں سے آگے شروع کرنے میں مدد دے گا۔
                  <br />
                  • <strong>بال کٹوانا (Hair cutting)</strong>: آپ ان تاریخوں کو نشان زد کر سکتے ہیں جن پر آپ نے بال کٹوائے، تاکہ آپ کو پچھلا ریکارڈ یاد رہے۔
                </span>
              ) : (
                <span>
                  MyOrbit Streaks lets you save text-based checkpoints when checking off an action:
                  <br />
                  • <strong>Quran Recitation</strong>: When marking daily recitation done, you can log exactly where you stopped (e.g., <em>&quot;Surah Tauba, ayat 30 completed&quot;</em>). Tomorrow, you will see this note to resume from the exact spot!
                  <br />
                  • <strong>Hair Cutting</strong>: Simply log the dates you got a haircut, preserving a history of your visits.
                </span>
              )}
            </Typography>
          </section>

          {/* Section 3: History & Absences */}
          <section className="space-y-3">
            <div className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}>
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-sm">
                ۳
              </span>
              <Typography variant="h6" fontWeight="bold" className="text-slate-800 dark:text-slate-100">
                {isRtl ? 'تاریخ اور غیر حاضری (Absences)' : 'Absence & History Grid'}
              </Typography>
            </div>
            <Typography variant="body1" className="text-slate-600 dark:text-slate-300 leading-relaxed"
              sx={{ lineHeight: isRtl ? 1.8 : 1.6, textAlign: isRtl ? 'right' : 'left' }}
            >
              {isRtl
                ? 'اپنے ریکارڈ کی تاریخ دیکھنے کے لیے سٹريک پر موجود گھڑی کے نشان (History) پر کلک کریں۔ یہ آپ کو پچھلے دنوں کا پورا گرڈ دکھائے گا۔ گرڈ میں سبز رنگ حاضری (Done) اور سرخ رنگ غیر حاضری (Absence/Missed) کو ظاہر کرتا ہے، جس سے آپ کو اپنی مستقل مزاجی کا فوری علم ہو جاتا ہے۔'
                : 'To view historical logs, click the Clock icon (History) on any streak card. This expands a grid of past dates. Green blocks indicate checked-off days, while red blocks clearly highlight absences (missed targets) so you can review your patterns.'}
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

          {/* Mockup 1: Interactive Streak Card */}
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
              <Box display="flex" justify-content="space-between" alignItems="flex-start" mb={1}
                sx={{ flexDirection: isRtl ? 'row-reverse' : 'row' }}
              >
                <Box>
                  <Typography variant="h6" fontWeight="bold" className="text-slate-850 dark:text-white"
                    sx={{ fontSize: isRtl ? '1.1rem' : '1.2rem' }}
                  >
                    {isRtl ? 'تلاوتِ قرآنِ پاک' : 'Quran Recitation'}
                  </Typography>
                  <Typography variant="caption" className="text-slate-400">
                    {isRtl ? 'روزانہ کی عادت' : 'DAILY HABIT'}
                  </Typography>
                </Box>
                <Typography variant="h6" sx={{ color: isDark ? '#4ade80' : 'green', fontWeight: 700 }}>
                  {streakCount}🔥
                </Typography>
              </Box>

              {/* Attendance Grid Preview */}
              <Box 
                className="my-4 flex gap-1 overflow-x-auto no-scrollbar py-1"
                sx={{ justifyContent: isRtl ? 'flex-end' : 'flex-start' }}
              >
                {timelineDays.map((d, i) => (
                  <Tooltip key={i} title={isRtl ? d.labelUr : d.labelEn}>
                    <Box
                      sx={{
                        width: 38,
                        minWidth: 38,
                        height: 44,
                        borderRadius: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: d.isDone
                          ? (isDark ? 'rgba(16, 185, 129, 0.15)' : '#d1fae5')
                          : d.isMissed
                          ? (isDark ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2')
                          : (isDark ? 'rgba(255, 255, 255, 0.05)' : '#f3f4f6'),
                        border: d.short === 'Today' ? '1.5px solid #3b82f6' : 'none',
                      }}
                    >
                      <Typography variant="caption" sx={{ fontSize: 9, fontWeight: 700, color: d.isDone ? '#10b981' : d.isMissed ? '#ef4444' : '#94a3b8' }}>
                        {d.isDone ? '✓' : d.isMissed ? '!' : ''}
                      </Typography>
                      <Typography variant="caption" sx={{ fontSize: 8, color: 'text.secondary' }}>
                        {d.short === 'Today' ? (isRtl ? 'آج' : 'Today') : d.short.split(' ')[0]}
                      </Typography>
                    </Box>
                  </Tooltip>
                ))}
              </Box>

              {/* Progress History Logs */}
              <Box mb={3} className="text-xs">
                <Typography variant="caption" className="text-slate-400 block font-bold" sx={{ textAlign: isRtl ? 'right' : 'left' }}>
                  {isRtl ? 'حالیہ پیشرفت:' : 'Recent Progress logs:'}
                </Typography>
                <Stack direction="row" flexWrap="wrap" gap={0.5} mt={1} sx={{ justifyContent: isRtl ? 'flex-end' : 'flex-start' }}>
                  {logs.map((log, idx) => (
                    <Chip
                      key={idx}
                      label={`${log.date}: ${log.progress}`}
                      size="small"
                      sx={{ fontSize: '10px', height: 22 }}
                    />
                  ))}
                </Stack>
              </Box>

              {/* Done button & Remarks */}
              <Box className="space-y-2">
                <Button
                  variant="contained"
                  color="success"
                  fullWidth
                  disabled={doneToday}
                  onClick={handleOpenDialog}
                  sx={{ textTransform: 'none', fontWeight: 650, borderRadius: '10px' }}
                >
                  {doneToday ? (isRtl ? 'آج کا ہدف مکمل ہے ✅' : 'Done Today ✅') : (isRtl ? 'مکمل نشان زد کریں' : 'Mark as Done')}
                </Button>
              </Box>
            </CardContent>
          </Card>

          {/* Simulated Progress input Dialog */}
          <AnimatePresence>
            {dialogOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs"
              >
                <Card
                  sx={{
                    width: '100%',
                    maxWidth: 340,
                    borderRadius: '20px',
                    borderColor: isDark ? '#334155' : '#e2e8f0',
                    bgcolor: isDark ? '#1e293b' : '#ffffff',
                    boxShadow: 24,
                  }}
                >
                  <CardContent className="p-5" style={{ direction: isRtl ? 'rtl' : 'ltr' }}>
                    <Typography variant="h6" fontWeight="bold" className="text-slate-800 dark:text-slate-100 mb-2">
                      {isRtl ? 'پیشرفت درج کریں' : 'Log Today\'s Progress'}
                    </Typography>
                    
                    <TextField
                      fullWidth
                      multiline
                      minRows={2}
                      label={isRtl ? 'آج کی پیشرفت (اختیاری)' : 'Today\'s Progress (Optional)'}
                      placeholder={isRtl ? 'مثلاً: سورہ توبہ، آیت 30' : 'e.g. Surah Tauba, verse 30'}
                      value={progressText}
                      onChange={(e) => setProgressText(e.target.value)}
                      sx={{
                        mt: 1,
                        '& .MuiOutlinedInput-root': {
                          borderRadius: '12px',
                        }
                      }}
                    />
                    <Typography variant="caption" className="text-slate-450 block mt-2 leading-relaxed">
                      {isRtl 
                        ? 'آپ اپنی پیشرفت درج کر سکتے ہیں تاکہ کل وہیں سے جاری رکھ سکیں۔ اگر کچھ نہ لکھیں گے تو صرف مکمل نشان زد ہوگا۔'
                        : 'Write what you completed today (optional). This helps you continue from the exact point tomorrow.'}
                    </Typography>

                    <Box mt={3} display="flex" gap={1.5} justifyContent="flex-end">
                      <Button size="small" onClick={() => setDialogOpen(false)} sx={{ textTransform: 'none' }}>
                        {isRtl ? 'کینسل' : 'Cancel'}
                      </Button>
                      <Button
                        variant="contained"
                        size="small"
                        color="success"
                        onClick={handleSaveProgress}
                        sx={{ textTransform: 'none', borderRadius: '8px' }}
                      >
                        {isRtl ? 'محفوظ کریں' : 'Save & Log'}
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </div>
    </div>
  );
}
