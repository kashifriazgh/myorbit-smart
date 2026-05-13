'use client';

import React, { useState } from 'react';
import { Agenda, Point } from '@/app/lib/interface';
import PointRow from './PointRow';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ExpandMore as ExpandMoreIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { Box, Typography, Button } from '@mui/material';

interface AgendaBlockProps {
  agenda: Agenda;
  onAddPoint: (agendaId: string) => void;
  onUpdatePoint: (agendaId: string, pointId: string, updates: Partial<Point>) => void;
  onDeletePoint: (agendaId: string, pointId: string) => void;
  isFirst?: boolean;
}

const GroupItem: React.FC<{ 
  groupName: string, 
  points: Point[], 
  onDeletePoint: (pointId: string) => void,
  onUpdatePoint: (pointId: string, updates: Partial<Point>) => void 
}> = ({ groupName, points, onDeletePoint, onUpdatePoint }) => {
  const [open, setOpen] = useState(true);
  
  return (
    <Box className="mb-2">
      <Box 
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between p-2 cursor-pointer group/groupbtn"
      >
        <Box className="flex items-center gap-2">
          <Box className="w-1.5 h-1.5 rounded-sm bg-slate-300" />
          <Typography variant="caption" className="font-black text-slate-600 uppercase tracking-widest text-[11px]">
            {groupName}
          </Typography>
        </Box>
        <Box className="flex items-center gap-2 text-slate-400">
          <Typography variant="caption" className="font-bold text-[10px]">{points.length}</Typography>
          <motion.div animate={{ rotate: open ? 180 : 0 }}>
            <ExpandMoreIcon sx={{ fontSize: 14 }} />
          </motion.div>
        </Box>
      </Box>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            {points.map((point) => (
              <PointRow 
                key={point.id} 
                point={point} 
                onDelete={onDeletePoint}
                onUpdate={(updates) => onUpdatePoint(point.id, updates)}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  );
};

const AgendaBlock: React.FC<AgendaBlockProps> = ({ agenda, onAddPoint, onUpdatePoint, onDeletePoint, isFirst }) => {
  const [isExpanded, setIsExpanded] = useState(isFirst || false);

  return (
    <Box className="mb-4">
      <Box 
        onClick={() => setIsExpanded(!isExpanded)}
        sx={{ 
          bgcolor: isExpanded ? '#0f172a' : '#1e293b',
          borderRadius: isExpanded ? '14px 14px 0 0' : '14px',
          color: '#f1f5f9'
        }}
        className="flex items-center justify-between p-4 cursor-pointer transition-all shadow-lg"
      >
        <Typography variant="subtitle1" className="font-extrabold tracking-tight">
          {agenda.title}
        </Typography>
        <Box className="flex items-center gap-3">
          <Box className="px-2.5 py-0.5 rounded-full bg-[#0f172a] text-[10px] font-black text-slate-500 uppercase">
            {agenda.points?.length || 0} items
          </Box>
          <motion.div animate={{ rotate: isExpanded ? 180 : 0 }}>
            <ExpandMoreIcon fontSize="small" sx={{ color: '#475569' }} />
          </motion.div>
        </Box>
      </Box>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-[#f8fafc] dark:bg-slate-800/20 border border-slate-200 dark:border-slate-800 border-t-0 rounded-b-[14px] p-2"
          >
            <Box className="flex flex-col">
              {/* Ungrouped Points */}
              {agenda.points?.filter(p => !p.groupName).map((point) => (
                <PointRow 
                  key={point.id} 
                  point={point} 
                  onDelete={(pointId) => onDeletePoint(agenda.id, pointId)}
                  onUpdate={(updates) => onUpdatePoint(agenda.id, point.id, updates)}
                />
              ))}

              {/* Grouped Points */}
              {Object.entries(
                agenda.points?.filter(p => p.groupName).reduce((acc: Record<string, typeof agenda.points>, p) => {
                  const group = p.groupName!;
                  if (!acc[group]) acc[group] = [];
                  acc[group].push(p);
                  return acc;
                }, {}) || {}
              ).map(([groupName, points]) => (
                <GroupItem 
                  key={groupName} 
                  groupName={groupName} 
                  points={points} 
                  onDeletePoint={(pointId) => onDeletePoint(agenda.id, pointId)} 
                  onUpdatePoint={(pointId, updates) => onUpdatePoint(agenda.id, pointId, updates)}
                />
              ))}
            </Box>
            
            <Button
              fullWidth
              startIcon={<AddIcon fontSize="small" />}
              onClick={(e) => {
                e.stopPropagation();
                onAddPoint(agenda.id);
              }}
              className="mt-3 py-3 rounded-xl border-dashed border-2 border-slate-200 dark:border-slate-800 text-slate-400 hover:text-indigo-600 hover:border-indigo-200 hover:bg-white transition-all normal-case font-black text-[11px] tracking-wider uppercase"
            >
              Add Item
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  );
};

export default AgendaBlock;
