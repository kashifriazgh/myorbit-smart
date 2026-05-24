'use client';

import React, { useState } from 'react';
import { 
  Dialog, DialogContent, Box, Typography, Button, 
  IconButton, Checkbox, Stack,
  useTheme, useMediaQuery, Chip
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SelectedIcon from '@mui/icons-material/CheckCircle';
import UnselectedIcon from '@mui/icons-material/RadioButtonUnchecked';
import FilterIcon from '@mui/icons-material/FilterList';
import { Point } from '@/app/lib/interface';
import { motion, AnimatePresence } from 'framer-motion';

interface PointSelectionModalProps {
  open: boolean;
  onClose: () => void;
  groupName: string;
  availablePoints: Point[];
  onConfirm: (selectedPointIds: string[]) => void;
}

const PointSelectionModal: React.FC<PointSelectionModalProps> = ({ 
  open, onClose, groupName, availablePoints, onConfirm 
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const handleToggle = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleConfirm = () => {
    onConfirm(selectedIds);
    setSelectedIds([]);
    onClose();
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      fullScreen={isMobile}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: { 
          borderRadius: isMobile ? 0 : '28px', 
          bgcolor: 'background.paper',
          overflow: 'hidden',
          backgroundImage: 'none'
        }
      }}
    >
      {/* Header */}
      <Box className="relative p-6 bg-gradient-to-r from-indigo-600 to-violet-600 text-white overflow-hidden">
        <Box className="absolute top-[-20px] right-[-20px] w-32 h-32 rounded-full bg-white/10 blur-2xl" />
        <Box className="relative z-10 flex justify-between items-center">
          <Box>
            <Typography variant="h6" className="font-black tracking-tight leading-none mb-1">Add to Group</Typography>
            <Typography variant="caption" className="text-white/60 font-bold uppercase tracking-widest text-[10px]">
              Target: <span className="text-white">{groupName}</span>
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small" className="bg-black/20 text-white hover:bg-black/30">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      <DialogContent className="p-6 bg-slate-50 dark:bg-slate-900">
        <Box className="mb-4 flex items-center justify-between">
          <Typography variant="caption" className="font-black text-slate-400 uppercase tracking-widest text-[10px]">
            Available Points ({availablePoints.length})
          </Typography>
          <Box className="px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/30 text-[9px] font-black text-indigo-600 uppercase">
            {selectedIds.length} Selected
          </Box>
        </Box>

        <Stack spacing={1.5} className="max-h-[60vh] overflow-y-auto pr-1">
          <AnimatePresence mode="popLayout">
            {availablePoints.map((point, index) => (
              <motion.div
                key={point.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Box 
                  onClick={() => handleToggle(point.id)}
                  className={`flex items-center gap-3 p-3 rounded-2xl border transition-all cursor-pointer ${
                    selectedIds.includes(point.id)
                      ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 shadow-sm'
                      : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700'
                  }`}
                >
                  <Checkbox 
                    size="small"
                    checked={selectedIds.includes(point.id)}
                    icon={<UnselectedIcon sx={{ fontSize: 20 }} />}
                    checkedIcon={<SelectedIcon sx={{ fontSize: 20, color: '#6366f1' }} />}
                    sx={{ p: 0 }}
                  />
                  <Box className="flex-1 overflow-hidden">
                    <Typography variant="body2" className="font-bold text-slate-700 dark:text-slate-200 truncate">
                      {point.type === 'keyvalue' ? `${point.key}: ${point.value}` : (point.content || point.type.toUpperCase())}
                    </Typography>
                    <Box className="flex items-center gap-2 mt-0.5">
                      <Chip 
                        label={point.type.toUpperCase()} 
                        size="small" 
                        sx={{ 
                          height: 14, 
                          fontSize: '8px', 
                          fontWeight: 900,
                          bgcolor: 'slate.100',
                          color: 'slate.500',
                          borderRadius: '4px'
                        }} 
                      />
                    </Box>
                  </Box>
                </Box>
              </motion.div>
            ))}
          </AnimatePresence>

          {availablePoints.length === 0 && (
            <Box className="py-12 text-center opacity-30">
              <FilterIcon sx={{ fontSize: 32, mb: 1 }} />
              <Typography variant="body2" className="font-bold">No ungrouped points</Typography>
              <Typography variant="caption">All points are already assigned to groups</Typography>
            </Box>
          )}
        </Stack>

        <Box className="mt-8">
          <Button
            fullWidth
            variant="contained"
            disabled={selectedIds.length === 0}
            onClick={handleConfirm}
            className={`py-4 rounded-2xl shadow-xl transition-all normal-case font-black text-lg ${
              selectedIds.length > 0 
                ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/30 text-white' 
                : 'bg-slate-200 text-slate-400'
            }`}
          >
            Add Selected Items
          </Button>
          <Button 
            fullWidth 
            onClick={onClose}
            className="mt-2 text-slate-400 dark:text-slate-500 font-bold normal-case"
          >
            Cancel
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default PointSelectionModal;
