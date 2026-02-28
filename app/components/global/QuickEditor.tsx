'use client';

import { useState } from 'react';

import 'tippy.js/dist/tippy.css';
import {
  Button,
  Box,
  Tabs,
  Tab,
  TextField,
  CircularProgress,
  Fade,
} from '@mui/material';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { useAuth } from '@/app/lib/context/userContext';
import { QuickNote } from '@/app/lib/interface';

interface ProductivityEditorProps {
  variant?: 'default' | 'compact';
}

export default function ProductivityEditor({
  variant = 'default',
}: ProductivityEditorProps) {
  const [activeTab, setActiveTab] = useState<'notes' | 'editor'>('notes');
  const [noteContent, setNoteContent] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const [noteFocused, setNoteFocused] = useState(false);

  const { theme } = useCustomTheme();
  const { user } = useAuth();
  const isCompact = variant === 'compact';

  // Collapsed state for editor content
  const [collapsed, setCollapsed] = useState(true);

  const handleSaveNote = async () => {
    if (!noteContent.trim() || !user?.uid || savingNote) return;

    setSavingNote(true);
    setNoteSaved(false);

    try {
      const noteData: Omit<QuickNote, 'id'> = {
        userId: user.uid,
        content: noteContent.trim(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await addDoc(collection(db, 'notes'), {
        ...noteData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setNoteSaved(true);
      setTimeout(() => {
        setNoteContent('');
        setNoteSaved(false);
      }, 1500);
    } catch (error) {
      console.error('Error saving note:', error);
    } finally {
      setSavingNote(false);
    }
  };

  return (
    <Box
      sx={{
        maxWidth: 'xl',
        width: '100%',
        mx: 'auto',
      }}
    >
      {/* Greeting and expand/collapse button on one line */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 2,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            fontWeight: 600,
            fontSize: '1.15rem',
          }}
        >
          {/* Dynamic greeting */}
          {(() => {
            const hour = new Date().getHours();
            let greeting = 'Good morning';
            if (hour >= 18) greeting = 'Good evening';
            else if (hour >= 12) greeting = 'Good afternoon';
            return `${greeting}, ${user?.firstName ? user.firstName : 'Guest'}`;
          })()}
        </Box>
        <Button
          size="small"
          variant="outlined"
          sx={{
            minWidth: 0,
            px: 1.5,
            py: 0.5,
            ml: 2,
            fontWeight: 700,
            fontSize: '1.2rem',
            borderRadius: 2,
          }}
          onClick={() => setCollapsed((prev) => !prev)}
        >
          {collapsed ? '+' : '–'}
        </Button>
      </Box>

      {/* Collapsible content */}
      {!collapsed && (
        <>
          <Tabs
            value={activeTab}
            onChange={(_, newValue) => setActiveTab(newValue)}
            sx={{
              mb: 2,
              '& .MuiTab-root': {
                textTransform: 'none',
                fontSize: '0.875rem',
                fontWeight: 600,
                minHeight: 40,
              },
            }}
          >
            <Tab label="Quick Notes" value="notes" />
            {/* <Tab label="Quick Editor" value="editor" /> */}
          </Tabs>

          {/* Quick Notes Tab */}
          {activeTab === 'notes' && (
            <Box>
              <TextField
                multiline
                rows={noteFocused ? (isCompact ? 4 : 6) : isCompact ? 1 : 3}
                fullWidth
                placeholder="Start typing your note..."
                value={noteContent}
                onFocus={() => setNoteFocused(true)}
                onBlur={() => {
                  if (!noteContent.trim()) setNoteFocused(false);
                }}
                onChange={(e) => setNoteContent(e.target.value)}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor:
                      theme?.mode === 'dark' ? '#1e293b' : '#ffffff',
                    color: theme?.mode === 'dark' ? '#f1f5f9' : '#0f172a',
                    fontSize: '1.125rem',
                    fontWeight: 500,
                    lineHeight: 1.7,
                    fontFamily:
                      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                    '& fieldset': {
                      borderColor:
                        theme?.mode === 'dark' ? '#475569' : '#cbd5e1',
                    },
                    '&:hover fieldset': {
                      borderColor:
                        theme?.mode === 'dark' ? '#64748b' : '#94a3b8',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor:
                        theme?.mode === 'dark' ? '#3b82f6' : '#2563eb',
                    },
                  },
                  '& .MuiInputBase-input': {
                    transition: 'all 0.18s ease',
                    '&::placeholder': {
                      color: theme?.mode === 'dark' ? '#64748b' : '#94a3b8',
                      opacity: 0.7,
                    },
                  },
                }}
              />

              {/* Saving Indicator */}
              {savingNote && (
                <Fade in={savingNote}>
                  <Box
                    sx={{
                      mt: 2,
                      p: 3,
                      borderRadius: 2,
                      background:
                        theme?.mode === 'dark'
                          ? 'linear-gradient(135deg, #1e293b 0%, #334155 100%)'
                          : 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
                      border: `1px solid ${theme?.mode === 'dark' ? '#475569' : '#cbd5e1'}`,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 2,
                    }}
                  >
                    <CircularProgress size={32} />
                    <Box sx={{ textAlign: 'center' }}>
                      <Box
                        component="span"
                        sx={{
                          fontSize: '1rem',
                          fontWeight: 600,
                          color: theme?.mode === 'dark' ? '#f1f5f9' : '#0f172a',
                          display: 'block',
                          mb: 0.5,
                        }}
                      >
                        Saving your note...
                      </Box>
                      <Box
                        component="span"
                        sx={{
                          fontSize: '0.875rem',
                          color: theme?.mode === 'dark' ? '#94a3b8' : '#64748b',
                        }}
                      >
                        Please wait a moment
                      </Box>
                    </Box>
                  </Box>
                </Fade>
              )}

              {/* Success Indicator */}
              {noteSaved && (
                <Fade in={noteSaved}>
                  <Box
                    sx={{
                      mt: 2,
                      p: 3,
                      borderRadius: 2,
                      background:
                        theme?.mode === 'dark'
                          ? 'linear-gradient(135deg, #065f46 0%, #047857 100%)'
                          : 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
                      border: `1px solid ${theme?.mode === 'dark' ? '#059669' : '#10b981'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 1.5,
                    }}
                  >
                    <Box
                      component="span"
                      sx={{
                        fontSize: '1.5rem',
                      }}
                    >
                      ✓
                    </Box>
                    <Box
                      component="span"
                      sx={{
                        fontSize: '1rem',
                        fontWeight: 600,
                        color: theme?.mode === 'dark' ? '#f1f5f9' : '#065f46',
                      }}
                    >
                      Note saved successfully!
                    </Box>
                  </Box>
                </Fade>
              )}

              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  variant="contained"
                  onClick={handleSaveNote}
                  disabled={!noteContent.trim() || savingNote}
                  sx={{
                    backgroundColor:
                      theme?.mode === 'dark' ? '#3b82f6' : '#2563eb',
                    '&:hover': {
                      backgroundColor:
                        theme?.mode === 'dark' ? '#2563eb' : '#1d4ed8',
                    },
                    textTransform: 'none',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    px: 3,
                  }}
                >
                  {savingNote ? 'Saving...' : 'Save Notes'}
                </Button>
              </Box>
            </Box>
          )}
        </>
      )}
    </Box>
  );
}
