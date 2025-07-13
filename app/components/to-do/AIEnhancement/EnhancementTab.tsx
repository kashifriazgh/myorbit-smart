'use client';

import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { Todo } from '@/app/lib/interface';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';

interface EnhancementTabProps {
  todo: Todo;
  onDataUpdated?: () => void;
}

const EnhancementTab = ({ todo, onDataUpdated }: EnhancementTabProps) => {
  const [loading, setLoading] = useState(false);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [enhancedEdits, setEnhancedEdits] = useState<Record<string, string>>(
    {}
  );
  const [applyingLabel, setApplyingLabel] = useState<string | null>(null);
  const [appliedLabels, setAppliedLabels] = useState<Set<string>>(new Set());
  const [result, setResult] = useState('');

  useEffect(() => {
    setSelectedFields([]);
    setEnhancedEdits({});
    setResult('');
    setAppliedLabels(new Set());
  }, [todo.id]);

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
    if (Object.keys(data).length === 0) {
      console.warn('No fields selected for enhancement.');
      return;
    }

    setLoading(true);
    setResult('');
    setEnhancedEdits({});

    try {
      const responses = await Promise.all(
        Object.entries(data).map(async ([label, text]) => {
          try {
            const res = await fetch('/api/ideas/improve-idea', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                value: text,
                instructions:
                  'You are improving task-related text for a productivity app. Improve grammar, spelling, and professional tone. Eliminate repetition (e.g., repeated "we will"), correct typos, and enhance flow. Avoid vague filler like "please proceed" or implying task completion. Preserve technical terms like KDK, DB, or API. Always rewrite the input in a clearer and more concise form. Do not return the original without changes.',
              }),
            });

            if (!res.ok) {
              const errorText = await res.text();
              console.error(
                `Error from API [${label}]:`,
                res.status,
                errorText
              );
              return [label, `[ERROR] (${res.status}) ${errorText}`] as const;
            }

            const json = await res.json();
            const improved = json.result?.trim();

            return [
              label,
              improved && improved !== text.trim()
                ? improved
                : '[UNCHANGED] ' + text,
            ] as const;
          } catch (innerErr) {
            console.error(`Network error for "${label}":`, innerErr);
            return [label, '[ERROR] Network error occurred'] as const;
          }
        })
      );

      const newEdits: Record<string, string> = {};
      responses.forEach(([label, improved]) => {
        newEdits[label] = improved;
      });

      setResult(
        responses
          .map(([label, improved]) => `${label}:\n${improved}`)
          .join('\n\n')
      );
      setEnhancedEdits(newEdits);
    } catch (err) {
      console.error('Unexpected error in enhancement process:', err);
      setResult('Unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async (label: string, aiText: string) => {
    const [type, i, j] = (() => {
      if (label.startsWith('Task Title')) return ['title'];
      if (label.startsWith('Task Description')) return ['description'];
      if (label.startsWith('Step') && label.includes('Description')) {
        const match = label.match(/Step (\d+) Description/);
        return match ? ['step_description', parseInt(match[1]) - 1] : [];
      }
      if (label.startsWith('Step')) {
        const match = label.match(/Step (\d+) Title/);
        return match ? ['step', parseInt(match[1]) - 1] : [];
      }
      if (label.startsWith('Substep')) {
        const match = label.match(/Substep (\d+)\.(\d+)/);
        return match
          ? ['substep', parseInt(match[1]) - 1, parseInt(match[2]) - 1]
          : [];
      }
      return [];
    })();

    try {
      setApplyingLabel(label);
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

      setAppliedLabels((prev) => new Set(prev).add(label));
      onDataUpdated?.();
    } catch (err) {
      console.error(err);
    } finally {
      setApplyingLabel(null);
    }
  };

  return (
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
              const currentVal = aiText; // already improved, show current
              return (
                <Box key={idx} p={2} border="1px solid #ccc" borderRadius={2}>
                  <Typography fontWeight="bold">{label}</Typography>

                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2">Original</Typography>
                      <TextField
                        fullWidth
                        value={currentVal}
                        multiline
                        minRows={2}
                        disabled
                      />
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2">AI Suggestion</Typography>
                      <TextField
                        fullWidth
                        multiline
                        minRows={2}
                        value={aiText}
                        onChange={(e) =>
                          setEnhancedEdits((prev) => ({
                            ...prev,
                            [label]: e.target.value,
                          }))
                        }
                      />
                    </Box>
                  </Box>

                  <Box mt={1} textAlign="right">
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => handleApply(label, enhancedEdits[label])}
                      disabled={
                        applyingLabel === label ||
                        appliedLabels.has(label) ||
                        !enhancedEdits[label]
                      }
                    >
                      {appliedLabels.has(label) ? (
                        'Applied'
                      ) : applyingLabel === label ? (
                        <CircularProgress size={16} />
                      ) : (
                        'Apply'
                      )}
                    </Button>
                  </Box>
                </Box>
              );
            })}
          </Stack>
        </Box>
      )}

      <Box mt={3}>
        <Typography variant="subtitle2">Raw AI Output (reference)</Typography>
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
    </Stack>
  );
};

export default EnhancementTab;
