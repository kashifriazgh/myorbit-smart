'use client';

import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Stack,
  Chip,
  TextField,
  IconButton,
  Divider,
} from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import PriorityHighIcon from '@mui/icons-material/PriorityHigh';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

import { useCustomTheme } from '@/app/lib/context/themeContext';

export default function NotesGuide({ language = 'en' }: { language?: 'en' | 'ur' }) {
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';
  const isRtl = language === 'ur';

  // State for Mockup 1: Live Markdown Editor
  const defaultMdEn = `# Workout Routine\n- Run **2 miles**\n- *15 pushups*\n- ~~Drink water~~`;
  const defaultMdUr = `# ورزش کا معمول\n- **2 میل** دوڑیں\n- *15 پش اپس*\n- ~~پانی پیئں~~`;

  const [mdInput, setMdInput] = useState(isRtl ? defaultMdUr : defaultMdEn);

  // Simple Markdown Parser for Live Preview
  const parseMarkdownToJsx = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      let content = line;
      let isHeader = false;
      let isBullet = false;

      // Check header
      if (content.startsWith('#')) {
        isHeader = true;
        content = content.replace(/^#\s*/, '');
      }
      // Check bullet
      else if (content.startsWith('-')) {
        isBullet = true;
        content = content.replace(/^-+\s*/, '');
      }

      // Parse bold **text**
      const boldRegex = /\*\*(.*?)\*\*/g;
      const italicRegex = /\*(.*?)\*/g;
      const strikeRegex = /~~(.*?)~~/g;

      // Simple JSX conversion helper for inline formats
      const renderFormattedText = (rawStr: string) => {
        // Parse bold, italic, strikethrough by replacing with styled spans (a simple approach)
        // For guide mockup, we can use dangerouslySetInnerHTML safely since it's client-side user typed
        const htmlContent = rawStr
          .replace(boldRegex, '<strong>$1</strong>')
          .replace(italicRegex, '<em>$1</em>')
          .replace(strikeRegex, '<del>$1</del>');
        
        return <span dangerouslySetInnerHTML={{ __html: htmlContent }} />;
      };

      if (isHeader) {
        return (
          <Typography key={idx} variant="h6" className="font-extrabold text-slate-800 dark:text-slate-100 mt-2 mb-1">
            {renderFormattedText(content)}
          </Typography>
        );
      }

      if (isBullet) {
        return (
          <li key={idx} className="ml-4 list-disc text-slate-605 dark:text-slate-350 text-sm">
            {renderFormattedText(content)}
          </li>
        );
      }

      return (
        <Typography key={idx} variant="body2" className="text-slate-650 dark:text-slate-350 min-h-[1.2rem] my-0.5">
          {renderFormattedText(line)}
        </Typography>
      );
    });
  };

  // State for Mockup 2: Note properties
  const [isFav, setIsFav] = useState(false);
  const [isImportant, setIsImportant] = useState(false);

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
              {isRtl ? 'مائی اوربٹ نوٹس کیا ہیں؟' : 'What are MyOrbit Notes?'}
            </Typography>
            <Typography variant="body2" className="text-slate-600 dark:text-slate-300 leading-relaxed"
              sx={{ lineHeight: isRtl ? 1.8 : 1.6 }}
            >
              {isRtl
                ? 'نوٹس کا سیکشن آپ کو خیالات، لنکس اور اہم معلومات کو تیزی سے لکھ کر محفوظ کرنے کی سہولت فراہم کرتا ہے۔ رچ ٹیکسٹ فارمیٹنگ کی مدد سے آپ اپنے نوٹس کو مزید واضح اور خوبصورت بنا سکتے ہیں۔'
                : 'The Notes module allows you to capture ideas, draft quick memos, and preserve crucial information. Structured with rich text markdown options, your notes stay organized and readable.'}
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
                {isRtl ? 'ہوم پیج پر کوئیک نوٹ وجیٹ' : 'Homepage Quick Note Widget'}
              </Typography>
            </div>
            <Typography variant="body1" className="text-slate-600 dark:text-slate-300 leading-relaxed"
              sx={{ lineHeight: isRtl ? 1.8 : 1.6, textAlign: isRtl ? 'right' : 'left' }}
            >
              {isRtl
                ? 'اپنے خیالات کو فوری طور پر لکھنے کے لیے، ہوم پیج پر سب سے اوپر ایک "کوئیک نوٹ" وجیٹ رکھا گیا ہے۔ آپ بغیر کسی تاخیر کے وہاں ایک چھوٹا نوٹ لکھ کر محفوظ کر سکتے ہیں جو خود بخود آپ کی لسٹ میں شامل ہو جاتا ہے۔'
                : 'For immediate capture, a Quick Note widget is placed right at the top of your dashboard. Simply type your thoughts and save—it lands in your notes log instantly.'}
            </Typography>
            <Typography variant="body1" className="text-slate-600 dark:text-slate-300 leading-relaxed"
              sx={{ lineHeight: isRtl ? 1.8 : 1.6, textAlign: isRtl ? 'right' : 'left' }}
            >
              {isRtl
                ? 'مکمل نوٹس سینٹر تک رسائی حاصل کرنے کے لیے آپ نیچے پاپ اوور مینو سے /notes پر جا سکتے ہیں۔'
                : 'To view and manage all your logs, navigate to the full Notes Center at /notes.'}
            </Typography>
          </section>

          {/* Section 2: Markdown Formatting */}
          <section className="space-y-3">
            <div className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}>
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-sm">
                ۲
              </span>
              <Typography variant="h6" fontWeight="bold" className="text-slate-800 dark:text-slate-100">
                {isRtl ? 'مارک ڈاؤن لینگویج سے فارمیٹنگ' : 'Rich Markdown Formatting'}
              </Typography>
            </div>
            <Typography variant="body1" className="text-slate-600 dark:text-slate-300 leading-relaxed"
              sx={{ lineHeight: isRtl ? 1.8 : 1.6, textAlign: isRtl ? 'right' : 'left' }}
            >
              {isRtl
                ? 'ہمارے نوٹس مارک ڈاؤن (Markdown) زبان کو سپورٹ کرتے ہیں۔ اپنے پیراگراف کو فارمیٹ کرنے کے لیے درج ذیل آسان علامات استعمال کریں:'
                : 'MyOrbit Notes support rich Markdown options. Use these simple text operators to style your notes:'}
            </Typography>
            <ul className={`list-disc pl-6 pr-6 space-y-1.5 text-slate-600 dark:text-slate-300 ${isRtl ? 'text-right' : 'text-left'}`}
              style={{ direction: isRtl ? 'rtl' : 'ltr' }}
            >
              <li>
                {isRtl
                  ? <span><strong>بڑی سرخی (Headings)</strong>: جملے کے شروع میں <code>#</code> لگائیں (مثلاً: <code># سرخی</code>)۔</span>
                  : <span><strong>Headers</strong>: Start a line with <code>#</code> to create a header title (e.g. <code># Meeting Notes</code>).</span>}
              </li>
              <li>
                {isRtl
                  ? <span><strong>فہرست (Bullet List)</strong>: جملے کے شروع میں <code>-</code> کا نشان لگائیں (مثلاً: <code>- پہلا آئٹم</code>)۔</span>
                  : <span><strong>Bullet Lists</strong>: Start lines with <code>-</code> to create structured bulleted lists.</span>}
              </li>
              <li>
                {isRtl
                  ? <span><strong>موٹا کریں (Bold)</strong>: الفاظ کے دونوں طرف <code>**</code> لگائیں (مثلاً: <code>**اہم**</code>)۔</span>
                  : <span><strong>Bold Text</strong>: Surround text with double asterisks <code>**bold**</code> for strong styling.</span>}
              </li>
              <li>
                {isRtl
                  ? <span><strong>ٹیڑھا کریں (Italic)</strong>: الفاظ کے دونوں طرف <code>*</code> کا نشان لگائیں (مثلاً: <code>*ضروری*</code>)۔</span>
                  : <span><strong>Italics</strong>: Surround text with single asterisks <code>*italic*</code> for emphasis.</span>}
              </li>
              <li>
                {isRtl
                  ? <span><strong>لائن کاٹیں (Strikethrough)</strong>: الفاظ کے دونوں طرف <code>~~</code> لگائیں (مثلاً: <code>~~مکمل کام~~</code>)۔</span>
                  : <span><strong>Strikethrough</strong>: Use double tildes <code>~~completed task~~</code> to cross out lines.</span>}
              </li>
            </ul>
          </section>

          {/* Section 3: Favorites, Importance & Search */}
          <section className="space-y-3">
            <div className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}>
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-sm">
                ۳
              </span>
              <Typography variant="h6" fontWeight="bold" className="text-slate-800 dark:text-slate-100">
                {isRtl ? 'پسندیدہ، اہمیت اور تلاش' : 'Distinguish, Search & Filters'}
              </Typography>
            </div>
            <Typography variant="body1" className="text-slate-600 dark:text-slate-300 leading-relaxed"
              sx={{ lineHeight: isRtl ? 1.8 : 1.6, textAlign: isRtl ? 'right' : 'left' }}
            >
              {isRtl ? (
                <span>
                  اپنے اہم نوٹس کو الگ اور ممتاز رکھنے کے لیے:
                  <br />
                  • <strong>پسندیدہ (Favorite ⭐)</strong>: نوٹ پر موجود ستارے کے آئیکن پر کلک کر کے اسے پسندیدہ میں شامل کریں۔
                  <br />
                  • <strong>اہم (Important ❗)</strong>: نوٹ کو اہم مارک کریں تاکہ اس پر لال رنگ کا لیبل لگ سکے۔
                  <br />
                  • <strong>تلاش (Search)</strong>: سرچ بار کے ذریعے کسی بھی نوٹ کو سیکنڈز میں اس کے مواد سے تلاش کریں۔
                </span>
              ) : (
                <span>
                  Keep your critical thoughts separated and easy to find:
                  <br />
                  • <strong>Favorites (⭐)</strong>: Star notes to group them under your favorites filter.
                  <br />
                  • <strong>Important (❗)</strong>: Mark notes as important to add an urgent red badge.
                  <br />
                  • <strong>Search</strong>: Use the dynamic search bar at the top of the page to find any note by its content instantly.
                </span>
              )}
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

          {/* Mockup 1: Live Markdown Preview */}
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
                {isRtl ? 'مارک ڈاؤن لکھیں (لائیو پری ویو):' : 'Write Markdown (Live Preview):'}
              </Typography>

              {/* Text Area Input */}
              <TextField
                fullWidth
                multiline
                minRows={4}
                value={mdInput}
                onChange={(e) => setMdInput(e.target.value)}
                placeholder={isRtl ? 'مارک ڈاؤن لکھیں...' : 'Type markdown here...'}
                sx={{
                  mb: 3,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '12px',
                    fontFamily: 'monospace',
                    fontSize: '0.85rem',
                    bgcolor: isDark ? 'rgba(0,0,0,0.15)' : '#fcfcfc',
                  }
                }}
              />

              <Divider className="my-2" />

              <Typography variant="caption" className="text-slate-400 block mb-2 font-bold"
                sx={{ textAlign: isRtl ? 'right' : 'left' }}
              >
                {isRtl ? 'لائیو رینڈرڈ نوٹس:' : 'Live Rendered Notes Output:'}
              </Typography>

              {/* Live Render output box */}
              <Box
                className="p-4 rounded-xl border min-h-[120px] text-left"
                sx={{
                  bgcolor: isDark ? '#0f172a' : '#f8fafc',
                  borderColor: isDark ? '#334155' : '#e2e8f0',
                }}
                style={{ direction: isRtl ? 'rtl' : 'ltr' }}
              >
                {parseMarkdownToJsx(mdInput)}
              </Box>
            </CardContent>
          </Card>

          {/* Mockup 2: Stars and Importance Toggle */}
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
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}
                sx={{ flexDirection: isRtl ? 'row-reverse' : 'row' }}
              >
                <Typography variant="body2" fontWeight="bold" className="text-slate-800 dark:text-slate-200">
                  {isRtl ? 'ملاقات کا خلاصہ' : 'Project Kickoff Notes'}
                </Typography>

                <Stack direction="row" spacing={0.5}>
                  <IconButton
                    size="small"
                    onClick={() => setIsFav(!isFav)}
                    color={isFav ? 'warning' : 'default'}
                  >
                    {isFav ? <StarIcon fontSize="small" /> : <StarBorderIcon fontSize="small" />}
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => setIsImportant(!isImportant)}
                    color={isImportant ? 'error' : 'default'}
                  >
                    <PriorityHighIcon fontSize="small" sx={{ opacity: isImportant ? 1 : 0.3 }} />
                  </IconButton>
                </Stack>
              </Box>

              <Box display="flex" gap={1} mb={2} sx={{ justifyContent: isRtl ? 'flex-end' : 'flex-start' }}>
                {isImportant && (
                  <Chip
                    size="small"
                    label={isRtl ? 'اہم' : 'Important'}
                    color="error"
                    variant="outlined"
                    sx={{ height: 20, fontSize: '0.65rem' }}
                  />
                )}
                {isFav && (
                  <Chip
                    size="small"
                    label={isRtl ? 'پسندیدہ' : 'Favorite'}
                    color="warning"
                    variant="outlined"
                    sx={{ height: 20, fontSize: '0.65rem' }}
                  />
                )}
                {!isImportant && !isFav && (
                  <Chip
                    size="small"
                    label={isRtl ? 'عام' : 'General'}
                    variant="outlined"
                    sx={{ height: 20, fontSize: '0.65rem', opacity: 0.6 }}
                  />
                )}
              </Box>

              <Typography variant="body2" className="text-slate-500 dark:text-slate-400 mb-2 leading-relaxed"
                sx={{ textAlign: isRtl ? 'right' : 'left' }}
              >
                {isRtl 
                  ? 'ٹیم کے ساتھ ہونے والی ملاقات کی تفصیلات... اوپر موجود بٹنز سے سٹار یا اہمیت تبدیل کر کے ٹیسٹ کریں۔'
                  : 'Kickoff meeting details. Try clicking the star or high priority icons above to change its status!'}
              </Typography>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}
