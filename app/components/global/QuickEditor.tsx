'use client';

import { useEffect, useState } from 'react';
import { Editor, EditorContent } from '@tiptap/react';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import Mention from '@tiptap/extension-mention';
import tippy from 'tippy.js';
import 'tippy.js/dist/tippy.css';
import { Button, Box, Alert } from '@mui/material';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { useAuth } from '@/app/lib/context/userContext';
import ScheduleDraftModal from '../homepage/ScheduleDraftModal';
import TaskDraftModal from '../to-do/TaskDraftModal';
import JournalDraftModal from '../journal/JournalDraftModal';
import ExpenseDraftModal from '../finance/utilsCompos/ExpenseDraftModal';
import ShoppingDraftModal from '../homepage/ShoppingDraftModal';
import IncomeDraftModal from '../finance/utilsCompos/IncomeDraftModal';
import StreakDraftModal from '../streaks/StreakDraftModal';
import TimeTableDraftModal from '../time-table/TimeTableDraftModal';
import IdeaDraftModal from '../ideas/IdeaDraftModal';
import GoalDraftModal from '../goals/GoalDraftModal';

import {
  detectMentionType,
  cleanContentForAI,
  ContentType,
} from '@/app/lib/utils/mentionDetector';

export default function ProductivityEditor() {
  const [editor, setEditor] = useState<Editor | null>(null);
  const [rawText, setRawText] = useState('');
  const [mentionType, setMentionType] = useState<ContentType>(null);
  const [draftModalType, setDraftModalType] = useState<ContentType>(null);
  const [showMentionError, setShowMentionError] = useState(false);
  const { theme } = useCustomTheme();
  const { user } = useAuth();

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
              const options = [
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
              return options
                .filter((item) =>
                  item.label.toLowerCase().includes(query.toLowerCase())
                )
                .slice(0, 10);
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

  const handleShowDraft = () => {
    const text = editor?.getText() || '';
    if (!text.trim()) {
      return;
    }

    const detectedType = detectMentionType(text);

    if (!detectedType) {
      setShowMentionError(true);
      setTimeout(() => setShowMentionError(false), 3000);
      return;
    }

    setDraftModalType(detectedType);
  };

  const handleQuickSave = async () => {
    const text = editor?.getText() || '';
    if (!text.trim() || !user) {
      return;
    }

    const detectedType = detectMentionType(text);

    if (!detectedType) {
      setShowMentionError(true);
      setTimeout(() => setShowMentionError(false), 3000);
      return;
    }

    // Quick Save: Route to draft modal for now (will be enhanced to save directly in future)
    // For now, showing draft allows users to review and edit before saving
    setDraftModalType(detectedType);
  };

  const handleCloseModal = () => {
    setDraftModalType(null);
  };

  const handleItemCreated = () => {
    // Clear editor after successful creation
    if (editor) {
      editor.commands.clearContent();
      setRawText('');
      setMentionType(null);
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
      <Box
        sx={{
          position: 'relative',
          border: `1px solid ${theme?.mode === 'dark' ? '#475569' : '#cbd5e1'}`,
          borderRadius: 2,
          backgroundColor: theme?.mode === 'dark' ? '#1e293b' : '#ffffff',
          minHeight: '100px',
          maxHeight: '300px',
          overflowY: 'auto',
          shadow: 1,
          transition: 'all 0.2s',
          '&:focus-within': {
            borderColor: theme?.mode === 'dark' ? '#3b82f6' : '#2563eb',
            boxShadow: `0 0 0 2px ${
              theme?.mode === 'dark' ? '#3b82f6' : '#2563eb'
            }40`,
          },
        }}
      >
        {!rawText && (
          <Box
            sx={{
              position: 'absolute',
              top: '16px',
              left: '16px',
              color: theme?.mode === 'dark' ? '#64748b' : '#94a3b8',
              pointerEvents: 'none',
              fontSize: '0.875rem',
              zIndex: 0,
            }}
          >
            Type your content and use @ to mention type (Task, Journal,
            Schedule, Expense, Shopping, Income, Streak, Time Table, Idea, Goal,
            Money)...
          </Box>
        )}
        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <EditorContent
            editor={editor}
            className="
              ProseMirror
              w-full
              min-h-[100px]
              p-4
              outline-none
              block
              break-words
              whitespace-pre-wrap
              focus:outline-none
            "
            style={{
              color: theme?.mode === 'dark' ? '#f1f5f9' : '#0f172a',
            }}
          />
        </Box>
      </Box>

      {showMentionError && (
        <Alert
          severity="warning"
          sx={{ mt: 1 }}
          onClose={() => setShowMentionError(false)}
        >
          Please use @ to mention the content type (e.g., @task, @journal,
          @schedule, @expense, @shopping, @income, @streak, @timetable, @idea,
          @goal, @money)
        </Alert>
      )}

      {mentionType && (
        <Box sx={{ mt: 1, mb: 1 }}>
          <Alert severity="info" sx={{ py: 0.5 }}>
            Detected:{' '}
            <strong>
              {mentionType.charAt(0).toUpperCase() + mentionType.slice(1)}
            </strong>
          </Alert>
        </Box>
      )}

      <Box
        sx={{
          mt: 2,
          display: 'flex',
          gap: 1,
          justifyContent: 'flex-end',
          flexWrap: 'wrap',
        }}
      >
        <Button
          variant="outlined"
          onClick={handleQuickSave}
          disabled={!rawText.trim() || !mentionType}
          size="small"
          sx={{
            textTransform: 'none',
            fontSize: '0.875rem',
          }}
        >
          Quick Save
        </Button>
        <Button
          variant="contained"
          onClick={handleShowDraft}
          disabled={!rawText.trim() || !mentionType}
          size="small"
          sx={{
            backgroundColor: theme?.mode === 'dark' ? '#3b82f6' : '#2563eb',
            '&:hover': {
              backgroundColor: theme?.mode === 'dark' ? '#2563eb' : '#1d4ed8',
            },
            textTransform: 'none',
            fontSize: '0.875rem',
          }}
        >
          Show me Draft
        </Button>
      </Box>

      {/* Schedule Draft Modal */}
      <ScheduleDraftModal
        open={draftModalType === 'schedule'}
        onClose={handleCloseModal}
        rawText={cleanContentForAI(rawText)}
        onScheduleCreated={handleItemCreated}
      />

      {/* Task Draft Modal */}
      <TaskDraftModal
        open={draftModalType === 'task'}
        onClose={handleCloseModal}
        rawText={cleanContentForAI(rawText)}
        onTaskCreated={handleItemCreated}
      />

      {/* Journal Draft Modal */}
      <JournalDraftModal
        open={draftModalType === 'journal'}
        onClose={handleCloseModal}
        rawText={cleanContentForAI(rawText)}
        onJournalCreated={handleItemCreated}
      />

      {/* Expense Draft Modal */}
      <ExpenseDraftModal
        open={draftModalType === 'expense'}
        onClose={handleCloseModal}
        rawText={cleanContentForAI(rawText)}
        onExpenseCreated={handleItemCreated}
      />

      {/* Shopping Draft Modal */}
      <ShoppingDraftModal
        open={draftModalType === 'shopping'}
        onClose={handleCloseModal}
        rawText={cleanContentForAI(rawText)}
        onShoppingItemCreated={handleItemCreated}
      />

      {/* Income Draft Modal */}
      <IncomeDraftModal
        open={draftModalType === 'income'}
        onClose={handleCloseModal}
        rawText={cleanContentForAI(rawText)}
        onIncomeCreated={handleItemCreated}
      />

      {/* Streak Draft Modal */}
      <StreakDraftModal
        open={draftModalType === 'streak'}
        onClose={handleCloseModal}
        rawText={cleanContentForAI(rawText)}
        onStreakCreated={handleItemCreated}
      />

      {/* Time Table Draft Modal */}
      <TimeTableDraftModal
        open={draftModalType === 'timetable'}
        onClose={handleCloseModal}
        rawText={cleanContentForAI(rawText)}
        onTimeTableCreated={handleItemCreated}
      />

      {/* Idea Draft Modal */}
      <IdeaDraftModal
        open={draftModalType === 'idea'}
        onClose={handleCloseModal}
        rawText={cleanContentForAI(rawText)}
        onIdeaCreated={handleItemCreated}
      />

      {/* Goal Draft Modal */}
      <GoalDraftModal
        open={draftModalType === 'goal'}
        onClose={handleCloseModal}
        rawText={cleanContentForAI(rawText)}
        onGoalCreated={handleItemCreated}
      />

      {/* Add Money Draft Modal - Note: This requires onSave prop from parent */}
      {/* For now, we'll show a message that this needs to be done from the finance page */}
    </Box>
  );
}
