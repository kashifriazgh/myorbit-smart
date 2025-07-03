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

interface Props {
  open: boolean;
  onClose: () => void;
  docId: string;
  originalText: string;
  onApply: (updatedText: string) => void; // called after enhancement
}

const ENHANCE_OPTIONS = [
  { key: 'grammar', label: 'Fix Grammar' },
  { key: 'fine_tune', label: 'Fine Tune Text' },
  { key: 'add_emojis', label: 'Add Emojis' },
];

export default function AIEnhanceModal({
  open,
  onClose,
  // docId,
  originalText,
  onApply,
}: Props) {
  const [tab, setTab] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [aiResult, setAiResult] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setTab(0);
      setSelectedOptions([]);
      setAiResult('');
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

    setLoading(true);
    try {
      const response = await fetch('/api/ideas/improve-idea', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          value: originalText,
          instructions: selectedOptions, // ✅ send as array
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
    //     const suggestionPrompt = `
    // You are an idea expert. Analyze this idea and provide feedback on:
    // 1. Productivity of the idea
    // 2. Accessibility and feasibility
    // 3. Roadmap to implement it
    // 4. Any missing aspects or improvements

    // Idea: "${originalText}"
    //     `.trim();

    setLoading(true);
    try {
      const response = await fetch('/api/ideas/improve-idea', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          value: originalText,
          suggestion: true,
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
      <DialogTitle>AI Assistant</DialogTitle>
      <DialogContent>
        <Tabs value={tab} onChange={(e, newVal) => setTab(newVal)}>
          <Tab label="Enhance" />
          <Tab label="Suggestions" />
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

          {tab === 1 && (
            <Stack spacing={2}>
              <Typography>Get detailed suggestions about your idea.</Typography>
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
                background: '#f7f7f7',
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
          {tab === 0 && (
            <Button
              onClick={handleApply}
              disabled={!aiResult}
              variant="contained"
            >
              Apply
            </Button>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
}
