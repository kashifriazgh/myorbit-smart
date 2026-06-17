'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Button,
  Box,
  Tabs,
  Tab,
  TextField,
  CircularProgress,
  Fade,
  IconButton,
  Stack,
  Tooltip,
  Divider,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useMediaQuery,
  useTheme as useMuiTheme,
} from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import PriorityHighIcon from '@mui/icons-material/PriorityHigh';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import FormatStrikethroughIcon from '@mui/icons-material/FormatStrikethrough';
import TitleIcon from '@mui/icons-material/Title';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import HorizontalRuleIcon from '@mui/icons-material/HorizontalRule';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditNoteIcon from '@mui/icons-material/EditNote';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { useAuth } from '@/app/lib/context/userContext';
import { QuickNote } from '@/app/lib/interface';

// Helper: Custom Markdown parser to render styled typography for note content
export const renderMarkdown = (text: string, themeMode?: 'light' | 'dark') => {
  if (!text) return null;

  const lines = text.split('\n');
  let inList: 'ul' | 'ol' | null = null;
  const elements: React.ReactNode[] = [];
  let listItems: React.ReactNode[] = [];

  const parseInline = (lineText: string) => {
    const currentText = lineText;
    const parts: React.ReactNode[] = [];
    const regex = /(\*\*|__|\*|_|~~)/g;
    const splitParts = currentText.split(regex);
    
    let isBold = false;
    let isItalic = false;
    let isStrike = false;

    for (let i = 0; i < splitParts.length; i++) {
      const part = splitParts[i];
      if (part === '**' || part === '__') {
        isBold = !isBold;
      } else if (part === '*' || part === '_') {
        isItalic = !isItalic;
      } else if (part === '~~') {
        isStrike = !isStrike;
      } else {
        if (isBold && isItalic) {
          parts.push(<strong key={i}><em>{part}</em></strong>);
        } else if (isBold) {
          parts.push(<strong key={i} style={{ fontWeight: 800 }}>{part}</strong>);
        } else if (isItalic) {
          parts.push(<em key={i}>{part}</em>);
        } else if (isStrike) {
          parts.push(<span key={i} style={{ textDecoration: 'line-through' }}>{part}</span>);
        } else {
          parts.push(part);
        }
      }
    }
    return parts;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const cleanLine = line.trim();

    // Headers, bullets, numbered lists, dividers, or plain text
    const isBullet = cleanLine.startsWith('- ') || cleanLine.startsWith('* ') || cleanLine.startsWith('• ');
    const isNumbered = /^\d+\.\s/.test(cleanLine);
    const isDivider = cleanLine === '---' || cleanLine === '***';

    if (isDivider) {
      // Close list
      if (inList === 'ul') {
        elements.push(<ul key={`ul-${i}`} style={{ paddingLeft: '24px', margin: '8px 0', listStyleType: 'disc' }}>{listItems}</ul>);
        listItems = [];
        inList = null;
      } else if (inList === 'ol') {
        elements.push(<ol key={`ol-${i}`} style={{ paddingLeft: '24px', margin: '8px 0' }}>{listItems}</ol>);
        listItems = [];
        inList = null;
      }
      elements.push(<Divider key={i} sx={{ my: 2, borderColor: themeMode === 'dark' ? '#334155' : '#cbd5e1' }} />);
    } else if (isBullet) {
      if (inList === 'ol') {
        elements.push(<ol key={`ol-${i}`} style={{ paddingLeft: '24px', margin: '8px 0' }}>{listItems}</ol>);
        listItems = [];
      }
      inList = 'ul';
      const content = cleanLine.substring(2);
      listItems.push(<li key={`li-${i}`} style={{ marginBottom: '4px' }}>{parseInline(content)}</li>);
    } else if (isNumbered) {
      if (inList === 'ul') {
        elements.push(<ul key={`ul-${i}`} style={{ paddingLeft: '24px', margin: '8px 0', listStyleType: 'disc' }}>{listItems}</ul>);
        listItems = [];
      }
      inList = 'ol';
      const content = cleanLine.replace(/^\d+\.\s/, '');
      listItems.push(<li key={`li-${i}`} style={{ marginBottom: '4px' }}>{parseInline(content)}</li>);
    } else {
      // Close open lists
      if (inList === 'ul') {
        elements.push(<ul key={`ul-${i}`} style={{ paddingLeft: '24px', margin: '8px 0', listStyleType: 'disc' }}>{listItems}</ul>);
        listItems = [];
        inList = null;
      } else if (inList === 'ol') {
        elements.push(<ol key={`ol-${i}`} style={{ paddingLeft: '24px', margin: '8px 0' }}>{listItems}</ol>);
        listItems = [];
        inList = null;
      }

      if (cleanLine.startsWith('# ')) {
        elements.push(<Typography key={i} variant="h5" fontWeight="bold" sx={{ mt: 2, mb: 1, color: themeMode === 'dark' ? '#3b82f6' : '#2563eb' }}>{parseInline(cleanLine.substring(2))}</Typography>);
      } else if (cleanLine.startsWith('## ')) {
        elements.push(<Typography key={i} variant="h6" fontWeight="bold" sx={{ mt: 1.5, mb: 1, color: themeMode === 'dark' ? '#60a5fa' : '#3b82f6' }}>{parseInline(cleanLine.substring(3))}</Typography>);
      } else {
        if (line === '') {
          elements.push(<Box key={i} sx={{ height: '12px' }} />);
        } else {
          elements.push(<Typography key={i} variant="body1" sx={{ minHeight: '24px', lineHeight: 1.7, color: themeMode === 'dark' ? '#cbd5e1' : '#475569' }}>{parseInline(line)}</Typography>);
        }
      }
    }
  }

  // Close lists at the end
  if (inList === 'ul') {
    elements.push(<ul key={`ul-end`} style={{ paddingLeft: '24px', margin: '8px 0', listStyleType: 'disc' }}>{listItems}</ul>);
  } else if (inList === 'ol') {
    elements.push(<ol key={`ol-end`} style={{ paddingLeft: '24px', margin: '8px 0' }}>{listItems}</ol>);
  }

  return <Box sx={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'left' }}>{elements}</Box>;
};

