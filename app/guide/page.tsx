'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Box,
  Typography,
  Button,
  Stack,
  Card,
  CardContent,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ChecklistIcon from '@mui/icons-material/Checklist';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import FlagIcon from '@mui/icons-material/Flag';
import HelpCenterIcon from '@mui/icons-material/HelpCenter';
import StarBorderIcon from '@mui/icons-material/StarBorder';

import { useCustomTheme } from '@/app/lib/context/themeContext';
import TodosGuide from '../components/guide/TodosGuide';
import SchedulesGuide from '../components/guide/SchedulesGuide';
import GoalsGuide from '../components/guide/GoalsGuide';

type GuideTabId = 'todos' | 'schedules' | 'goals';

interface GuideSection {
  id: GuideTabId;
  label: string;
  icon: React.ReactElement;
  description: string;
  isAvailable: boolean;
}

export default function GuidePage() {
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';
  
  const [activeTab, setActiveTab] = useState<GuideTabId | 'directory'>('directory');
  const [language, setLanguage] = useState<'en' | 'ur'>('en');

  const isRtl = language === 'ur';

  const guideSections: GuideSection[] = [
    {
      id: 'todos',
      label: language === 'ur' ? 'کاموں کی فہرست' : 'To-Do Tasks',
      icon: <ChecklistIcon />,
      description: language === 'ur' 
        ? 'روزمرہ کے معمولات، ذیلی مراحل، کاموں کی ترجیح، اور واٹس ایپ یاد دہانیاں۔' 
        : 'Daily routines, multi-step subtasks, priorities, and WhatsApp alerts.',
      isAvailable: true,
    },
    {
      id: 'schedules',
      label: language === 'ur' ? 'شیڈول' : 'Schedules',
      icon: <EventAvailableIcon />,
      description: language === 'ur' 
        ? 'کیلنڈر، بار بار آنے والے کام، اور روزمرہ کا منصوبہ ساز۔' 
        : 'Calendar integrations, recurring schedules, and agenda planners.',
      isAvailable: true,
    },
    {
      id: 'goals',
      label: language === 'ur' ? 'اہداف' : 'Goals',
      icon: <FlagIcon />,
      description: language === 'ur' 
        ? 'طویل مدتی مقاصد، اہم سنگ میل، اور ترقی کا لاگ۔' 
        : 'Long-term aspirations, milestones, and strategic progress logs.',
      isAvailable: true,
    },
  ];

  return (
    <Box
      sx={{
        backgroundColor: isDark ? '#0f172a' : '#f8fafc',
        color: isDark ? '#f1f5f9' : '#0f172a',
        minHeight: '100vh',
        pb: 12,
      }}
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div className="max-w-6xl mx-auto px-4 py-8">
        
        {/* Header Navigation */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
          <Button
            component={Link}
            href="/"
            startIcon={isRtl ? null : <ArrowBackIcon />}
            endIcon={isRtl ? <ArrowBackIcon sx={{ transform: 'rotate(180deg)' }} /> : null}
            sx={{
              color: isDark ? '#94a3b8' : '#64748b',
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.9rem',
              '&:hover': {
                color: isDark ? '#f1f5f9' : '#0f172a',
                backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
              },
            }}
          >
            {isRtl ? 'ڈیش بورڈ پر واپس جائیں' : 'Back to Dashboard'}
          </Button>

          <Stack direction="row" spacing={2} alignItems="center">
            {/* Language Switcher Button */}
            <Box className="rounded-xl border p-0.5 flex" sx={{ borderColor: isDark ? '#334155' : '#e2e8f0', bgcolor: isDark ? '#1e293b' : '#f1f5f9' }}>
              <Button
                size="small"
                onClick={() => setLanguage('en')}
                sx={{
                  px: 2,
                  py: 0.5,
                  borderRadius: '10px',
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  bgcolor: language === 'en' ? (isDark ? '#3b82f6' : '#ffffff') : 'transparent',
                  color: language === 'en' ? (isDark ? '#ffffff' : '#1e3a8a') : (isDark ? '#94a3b8' : '#64748b'),
                  boxShadow: language === 'en' && !isDark ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  '&:hover': {
                    bgcolor: language === 'en' ? (isDark ? '#2563eb' : '#ffffff') : 'rgba(0,0,0,0.05)',
                  }
                }}
              >
                English
              </Button>
              <Button
                size="small"
                onClick={() => setLanguage('ur')}
                sx={{
                  px: 2,
                  py: 0.5,
                  borderRadius: '10px',
                  fontFamily: 'system-ui, sans-serif',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  bgcolor: language === 'ur' ? (isDark ? '#3b82f6' : '#ffffff') : 'transparent',
                  color: language === 'ur' ? (isDark ? '#ffffff' : '#1e3a8a') : (isDark ? '#94a3b8' : '#64748b'),
                  boxShadow: language === 'ur' && !isDark ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  '&:hover': {
                    bgcolor: language === 'ur' ? (isDark ? '#2563eb' : '#ffffff') : 'rgba(0,0,0,0.05)',
                  }
                }}
              >
                اردو
              </Button>
            </Box>

            <Box className="flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold text-slate-500 dark:text-slate-400"
              sx={{ borderColor: isDark ? '#334155' : '#e2e8f0' }}
            >
              <StarBorderIcon sx={{ fontSize: 14 }} className="text-amber-500" />
              {isRtl ? 'مائی اوربٹ مینول v1.0' : 'MyOrbit Manual v1.0'}
            </Box>
          </Stack>
        </div>

        {/* Hero Section */}
        <div className={`mb-12 text-center ${isRtl ? 'md:text-right' : 'md:text-left'} relative py-6`}>
          <div className={`absolute ${isRtl ? 'left-0' : 'right-0'} top-1/2 -translate-y-1/2 opacity-5 pointer-events-none hidden md:block`}>
            <HelpCenterIcon sx={{ fontSize: 180 }} />
          </div>
          <Typography
            variant="h3"
            fontWeight="900"
            className="mb-3 tracking-tight bg-gradient-to-r from-blue-600 to-indigo-500 dark:from-blue-400 dark:to-indigo-300 bg-clip-text text-transparent"
            sx={{ 
              fontFamily: isRtl ? 'var(--font-roboto), sans-serif' : 'var(--font-inter)',
              lineHeight: isRtl ? 1.4 : 1.2
            }}
          >
            {isRtl ? 'مائی اوربٹ گائیڈ سینٹر' : 'MyOrbit Guide Center'}
          </Typography>
          <Typography
            variant="h6"
            className="text-slate-550 dark:text-slate-350 max-w-2xl font-light leading-relaxed"
            sx={{ 
              fontFamily: 'var(--font-roboto)',
              lineHeight: isRtl ? 1.8 : 1.6
            }}
          >
            {isRtl 
              ? 'اپنے انٹرایکٹو دستی گائیڈ میں خوش آمدید۔ مائی اوربٹ کے ساتھ اپنی روزمرہ کی روٹین، شیڈول اور اہداف کو مربوط کر کے اپنی زندگی کو منظم کرنے کے طریقے سیکھیں۔'
              : 'Welcome to your interactive handbook. Learn how to orchestrate your tasks, coordinate streaks, and track goals to build your optimal digital orbit with MyOrbit.'}
          </Typography>
        </div>

        {/* Guide Switcher Tabs (Scrollable on Mobile, Grid/Pill on Desktop) */}
        <Box
          className={`p-1.5 rounded-2xl border mb-10 overflow-x-auto no-scrollbar ${
            activeTab !== 'directory' ? 'hidden md:block' : 'block'
          }`}
          sx={{
            borderColor: isDark ? '#334155' : '#e2e8f0',
            bgcolor: isDark ? '#1e293b/60' : '#ffffff',
          }}
        >
          <div className="flex gap-2 min-w-max md:min-w-0">
            <button
              onClick={() => setActiveTab('directory')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${
                activeTab === 'directory'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <span className={activeTab === 'directory' ? 'text-white' : 'text-slate-400 dark:text-slate-500'}>
                <HelpCenterIcon />
              </span>
              {isRtl ? 'تمام گائیڈز' : 'All Guides'}
            </button>
            {guideSections.map((section) => {
              const isActive = activeTab === section.id;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveTab(section.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className={isActive ? 'text-white' : 'text-slate-400 dark:text-slate-500'}>
                    {section.icon}
                  </span>
                  {section.label}
                </button>
              );
            })}
          </div>
        </Box>

        {/* Render Guide Content */}
        <motion.div
          key={activeTab + language}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className={isRtl ? 'text-right' : 'text-left'}
        >
          {activeTab === 'directory' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {guideSections.map((section) => (
                <Card
                  key={section.id}
                  elevation={2}
                  className="border transition-all duration-300 hover:-translate-y-1 hover:shadow-lg cursor-pointer group"
                  onClick={() => setActiveTab(section.id)}
                  sx={{
                    borderColor: isDark ? '#334155' : '#e2e8f0',
                    bgcolor: isDark ? '#1e293b' : '#ffffff',
                    borderRadius: '20px',
                    overflow: 'hidden',
                  }}
                >
                  <CardContent className="p-6 flex flex-col h-full justify-between">
                    <div className="space-y-4">
                      <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                        {section.icon}
                      </div>
                      <div className="space-y-2">
                        <Typography variant="h6" fontWeight="bold" className="text-slate-800 dark:text-slate-100 flex items-center gap-2" sx={{ fontFamily: isRtl ? 'var(--font-roboto), sans-serif' : 'var(--font-inter)' }}>
                          {section.label}
                        </Typography>
                        <Typography variant="body2" className="text-slate-500 dark:text-slate-400 leading-relaxed min-h-[48px]" sx={{ fontFamily: 'var(--font-roboto)' }}>
                          {section.description}
                        </Typography>
                      </div>
                    </div>
                    <div className="pt-6 flex justify-end">
                      <Button
                        size="small"
                        variant="text"
                        className="group-hover:text-blue-600 dark:group-hover:text-blue-400"
                        endIcon={isRtl ? <ArrowBackIcon sx={{ transform: 'rotate(180deg)', fontSize: 16 }} /> : <ArrowForwardIcon sx={{ fontSize: 16 }} />}
                        sx={{ textTransform: 'none', fontWeight: 600, color: isDark ? '#94a3b8' : '#64748b' }}
                      >
                        {isRtl ? 'گائیڈ پڑھیں' : 'Read Guide'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <>
              <Button
                startIcon={isRtl ? null : <ArrowBackIcon />}
                endIcon={isRtl ? <ArrowBackIcon sx={{ transform: 'rotate(180deg)' }} /> : null}
                onClick={() => setActiveTab('directory')}
                sx={{
                  mb: 4,
                  color: isDark ? '#94a3b8' : '#64748b',
                  textTransform: 'none',
                  fontWeight: 600,
                  '&:hover': {
                    color: isDark ? '#f1f5f9' : '#0f172a',
                    bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                  },
                }}
              >
                {isRtl ? 'تمام گائیڈز پر واپس جائیں' : 'Back to All Guides'}
              </Button>

              {activeTab === 'todos' ? (
                <TodosGuide language={language} />
              ) : activeTab === 'schedules' ? (
                <SchedulesGuide language={language} />
              ) : activeTab === 'goals' ? (
                <GoalsGuide language={language} />
              ) : null}
            </>
          )}
        </motion.div>

      </div>
    </Box>
  );
}
