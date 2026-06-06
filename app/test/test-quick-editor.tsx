'use client';

import { useEffect, useState } from 'react';
import { Editor } from '@tiptap/react';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import Mention from '@tiptap/extension-mention';
import tippy from 'tippy.js';
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
// import ScheduleDraftModal from '../homepage/ScheduleDraftModal';
// import TaskDraftModal from '../to-do/TaskDraftModal';
// import JournalDraftModal from '../journal/JournalDraftModal';
// import ExpenseDraftModal from '../finance/utilsCompos/ExpenseDraftModal';
// import ShoppingDraftModal from '../homepage/ShoppingDraftModal';
// import IncomeDraftModal from '../finance/utilsCompos/IncomeDraftModal';
// import StreakDraftModal from '../streaks/StreakDraftModal';
// import TimeTableDraftModal from '../time-table/TimeTableDraftModal';
// import IdeaDraftModal from '../ideas/IdeaDraftModal';

import {
  detectMentionType,
  ContentType,
} from '@/app/lib/utils/mentionDetector';

const MENTION_OPTIONS = [
  { id: 'task', label: 'Task' },
  { id: 'journal', label: 'Journal' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'expense', label: 'Expense' },
  { id: 'shopping', label: 'Shopping' },
  { id: 'income', label: 'Income' },
  { id: 'streak', label: 'Streak' },
  { id: 'timetable', label: 'Time Table' },
  { id: 'idea', label: 'Idea' },
  { id: 'goal', label: 'Goal' },
  { id: 'money', label: 'Add Money' },
];

const KEYWORD_TRIGGER_WORDS = [
  'task',
  'todo',
  'journal',
  'schedule',
  'expense',
  'shopping',
  'income',
  'streak',
  'timetable',
  'time table',
  'idea',
  'goal',
  'money',
  'addmoney',
  'add money',
];

const PLACEHOLDER_LINES = [
  '@task Call local store tomorrow 11',
  '@schedule Meeting with team members at 12:30 pm',
  '@goal Finish quarterly planning before Friday',
  '@idea Launch creative marketing hook for summer campaign',
];

// interface ParsedTaskQuickSave {
//   title?: string;
//   description?: string;
//   priority?: 'routine' | 'urgent' | 'critical';
//   dueDate?: string;
// }

// const parseAiJson = <T,>(result: string): Partial<T> => {
//   if (!result || typeof result !== 'string') {
//     return {};
//   }

//   const cleaned = result
//     .trim()
//     .replace(/```json\n?/gi, '')
//     .replace(/```\n?/g, '')
//     .trim();

//   try {
//     return JSON.parse(cleaned) as T;
//   } catch (error) {
//     console.log(error);
//     const match = cleaned.match(/\{[\s\S]*\}/);
//     if (match) {
//       try {
//         const fixed = match[0].replace(/,(\s*[}\]])/g, '$1');
//         return JSON.parse(fixed) as T;
//       } catch {
//         return {};
//       }
//     }
//   }
//   return {};
// };

// const getTomorrowDate = () => {
//   const tomorrow = new Date();
//   tomorrow.setDate(tomorrow.getDate() + 1);
//   return tomorrow;
// };

// const quickSaveTask = async (rawText: string, user: FirestoreUser) => {
//   const prompt = `
// You are a productivity assistant. Analyze the following user input and extract task information. Return ONLY a valid JSON object with the following structure. Do not include any explanation, markdown code blocks, or additional text - just the raw JSON object:

// {
//   "title": "string (required, extract from text or create a meaningful title)",
//   "description": "string (optional, extract description if mentioned, otherwise empty string)",
//   "priority": "routine" | "urgent" | "critical" (determine based on urgency keywords in text, default "routine"),
//   "dueDate": "YYYY-MM-DD format (extract from text, default to tomorrow if not specified)"
// }

// Guidelines for extraction:
// - Title: Extract the main task or create a meaningful title based on the activity
// - Description: Extract additional details if mentioned, otherwise use empty string
// - Priority:
//   * "critical" or "urgent" or "asap" or "emergency" → critical
//   * "important" or "high priority" or "soon" → urgent
//   * Default → routine
// - DueDate: Look for keywords like "today", "tomorrow", "Monday", specific dates. If not found, use tomorrow.

