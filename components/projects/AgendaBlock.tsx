'use client';

import React, { useState, useMemo } from 'react';
import { Agenda, Point } from '@/app/lib/interface';
import PointRow from './PointRow';
import { motion, AnimatePresence } from 'framer-motion';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AddIcon from '@mui/icons-material/Add';
import GroupIcon from '@mui/icons-material/FolderOpen';
import AddPointIcon from '@mui/icons-material/AddCircleOutline';
import SelectedIcon from '@mui/icons-material/CheckCircle';
import UnselectedIcon from '@mui/icons-material/RadioButtonUnchecked';
import { Box, Typography, Button, IconButton, TextField, ClickAwayListener, Checkbox, FormControlLabel } from '@mui/material';
import { useProjects } from '@/app/lib/context/ProjectsContext';
import PointSelectionModal from './PointSelectionModal';

interface AgendaBlockProps {
  projectId: string;
  agenda: Agenda;
  onAddPoint: (agendaId: string, groupName?: string) => void;
  onUpdatePoint: (agendaId: string, pointId: string, updates: Partial<Point>) => void;
  onDeletePoint: (agendaId: string, pointId: string) => void;
  isFirst?: boolean;
}

const GroupItem: React.FC<{ 
  groupName: string, 
  points: Point[], 
  onDeletePoint: (pointId: string) => void,
  onUpdatePoint: (pointId: string, updates: Partial<Point>) => void,
  onAddPoint: () => void
}> = ({ groupName, points, onDeletePoint, onUpdatePoint, onAddPoint }) => {
  const [open, setOpen] = useState(true);
  
  return (
    <Box className="mb-4 bg-slate-50/50 dark:bg-slate-900/20 rounded-xl border border-slate-100 dark:border-slate-800/50 overflow-hidden">
      <Box 
        className="flex items-center justify-between p-3 cursor-pointer bg-white dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800/50"
      >
        <Box 
          onClick={() => setOpen(!open)}
          className="flex items-center gap-3 flex-1"
        >
          <GroupIcon sx={{ fontSize: 16, color: '#6366f1' }} />
          <Typography variant="caption" className="font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest text-[11px]">
            {groupName}
          </Typography>
          <Box className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[9px] font-bold text-slate-500">
            {points.length}
          </Box>
        </Box>
        <Box className="flex items-center gap-1">
          <IconButton 
            size="small" 
            onClick={(e) => {
              e.stopPropagation();
              onAddPoint();
            }}
            className="text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
          >
            <AddPointIcon sx={{ fontSize: 18 }} />
          </IconButton>
          <IconButton 
            size="small" 
            onClick={() => setOpen(!open)}
            className="text-slate-400"
          >
            <motion.div animate={{ rotate: open ? 180 : 0 }}>
              <ExpandMoreIcon sx={{ fontSize: 18 }} />
            </motion.div>
          </IconButton>
        </Box>
      </Box>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden p-2"
          >
            {points.length > 0 ? points.map((point) => (
              <PointRow 
                key={point.id} 
                point={point} 
                onDelete={onDeletePoint}
                onUpdate={(updates) => onUpdatePoint(point.id, updates)}
              />
            )) : (
              <Box className="py-6 text-center opacity-40">
                <Typography variant="caption" className="font-bold uppercase tracking-tighter text-slate-400">Empty Group</Typography>
              </Box>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  );
};

const AgendaBlock: React.FC<AgendaBlockProps> = ({ projectId, agenda, onAddPoint, onUpdatePoint, onDeletePoint, isFirst }) => {
  const { updateMultiplePoints } = useProjects();
  const [isExpanded, setIsExpanded] = useState(isFirst || false);
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedPointIds, setSelectedPointIds] = useState<string[]>([]);
  const [localGroups, setLocalGroups] = useState<string[]>([]);
  const [selectingForGroup, setSelectingForGroup] = useState<string | null>(null);

  const groups = useMemo(() => {
    const existingGroups = Array.from(new Set(agenda.points?.filter(p => p.groupName).map(p => p.groupName!) || []));
    return Array.from(new Set([...existingGroups, ...localGroups]));
  }, [agenda.points, localGroups]);

  const handleCreateGroup = async () => {
    const gName = newGroupName.trim();
    if (!gName) return; // Validation
    
    setLocalGroups(prev => [...prev, gName]);
    
    // Update selected points using batch update
    if (selectedPointIds.length > 0) {
      await updateMultiplePoints(projectId, agenda.id, selectedPointIds, { groupName: gName });
    }

    setNewGroupName('');
    setSelectedPointIds([]);
    setIsAddingGroup(false);
  };

  const handleModalConfirm = async (pIds: string[]) => {
    if (selectingForGroup && pIds.length > 0) {
      await updateMultiplePoints(projectId, agenda.id, pIds, { groupName: selectingForGroup });
    }
    setSelectingForGroup(null);
  };

  return (
    <Box className="mb-6">
      <Box 
        onClick={() => setIsExpanded(!isExpanded)}
        className={`flex items-center justify-between p-4 cursor-pointer transition-all shadow-xl ${
          isExpanded 
            ? 'bg-slate-900 dark:bg-slate-900 rounded-t-[18px]' 
            : 'bg-slate-800 dark:bg-slate-800 rounded-[18px]'
        } text-white`}
      >
        <Typography variant="subtitle1" className="font-extrabold tracking-tight">
          {agenda.title}
        </Typography>
        <Box className="flex items-center gap-3">
          <Box className="px-2.5 py-0.5 rounded-full bg-black/30 text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {agenda.points?.length || 0}
          </Box>
          <motion.div animate={{ rotate: isExpanded ? 180 : 0 }}>
            <ExpandMoreIcon fontSize="small" className="text-slate-500" />
          </motion.div>
        </Box>
      </Box>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 border-t-0 rounded-b-[18px] p-3"
          >
            <Box className="flex flex-col gap-1">
              {/* Ungrouped Points */}
              {agenda.points?.filter(p => !p.groupName).map((point) => (
                <PointRow 
                  key={point.id} 
                  point={point} 
                  onDelete={(pointId) => onDeletePoint(agenda.id, pointId)}
                  onUpdate={(updates) => onUpdatePoint(agenda.id, point.id, updates)}
                />
              ))}

              {/* Grouped Sections */}
              {groups.map((groupName) => (
                <GroupItem 
                  key={groupName} 
                  groupName={groupName} 
                  points={agenda.points?.filter(p => p.groupName === groupName) || []} 
                  onDeletePoint={(pointId) => onDeletePoint(agenda.id, pointId)} 
                  onUpdatePoint={(pointId, updates) => onUpdatePoint(agenda.id, pointId, updates)}
                  onAddPoint={() => setSelectingForGroup(groupName)}
                />
              ))}
            </Box>
            
            <Box className="flex gap-2 mt-4">
              <Button
                fullWidth
                startIcon={<AddIcon fontSize="small" />}
                onClick={(e) => {
                  e.stopPropagation();
                  onAddPoint(agenda.id);
                }}
                className="flex-1 py-3 rounded-xl border-dashed border-2 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-indigo-600 hover:border-indigo-300 hover:bg-white dark:hover:bg-slate-800 transition-all normal-case font-black text-[11px] tracking-wider uppercase"
              >
                Add Point
              </Button>
              <Button
                fullWidth
                startIcon={<GroupIcon fontSize="small" />}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsAddingGroup(true);
                }}
                className="flex-1 py-3 rounded-xl border-dashed border-2 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-indigo-600 hover:border-indigo-300 hover:bg-white dark:hover:bg-slate-800 transition-all normal-case font-black text-[11px] tracking-wider uppercase"
              >
                Add Group
              </Button>
            </Box>

            {isAddingGroup && (
              <ClickAwayListener onClickAway={() => setIsAddingGroup(false)}>
                <Box className="mt-3 p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg">
                  <TextField
                    fullWidth
                    size="small"
                    autoFocus
                    placeholder="Enter group name..."
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateGroup()}
                    sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                  />
                  
                  {/* Point Selection */}
                  <Box className="mb-3">
                    <Typography variant="caption" className="font-black text-slate-400 uppercase tracking-widest text-[9px] mb-1 block">
                      Select points to add to group
                    </Typography>
                    <Box className="max-h-40 overflow-y-auto pr-1">
                      {agenda.points?.filter(p => !p.groupName).map(p => (
                        <FormControlLabel
                          key={p.id}
                          control={
                            <Checkbox 
                              size="small"
                              checked={selectedPointIds.includes(p.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedPointIds(prev => [...prev, p.id]);
                                } else {
                                  setSelectedPointIds(prev => prev.filter(id => id !== p.id));
                                }
                              }}
                              icon={<UnselectedIcon sx={{ fontSize: 18 }} />}
                              checkedIcon={<SelectedIcon sx={{ fontSize: 18, color: '#6366f1' }} />}
                            />
                          }
                          label={
                            <Typography variant="caption" className="font-bold text-slate-600 dark:text-slate-400">
                              {p.type === 'keyvalue' ? `${p.key}: ${p.value}` : (p.content || p.type.toUpperCase())}
                            </Typography>
                          }
                          sx={{ display: 'flex', mb: 0.5, ml: 0 }}
                        />
                      ))}
                      {agenda.points?.filter(p => !p.groupName).length === 0 && (
                        <Typography variant="caption" className="italic text-slate-400 block py-2">No ungrouped points available</Typography>
                      )}
                    </Box>
                  </Box>

                  <Box className="flex justify-end gap-2 border-t border-slate-100 dark:border-slate-700 pt-2">
                    <Button size="small" onClick={() => {
                      setIsAddingGroup(false);
                      setSelectedPointIds([]);
                    }} className="text-slate-400 font-bold">Cancel</Button>
                    <Button 
                      size="small" 
                      variant="contained" 
                      onClick={handleCreateGroup} 
                      disabled={!newGroupName.trim()}
                      className="bg-indigo-600 text-white font-bold rounded-lg px-4"
                    >
                      Create & Add
                    </Button>
                  </Box>
                </Box>
              </ClickAwayListener>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <PointSelectionModal 
        open={!!selectingForGroup}
        onClose={() => setSelectingForGroup(null)}
        groupName={selectingForGroup || ''}
        availablePoints={agenda.points?.filter(p => !p.groupName) || []}
        onConfirm={handleModalConfirm}
      />
    </Box>
  );
};

export default AgendaBlock;

