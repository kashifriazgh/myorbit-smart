'use client';

import {
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Stack,
  Button,
  CircularProgress,
  TextField,
  IconButton,
  Chip,
} from '@mui/material';
import { useEffect, useState, useCallback } from 'react';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { useAuth } from '@/app/lib/context/userContext';
import { Close as CloseIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { db } from '@/app/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import moment from 'moment';
import MoodSelector from './moodSelector';
import Slider from '@mui/material/Slider';

interface Props {
  open: boolean;
  onClose: () => void;
  rawText: string;
  onJournalCreated?: () => void;
}

type MoodType = 'happy' | 'loving' | 'sad' | 'heart-broken' | 'angry' | null;

interface EditableJournal {
  title: string;
  content: string;
  mood: MoodType;
  moodLevel: number;
  tags: string[];
}

interface ParsedJournalData {
  title?: string;
  content?: string;
  mood?: MoodType;
  moodLevel?: number;
  tags?: string[];
}

export default function JournalDraftModal({
  open,
  onClose,
  rawText,
  onJournalCreated,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [editableJournal, setEditableJournal] = useState<EditableJournal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');
  const { theme } = useCustomTheme();
  const { user } = useAuth();

  const defaultTitle = moment().format('dddd, DD MMMM YYYY');

  const parseAIResponse = (result: string): ParsedJournalData => {
    if (!result || typeof result !== 'string') {
      throw new Error('Empty or invalid AI response');
    }

    let cleanedResult = result.trim();
    cleanedResult = cleanedResult
      .replace(/```json\n?/gi, '')
      .replace(/```\n?/g, '')
      .trim();

    try {
      return JSON.parse(cleanedResult);
    } catch (e) {
      const jsonMatch = cleanedResult.match(/\{[\s\S]*\}/);
      console.log(e);
      if (jsonMatch) {
        try {
          const fixed = jsonMatch[0].replace(/,(\s*[}\]])/g, '$1');
          return JSON.parse(fixed);
        } catch (e2) {
          throw new Error('Could not parse AI response');
          console.log(e2);
        }
      }
      throw new Error('Could not parse AI response');
    }
  };

  const generateDraft = useCallback(async () => {
    if (!rawText.trim()) {
      setError('Please enter some text to generate a journal draft.');
      return;
    }

    setLoading(true);
    setError(null);

    const prompt = `
You are a productivity assistant. Analyze the following user input and extract journal entry information. Return ONLY a valid JSON object with the following structure. Do not include any explanation, markdown code blocks, or additional text - just the raw JSON object:

{
  "title": "string (optional, extract from text or create a meaningful title, can be empty string)",
  "content": "string (required, extract or use the main text content)",
  "mood": "happy" | "loving" | "sad" | "heart-broken" | "angry" | null (determine based on emotional keywords in text, can be null),
  "moodLevel": number (1-10, estimate based on intensity mentioned, default 5 if mood is set),
  "tags": ["string"] (extract relevant tags or keywords, can be empty array)
}

Guidelines for extraction:
- Title: Extract a title if mentioned, otherwise use empty string (will use date as default)
- Content: Use the main text content, cleaned up
- Mood: Look for emotional keywords like "happy", "sad", "angry", "excited", "down", etc.
  * happy/excited/good/great → happy
  * sad/down/depressed/low → sad
  * angry/mad/frustrated → angry
  * love/caring/affectionate → loving
  * heartbroken/broken/shattered → heart-broken
  * If no clear emotion → null
- MoodLevel: Estimate intensity (1-10), default 5 if mood is detected
- Tags: Extract keywords or topics mentioned, return as array

User input: "${rawText}"

CRITICAL: Return ONLY valid JSON, no markdown, no explanations, no additional text.
`.trim();

    try {
      const response = await fetch('/api/ideas/improve-idea', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          value: rawText,
          instructions: prompt,
        }),
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      const result = data.result || '';

      if (!result) {
        throw new Error('Empty response from AI');
      }

      let parsedData: ParsedJournalData;
      try {
        parsedData = parseAIResponse(result);
      } catch (parseError) {
        console.warn('AI response parsing failed, using defaults:', parseError);
        parsedData = {};
      }

      const validMoods: MoodType[] = ['happy', 'loving', 'sad', 'heart-broken', 'angry'];

      const draft: EditableJournal = {
        title: parsedData.title || '',
        content: parsedData.content || rawText || '',
        mood:
          parsedData.mood && validMoods.includes(parsedData.mood)
            ? parsedData.mood
            : null,
        moodLevel:
          parsedData.moodLevel &&
          parsedData.moodLevel >= 1 &&
          parsedData.moodLevel <= 10
            ? parsedData.moodLevel
            : parsedData.mood
            ? 5
            : 5,
        tags: Array.isArray(parsedData.tags) ? parsedData.tags : [],
      };

      setEditableJournal(draft);
    } catch (error) {
      console.error('Error generating draft:', error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to generate journal draft. Please try again.';

      setError(
        `AI parsing failed: ${errorMessage}. You can edit the fields below.`
      );

      const fallbackDraft: EditableJournal = {
        title: '',
        content: rawText || '',
        mood: null,
        moodLevel: 5,
        tags: [],
      };
      setEditableJournal(fallbackDraft);
    } finally {
      setLoading(false);
    }
  }, [rawText]);

  useEffect(() => {
    if (open && rawText.trim() && !editableJournal && !loading) {
      generateDraft();
    }
  }, [open, rawText, editableJournal, loading, generateDraft]);

  useEffect(() => {
    if (!open) {
      setEditableJournal(null);
      setError(null);
      setLoading(false);
      setTagInput('');
    }
  }, [open]);

  const handleInputChange = (field: keyof EditableJournal, value: string | MoodType | number | string[]) => {
    setEditableJournal((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        [field]: value,
      };
    });
  };

  const handleAddTag = () => {
    const clean = tagInput.trim();
    if (clean && editableJournal && !editableJournal.tags?.includes(clean)) {
      handleInputChange('tags', [...(editableJournal.tags || []), clean]);
      setTagInput('');
    }
  };

  const handleDeleteTag = (index: number) => {
    if (editableJournal?.tags) {
      handleInputChange(
        'tags',
        editableJournal.tags.filter((_, i: number) => i !== index)
      );
    }
  };

  const handleConfirmSave = async () => {
    if (!editableJournal || !user) {
      setError('Missing journal data or user information.');
      return;
    }

    if (!editableJournal.content?.trim()) {
      setError('Content is required.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const finalTitle = editableJournal.title?.trim() || defaultTitle;

      const journal = {
        userId: user.uid,
        authorName: user.firstName || '',
        createdAt: serverTimestamp(),
        mood: editableJournal.mood
          ? {
              type: editableJournal.mood,
              level: editableJournal.moodLevel || 5,
            }
          : null,
        title: finalTitle,
        content: editableJournal.content.trim(),
        tags: editableJournal.tags || [],
        privacy: 'private',
      };

      await addDoc(collection(db, 'journals'), journal);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('journalCreated'));
      }

      if (onJournalCreated) {
        onJournalCreated();
      }

      onClose();
    } catch (error) {
      console.error('Error saving journal:', error);
      setError('Failed to save journal. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: theme?.mode === 'dark' ? '#1e293b' : '#ffffff',
          color: theme?.mode === 'dark' ? '#f1f5f9' : '#0f172a',
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
          Edit Journal Draft
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        {loading && !editableJournal && (
          <Box
            display="flex"
            flexDirection="column"
            alignItems="center"
            gap={2}
            py={4}
          >
            <CircularProgress />
            <Typography variant="body2" color="text.secondary">
              Analyzing your input and generating journal entry...
            </Typography>
          </Box>
        )}

        {error && (
          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              backgroundColor: theme?.mode === 'dark' ? '#7f1d1d' : '#fee2e2',
              color: theme?.mode === 'dark' ? '#fca5a5' : '#991b1b',
              mb: 2,
            }}
          >
            <Typography variant="body2">{error}</Typography>
          </Box>
        )}

        {editableJournal && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextField
              fullWidth
              label="Title (Optional)"
              value={editableJournal.title || ''}
              onChange={(e) => handleInputChange('title', e.target.value)}
              variant="outlined"
              size="medium"
              placeholder={`Default: ${defaultTitle}`}
            />

            <TextField
              fullWidth
              label="Content *"
              value={editableJournal.content || ''}
              onChange={(e) => handleInputChange('content', e.target.value)}
              required
              variant="outlined"
              size="medium"
              multiline
              rows={6}
              placeholder="What happened today?"
            />

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                Mood
              </Typography>
              <MoodSelector
                selectedMood={editableJournal.mood}
                onSelect={(val) => handleInputChange('mood', val)}
              />
            </Box>

            {editableJournal.mood && (
              <Box px={2}>
                <Typography gutterBottom>
                  How strong is your {editableJournal.mood} feeling?
                </Typography>
                <Slider
                  value={editableJournal.moodLevel || 5}
                  onChange={(_, val) => handleInputChange('moodLevel', val)}
                  min={1}
                  max={10}
                  valueLabelDisplay="auto"
                />
              </Box>
            )}

            <Stack direction="row" spacing={1} alignItems="center">
              <TextField
                label="Add Tag"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                fullWidth
              />
              <Button onClick={handleAddTag}>Add</Button>
            </Stack>

            {editableJournal.tags && editableJournal.tags.length > 0 && (
              <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
                {editableJournal.tags.map((tag: string, idx: number) => (
                  <Chip
                    key={idx}
                    label={`#${tag}`}
                    onDelete={() => handleDeleteTag(idx)}
                    deleteIcon={<DeleteIcon />}
                    sx={{
                      bgcolor: theme?.mode === 'dark' ? '#334155' : undefined,
                      color: theme?.mode === 'dark' ? '#e2e8f0' : undefined,
                    }}
                  />
                ))}
              </Stack>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 3, gap: 1 }}>
        <Button onClick={onClose} variant="outlined" disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleConfirmSave}
          variant="contained"
          disabled={loading || !editableJournal?.content?.trim()}
          sx={{
            backgroundColor: theme?.mode === 'dark' ? '#3b82f6' : '#2563eb',
            '&:hover': {
              backgroundColor: theme?.mode === 'dark' ? '#2563eb' : '#1d4ed8',
            },
          }}
        >
          {loading ? <CircularProgress size={20} /> : 'Save Entry'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