// Current date context: ${new Date().toISOString().split('T')[0]}
// Tomorrow date: ${getTomorrowDate().toISOString().split('T')[0]}

// User input: "${rawText}"

// CRITICAL: Return ONLY valid JSON, no markdown, no explanations, no additional text.
// `.trim();

//   const response = await fetch('/api/ideas/improve-idea', {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({
//       value: rawText,
//       instructions: prompt,
//     }),
//   });

//   if (!response.ok) {
//     throw new Error(`AI request failed (${response.status}).`);
//   }

//   const data = await response.json();
//   const result = data.result || '';
//   const parsed = parseAiJson<ParsedTaskQuickSave>(result);

//   const dueDate =
//     parsed.dueDate && !Number.isNaN(new Date(parsed.dueDate).getTime())
//       ? new Date(parsed.dueDate)
//       : getTomorrowDate();

//   const docData = {
//     title: parsed.title?.trim() || rawText.substring(0, 50) || 'Untitled Task',
//     description: parsed.description || '',
//     priority: parsed.priority || 'routine',
//     status: 'in_progress',
//     progressPercent: 0,
//     pinned: false,
//     isArchived: false,
//     authorId: user.uid,
//     authorName: user.firstName || '',
//     assignedUsers: [],
//     sharedWith: [],
//     startDate: Timestamp.fromDate(new Date()),
//     dueDate: Timestamp.fromDate(dueDate),
//     createdAt: serverTimestamp(),
//     updatedAt: serverTimestamp(),
//     privacy: 'private',
//     isImportant: false,
//     steps: [],
//   };

//   await addDoc(collection(db, 'todos'), docData);

//   if (typeof window !== 'undefined') {
//     window.dispatchEvent(new CustomEvent('taskCreated'));
//   }

