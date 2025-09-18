'use client';

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  CircularProgress,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Stack,
  Divider,
} from '@mui/material';
import { useState } from 'react';
import { useCustomTheme } from '@/app/lib/context/themeContext';

interface AIStep {
  text: string;
  description?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onApply: (selectedSteps: AIStep[]) => void;
  taskTitle: string;
  taskDescription?: string;
}

export default function AIStepGeneratorModal({
  open,
  onClose,
  onApply,
  taskTitle,
  taskDescription,
}: Props) {
  const { theme } = useCustomTheme();
  const [loading, setLoading] = useState(false);
  const [aiSteps, setAiSteps] = useState<AIStep[]>([]);
  const [selectedSteps, setSelectedSteps] = useState<boolean[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateSteps = async () => {
    if (!taskTitle.trim()) {
      setError('Task title is required to generate steps');
      return;
    }

    setLoading(true);
    setError(null);
    setAiSteps([]);
    setSelectedSteps([]);

    try {
      const content = taskDescription
        ? `${taskTitle}\n\nDescription: ${taskDescription}`
        : taskTitle;

      const instructions = `You are a professional task planner and productivity expert. Analyze the following task and break it down into clear, actionable steps that can be completed sequentially.

Task: "${content}"

Please provide 3-8 specific, actionable steps that will help complete this task. Each step should be:
- Clear and specific
- Actionable (start with a verb)
- Realistic and achievable
- In logical order

Format your response as a JSON array of objects, where each object has:
- "text": the step description (required)
- "description": additional details or context (optional)

Example format:
[
  {"text": "Research and gather requirements", "description": "Identify all necessary information and constraints"},
  {"text": "Create initial plan", "description": "Outline the approach and timeline"},
  {"text": "Execute the main task", "description": "Complete the primary objective"}
]

If the task is too vague or doesn't have clear actionable steps, return an empty array [].`;

      const response = await fetch('/api/ideas/improve-idea', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          value: content,
          instructions,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate steps');
      }

      const result = data.result?.trim();

      if (!result) {
        setError(
          'No steps were generated. The task might be too vague or simple.'
        );
        return;
      }

      // Try to parse the JSON response
      try {
        const parsedSteps = JSON.parse(result);
        if (Array.isArray(parsedSteps) && parsedSteps.length > 0) {
          setAiSteps(parsedSteps);
          setSelectedSteps(new Array(parsedSteps.length).fill(true)); // Select all by default
        } else {
          setError('No actionable steps could be generated for this task.');
        }
      } catch (parseError) {
        // If JSON parsing fails, try to extract steps from text
        const lines = result.split('\n').filter((line) => line.trim());
        const extractedSteps: AIStep[] = [];
        console.log(parseError);
        for (const line of lines) {
          const trimmed = line.trim();
          if (
            trimmed &&
            !trimmed.startsWith('[') &&
            !trimmed.startsWith(']') &&
            !trimmed.startsWith('{') &&
            !trimmed.startsWith('}')
          ) {
            // Remove numbering and bullet points
            const cleanText = trimmed.replace(/^[\d\.\-\*\•]\s*/, '');
            if (cleanText.length > 5) {
              // Only include meaningful steps
              extractedSteps.push({ text: cleanText });
            }
          }
        }

        if (extractedSteps.length > 0) {
          setAiSteps(extractedSteps);
          setSelectedSteps(new Array(extractedSteps.length).fill(true));
        } else {
          setError('Could not extract actionable steps from the response.');
        }
      }
    } catch (error) {
      console.error('Error generating steps:', error);
      setError(
        error instanceof Error ? error.message : 'Failed to generate steps'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleStepToggle = (index: number) => {
    const updated = [...selectedSteps];
    updated[index] = !updated[index];
    setSelectedSteps(updated);
  };

  const handleApply = () => {
    const selected = aiSteps.filter((_, index) => selectedSteps[index]);
    onApply(selected);
    onClose();
  };

  const handleClose = () => {
    setAiSteps([]);
    setSelectedSteps([]);
    setError(null);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      onClick={(e) => e.stopPropagation()}
    >
      <DialogTitle
        sx={
          theme?.mode === 'dark' ? { bgcolor: '#334155', color: '#f8fafc' } : {}
        }
      >
        🤖 AI Step Generator
      </DialogTitle>
      <DialogContent
        sx={
          theme?.mode === 'dark' ? { bgcolor: '#334155', color: '#f8fafc' } : {}
        }
      >
        <Stack spacing={3}>
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Task: {taskTitle}
            </Typography>
            {taskDescription && (
              <Typography variant="body2" color="text.secondary">
                {taskDescription}
              </Typography>
            )}
          </Box>

          <Button
            variant="contained"
            onClick={handleGenerateSteps}
            disabled={loading || !taskTitle.trim()}
            sx={{ alignSelf: 'flex-start' }}
          >
            {loading ? (
              <>
                <CircularProgress size={20} sx={{ mr: 1 }} />
                Generating Steps...
              </>
            ) : (
              'Generate AI Steps'
            )}
          </Button>

          {error && (
            <Box
              sx={{
                p: 2,
                bgcolor: theme?.mode === 'dark' ? '#dc2626' : '#fee2e2',
                color: theme?.mode === 'dark' ? '#fecaca' : '#dc2626',
                borderRadius: 1,
                border: `1px solid ${
                  theme?.mode === 'dark' ? '#f87171' : '#fca5a5'
                }`,
              }}
            >
              <Typography variant="body2">{error}</Typography>
            </Box>
          )}

          {aiSteps.length > 0 && (
            <Box>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="subtitle2" gutterBottom>
                Select the steps you want to add:
              </Typography>
              <FormGroup>
                {aiSteps.map((step, index) => (
                  <FormControlLabel
                    key={index}
                    control={
                      <Checkbox
                        checked={selectedSteps[index]}
                        onChange={() => handleStepToggle(index)}
                        sx={{
                          color: theme?.mode === 'dark' ? '#e2e8f0' : undefined,
                        }}
                      />
                    }
                    label={
                      <Box>
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: selectedSteps[index] ? 500 : 400,
                            color:
                              theme?.mode === 'dark' ? '#f1f5f9' : 'inherit',
                          }}
                        >
                          {step.text}
                        </Typography>
                        {step.description && (
                          <Typography
                            variant="caption"
                            sx={{
                              color:
                                theme?.mode === 'dark'
                                  ? '#94a3b8'
                                  : 'text.secondary',
                              fontStyle: 'italic',
                            }}
                          >
                            {step.description}
                          </Typography>
                        )}
                      </Box>
                    }
                    sx={{ mb: 1 }}
                  />
                ))}
              </FormGroup>
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions
        sx={
          theme?.mode === 'dark' ? { bgcolor: '#334155', color: '#f8fafc' } : {}
        }
      >
        <Button onClick={handleClose}>Cancel</Button>
        {aiSteps.length > 0 && (
          <Button
            onClick={handleApply}
            variant="contained"
            disabled={selectedSteps.every((selected) => !selected)}
          >
            Add Selected Steps ({selectedSteps.filter(Boolean).length})
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
