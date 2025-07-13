'use client';

import {
  Box,
  Button,
  CircularProgress,
  Stack,
  Typography,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import { useState } from 'react';
import { Todo } from '@/app/lib/interface';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';

interface BreakdownTabProps {
  todo: Todo;
  onDataUpdated?: () => void;
}

interface ParsedStep {
  title: string;
  subSteps?: string[];
}

const BreakdownTab = ({ todo, onDataUpdated }: BreakdownTabProps) => {
  const [loading, setLoading] = useState(false);
  const [rawText, setRawText] = useState('');
  const [parsedSteps, setParsedSteps] = useState<ParsedStep[]>([]);

  const callBreakdown = async () => {
    const prompt = `
You are a productivity expert. Break down the following task into clearly labeled steps and sub-steps. Sub-steps should be practical actions under the main step. Avoid emojis and completion language (e.g., "done", "complete"). Maintain professional tone.

Respond using this format:
1. Main Step Title
   - Substep 1
   - Substep 2

Task: ${todo.title}
${todo.description ? `Description: ${todo.description}` : ''}

${
  todo.steps?.length
    ? `Current Steps:\n${todo.steps
        .map((s, i) => `• ${i + 1}. ${s.text}`)
        .join('\n')}`
    : ''
}
    `.trim();

    setLoading(true);
    try {
      const res = await fetch('/api/ideas/improve-idea', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          value: todo.title,
          instructions: prompt,
        }),
      });

      const json = await res.json();
      const output = json.result || '';
      setRawText(output);
      setParsedSteps(parseBreakdown(output));
    } catch (err) {
      console.error(err);
      setRawText('Error generating breakdown.');
    } finally {
      setLoading(false);
    }
  };

  const parseBreakdown = (text: string): ParsedStep[] => {
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const steps: ParsedStep[] = [];

    let currentStep: ParsedStep | null = null;

    for (const line of lines) {
      const stepMatch = line.match(/^\d+[\.\)]\s*(.*)/);
      const subStepMatch = line.match(/^- (.*)/);

      if (stepMatch) {
        if (currentStep) steps.push(currentStep);
        currentStep = { title: stepMatch[1], subSteps: [] };
      } else if (subStepMatch && currentStep) {
        currentStep.subSteps!.push(subStepMatch[1]);
      }
    }

    if (currentStep) steps.push(currentStep);
    return steps;
  };

  const handleCreateSteps = async () => {
    if (!parsedSteps.length) return;

    const newSteps: Todo['steps'] = parsedSteps.map((step) => ({
      text: step.title,
      description: '',
      done: false,
      status: 'in_progress',
      subSteps:
        step.subSteps?.map((s) => ({
          text: s,
          description: '',
          done: false,
          status: 'in_progress',
        })) || [],
    }));

    try {
      const ref = doc(db, 'todos', todo.id!);
      await updateDoc(ref, { steps: newSteps });
      onDataUpdated?.();
    } catch (err) {
      console.error('Error saving steps:', err);
    }
  };

  return (
    <Stack spacing={2}>
      <Typography>
        Get a logical breakdown of this task into practical steps and substeps.
      </Typography>

      <Button variant="contained" onClick={callBreakdown} disabled={loading}>
        {loading ? 'Generating...' : 'Get Breakdown'}
      </Button>

      {parsedSteps.length > 0 && (
        <>
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Suggested Steps Preview
            </Typography>
            <List dense>
              {parsedSteps.map((step, i) => (
                <Box key={i} mb={2}>
                  <ListItem>
                    <ListItemText
                      primaryTypographyProps={{ fontWeight: 'bold' }}
                      primary={`${i + 1}. ${step.title}`}
                    />
                  </ListItem>
                  {step.subSteps?.length > 0 && (
                    <List component="div" disablePadding sx={{ pl: 4 }}>
                      {step.subSteps.map((sub, j) => (
                        <ListItem key={j}>
                          <ListItemText primary={`- ${sub}`} />
                        </ListItem>
                      ))}
                    </List>
                  )}
                </Box>
              ))}
            </List>
          </Box>

          <Button
            variant="outlined"
            color="success"
            onClick={handleCreateSteps}
          >
            Create These Steps
          </Button>
        </>
      )}

      <Box>
        <Typography variant="subtitle2">Raw AI Response</Typography>
        {loading ? (
          <CircularProgress sx={{ mt: 2 }} />
        ) : (
          <Box
            sx={{
              backgroundColor: '#f5f5f5',
              padding: 1,
              borderRadius: 1,
              fontSize: 14,
              whiteSpace: 'pre-line',
              mt: 1,
            }}
          >
            {rawText || 'No response yet.'}
          </Box>
        )}
      </Box>
    </Stack>
  );
};

export default BreakdownTab;