//   return docData.title;
// };

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
  // const [editorFocused, setEditorFocused] = useState(false);

  const [editor, setEditor] = useState<Editor | null>(null);
  const [rawText, setRawText] = useState('');
  const [mentionType, setMentionType] = useState<ContentType>(null);
  const [showMentionError, setShowMentionError] = useState(false);
  const [placeholderContent, setPlaceholderContent] = useState('');
  const [placeholderLineIndex, setPlaceholderLineIndex] = useState(0);
  const [placeholderCharIndex, setPlaceholderCharIndex] = useState(0);
  const [showKeywordSuggestions, setShowKeywordSuggestions] = useState(false);
  const [keywordSuggestionUsed, setKeywordSuggestionUsed] = useState(false);
  const [quickSaveError, setQuickSaveError] = useState<string | null>(null);
  const { theme } = useCustomTheme();
  const { user } = useAuth();
  const isCompact = variant === 'compact';

  // Just testing
  console.log(
    mentionType,

    showMentionError,
    rawText,

    quickSaveError,
  );
  // Collapsed state for editor content
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    // --- Custom Mention Extension to style mentions properly ---
    const CustomMention = Mention.extend({
      renderHTML({ node, HTMLAttributes }) {
        return [
          'span',
          {
            ...HTMLAttributes,
            class:
              'bg-blue-100 text-blue-600 px-2 py-1 rounded-full font-semibold text-lg',
          },
          `@${node.attrs.label}`,
        ];
      },
    });

    const e = new Editor({
      extensions: [
        Document,
        Paragraph,
        Text,
        CustomMention.configure({
          suggestion: {
            items: ({ query }) => {
              return MENTION_OPTIONS.filter((item) =>
                item.label.toLowerCase().includes(query.toLowerCase()),
              ).slice(0, 10);
            },
            render: () => {
              let popup: ReturnType<typeof tippy> | null = null;
              let root: HTMLDivElement;

              interface MentionItem {
                id: string;
                label: string;
              }

              type MentionProps = {
                items: MentionItem[];
                command: (item: MentionItem) => void;
                clientRect?: () => DOMRect | null;
              };

              return {
                onStart: (props: MentionProps) => {
                  root = document.createElement('div');
                  root.className =
                    'bg-white border border-gray-200 rounded-lg shadow-lg p-1 text-sm w-48';

                  props.items.forEach((item: MentionItem) => {
                    const div = document.createElement('div');
                    div.className =
                      'px-3 py-2 cursor-pointer text-gray-800 hover:bg-blue-50 rounded transition-colors';
                    div.textContent = item.label;
                    div.onclick = () => props.command(item);
                    root.appendChild(div);
                  });

                  popup = tippy('body', {
                    getReferenceClientRect: props.clientRect || (() => null),
                    appendTo: () => document.body,
                    content: root,
                    showOnCreate: true,
                    interactive: true,
                    placement: 'bottom-start',
                    theme: 'light-border',
                  });
                },
                onUpdate(props: MentionProps) {
                  while (root.firstChild) root.removeChild(root.firstChild);

                  props.items.forEach((item: MentionItem) => {
                    const div = document.createElement('div');
                    div.className =
                      'px-3 py-2 cursor-pointer text-gray-800 hover:bg-blue-50 rounded transition-colors';
                    div.textContent = item.label;
                    div.onclick = () => props.command(item);
                    root.appendChild(div);
                  });

                  if (popup && popup[0] && props.clientRect) {
                    popup[0].setProps({
                      getReferenceClientRect: props.clientRect,
                    });
                  }
                },
                onExit() {
                  if (popup && popup[0]) {
                    popup[0].destroy();
                  }
                },
              } as {
                onStart: (props: {
                  items: MentionItem[];
                  command: (item: MentionItem) => void;
                  clientRect?: () => DOMRect | null;
                }) => void;
                onUpdate: (props: {
                  items: MentionItem[];
                  command: (item: MentionItem) => void;
                  clientRect?: () => DOMRect | null;
                }) => void;
                onExit: () => void;
              };
            },
          },
        }),
      ],
      content: '<p></p>',
      autofocus: false,
      editable: true,
    });

    setEditor(e);
    return () => e.destroy();
  }, []);

  // Update rawText and detect mention type when editor content changes
  useEffect(() => {
    if (!editor) return;

    const updateText = () => {
      const text = editor.getText();
      setRawText(text);

      // Detect mention type
      const detectedType = detectMentionType(text);
      setMentionType(detectedType);
      setShowMentionError(false);
    };

    editor.on('update', updateText);
    updateText(); // Initial update

    return () => {
      editor.off('update', updateText);
    };
  }, [editor]);

  useEffect(() => {
    if (!isCompact || rawText) {
      if (placeholderContent) {
        setPlaceholderContent('');
      }
      if (placeholderLineIndex !== 0) {
        setPlaceholderLineIndex(0);
      }
      if (placeholderCharIndex !== 0) {
        setPlaceholderCharIndex(0);
      }
      return;
    }

    const currentLine = PLACEHOLDER_LINES[placeholderLineIndex] || '';
    let typingTimeout: ReturnType<typeof setTimeout>;

    if (placeholderCharIndex < currentLine.length) {
      typingTimeout = setTimeout(() => {
        setPlaceholderContent(
          (prev) => prev + currentLine[placeholderCharIndex],
        );
        setPlaceholderCharIndex((prev) => prev + 1);
      }, 75);
    } else {
      typingTimeout = setTimeout(
        () => {
          if (placeholderLineIndex < PLACEHOLDER_LINES.length - 1) {
            setPlaceholderContent((prev) =>
              prev.endsWith('\n') ? prev : `${prev}\n`,
            );
            setPlaceholderLineIndex((prev) => prev + 1);
            setPlaceholderCharIndex(0);
          } else {
            setPlaceholderContent('');
            setPlaceholderLineIndex(0);
            setPlaceholderCharIndex(0);
          }
        },
        placeholderLineIndex === PLACEHOLDER_LINES.length - 1 ? 1500 : 300,
      );
    }

    return () => {
      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }
    };
  }, [
    isCompact,
    rawText,
    placeholderCharIndex,
    placeholderLineIndex,
    placeholderContent,
  ]);

  useEffect(() => {
    if (!editor || keywordSuggestionUsed) {
      if (showKeywordSuggestions) {
        setShowKeywordSuggestions(false);
      }
      return;
    }

    const handleKeywordSuggestions = () => {
      if (!editor) return;

      const text = editor.getText();
      if (text.includes('@')) {
        if (showKeywordSuggestions) {
          setShowKeywordSuggestions(false);
        }
        return;
      }

      const { from } = editor.state.selection;
      const textUntilCursor = editor.state.doc.textBetween(0, from, '\n', '\n');
      const lastWordMatch = textUntilCursor.match(/(\w{3,})$/);
      const lastWord = lastWordMatch ? lastWordMatch[1].toLowerCase() : '';
      const lastTwoWordsMatch = textUntilCursor.match(/(\w+\s+\w+)$/);
      const lastTwoWords = lastTwoWordsMatch
        ? lastTwoWordsMatch[1].toLowerCase().trim()
        : '';
      const lastTwoWordsNoSpace = lastTwoWords.replace(/\s+/g, '');

      if (
        KEYWORD_TRIGGER_WORDS.includes(lastWord) ||
        KEYWORD_TRIGGER_WORDS.includes(lastTwoWords) ||
        KEYWORD_TRIGGER_WORDS.includes(lastTwoWordsNoSpace)
      ) {
        setShowKeywordSuggestions(true);
      } else if (showKeywordSuggestions) {
        setShowKeywordSuggestions(false);
      }
    };

    editor.on('update', handleKeywordSuggestions);
    return () => {
      editor.off('update', handleKeywordSuggestions);
    };
  }, [editor, keywordSuggestionUsed, showKeywordSuggestions]);

  useEffect(() => {
    if (!rawText.trim()) {
      setKeywordSuggestionUsed(false);
      setShowKeywordSuggestions(false);
    }
  }, [rawText]);

  // const handleKeywordSuggestionSelect = (itemId: string) => {
  //   if (!editor) return;

  //   const { from } = editor.state.selection;
  //   let start = from;

  //   while (start > 0) {
  //     const char = editor.state.doc.textBetween(start - 1, start, '\n', '\n');
  //     if (/\s/.test(char)) {
  //       break;
  //     }
  //     start -= 1;
  //   }

  //   editor
  //     .chain()
  //     .focus()
  //     .deleteRange({ from: start, to: from })
  //     .insertContent(`@${itemId} `)
  //     .run();

  //   setKeywordSuggestionUsed(true);
  //   setShowKeywordSuggestions(false);
  // };

  // const handleShowDraft = () => {
  //   const text = editor?.getText() || '';
  //   if (!text.trim()) {
  //     return;
  //   }

  //   const detectedType = detectMentionType(text);

  //   if (!detectedType) {
  //     setShowMentionError(true);
  //     setTimeout(() => setShowMentionError(false), 3000);
  //     return;
  //   }

  //   setDraftModalType(detectedType);
  // };

  // const handleQuickSave = async () => {
  //   const text = editor?.getText() || '';
  //   if (!text.trim() || !user) {
  //     return;
  //   }

  //   const detectedType = detectMentionType(text);

  //   if (!detectedType) {
  //     setShowMentionError(true);
  //     setTimeout(() => setShowMentionError(false), 3000);
  //     return;
  //   }

  //   setQuickSaving(true);
  setQuickSaveError(null);
  //   setQuickSaveMessage(null);

  //   try {
  //     const cleanedText = cleanContentForAI(text);

  //     switch (detectedType) {
  //       case 'task': {
  //         const savedTitle = await quickSaveTask(cleanedText, user);
  //         setQuickSaveMessage(`Quick saved task "${savedTitle}".`);
  //         handleItemCreated();
  //         break;
  //       }
  //       default: {
  //         setQuickSaveError(
  //           'Quick Save currently supports @task entries. Use "Show me Draft" for other types.',
  //         );
  //         break;
  //       }
  //     }
  //   } catch (error) {
  //     console.error('Quick save failed:', error);
  //     setQuickSaveError(
  //       error instanceof Error
  //         ? error.message
  //         : 'Quick Save failed. Please try again.',
  //     );
  //   } finally {
  //     setQuickSaving(false);
  //   }
  // };

  // const handleCloseModal = () => {
  //   setDraftModalType(null);
  // };

  // const handleItemCreated = () => {
  //   // Clear editor after successful creation
  //   if (editor) {
  //     editor.commands.clearContent();
  //     setRawText('');
  //     setMentionType(null);
  //   }
  //   setKeywordSuggestionUsed(false);
  //   setShowKeywordSuggestions(false);
  // };

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
            <Tab label="Quick Editor" value="editor" />
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

          {/* Quick Editor Tab */}
          {activeTab === 'editor' && (
            <Box>
              {/* ...existing code... */}
              {/* The entire Quick Editor tab content remains unchanged here */}
              {/* ...existing code... */}
            </Box>
          )}
        </>
      )}
    </Box>
  );
}
