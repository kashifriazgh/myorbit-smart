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
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { useEffect, useState, useCallback } from 'react';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { useAuth } from '@/app/lib/context/userContext';
import { Close as CloseIcon } from '@mui/icons-material';
import { db } from '@/app/lib/firebase';
import {
  collection,
  addDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import moment from 'moment-timezone';

type IdeaLevel = 'super' | 'important' | 'general';
type Privacy = 'private' | 'public';

interface Props {
  open: boolean;
  onClose: () => void;
  rawText: string;
  onIdeaCreated?: () => void;
}

interface EditableIdea {
  text: string;
  tags: string[];
  level: IdeaLevel;
  privacy: Privacy;
}

interface ParsedIdeaData {
  text?: string;
  tags?: string[];
  level?: IdeaLevel;
  privacy?: Privacy;
}

export default function IdeaDraftModal({
  open,
  onClose,
  rawText,
  onIdeaCreated,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [editableIdea, setEditableIdea] = useState<EditableIdea | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');
  const { theme } = useCustomTheme();
  const { user } = useAuth();

  const parseAIResponse = (result: string): ParsedIdeaData => {
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
      setError('Please enter some text to generate an idea draft.');
      return;
    }

    setLoading(true);
    setError(null);

    const prompt = `
You are a productivity assistant. Analyze the following user input and extract idea information. Return ONLY a valid JSON object with the following structure. Do not include any explanation, markdown code blocks, or additional text - just the raw JSON object:

{
  "text": "string (required, extract or use the main idea text)",
  "tags": ["string"] (extract relevant tags or keywords, can be empty array),
  "level": "super" | "important" | "general" (determine based on keywords in text, default "general"),
  "privacy": "private" | "public" (default "private")
}

Guidelines for extraction:
- Text: Use the main idea text, cleaned up
- Tags: Extract keywords or topics mentioned, return as array
- Level: 
  * "super" or "critical" or "urgent" or "amazing" → super
  * "important" or "significant" or "valuable" → important
  * Default → general
- Privacy: Default to "private"

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

      let parsedData: ParsedIdeaData;
      try {
        parsedData = parseAIResponse(result);
      } catch (parseError) {
        console.warn('AI response parsing failed, using defaults:', parseError);
        parsedData = {};
      }

      const validLevels: IdeaLevel[] = ['super', 'important', 'general'];
      const validPrivacy: Privacy[] = ['private', 'public'];

      const draft: EditableIdea = {
        text: parsedData.text || rawText || '',
        tags: Array.isArray(parsedData.tags) ? parsedData.tags : [],
        level: validLevels.includes(parsedData.level)
          ? parsedData.level
          : 'general',
        privacy: validPrivacy.includes(parsedData.privacy)
          ? parsedData.privacy
          : 'private',
      };

      setEditableIdea(draft);
    } catch (error) {
      console.error('Error generating draft:', error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to generate idea draft. Please try again.';

      setError(
        `AI parsing failed: ${errorMessage}. You can edit the fields below.`
      );

      const fallbackDraft: EditableIdea = {
        text: rawText || '',
        tags: [],
        level: 'general',
        privacy: 'private',
      };
      setEditableIdea(fallbackDraft);
    } finally {
      setLoading(false);
    }
  }, [rawText]);

  useEffect(() => {
    if (open && rawText.trim() && !editableIdea && !loading) {
      generateDraft();
    }
  }, [open, rawText, editableIdea, loading, generateDraft]);

  useEffect(() => {
    if (!open) {
      setEditableIdea(null);
      setError(null);
      setLoading(false);
      setTagInput('');
    }
  }, [open]);

  const handleInputChange = (
    field: keyof EditableIdea,
    value: string | string[] | IdeaLevel | Privacy
  ) => {
    setEditableIdea((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        [field]: value,
      };
    });
  };

  const handleTagAdd = () => {
    const t = tagInput.trim();
    if (t && editableIdea && !editableIdea.tags?.includes(t)) {
      handleInputChange('tags', [...(editableIdea.tags || []), t]);
      setTagInput('');
    }
  };

  const handleConfirmSave = async () => {
    if (!editableIdea || !user) {
      setError('Missing idea data or user information.');
      return;
    }

    if (!editableIdea.text?.trim()) {
      setError('Idea text is required.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const timezone = moment.tz.guess();
      const localTime = moment().toDate();

      await addDoc(collection(db, 'ideas'), {
        text: editableIdea.text.trim(),
        tags: editableIdea.tags || [],
        privacy: editableIdea.privacy || 'private',
        level: editableIdea.level || 'general',
        createdAt: serverTimestamp(),
        localCreatedAt: Timestamp.fromDate(localTime),
        timezone,
        authorId: user.uid,
        authorName: user.firstName || '',
        sharedWith: [],
      });

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ideaCreated'));
      }

      if (onIdeaCreated) {
        onIdeaCreated();
      }

      onClose();
    } catch (error) {
      console.error('Error saving idea:', error);
      setError('Failed to save idea. Please try again.');
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
          Edit Idea Draft
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        {loading && !editableIdea && (
          <Box
            display="flex"
            flexDirection="column"
            alignItems="center"
            gap={2}
            py={4}
          >
            <CircularProgress />
            <Typography variant="body2" color="text.secondary">
              Analyzing your input and generating idea...
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

        {editableIdea && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextField
              fullWidth
              label="Idea *"
              multiline
              rows={4}
              value={editableIdea.text || ''}
              onChange={(e) => handleInputChange('text', e.target.value)}
              required
              variant="outlined"
              size="medium"
            />

            <Stack direction="row" spacing={1} alignItems="center">
              <TextField
                label="Add Tag"
                placeholder="Press Enter"
                fullWidth
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleTagAdd()}
                size="small"
              />
              <Button onClick={handleTagAdd} size="small">
                Add
              </Button>
            </Stack>

            {editableIdea.tags && editableIdea.tags.length > 0 && (
              <Paper
                variant="outlined"
                sx={{ p: 1, display: 'flex', flexWrap: 'wrap', gap: 1 }}
              >
                {editableIdea.tags.map((t: string, i: number) => (
                  <Chip
                    key={i}
                    label={t}
                    onDelete={() => {
                      handleInputChange(
                        'tags',
                        editableIdea.tags.filter((x: string) => x !== t)
                      );
                    }}
                    size="small"
                  />
                ))}
              </Paper>
            )}

            <Stack direction="row" spacing={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Level</InputLabel>
                <Select
                  value={editableIdea.level || 'general'}
                  onChange={(e) => handleInputChange('level', e.target.value)}
                  label="Level"
                >
                  <MenuItem value="general">General</MenuItem>
                  <MenuItem value="important">Important</MenuItem>
                  <MenuItem value="super">Super</MenuItem>
                </Select>
              </FormControl>

              <FormControl fullWidth size="small">
                <InputLabel>Privacy</InputLabel>
                <Select
                  value={editableIdea.privacy || 'private'}
                  onChange={(e) => handleInputChange('privacy', e.target.value)}
                  label="Privacy"
                >
                  <MenuItem value="private">Only Me</MenuItem>
                  <MenuItem value="public">Public</MenuItem>
                </Select>
              </FormControl>
            </Stack>
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
          disabled={loading || !editableIdea?.text?.trim()}
          sx={{
            backgroundColor: theme?.mode === 'dark' ? '#3b82f6' : '#2563eb',
            '&:hover': {
              backgroundColor: theme?.mode === 'dark' ? '#2563eb' : '#1d4ed8',
            },
          }}
        >
          {loading ? <CircularProgress size={20} /> : 'Save Idea'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
