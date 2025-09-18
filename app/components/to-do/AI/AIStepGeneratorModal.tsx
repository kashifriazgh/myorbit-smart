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

      const instructions = `You are a professional task planner and productivity expert. Analyze the following task and break it down into 3-5 realistic, actionable steps that can be completed sequentially.

Task: "${content}"

IMPORTANT: Generate only 3-5 steps maximum. Each step should be:
- Clear and specific
- Actionable (start with a verb)
- Realistic and achievable within reasonable time
- In logical order
- Focused on the core task, not every possible detail

Format your response as a valid JSON array of objects, where each object has:
- "text": the step description (required, keep it concise)
- "description": additional details or context (optional, keep it brief)

Example format:
[
  {"text": "Research and gather requirements", "description": "Identify all necessary information and constraints"},
  {"text": "Create initial plan", "description": "Outline the approach and timeline"},
  {"text": "Execute the main task", "description": "Complete the primary objective"}
]

Return ONLY the JSON array, no other text. If the task is too vague or doesn't have clear actionable steps, return an empty array [].`;

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
        // Clean the result to remove any markdown formatting
        const cleanResult = result.replace(/```json\s*|\s*```/g, '').trim();
        const parsedSteps = JSON.parse(cleanResult);

        if (Array.isArray(parsedSteps) && parsedSteps.length > 0) {
          // Limit to maximum 5 steps and filter out invalid entries
          const validSteps = parsedSteps
            .filter(
              (step) =>
                step &&
                typeof step === 'object' &&
                step.text &&
                step.text.trim()
            )
            .slice(0, 5)
            .map((step) => ({
              text: step.text.trim(),
              description: step.description
                ? step.description.trim()
                : undefined,
            }));

          if (validSteps.length > 0) {
            setAiSteps(validSteps);
            setSelectedSteps(new Array(validSteps.length).fill(true)); // Select all by default
          } else {
            setError('No valid steps could be generated for this task.');
          }
        } else {
          setError('No actionable steps could be generated for this task.');
        }
      } catch (parseError) {
        console.error('JSON parsing error:', parseError);
        setError('Failed to parse AI response. Please try again.');
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
              <Typography
                variant="subtitle2"
                gutterBottom
                sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
              >
                🤖 AI Generated Steps ({aiSteps.length})
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Select the steps you want to add to your task:
                </Typography>
              </Typography>
              <FormGroup>
                {aiSteps.map((step, index) => (
                  <Box
                    key={index}
                    sx={{
                      p: 2,
                      mb: 1.5,
                      border: `2px solid ${
                        selectedSteps[index] ? 'primary.main' : 'divider'
                      }`,
                      borderRadius: 2,
                      bgcolor: selectedSteps[index]
                        ? theme?.mode === 'dark'
                          ? 'rgba(59, 130, 246, 0.1)'
                          : 'rgba(59, 130, 246, 0.05)'
                        : theme?.mode === 'dark'
                        ? '#374151'
                        : '#f9fafb',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        borderColor: 'primary.main',
                        bgcolor: selectedSteps[index]
                          ? theme?.mode === 'dark'
                            ? 'rgba(59, 130, 246, 0.15)'
                            : 'rgba(59, 130, 246, 0.08)'
                          : theme?.mode === 'dark'
                          ? '#4b5563'
                          : '#f3f4f6',
                      },
                    }}
                  >
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={selectedSteps[index]}
                          onChange={() => handleStepToggle(index)}
                          sx={{
                            color:
                              theme?.mode === 'dark' ? '#e2e8f0' : undefined,
                          }}
                        />
                      }
                      label={
                        <Box sx={{ ml: 1 }}>
                          <Typography
                            variant="body1"
                            sx={{
                              fontWeight: selectedSteps[index] ? 600 : 500,
                              color:
                                theme?.mode === 'dark' ? '#f1f5f9' : 'inherit',
                              mb: step.description ? 0.5 : 0,
                            }}
                          >
                            {step.text}
                          </Typography>
                          {step.description && (
                            <Typography
                              variant="body2"
                              sx={{
                                color:
                                  theme?.mode === 'dark'
                                    ? '#94a3b8'
                                    : 'text.secondary',
                                lineHeight: 1.4,
                              }}
                            >
                              {step.description}
                            </Typography>
                          )}
                        </Box>
                      }
                      sx={{ m: 0, width: '100%' }}
                    />
                  </Box>
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