interface MarkdownHelpDialogProps {
  open: boolean;
  onClose: () => void;
}

// Reusable formatting education dialog
export function MarkdownHelpDialog({ open, onClose }: MarkdownHelpDialogProps) {
  const { theme } = useCustomTheme();
  
  const examples = [
    { type: 'Header 1', typeCode: '# Title text', render: <strong><span style={{ fontSize: '1.15rem', color: theme?.mode === 'dark' ? '#3b82f6' : '#2563eb' }}>Title text</span></strong> },
    { type: 'Header 2', typeCode: '## Section title', render: <strong><span style={{ fontSize: '1rem', color: theme?.mode === 'dark' ? '#60a5fa' : '#3b82f6' }}>Section title</span></strong> },
    { type: 'Bold Text', typeCode: '**Bold Words**', render: <strong style={{ fontWeight: 800 }}>Bold Words</strong> },
    { type: 'Italic Text', typeCode: '*Slanted Text*', render: <em>Slanted Text</em> },
    { type: 'Strikethrough', typeCode: '~~Completed Task~~', render: <span style={{ textDecoration: 'line-through', opacity: 0.6 }}>Completed Task</span> },
    { type: 'Bullet List', typeCode: '- Item A\n- Item B', render: <ul style={{ paddingLeft: '16px', margin: 0, listStyleType: 'disc' }}><li style={{ fontSize: '0.85rem' }}>Item A</li><li style={{ fontSize: '0.85rem' }}>Item B</li></ul> },
    { type: 'Numbered List', typeCode: '1. Step One\n2. Step Two', render: <ol style={{ paddingLeft: '16px', margin: 0 }}><li style={{ fontSize: '0.85rem' }}>Step One</li><li style={{ fontSize: '0.85rem' }}>Step Two</li></ol> },
    { type: 'Horizontal Line', typeCode: '---', render: <Divider sx={{ my: 0.5, borderColor: theme?.mode === 'dark' ? '#334155' : '#cbd5e1' }} /> },
  ];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 4,
          p: 1.5,
          backgroundColor: theme?.mode === 'dark' ? '#1e293b' : '#ffffff',
          color: theme?.mode === 'dark' ? '#f1f5f9' : '#0f172a',
        }
      }}
    >
      <DialogTitle sx={{ fontWeight: 800, fontSize: '1.35rem', display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <HelpOutlineIcon color="primary" sx={{ fontSize: 28 }} /> Formatting Guide
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: theme?.mode === 'dark' ? '#94a3b8' : '#64748b', mb: 3 }}>
          Use standard Markdown formatting inside your Quick Notes. Highlight any text block and click the formatting tools in the toolbar, or type these shortcuts directly:
        </Typography>

        {/* Horizontal scroll container for mobile/tablet responsive comfort */}
        <Box sx={{ width: '100%', overflowX: 'auto', pb: 1 }}>
          <Box sx={{ minWidth: '460px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Header row */}
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1.25fr 1.25fr', gap: 2, pb: 1, borderBottom: '2px solid', borderColor: theme?.mode === 'dark' ? '#334155' : '#cbd5e1' }}>
              <Typography variant="caption" fontWeight="800" sx={{ color: theme?.mode === 'dark' ? '#94a3b8' : '#475569' }}>STYLE</Typography>
              <Typography variant="caption" fontWeight="800" sx={{ color: theme?.mode === 'dark' ? '#94a3b8' : '#475569' }}>WHAT TO TYPE</Typography>
              <Typography variant="caption" fontWeight="800" sx={{ color: theme?.mode === 'dark' ? '#94a3b8' : '#475569' }}>VISUAL RESULT</Typography>
            </Box>

            {/* Table rows */}
            {examples.map((item, idx) => (
              <Box 
                key={idx} 
                sx={{ 
                  display: 'grid', 
                  gridTemplateColumns: '1fr 1.25fr 1.25fr', 
                  gap: 2, 
                  alignItems: 'center', 
                  py: 0.5, 
                  borderBottom: '1px solid', 
                  borderColor: theme?.mode === 'dark' ? '#33415540' : '#e2e8f060' 
                }}
              >
                <Typography variant="body2" fontWeight="700" sx={{ fontSize: '0.85rem' }}>{item.type}</Typography>
                <Box 
                  sx={{ 
                    p: 0.75, 
                    borderRadius: 1.5, 
                    bgcolor: theme?.mode === 'dark' ? '#0f172a50' : '#f8fafc',
                    border: '1px solid',
                    borderColor: theme?.mode === 'dark' ? '#33415580' : '#e2e8f0',
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                    whiteSpace: 'pre-wrap',
                    color: theme?.mode === 'dark' ? '#38bdf8' : '#0284c7',
                  }}
                >
                  {item.typeCode}
                </Box>
                <Box>{item.render}</Box>
              </Box>
            ))}
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2, pt: 1 }}>
        <Button 
          onClick={onClose} 
          variant="contained" 
          fullWidth
          sx={{ 
            borderRadius: 3, 
            py: 1,
            textTransform: 'none', 
            fontWeight: 800,
            background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
            boxShadow: '0 4px 10px rgba(37, 99, 235, 0.3)',
            '&:hover': {
              boxShadow: '0 6px 14px rgba(37, 99, 235, 0.5)',
            }
          }}
        >
          Got it, thanks!
        </Button>
      </DialogActions>
    </Dialog>
  );
}

