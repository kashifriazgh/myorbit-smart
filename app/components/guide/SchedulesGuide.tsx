'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Stack,
  Chip,
  Button,
  Stepper,
  Step,
  StepLabel,
  Avatar,
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import SendIcon from '@mui/icons-material/Send';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';

import { useCustomTheme } from '@/app/lib/context/themeContext';

export default function SchedulesGuide({ language = 'en' }: { language?: 'en' | 'ur' }) {
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';
  const isRtl = language === 'ur';

  // State for simulated WhatsApp done reply
  const [whatsappStep, setWhatsappStep] = useState<number>(0); // 0: initial, 1: typed done, 2: bot replied

  const handleSimulateReply = () => {
    if (whatsappStep === 0) {
      setWhatsappStep(1);
      setTimeout(() => {
        setWhatsappStep(2);
      }, 1500);
    } else {
      setWhatsappStep(0);
    }
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
              {isRtl ? 'مائی اوربٹ شیڈولز کیا ہیں؟' : 'What are MyOrbit Schedules?'}
            </Typography>
            <Typography variant="body2" className="text-slate-600 dark:text-slate-300 leading-relaxed"
              sx={{ lineHeight: isRtl ? 1.8 : 1.6 }}
            >
              {isRtl
                ? 'اپنے دن کو زیادہ مرکوز بنانے کے لیے آپ شیڈول تشکیل دے سکتے ہیں۔ شیڈولز آپ کے دن کے مخصوص اوقات کو بلاک کرنے اور ترتیب دینے کا بہترین ذریعہ ہیں۔'
                : 'To make your day more focused, you can create schedules. Schedules represent timed events and tasks for specific slots during the day, acting as your personal timetable.'}
            </Typography>
          </div>
        </Stack>
      </Box>

      {/* Grid of Guide Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Side: Explanations */}
        <div className="lg:col-span-7 space-y-12">
          
          {/* Section 1: Diff between Tasks & Schedules */}
          <section className="space-y-3">
            <div className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}>
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-sm">
                ۱
              </span>
              <Typography variant="h6" fontWeight="bold" className="text-slate-800 dark:text-slate-100">
                {isRtl ? 'کاموں (Tasks) اور شیڈول (Schedules) میں فرق' : 'Tasks vs. Schedules'}
              </Typography>
            </div>
            <Typography variant="body1" className="text-slate-600 dark:text-slate-300 leading-relaxed"
              sx={{ lineHeight: isRtl ? 1.8 : 1.6, textAlign: isRtl ? 'right' : 'left' }}
            >
              {isRtl ? (
                <span>
                  اکثر یہ سوال اٹھتا ہے کہ کاموں (To-Dos) اور شیڈول میں کیا فرق ہے؟
                  <br />
                  • <strong>کاموں کی فہرست (To-Dos)</strong>: یہ چیک لسٹ کی طرح ہوتے ہیں۔ ان کا بنیادی مقصد یہ ٹریک کرنا ہوتا ہے کہ کام <em>کتنا مکمل</em> ہوا ہے (جیسے ذیلی مراحل مکمل کرنا)۔
                  <br />
                  • <strong>شیڈول (Schedules)</strong>: یہ وقت کی پابندی (Time-blocking) کے لیے ہیں۔ یہ دن کا ایک حصہ مخصوص کرتے ہیں (مثال کے طور پر: صبح 9:00 سے 10:00 بجے تک) تاکہ آپ کی توجہ نہ بھٹکے۔
                </span>
              ) : (
                <span>
                  What is the difference between a Task and a Schedule?
                  <br />
                  • <strong>To-Do Tasks</strong>: These are checklist-oriented. They focus on <em>completion progress</em> (like ticking off sub-steps) and don&apos;t necessarily require specific hours.
                  <br />
                  • <strong>Schedules</strong>: These are time-blocking oriented. They book a specific slot of your day (e.g., 9:00 AM - 10:00 AM) to ensure you focus on a single objective at that time.
                </span>
              )}
            </Typography>
          </section>

          {/* Section 2: Mandatory Fields */}
          <section className="space-y-3">
            <div className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}>
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-sm">
                ۲
              </span>
              <Typography variant="h6" fontWeight="bold" className="text-slate-800 dark:text-slate-100">
                {isRtl ? 'شیڈول بنانا: لازمی اور اختیاری فیلڈز' : 'Creating a Schedule'}
              </Typography>
            </div>
            <Typography variant="body1" className="text-slate-600 dark:text-slate-300 leading-relaxed"
              sx={{ lineHeight: isRtl ? 1.8 : 1.6, textAlign: isRtl ? 'right' : 'left' }}
            >
              {isRtl
                ? 'نیا شیڈول بناتے وقت عنوان (Title)، تاریخ (Date) اور شروع کا وقت (Start Time) فراہم کرنا لازمی ہے۔'
                : 'To create a schedule, a Title, Date, and Start Time are mandatory.'}
            </Typography>
            <ul className={`list-disc pl-6 pr-6 space-y-1.5 text-slate-600 dark:text-slate-300 ${isRtl ? 'text-right' : 'text-left'}`}
              style={{ direction: isRtl ? 'rtl' : 'ltr' }}
            >
              <li>
                {isRtl
                  ? <span><strong>آخری وقت (End Date/Time)</strong>: اختیاری طور پر آخری وقت سیٹ کریں تاکہ شیڈول کا کل دورانیہ واضح ہو سکے۔</span>
                  : <span><strong>End Date/Time</strong>: Optionally set an end date/time to depict the total duration of the slot.</span>}
              </li>
              <li>
                {isRtl
                  ? <span><strong>مقصد (Objective)</strong>: ایک واضح مقصد (Objective) سیٹ کریں کیونکہ واضح مقاصد توجہ اور نتائج کو بہتر بناتے ہیں۔</span>
                  : <span><strong>Objective</strong>: Define a clear target. Having a clear objective significantly improves daily focus.</span>}
              </li>
              <li>
                {isRtl
                  ? <span><strong>یاد دہانی (Reminders)</strong>: پریمیم ممبرز کے لیے واٹس ایپ اور پش نوٹیفیکیشنز دستیاب ہیں۔</span>
                  : <span><strong>Reminders</strong>: Premium users can configure automated WhatsApp or push alerts before the schedule starts.</span>}
              </li>
            </ul>
          </section>

          {/* Section 3: Flexible Daily Schedules */}
          <section className="space-y-3">
            <div className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}>
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-sm">
                ۳
              </span>
              <Typography variant="h6" fontWeight="bold" className="text-slate-800 dark:text-slate-100">
                {isRtl ? 'لچکدار شیڈول (بغیر تاریخ و وقت)' : 'Flexible Daily Schedules'}
              </Typography>
            </div>
            <Typography variant="body1" className="text-slate-600 dark:text-slate-300 leading-relaxed"
              sx={{ lineHeight: isRtl ? 1.8 : 1.6, textAlign: isRtl ? 'right' : 'left' }}
            >
              {isRtl
                ? 'اگر آپ چاہیں تو بغیر کسی مخصوص آخری تاریخ یا وقت کے بھی شیڈول بنا سکتے ہیں۔ یہ کام "لچکدار" (Flexible) تصور کیا جائے گا اور کسی ایک تاریخ کے بجائے ہر روز مستقل نظر آئے گا۔ یہ روزانہ کی عادتوں یا مسلسل کاموں کے لیے بہترین ہے۔'
                : 'You can also set a schedule with no specific due date or time. It will mark the event as Flexible, causing it to display daily on your scheduler rather than just on one single day.'}
            </Typography>
          </section>

          {/* Section 4: WhatsApp Done Reply Trigger */}
          <section className="space-y-3">
            <div className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}>
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold text-sm">
                ۴
              </span>
              <Typography variant="h6" fontWeight="bold" className="text-slate-800 dark:text-slate-100">
                {isRtl ? 'واٹس ایپ کے ذریعے کام مکمل کرنا' : 'Completing via WhatsApp Reply'}
              </Typography>
            </div>
            <Typography variant="body1" className="text-slate-600 dark:text-slate-300 leading-relaxed"
              sx={{ lineHeight: isRtl ? 1.8 : 1.6, textAlign: isRtl ? 'right' : 'left' }}
            >
              {isRtl
                ? 'شیڈولز کو براہ راست ایپ کے اندر سے "Done" (مکمل) مارک نہیں کیا جا سکتا کیونکہ وہ کیلنڈر پر مبنی ٹائم بلاک ہوتے ہیں۔'
                : 'Schedules are editable, but you cannot mark them as done directly within the app interface.'}
            </Typography>
            <Typography variant="body1" className="text-slate-600 dark:text-slate-300 leading-relaxed"
              sx={{ lineHeight: isRtl ? 1.8 : 1.6, textAlign: isRtl ? 'right' : 'left' }}
            >
              {isRtl
                ? 'تاہم، اگر آپ پریمیم صارف ہیں، تو مائی اوربٹ واٹس ایپ یاد دہانی کے پیغام پر جواب دینے کی سہولت فراہم کرتا ہے۔ جب آپ واٹس ایپ الرٹ پر صرف "done" لکھ کر جواب بھیجیں گے، تو مائی اوربٹ آپ کا شیڈول ایپ میں خود بخود مکمل نشان زد کر دے گا!'
                : 'However, you can easily mark a schedule as completed through the premium WhatsApp reminder. If you reply to the WhatsApp notification with the word "done", the system will automatically mark that schedule as completed in the app!'}
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

          {/* Mockup 1: Stepper Timeline */}
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
              <Typography variant="body2" fontWeight="bold" className="text-slate-500 dark:text-slate-400 mb-4"
                sx={{ textAlign: isRtl ? 'right' : 'left' }}
              >
                {isRtl ? 'ایپ کا ٹائم لائن فارمیٹ:' : 'App Timeline Format:'}
              </Typography>

              <Stepper
                orientation="vertical"
                sx={{
                  '& .MuiStepConnector-root': {
                    marginLeft: isRtl ? 'auto' : '11px',
                    marginRight: isRtl ? '11px' : 'auto',
                    '& .MuiStepConnector-line': {
                      borderLeftWidth: '2px',
                      borderLeftStyle: 'dashed',
                      borderLeftColor: isDark ? '#374151' : '#e5e7eb',
                      minHeight: '20px',
                    },
                  },
                }}
              >
                {/* Step 1: Specific Timed Schedule */}
                <Step active={true} completed={whatsappStep === 2}>
                  <StepLabel
                    StepIconComponent={() => (
                      <Box
                        sx={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          backgroundColor: whatsappStep === 2 ? '#22c55e' : '#2563eb',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          fontWeight: 'bold',
                        }}
                      >
                        {whatsappStep === 2 ? '✓' : '۱'}
                      </Box>
                    )}
                    sx={{ '& .MuiStepLabel-labelContainer': { paddingLeft: isRtl ? '0' : '8px', paddingRight: isRtl ? '8px' : '0' } }}
                  >
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, textAlign: isRtl ? 'right' : 'left' }}>
                      <Typography variant="caption" className="text-slate-400" fontWeight="bold">
                        9:00 AM - 10:00 AM
                      </Typography>
                      <Typography variant="body2" fontWeight="bold" className="text-slate-800 dark:text-slate-100">
                        {isRtl ? 'صبح کی کوڈنگ اور ڈیزائن' : 'Morning Coding & Design'}
                      </Typography>
                      <Box display="flex" alignItems="center" gap={1} justifyContent={isRtl ? 'flex-end' : 'flex-start'}>
                        <Chip
                          label={isRtl ? 'اہم مقصد: بیٹا لانچ' : 'Objective: Beta Launch'}
                          size="small"
                          sx={{ height: 20, fontSize: '0.7rem', backgroundColor: '#f44336', color: 'white' }}
                        />
                        <Chip
                          label={`60 ${isRtl ? 'منٹ' : 'min'}`}
                          size="small"
                          sx={{ height: 20, fontSize: '0.7rem', bgcolor: isDark ? '#374151' : '#f3f4f6', color: isDark ? '#d1d5db' : '#374151' }}
                        />
                      </Box>
                    </Box>
                  </StepLabel>
                </Step>

                {/* Step 2: Flexible Schedule */}
                <Step active={true}>
                  <StepLabel
                    StepIconComponent={() => (
                      <Box
                        sx={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          borderColor: '#9ca3af',
                          border: '2px solid',
                          color: '#9ca3af',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          fontWeight: 'bold',
                        }}
                      >
                        ۲
                      </Box>
                    )}
                    sx={{ '& .MuiStepLabel-labelContainer': { paddingLeft: isRtl ? '0' : '8px', paddingRight: isRtl ? '8px' : '0' } }}
                  >
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, textAlign: isRtl ? 'right' : 'left' }}>
                      <Typography variant="caption" className="text-purple-500" fontWeight="bold">
                        {isRtl ? 'لچکدار وقت (روزانہ)' : 'Flexible Timing (Daily)'}
                      </Typography>
                      <Typography variant="body2" fontWeight="bold" className="text-slate-850 dark:text-white">
                        {isRtl ? 'ٹیم کے کاموں کا جائزہ' : 'Review Team Commit Logs'}
                      </Typography>
                      <Box display="flex" alignItems="center" gap={1} justifyContent={isRtl ? 'flex-end' : 'flex-start'}>
                        <Chip
                          label={isRtl ? 'لچکدار' : 'Flexible'}
                          size="small"
                          variant="outlined"
                          sx={{
                            height: 20,
                            fontSize: '0.65rem',
                            fontWeight: 900,
                            borderColor: '#8b5cf6',
                            color: '#8b5cf6',
                            borderWidth: '1.5px',
                          }}
                        />
                      </Box>
                    </Box>
                  </StepLabel>
                </Step>
              </Stepper>
            </CardContent>
          </Card>

          {/* Mockup 2: WhatsApp Simulator for reply */}
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
              <Box display="flex" alignItems="center" justify-content="space-between" mb={2} sx={{ flexDirection: isRtl ? 'row-reverse' : 'row' }}>
                <div className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}>
                  <Avatar sx={{ bgcolor: 'rgba(16, 185, 129, 0.15)', color: '#128c7e', width: 36, height: 36 }}>
                    <WhatsAppIcon sx={{ fontSize: 20 }} />
                  </Avatar>
                  <div className={isRtl ? 'text-right' : 'text-left'}>
                    <Typography variant="body1" fontWeight="bold" className="text-slate-800 dark:text-slate-100 leading-none">
                      {isRtl ? 'یاد دہانی کا لائیو سمیلیٹر' : 'WhatsApp Done Reply Simulator'}
                    </Typography>
                    <Typography variant="caption" className="text-slate-400">
                      {isRtl ? 'مائی اوربٹ بوٹ جواب الرٹ' : 'MyOrbit WhatsApp Integration'}
                    </Typography>
                  </div>
                </div>
              </Box>

              <Typography variant="body2" className="text-slate-500 dark:text-slate-400 mb-4 leading-relaxed"
                sx={{ textAlign: isRtl ? 'right' : 'left' }}
              >
                {isRtl
                  ? 'ٹیسٹ کرنے کے لیے نیچے دیے گئے بٹن پر کلک کریں کہ واٹس ایپ پر "done" لکھنے سے شیڈول کیسے ایپ میں مکمل ہوتا ہے:'
                  : 'Click the button below to simulate replying "done" to mark the schedule completed automatically:'}
              </Typography>

              {/* Chat Window */}
              <Box
                className="p-3 border rounded-xl space-y-3 mb-4"
                sx={{
                  bgcolor: isDark ? '#0b141a' : '#efeae2',
                  borderColor: isDark ? '#222d34' : '#e1e1e1',
                }}
                style={{ direction: 'ltr' }} // Keep chat layout left-to-right as WhatsApp standard
              >
                {/* Message 1 (Bot Reminder) */}
                <div className="flex items-start gap-2">
                  <Avatar sx={{ bgcolor: '#128c7e', width: 24, height: 24, fontSize: 10 }}>OB</Avatar>
                  <Box
                    className="p-2.5 rounded-lg rounded-tl-none max-w-[80%] shadow-sm"
                    sx={{
                      bgcolor: isDark ? '#202c33' : '#ffffff',
                      color: isDark ? '#e9edef' : '#111b21',
                    }}
                  >
                    <Typography variant="body2" className="text-[12px] leading-relaxed">
                      🔔 <strong>Schedule Alert!</strong><br />
                      Hi Kashif! Your schedule <strong>&quot;Morning Coding &amp; Design&quot;</strong> has started. Stay focused! 🚀
                    </Typography>
                  </Box>
                </div>

                {/* Message 2 (User Reply "done") */}
                {whatsappStep >= 1 && (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex justify-end"
                  >
                    <Box
                      className="p-2.5 rounded-lg rounded-tr-none max-w-[80%] shadow-sm text-right"
                      sx={{
                        bgcolor: isDark ? '#005c4b' : '#d9fdd3',
                        color: isDark ? '#e9edef' : '#111b21',
                      }}
                    >
                      <Typography variant="body2" className="text-[12px] font-bold">
                        done
                      </Typography>
                    </Box>
                  </motion.div>
                )}

                {/* Message 3 (Bot Confirmation) */}
                {whatsappStep === 2 && (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex items-start gap-2"
                  >
                    <Avatar sx={{ bgcolor: '#128c7e', width: 24, height: 24, fontSize: 10 }}>OB</Avatar>
                    <Box
                      className="p-2.5 rounded-lg rounded-tl-none max-w-[80%] shadow-sm"
                      sx={{
                        bgcolor: isDark ? '#202c33' : '#ffffff',
                        color: isDark ? '#e9edef' : '#111b21',
                      }}
                    >
                      <Typography variant="body2" className="text-[12px] leading-relaxed">
                        {isRtl ? (
                          <span>
                            ✓ شیڈول <strong>&quot;صبح کی کوڈنگ اور ڈیزائن&quot;</strong> کو ایپ میں مکمل (Completed) نشان زد کر دیا گیا ہے۔ بہت خوب! 🌟
                          </span>
                        ) : (
                          <span>
                            ✓ Schedule <strong>&quot;Morning Coding &amp; Design&quot;</strong> has been marked as <strong>completed</strong> in the app. Great job! 🌟
                          </span>
                        )}
                      </Typography>
                    </Box>
                  </motion.div>
                )}
              </Box>

              <div className="flex justify-center">
                <Button
                  variant="contained"
                  onClick={handleSimulateReply}
                  size="small"
                  startIcon={<SendIcon sx={{ transform: isRtl ? 'rotate(180deg)' : 'none' }} />}
                  sx={{
                    bgcolor: whatsappStep > 0 ? '#dc2626' : '#128c7e',
                    color: 'white',
                    textTransform: 'none',
                    fontWeight: 600,
                    borderRadius: '8px',
                    '&:hover': {
                      bgcolor: whatsappStep > 0 ? '#b91c1c' : '#0e6f63',
                    },
                  }}
                >
                  {whatsappStep === 0 
                    ? (isRtl ? 'پیغام "done" بھیجیں' : 'Simulate typing "done"') 
                    : (isRtl ? 'دوبارہ شروع کریں' : 'Reset Simulator')}
                </Button>
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}
