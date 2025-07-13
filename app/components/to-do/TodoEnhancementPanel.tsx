'use client';

import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { Todo } from '@/app/lib/interface';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';

interface Props {
  open: boolean;
  onClose: () => void;
  todo: Todo;
}

const TodoEnhancementPanel = ({ open, onClose, todo }: Props) => {
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [enhancedEdits, setEnhancedEdits] = useState<Record<string, string>>(
    {}
  );

  const reset = () => {
    setResult('');
    setSelectedFields([]);
    setEnhancedEdits({});
    setTab(0);
  };

  useEffect(() => {
    if (!open) reset();
  }, [open]);

  const toggleField = (field: string) => {
    setSelectedFields((prev) =>
      prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field]
    );
  };

  const getFieldData = () => {
    const fields: Record<string, string> = {};
    if (selectedFields.includes('title')) fields['Task Title'] = todo.title;
    if (selectedFields.includes('description') && todo.description)
      fields['Task Description'] = todo.description;
    todo.steps?.forEach((step, i) => {
      if (selectedFields.includes('step_title'))
        fields[`Step ${i + 1} Title`] = step.text;
      if (selectedFields.includes('step_description') && step.description)
        fields[`Step ${i + 1} Description`] = step.description;
      step.subSteps?.forEach((sub, j) => {
        if (selectedFields.includes('substep_title'))
          fields[`Substep ${i + 1}.${j + 1} Title`] = sub.text;
      });
    });
    return fields;
  };

  const callEnhance = async () => {
    const data = getFieldData();
    setLoading(true);
    setResult('');
    setEnhancedEdits({});
    try {
      const responses = await Promise.all(
        Object.entries(data).map(async ([label, text]) => {
          const res = await fetch('/api/ideas/improve-idea', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              value: text,
              instructions:
                'Improve this text for grammar, clarity, tone and add relevant emojis. Only return the improved version.',
            }),
          });
          const json = await res.json();
          return [label, json.result || text] as [string, string];
        })
      );

      const combinedText = responses
        .map(([label, improved]) => `${label}:\n${improved}`)
        .join('\n\n');

      const newEdits: Record<string, string> = {};
      responses.forEach(([label, improved]) => {
        newEdits[label] = improved;
      });

      setResult(combinedText);
      setEnhancedEdits(newEdits);
    } catch (err) {
      console.error(err);
      setResult('Error enhancing content.');
    } finally {
      setLoading(false);
    }
  };

  const callBreakdown = async () => {
    const prompt = `
You are a productivity expert. Break down the following task into detailed steps and sub-steps, if applicable. Be logical and practical.

Task: ${todo.title}
${todo.description ? `\nDescription: ${todo.description}` : ''}

Steps:
${todo.steps?.map((s, i) => `• ${i + 1}. ${s.text}`).join('\n') || 'None'}
    `.trim();

    setLoading(true);
    setResult('');
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
      setResult(json.result || 'No breakdown returned.');
    } catch (err) {
      console.error(err);
      setResult('Error generating breakdown.');
    } finally {
      setLoading(false);
    }
  };

  const callSchedule = async () => {
    const prompt = `
Generate a daily schedule plan to complete the following task based on its content:

Title: ${todo.title}
${todo.description ? `Description: ${todo.description}` : ''}
Steps:
${todo.steps?.map((s, i) => `• ${i + 1}. ${s.text}`).join('\n') || 'None'}

Return a concise paragraph describing the schedule.
    `.trim();

    setLoading(true);
    setResult('');
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
      setResult(json.result || 'No schedule returned.');

      await updateDoc(doc(db, 'todos', todo.id!), {
        scheduleSummary: json.result || '',
      });
    } catch (err) {
      console.error(err);
      setResult('Error generating schedule.');
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    {
      label: 'Enhance Content',
      content: (
        <Stack spacing={2}>
          <Typography>Select items to enhance:</Typography>
          {[
            ['title', 'Task Title'],
            ['description', 'Task Description'],
            ['step_title', 'Step Titles'],
            ['step_description', 'Step Descriptions'],
            ['substep_title', 'Substep Titles'],
          ].map(([key, label]) => (
            <FormControlLabel
              key={key}
              control={
                <Checkbox
                  checked={selectedFields.includes(key)}
                  onChange={() => toggleField(key)}
                />
              }
              label={label}
            />
          ))}
          <Button
            variant="contained"
            onClick={callEnhance}
            disabled={loading || selectedFields.length === 0}
          >
            Enhance
          </Button>

          {Object.keys(enhancedEdits).length > 0 && (
            <Box mt={3}>
              <Typography variant="subtitle2" gutterBottom>
                Apply AI Suggestions
              </Typography>

              <Stack spacing={3}>
                {Object.entries(enhancedEdits).map(([label, aiText], idx) => {
                  const [type, i, j] = (() => {
                    if (label.startsWith('Task Title')) return ['title'];
                    if (label.startsWith('Task Description'))
                      return ['description'];
                    if (
                      label.startsWith('Step') &&
                      label.includes('Description')
                    ) {
                      const match = label.match(/Step (\d+) Description/);
                      return match
                        ? ['step_description', parseInt(match[1]) - 1]
                        : ['step_description'];
                    }
                    if (label.startsWith('Step')) {
                      const match = label.match(/Step (\d+) Title/);
                      return match
                        ? ['step', parseInt(match[1]) - 1]
                        : ['step'];
                    }
                    if (label.startsWith('Substep')) {
                      const match = label.match(/Substep (\d+)\.(\d+)/);
                      return match
                        ? [
                            'substep',
                            parseInt(match[1]) - 1,
                            parseInt(match[2]) - 1,
                          ]
                        : ['substep'];
                    }
                    return ['unknown'];
                  })();

                  const currentVal = (() => {
                    if (type === 'title') return todo.title;
                    if (type === 'description') return todo.description || '';
                    if (type === 'step') return todo.steps?.[i]?.text || '';
                    if (type === 'step_description')
                      return todo.steps?.[i]?.description || '';
                    if (type === 'substep')
                      return todo.steps?.[i]?.subSteps?.[j]?.text || '';
                    return '';
                  })();

                  const handleApply = async () => {
                    try {
                      const ref = doc(db, 'todos', todo.id!);
                      const updatedSteps = [...(todo.steps || [])];

                      if (type === 'title' || type === 'description') {
                        await updateDoc(ref, { [type]: aiText });
                      } else if (type === 'step') {
                        updatedSteps[i].text = aiText;
                        await updateDoc(ref, { steps: updatedSteps });
                      } else if (type === 'step_description') {
                        updatedSteps[i].description = aiText;
                        await updateDoc(ref, { steps: updatedSteps });
                      } else if (type === 'substep') {
                        updatedSteps[i].subSteps![j].text = aiText;
                        await updateDoc(ref, { steps: updatedSteps });
                      }

                      alert(`Updated: ${label}`);
                    } catch (err) {
                      console.error(err);
                      alert(`Failed to update: ${label}`);
                    }
                  };

                  return (
                    <Box
                      key={idx}
                      p={2}
                      border="1px solid #ccc"
                      borderRadius={2}
                    >
                      <Typography fontWeight="bold">{label}</Typography>

                      <Typography variant="body2" color="text.secondary" mt={1}>
                        Current:
                      </Typography>
                      <Box
                        sx={{
                          backgroundColor: '#f5f5f5',
                          padding: 1,
                          borderRadius: 1,
                          fontSize: 14,
                        }}
                      >
                        {currentVal}
                      </Box>

                      <Typography variant="body2" color="text.secondary" mt={2}>
                        AI Suggestion:
                      </Typography>
                      <TextField
                        fullWidth
                        multiline
                        minRows={2}
                        value={enhancedEdits[label]}
                        onChange={(e) =>
                          setEnhancedEdits((prev) => ({
                            ...prev,
                            [label]: e.target.value,
                          }))
                        }
                      />

                      <Box mt={1} textAlign="right">
                        <Button
                          variant="contained"
                          size="small"
                          onClick={handleApply}
                          disabled={
                            !enhancedEdits[label] ||
                            enhancedEdits[label] === currentVal
                          }
                        >
                          Apply
                        </Button>
                      </Box>
                    </Box>
                  );
                })}
              </Stack>
            </Box>
          )}
        </Stack>
      ),
    },
    {
      label: 'Suggest Breakdown',
      content: (
        <Stack spacing={2}>
          <Typography>
            Get a logical breakdown of this task into practical steps and
            substeps.
          </Typography>
          <Button
            variant="contained"
            onClick={callBreakdown}
            disabled={loading}
          >
            Get Breakdown
          </Button>
        </Stack>
      ),
    },
    {
      label: 'Suggest Schedule',
      content: (
        <Stack spacing={2}>
          <Typography>
            Generate a brief daily plan to complete this task.
          </Typography>
          <Button variant="contained" onClick={callSchedule} disabled={loading}>
            Generate Schedule
          </Button>
        </Stack>
      ),
    },
  ];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>🧠 AI Assistant for Task</DialogTitle>
      <DialogContent>
        <Tabs value={tab} onChange={(e, val) => setTab(val)} sx={{ mb: 2 }}>
          {tabs.map((t, i) => (
            <Tab key={i} label={t.label} />
          ))}
        </Tabs>

        <Box>{tabs[tab].content}</Box>

        <Box mt={3}>
          <Typography variant="subtitle2">
            Raw AI Output (for reference)
          </Typography>
          {loading ? (
            <CircularProgress sx={{ mt: 2 }} />
          ) : (
            <TextField
              multiline
              fullWidth
              minRows={6}
              value={result}
              onChange={(e) => setResult(e.target.value)}
              sx={{ mt: 1 }}
            />
          )}
        </Box>

        <Box display="flex" justifyContent="flex-end" mt={3}>
          <Button onClick={onClose}>Close</Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default TodoEnhancementPanel;