interface NoteInputProps {
  variant?: 'default' | 'compact';
  noteId?: string;
  initialContent?: string;
  initialIsImportant?: boolean;
  initialIsFav?: boolean;
  onSaveSuccess?: (content: string) => void;
  onCancel?: () => void;
}

export default function NoteInput({ 
  variant = 'default',
  noteId,
  initialContent = '',
  initialIsImportant = false,
  initialIsFav = false,
  onSaveSuccess,
  onCancel,
}: NoteInputProps) {
  const [activeTab, setActiveTab] = useState<'notes'>('notes');
  const [noteContent, setNoteContent] = useState(initialContent);
  const [savingNote, setSavingNote] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const [noteFocused, setNoteFocused] = useState(!!noteId);
  const [isImportant, setIsImportant] = useState(initialIsImportant);
  const [isFav, setIsFav] = useState(initialIsFav);

  // Help Guide Dialog State
  const [helpOpen, setHelpOpen] = useState(false);

  // Editor mode: write vs live preview
  const [editorMode, setEditorMode] = useState<'write' | 'preview'>('write');

  const { theme } = useCustomTheme();
  const { user } = useAuth();
  const isCompact = variant === 'compact';
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const muiTheme = useMuiTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('sm'));

  // Sync props if editing asynchronously loaded note
  useEffect(() => {
    if (initialContent !== undefined) setNoteContent(initialContent);
    if (initialIsImportant !== undefined) setIsImportant(initialIsImportant);
    if (initialIsFav !== undefined) setIsFav(initialIsFav);
  }, [initialContent, initialIsImportant, initialIsFav]);

  // Insert formatting wrappers at cursor / selection
  const insertFormatting = (prefix: string, suffix: string = '') => {
    const textarea = inputRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = noteContent;

    const selectedText = text.substring(start, end);
    const placeholder = suffix || 'Text';
    const replacement = prefix + (selectedText || placeholder) + (selectedText ? suffix : (suffix ? suffix : ''));

    const newContent = text.substring(0, start) + replacement + text.substring(end);
    setNoteContent(newContent);

    // Refocus and auto-select inserted placeholder/content
    setTimeout(() => {
      textarea.focus();
      const selectionStart = start + prefix.length;
      const selectionEnd = selectionStart + (selectedText || placeholder).length;
      textarea.setSelectionRange(selectionStart, selectionEnd);
    }, 0);
  };

  const handleSaveNote = async () => {
    if (!noteContent.trim() || !user?.uid || savingNote) return;

    setSavingNote(true);
    setNoteSaved(false);

    try {
      if (noteId) {
        // Updating existing note
        await updateDoc(doc(db, 'notes', noteId), {
          content: noteContent.trim(),
          isImportant,
          isFav,
          updatedAt: serverTimestamp(),
        });
        setNoteSaved(true);
        if (onSaveSuccess) {
          onSaveSuccess(noteContent.trim());
        }
      } else {
        // Creating new note
        const noteData: Omit<QuickNote, 'id'> = {
          userId: user.uid,
          content: noteContent.trim(),
          isImportant,
          isFav,
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
          setIsImportant(false);
          setIsFav(false);
          setNoteSaved(false);
        }, 1500);
      }
    } catch (error) {
      console.error('Error saving note:', error);
    } finally {
      setSavingNote(false);
    }
  };

  return (
    <Box>
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
        <Tab label={noteId ? 'Edit Quick Note' : 'Quick Notes'} value="notes" />
      </Tabs>

      {activeTab === 'notes' && (
        <Box>
          {/* Custom Editor Container Wrap */}
          <Box 
            sx={{ 
              border: '1px solid',
              borderColor: theme?.mode === 'dark' ? '#334155' : '#cbd5e1',
              borderRadius: 3,
              overflow: 'hidden',
              backgroundColor: theme?.mode === 'dark' ? '#0f172a' : '#ffffff',
              transition: 'all 0.2s ease',
              boxShadow: noteFocused ? '0 0 0 2px rgba(59, 130, 246, 0.2)' : 'none',
              '&:focus-within': {
                borderColor: theme?.mode === 'dark' ? '#3b82f6' : '#2563eb',
              }
            }}
          >
            {/* Editor Toolbar with Format Tools & Preview Switcher */}
            <Stack 
              direction="row" 
              justifyContent="space-between"
              alignItems="center"
              sx={{ 
                p: 0.75, 
                borderBottom: '1px solid',
                borderColor: theme?.mode === 'dark' ? '#334155' : '#cbd5e1',
                backgroundColor: theme?.mode === 'dark' ? '#1e293b50' : '#f8fafc',
                flexWrap: 'wrap',
                gap: 0.5,
              }}
            >
              {/* Insert format tags */}
              <Stack direction="row" spacing={0.25} alignItems="center" flexWrap="wrap">
                <Tooltip title="Bold (**text**)">
                  <span>
                    <IconButton size="small" onClick={() => insertFormatting('**', '**')} disabled={editorMode === 'preview'}>
                      <FormatBoldIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Italic (*text*)">
                  <span>
                    <IconButton size="small" onClick={() => insertFormatting('*', '*')} disabled={editorMode === 'preview'}>
                      <FormatItalicIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Strikethrough (~~text~~)">
                  <span>
                    <IconButton size="small" onClick={() => insertFormatting('~~', '~~')} disabled={editorMode === 'preview'}>
                      <FormatStrikethroughIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 0.5 }} />
                <Tooltip title="Header 1 (# text)">
                  <span>
                    <IconButton size="small" onClick={() => insertFormatting('# ', '')} disabled={editorMode === 'preview'}>
                      <TitleIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Header 2 (## text)">
                  <span>
                    <IconButton size="small" onClick={() => insertFormatting('## ', '')} disabled={editorMode === 'preview'}>
                      <TitleIcon fontSize="small" sx={{ transform: 'scale(0.8)' }} />
                    </IconButton>
                  </span>
                </Tooltip>
                <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 0.5 }} />
                <Tooltip title="Bullet List (- text)">
                  <span>
                    <IconButton size="small" onClick={() => insertFormatting('- ', '')} disabled={editorMode === 'preview'}>
                      <FormatListBulletedIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Numbered List (1. text)">
                  <span>
                    <IconButton size="small" onClick={() => insertFormatting('1. ', '')} disabled={editorMode === 'preview'}>
                      <FormatListNumberedIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Divider Line (---)">
                  <span>
                    <IconButton size="small" onClick={() => insertFormatting('\n---\n', '')} disabled={editorMode === 'preview'}>
                      <HorizontalRuleIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 0.5 }} />
                <Tooltip title="Formatting Help Guide">
                  <span>
                    <IconButton size="small" onClick={() => setHelpOpen(true)}>
                      <HelpOutlineIcon fontSize="small" color="primary" />
                    </IconButton>
                  </span>
                </Tooltip>
              </Stack>

              {/* Mode Selector */}
              <Stack direction="row" spacing={0.5}>
                <Button
                  size="small"
                  startIcon={<EditNoteIcon />}
                  variant={editorMode === 'write' ? 'contained' : 'text'}
                  onClick={() => setEditorMode('write')}
                  sx={{
                    px: 1.5,
                    py: 0.25,
                    fontSize: '0.75rem',
                    textTransform: 'none',
                    fontWeight: 700,
                    borderRadius: 1.5,
                    boxShadow: 'none',
                    '&:hover': { boxShadow: 'none' }
                  }}
                >
                  Write
                </Button>
                <Button
                  size="small"
                  startIcon={<VisibilityIcon />}
                  variant={editorMode === 'preview' ? 'contained' : 'text'}
                  onClick={() => setEditorMode('preview')}
                  sx={{
                    px: 1.5,
                    py: 0.25,
                    fontSize: '0.75rem',
                    textTransform: 'none',
                    fontWeight: 700,
                    borderRadius: 1.5,
                    boxShadow: 'none',
                    '&:hover': { boxShadow: 'none' }
                  }}
                >
                  Preview
                </Button>
              </Stack>
            </Stack>

            {/* Editable Screen / Live Preview Screen */}
            {editorMode === 'write' ? (
              <TextField
                inputRef={inputRef}
                multiline
                rows={
                  isMobile && noteId
                    ? undefined                         // mobile edit: use CSS height instead
                    : noteId
                      ? (isCompact ? 10 : 14)          // desktop edit — always tall
                      : noteFocused
                        ? (isCompact ? 4 : 6)           // new note focused
                        : (isCompact ? 2 : 4)           // new note idle
                }
                minRows={isMobile && noteId ? 20 : undefined}
                fullWidth
                placeholder="Start typing your note (supports Markdown: **bold**, *italic*, - list)..."
                value={noteContent}
                onFocus={() => setNoteFocused(true)}
                onBlur={() => {
                  if (!noteContent.trim()) setNoteFocused(false);
                }}
                onChange={(e) => setNoteContent(e.target.value)}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    fontSize: '1.05rem',
                    fontWeight: 500,
                    lineHeight: 1.7,
                    p: 2,
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                    color: theme?.mode === 'dark' ? '#cbd5e1' : '#0f172a',
                    '& fieldset': { border: 'none' },
                    // On mobile edit mode: stretch to fill remaining viewport height
                    ...(isMobile && noteId ? {
                      '& textarea': {
                        minHeight: 'calc(100dvh - 360px)',
                        resize: 'none',
                      },
                    } : {}),
                  },
                }}
              />
            ) : (
              <Box 
                sx={{ 
                  p: 2, 
                  minHeight: isMobile && noteId
                    ? 'calc(100dvh - 360px)'           // mobile edit — fill viewport
                    : noteId
                      ? (isCompact ? 260 : 364)        // desktop edit — always tall
                      : noteFocused
                        ? (isCompact ? 104 : 156)      // new note focused
                        : (isCompact ? 54 : 104),      // new note idle
                  maxHeight: isMobile && noteId ? 'none' : '400px',
                  overflowY: 'auto',
                  backgroundColor: theme?.mode === 'dark' ? '#0f172a' : '#fafafa',
                }}
              >
                {noteContent.trim() ? (
                  renderMarkdown(noteContent, theme?.mode)
                ) : (
                  <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                    Nothing to preview yet. Start typing in Write mode!
                  </Typography>
                )}
              </Box>
            )}
          </Box>

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
                <Box component="span" sx={{ fontSize: '1.5rem', color: theme?.mode === 'dark' ? '#34d399' : '#059669' }}>
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
                  {noteId ? 'Note updated successfully!' : 'Note saved successfully!'}
                </Box>
              </Box>
            </Fade>
          )}

          <Box
            sx={{
              mt: 2,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Stack direction="row" spacing={1}>
              <Tooltip title={isFav ? 'Remove from Favorites' : 'Add to Favorites'}>
                <IconButton
                  size="small"
                  onClick={() => setIsFav(!isFav)}
                  color={isFav ? 'warning' : 'default'}
                >
                  {isFav ? <StarIcon /> : <StarBorderIcon />}
                </IconButton>
              </Tooltip>
              <Tooltip title={isImportant ? 'Unmark as Important' : 'Mark as Important'}>
                <IconButton
                  size="small"
                  onClick={() => setIsImportant(!isImportant)}
                  color={isImportant ? 'error' : 'default'}
                >
                  <PriorityHighIcon sx={{ opacity: isImportant ? 1 : 0.3 }} />
                </IconButton>
              </Tooltip>
            </Stack>

            <Stack direction="row" spacing={1.5}>
              {onCancel && (
                <Button
                  variant="outlined"
                  onClick={onCancel}
                  disabled={savingNote}
                  sx={{
                    textTransform: 'none',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    borderRadius: 2,
                    px: 3,
                  }}
                >
                  Cancel
                </Button>
              )}
              <Button
                variant="contained"
                onClick={handleSaveNote}
                disabled={!noteContent.trim() || savingNote}
                sx={{
                  backgroundColor: theme?.mode === 'dark' ? '#3b82f6' : '#2563eb',
                  '&:hover': {
                    backgroundColor:
                      theme?.mode === 'dark' ? '#2563eb' : '#1d4ed8',
                  },
                  textTransform: 'none',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  borderRadius: 2,
                  px: 3,
                }}
              >
                {savingNote ? 'Saving...' : (noteId ? 'Save Edits' : 'Save Notes')}
              </Button>
            </Stack>
          </Box>
        </Box>
      )}

      {/* Guide Dialog Pop-up */}
      <MarkdownHelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </Box>
  );
}
