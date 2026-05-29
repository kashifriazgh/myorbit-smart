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
import { useCustomTheme } from '@/app/lib/context/themeContext';

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
  const { theme: customTheme } = useCustomTheme();
  const isDark = customTheme?.mode === 'dark';
  
  return (
    <Box 
      className="mb-4 rounded-xl border overflow-hidden"
      sx={{
        bgcolor: isDark ? 'rgba(30, 41, 59, 0.2)' : 'rgba(241, 245, 249, 0.5)',
        borderColor: isDark ? '#1e293b' : '#f1f5f9'
      }}
    >
      <Box 
        className="flex items-center justify-between p-3 cursor-pointer border-b"
        sx={{
          bgcolor: isDark ? '#0f172a' : '#ffffff',
          borderColor: isDark ? '#1e293b' : '#f1f5f9'
        }}
      >
        <Box 
          onClick={() => setOpen(!open)}
          className="flex items-center gap-3 flex-1"
        >
          <GroupIcon sx={{ fontSize: 16, color: '#6366f1' }} />
          <Typography 
            variant="caption" 
            className="font-black uppercase tracking-widest text-[11px]"
            sx={{ color: isDark ? '#cbd5e1' : '#334155' }}
          >
            {groupName}
          </Typography>
          <Box 
            className="px-1.5 py-0.5 rounded text-[9px] font-bold"
            sx={{
              bgcolor: isDark ? '#1e293b' : '#f1f5f9',
              color: isDark ? '#94a3b8' : '#64748b'
            }}
          >
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
  const { theme: customTheme } = useCustomTheme();
  const isDark = customTheme?.mode === 'dark';
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
            className="overflow-hidden border border-t-0 rounded-b-[18px] p-3"
            style={{
              backgroundColor: isDark ? 'rgba(15, 23, 42, 0.4)' : '#ffffff',
              borderColor: isDark ? '#1e293b' : '#e2e8f0'
            }}
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
                className="flex-1 py-3 rounded-xl border-dashed border-2 transition-all normal-case font-black text-[11px] tracking-wider uppercase"
                sx={{
                  borderColor: isDark ? '#1e293b' : '#e2e8f0',
                  color: isDark ? '#94a3b8' : '#64748b',
                  '&:hover': {
                    borderColor: '#6366f1',
                    color: '#6366f1',
                    bgcolor: isDark ? 'rgba(99, 102, 241, 0.05)' : 'rgba(99, 102, 241, 0.02)'
                  }
                }}
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
                className="flex-1 py-3 rounded-xl border-dashed border-2 transition-all normal-case font-black text-[11px] tracking-wider uppercase"
                sx={{
                  borderColor: isDark ? '#1e293b' : '#e2e8f0',
                  color: isDark ? '#94a3b8' : '#64748b',
                  '&:hover': {
                    borderColor: '#6366f1',
                    color: '#6366f1',
                    bgcolor: isDark ? 'rgba(99, 102, 241, 0.05)' : 'rgba(99, 102, 241, 0.02)'
                  }
                }}
              >
                Add Group
              </Button>
            </Box>

            {isAddingGroup && (
              <ClickAwayListener onClickAway={() => setIsAddingGroup(false)}>
                <Box 
                  className="mt-3 p-3 rounded-xl border shadow-lg"
                  sx={{
                    bgcolor: isDark ? '#0f172a' : '#ffffff',
                    borderColor: isDark ? '#1e293b' : '#e2e8f0'
                  }}
                >
                  <TextField
                    fullWidth
                    size="small"
                    autoFocus
                    placeholder="Enter group name..."
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateGroup()}
                    sx={{ 
                      mb: 2, 
                      '& .MuiOutlinedInput-root': { 
                        borderRadius: '12px',
                        bgcolor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)',
                        color: isDark ? '#f1f5f9' : '#0f172a',
                        '& fieldset': {
                          borderColor: isDark ? '#334155' : '#e2e8f0',
                        }
                      } 
                    }}
                  />
                  
                  {/* Point Selection */}
                  <Box className="mb-3">
                    <Typography 
                      variant="caption" 
                      className="font-black uppercase tracking-widest text-[9px] mb-1 block"
                      sx={{ color: isDark ? '#94a3b8' : '#64748b' }}
                    >
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
                            <Typography variant="caption" className="font-bold" sx={{ color: isDark ? '#cbd5e1' : '#475569' }}>
                              {p.type === 'keyvalue' ? `${p.key}: ${p.value}` : (p.content || p.type.toUpperCase())}
                            </Typography>
                          }
                          sx={{ display: 'flex', mb: 0.5, ml: 0 }}
                        />
                      ))}
                      {agenda.points?.filter(p => !p.groupName).length === 0 && (
                        <Typography variant="caption" className="italic block py-2" sx={{ color: isDark ? '#94a3b8' : '#64748b' }}>No ungrouped points available</Typography>
                      )}
                    </Box>
                  </Box>

                  <Box 
                    className="flex justify-end gap-2 border-t pt-2"
                    sx={{ borderColor: isDark ? '#1e293b' : '#f1f5f9' }}
                  >
                    <Button size="small" onClick={() => {
                      setIsAddingGroup(false);
                      setSelectedPointIds([]);
                    }} className="font-bold" sx={{ color: isDark ? '#94a3b8' : '#64748b' }}>Cancel</Button>
                    <Button 
                      size="small" 
                      variant="contained" 
                      onClick={handleCreateGroup} 
                      disabled={!newGroupName.trim()}
                      className="text-white font-bold rounded-lg px-4"
                      sx={{ bgcolor: '#6366f1', '&:hover': { bgcolor: '#4f46e5' } }}
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

