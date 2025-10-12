'use client';

import React from 'react';
import { Checkbox, Button, Chip } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CircleOutlinedIcon from '@mui/icons-material/CircleOutlined';

const items = [
  { name: 'Avocados', qty: '2 pc', emoji: '🥑', checked: true },
  { name: 'Salmon fillets', qty: '2 x 150g', emoji: '🐟', checked: true },
  { name: 'Yogurt', qty: '200g', emoji: '🍶', checked: false, ai: true },
  { name: 'Dark chocolate almonds', qty: '50g', emoji: '🍫', checked: false },
  { name: 'Red Onion', qty: '1/4 piece', emoji: '🧅', checked: false },
  { name: 'Lettuce', qty: '2 pc', emoji: '🥬', checked: false },
];

export default function ShoppingList() {
  const [list, setList] = React.useState(items);

  const toggleCheck = (index: number) => {
    const updated = [...list];
    updated[index].checked = !updated[index].checked;
    setList(updated);
  };

  return (
    <div className="max-w-xs mx-auto rounded-2xl bg-white shadow-md border border-gray-100 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-800">Shopping list</h2>
        <span className="text-gray-400 cursor-pointer text-xl hover:text-gray-600">
          ↗
        </span>
      </div>

      {/* List */}
      <ul className="space-y-2">
        {list.map((item, index) => (
          <li
            key={index}
            className="flex items-center justify-between bg-gray-50 hover:bg-gray-100 rounded-xl px-3 py-2 transition"
          >
            <div className="flex items-center gap-2">
              <Checkbox
                icon={<CircleOutlinedIcon />}
                checkedIcon={<CheckCircleIcon className="text-green-500" />}
                checked={item.checked}
                onChange={() => toggleCheck(index)}
                size="small"
              />
              <span className="text-xl">{item.emoji}</span>
              <div className="flex flex-col leading-tight">
                <span
                  className={`text-sm font-medium ${
                    item.checked
                      ? 'line-through text-gray-400'
                      : 'text-gray-800'
                  }`}
                >
                  {item.name}
                </span>
                <div className="flex items-center gap-1">
                  {item.ai && (
                    <Chip
                      label="AI Suggested"
                      size="small"
                      sx={{
                        fontSize: '0.65rem',
                        color: '#2563EB',
                        backgroundColor: '#EFF6FF',
                        borderRadius: '6px',
                      }}
                    />
                  )}
                  <span className="text-xs text-gray-500">{item.qty}</span>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* Footer */}
      <Button
        variant="contained"
        fullWidth
        sx={{
          marginTop: 3,
          textTransform: 'none',
          backgroundColor: '#FACC15',
          color: '#000',
          fontWeight: 600,
          borderRadius: '9999px',
          '&:hover': { backgroundColor: '#EAB308' },
        }}
      >
        🛒 Shop Now
      </Button>
    </div>
  );
}
