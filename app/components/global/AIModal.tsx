'use client';

import {
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  Typography,
  Tabs,
  Tab,
  Stack,
  Button,
  Checkbox,
  FormGroup,
  FormControlLabel,
  CircularProgress,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { useCustomTheme } from '@/app/lib/context/themeContext';

interface Props {
  open: boolean;
  onClose: () => void;
  docId: string;
  originalText: string;
  onApply: (updatedText: string) => void;
  enableSuggestion?: boolean; // ✅ NEW
  suggestionPrompt?: string;
}

const ENHANCE_OPTIONS = [
  { key: 'grammar', label: 'Fix Grammar' },
  { key: 'fine_tune', label: 'Fine Tune Text' },
  { key: 'add_emojis', label: 'Add Emojis' },
];

export default function AIEnhanceModal({
  open,
  onClose,
  originalText,
  onApply,
  enableSuggestion = true, // ✅ default is true
  suggestionPrompt,
}: Props) {
  const [tab, setTab] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [aiResult, setAiResult] = useState('');
  const [loading, setLoading] = useState(false);
  const { theme } = useCustomTheme();
  const [aiSource, setAiSource] = useState<'enhance' | 'suggest' | null>(null);

  useEffect(() => {
    if (!open) {
      setTab(0);
      setSelectedOptions([]);
      setAiResult('');
      setAiSource(null); // reset source when modal closes
      setLoading(false);
    }
  }, [open]);

  const handleCheckboxToggle = (key: string) => {
    setSelectedOptions((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleEnhance = async () => {
    if (selectedOptions.length === 0) return;
    setAiSource('enhance');

    const enhanceMap: Record<string, string> = {
      grammar: 'Fix grammar issues',
      fine_tune: 'Fine-tune the text for clarity and tone',
      add_emojis: 'Add relevant emojis for better readability',
    };

    const instructionText = selectedOptions
      .map((key) => enhanceMap[key])
      .join(', ');

    const fullPrompt = `
Improve the following text with these actions: ${instructionText}.
Return only the improved version. No explanation needed.
    `.trim();

    setLoading(true);
    try {
      const response = await fetch('/api/ideas/improve-idea', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          value: originalText,
          instructions: fullPrompt,
        }),
      });

      const data = await response.json();
      setAiResult(data.result || 'No enhancement returned.');
    } catch (error) {
      console.error('Error enhancing text:', error);
      setAiResult('Error enhancing text.');
    } finally {
      setLoading(false);
    }
  };

  const handleSuggest = async () => {
    const suggestionPromptText =
      suggestionPrompt ||
      `
You are a productivity assistant. Analyze the following task and provide:
1. Productivity potential
2. Accessibility or feasibility
3. A suggested roadmap
4. Any missing aspects or improvements

Keep it detailed but clear.
`.trim();
    setAiSource('suggest');

    setLoading(true);
    try {
      const response = await fetch('/api/ideas/improve-idea', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          value: originalText,
          instructions: suggestionPromptText,
        }),
      });

      const data = await response.json();
      setAiResult(data.result || 'No suggestions returned.');
    } catch (error) {
      console.error('Suggestion fetch error:', error);
      setAiResult('Error getting suggestions.');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (aiResult) onApply(aiResult);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      onClick={(e) => e.stopPropagation()}
    >
      <DialogTitle
        sx={
          theme.mode === 'dark' ? { bgcolor: '#334155', color: '#f8fafc' } : {}
        }
      >
        AI Assistant
      </DialogTitle>
      <DialogContent
        sx={
          theme.mode === 'dark' ? { bgcolor: '#334155', color: '#f8fafc' } : {}
        }
      >
        <Tabs value={tab} onChange={(e, newVal) => setTab(newVal)}>
          <Tab label="Enhance" />
          {enableSuggestion && <Tab label="Suggestions" />}
        </Tabs>

        <Box mt={2}>
          {tab === 0 && (
            <Stack spacing={2}>
              <Typography>Select enhancement aspects:</Typography>
              <FormGroup>
                {ENHANCE_OPTIONS.map((opt) => (
                  <FormControlLabel
                    key={opt.key}
                    control={
                      <Checkbox
                        checked={selectedOptions.includes(opt.key)}
                        onChange={() => handleCheckboxToggle(opt.key)}
                      />
                    }
                    label={opt.label}
                  />
                ))}
              </FormGroup>

              <Button
                variant="outlined"
                onClick={handleEnhance}
                disabled={loading || selectedOptions.length === 0}
              >
                Run AI Enhancement
              </Button>
            </Stack>
          )}

          {tab === 1 && enableSuggestion && (
            <Stack spacing={2}>
              <Typography>
                Get detailed suggestions about your content.
              </Typography>
              <Button
                variant="outlined"
                onClick={handleSuggest}
                disabled={loading}
              >
                Get Suggestions
              </Button>
            </Stack>
          )}
        </Box>

        <Box mt={3}>
          <Typography variant="subtitle2" gutterBottom>
            AI Response:
          </Typography>
          {loading ? (
            <CircularProgress />
          ) : (
            <Typography
              variant="body2"
              sx={{
                whiteSpace: 'pre-wrap',
                background: theme?.mode === 'dark' ? '#475569' : '#f7f7f7',
                color: theme?.mode === 'dark' ? '#f1f5f9' : 'inherit',
                borderRadius: 2,
                p: 2,
                minHeight: 100,
              }}
            >
              {aiResult || '(No output yet)'}
            </Typography>
          )}
        </Box>

        <Box display="flex" justifyContent="flex-end" mt={3} gap={2}>
          <Button onClick={onClose}>Close</Button>
          {tab === 0 && aiSource === 'enhance' && aiResult && (
            <Button onClick={handleApply} variant="contained">
              Apply
            </Button>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
}
