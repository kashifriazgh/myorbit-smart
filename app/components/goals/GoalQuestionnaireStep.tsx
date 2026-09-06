'use client';

import React, { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Chip,
  Stack,
  Checkbox,
  FormControlLabel,
  InputAdornment,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { CheckCircle, RadioButtonUnchecked } from '@mui/icons-material';
import { QuestionConfig, QuestionOption } from '../../lib/config/goalCategoriesConfig';

interface GoalQuestionnaireStepProps {
  question: QuestionConfig;
  value: unknown;
  onChange: (val: unknown) => void;
  color: string;
  isDark: boolean;
}

export default function GoalQuestionnaireStep({
  question,
  value,
  onChange,
  color,
  isDark,
}: GoalQuestionnaireStepProps) {
  const [customText, setCustomText] = useState<string>(
    typeof value === 'string' && !question.options?.some((o) => o.value === value)
      ? value
      : ''
  );

  const borderCol = isDark ? '#334155' : '#e2e8f0';
  const textCol = isDark ? '#f1f5f9' : '#0f172a';
  const mutedCol = isDark ? '#64748b' : '#94a3b8';
  const cardBg = isDark ? '#0f172a' : '#f8fafc';

  const handleOptionSelect = (option: QuestionOption) => {
    if (option.isCustomInput) {
      onChange(customText || option.value);
    } else {
      onChange(option.value);
    }
  };

  const handleCustomTextChange = (txt: string) => {
    setCustomText(txt);
    onChange(txt);
  };

  // Render question types
  const renderQuestionBody = () => {
    switch (question.type) {
      case 'text_input':
        return (
          <TextField
            fullWidth
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={question.placeholder || 'Enter response...'}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: '16px',
                fontSize: '1.05rem',
                fontWeight: 600,
                bgcolor: cardBg,
              },
            }}
          />
        );

      case 'number_input':
        return (
          <TextField
            fullWidth
            type="number"
            value={value !== undefined && value !== null ? String(value) : ''}
            onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
            placeholder={question.placeholder || '0'}
            InputProps={{
              endAdornment: question.unit ? (
                <InputAdornment position="end">
                  <Typography sx={{ fontWeight: 700, color: color }}>{question.unit}</Typography>
                </InputAdornment>
              ) : null,
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: '16px',
                fontSize: '1.1rem',
                fontWeight: 700,
                bgcolor: cardBg,
              },
            }}
          />
        );

      case 'single_choice': {
        const isCustomSelected =
          typeof value === 'string' &&
          question.options?.some((o) => o.isCustomInput && (o.value === value || customText === value));

        return (
          <Box>
            <Stack direction="row" gap={1.25} flexWrap="wrap">
              {question.options?.map((opt) => {
                const isSelected = value === opt.value || (opt.isCustomInput && isCustomSelected);
                return (
                  <Box
                    key={opt.value}
                    onClick={() => handleOptionSelect(opt)}
                    sx={{
                      p: 1.75,
                      px: 2.25,
                      borderRadius: '16px',
                      cursor: 'pointer',
                      border: `2px solid ${isSelected ? color : borderCol}`,
                      bgcolor: isSelected ? `${color}18` : cardBg,
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.25,
                      '&:hover': {
                        borderColor: color,
                        transform: 'translateY(-1px)',
                        boxShadow: `0 4px 12px ${color}20`,
                      },
                    }}
                  >
                    {opt.icon && (
                      <Typography sx={{ fontSize: '1.25rem' }}>{opt.icon}</Typography>
                    )}
                    <Typography
                      sx={{
                        fontSize: 13.5,
                        fontWeight: isSelected ? 800 : 600,
                        color: isSelected ? textCol : isDark ? '#cbd5e1' : '#475569',
                      }}
                    >
                      {opt.label}
                    </Typography>
                    {isSelected && <CheckCircle sx={{ fontSize: 18, color: color, ml: 'auto' }} />}
                  </Box>
                );
              })}
            </Stack>

            {/* Custom Input Field if custom option selected */}
            {question.options?.some((o) => o.isCustomInput) && isCustomSelected && (
              <Box sx={{ mt: 2 }}>
                <TextField
                  fullWidth
                  size="small"
                  value={customText}
                  onChange={(e) => handleCustomTextChange(e.target.value)}
                  placeholder="Specify custom response..."
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                />
              </Box>
            )}
          </Box>
        );
      }

      case 'multi_choice': {
        const selectedArr = Array.isArray(value) ? (value as string[]) : [];
        const toggleMulti = (val: string) => {
          if (selectedArr.includes(val)) {
            onChange(selectedArr.filter((v) => v !== val));
          } else {
            onChange([...selectedArr, val]);
          }
        };

        return (
          <Stack direction="row" gap={1} flexWrap="wrap">
            {question.options?.map((opt) => {
              const isSelected = selectedArr.includes(opt.value);
              return (
                <Chip
                  key={opt.value}
                  label={opt.label}
                  onClick={() => toggleMulti(opt.value)}
                  variant={isSelected ? 'filled' : 'outlined'}
                  icon={isSelected ? <CheckCircle style={{ color: color }} /> : <RadioButtonUnchecked style={{ color: mutedCol }} />}
                  sx={{
                    borderRadius: '12px',
                    fontWeight: 700,
                    fontSize: 13,
                    px: 1,
                    py: 2.2,
                    borderColor: isSelected ? color : borderCol,
                    bgcolor: isSelected ? `${color}20` : 'transparent',
                    color: isSelected ? textCol : mutedCol,
                    '&:hover': { bgcolor: `${color}15` },
                  }}
                />
              );
            })}
          </Stack>
        );
      }

      case 'amount_or_choice': {
        const isCustomSelected = value === 'custom_amount' || value === customText;
        return (
          <Box>
            <Stack direction="row" gap={1} flexWrap="wrap" mb={2}>
              {question.options?.map((opt) => {
                const isSelected = value === opt.value;
                return (
                  <Chip
                    key={opt.value}
                    label={opt.label}
                    onClick={() => {
                      if (opt.isCustomInput) {
                        onChange('custom_amount');
                      } else {
                        onChange(opt.value);
                      }
                    }}
                    variant={isSelected ? 'filled' : 'outlined'}
                    sx={{
                      borderRadius: '12px',
                      fontWeight: 700,
                      fontSize: 13,
                      borderColor: isSelected ? color : borderCol,
                      bgcolor: isSelected ? `${color}25` : 'transparent',
                      color: isSelected ? textCol : mutedCol,
                      '&:hover': { bgcolor: `${color}15` },
                    }}
                  />
                );
              })}
            </Stack>

            {(isCustomSelected || value === 'custom_amount' || (typeof value === 'string' && /^\d+$/.test(value))) && (
              <TextField
                fullWidth
                type="number"
                label="Enter Amount"
                value={typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value)) ? value : customText}
                onChange={(e) => {
                  const val = e.target.value;
                  setCustomText(val);
                  onChange(val);
                }}
                placeholder="e.g. 100000"
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '14px', fontWeight: 700 } }}
              />
            )}
          </Box>
        );
      }

      case 'date_or_choice': {
        const isCustomDate = value instanceof Date || (typeof value === 'string' && (value.includes('-') || value === 'specific_date'));
        return (
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <Box>
              <Stack direction="row" gap={1} flexWrap="wrap" mb={2}>
                {question.options?.map((opt) => {
                  const isSelected = value === opt.value;
                  return (
                    <Chip
                      key={opt.value}
                      label={opt.label}
                      onClick={() => {
                        if (opt.isCustomInput) {
                          onChange('specific_date');
                        } else {
                          onChange(opt.value);
                        }
                      }}
                      variant={isSelected ? 'filled' : 'outlined'}
                      sx={{
                        borderRadius: '12px',
                        fontWeight: 700,
                        fontSize: 13,
                        borderColor: isSelected ? color : borderCol,
                        bgcolor: isSelected ? `${color}25` : 'transparent',
                        color: isSelected ? textCol : mutedCol,
                        '&:hover': { bgcolor: `${color}15` },
                      }}
                    />
                  );
                })}
              </Stack>

              {isCustomDate && (
                <DatePicker
                  label="Select Deadline Date"
                  value={value instanceof Date ? value : null}
                  onChange={(dateVal) => onChange(dateVal)}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      sx: { '& .MuiOutlinedInput-root': { borderRadius: '14px' } },
                    },
                  }}
                />
              )}
            </Box>
          </LocalizationProvider>
        );
      }

      case 'checkbox_milestones': {
        const selectedMilestones = Array.isArray(value) ? (value as string[]) : [];
        const toggleMilestone = (milestoneVal: string) => {
          if (selectedMilestones.includes(milestoneVal)) {
            onChange(selectedMilestones.filter((m) => m !== milestoneVal));
          } else {
            onChange([...selectedMilestones, milestoneVal]);
          }
        };

        return (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 1.25,
            }}
          >
            {question.options?.map((opt) => {
              const isChecked = selectedMilestones.includes(opt.value);
              return (
                <Box
                  key={opt.value}
                  onClick={() => toggleMilestone(opt.value)}
                  sx={{
                    p: 1.5,
                    borderRadius: '14px',
                    cursor: 'pointer',
                    border: `1.5px solid ${isChecked ? color : borderCol}`,
                    bgcolor: isChecked ? `${color}15` : cardBg,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    transition: 'all 0.15s ease',
                    '&:hover': { borderColor: color },
                  }}
                >
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={isChecked}
                        sx={{ color: mutedCol, '&.Mui-checked': { color: color } }}
                      />
                    }
                    label={
                      <Typography sx={{ fontSize: 13, fontWeight: 700, color: textCol }}>
                        {opt.label}
                      </Typography>
                    }
                    sx={{ m: 0, pointerEvents: 'none' }}
                  />
                </Box>
              );
            })}
          </Box>
        );
      }

      default:
        return null;
    }
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 800, mb: 0.75, color: textCol, fontSize: '1.2rem' }}>
        {question.question}
      </Typography>
      {question.subtitle && (
        <Typography sx={{ fontSize: 12.5, color: mutedCol, mb: 2 }}>
          {question.subtitle}
        </Typography>
      )}
      <Box sx={{ mt: 2 }}>{renderQuestionBody()}</Box>
    </Box>
  );
}
