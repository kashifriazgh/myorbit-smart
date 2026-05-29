'use client';

import React, { useState, useMemo } from 'react';
import { Project } from '@/app/lib/interface';
import { useProjects } from '@/app/lib/context/ProjectsContext';
import AgendaBlock from './AgendaBlock';
import NewAgendaModal from './NewAgendaModal';
import NewPointModal from './NewPointModal';
import { useTodoContext } from '@/app/lib/context/todoContext';
import { useGoals } from '@/app/lib/context/GoalsContext';
import { Point } from '@/app/lib/interface';
import { Box, Typography, Button, Container } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import MoneyIcon from '@mui/icons-material/AttachMoney';
import PeopleIcon from '@mui/icons-material/People';
import CalendarIcon from '@mui/icons-material/CalendarToday';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { toDateSafe } from '@/app/lib/utilts';
import { useCustomTheme } from '@/app/lib/context/themeContext';

interface ProjectDetailProps {
  project: Project;
}

const ProjectDetail: React.FC<ProjectDetailProps> = ({ project }) => {
  const { deletePoint, updatePoint } = useProjects();
  const [isAgendaModalOpen, setIsAgendaModalOpen] = useState(false);
  const [isPointModalOpen, setIsPointModalOpen] = useState(false);
  const [selectedAgendaId, setSelectedAgendaId] = useState<string | null>(null);
  const [selectedGroupName, setSelectedGroupName] = useState<string | undefined>(undefined);
  const [editingPoint, setEditingPoint] = useState<Point | null>(null);

  const { todos } = useTodoContext();
  const { goals } = useGoals();
  const { theme: customTheme } = useCustomTheme();
  const isDark = customTheme?.mode === 'dark';

  const existingGroups = useMemo(() => {
    const groups = new Set<string>();
    project.agendas?.forEach(a => a.points?.forEach(p => {
      if (p.groupName) groups.add(p.groupName);
    }));
    return Array.from(groups);
  }, [project.agendas]);

  const overallProgress = useMemo(() => {
    const allPoints = project.agendas?.flatMap(a => a.points || []) || [];
    if (allPoints.length === 0) return 0;

    let totalProgress = 0;
    allPoints.forEach(p => {
      if (p.type === 'todo') {
        const todo = todos.find(t => t.id === p.todoId);
        totalProgress += todo?.status === 'completed' ? 100 : (todo?.progressPercent || 0);
      } else if (p.type === 'goal') {
        const goal = goals.find(g => g.id === p.goalId);
        totalProgress += goal?.status === 'Completed' ? 100 : (goal?.progress || 0);
      } else {
        totalProgress += p.done ? 100 : 0;
      }
    });

    return Math.round(totalProgress / allPoints.length);
  }, [project.agendas, todos, goals]);


  // Actually use updateProject
  const { updateProject: updateProjectInDB } = useProjects();
  React.useEffect(() => {
    if (project.id && overallProgress !== project.progress) {
      updateProjectInDB(project.id, { progress: overallProgress });
    }
  }, [overallProgress, project.id, project.progress, updateProjectInDB]);

  const stats = useMemo(() => {
    const agendas = project.agendas?.length || 0;
    const points = project.agendas?.reduce((acc, a) => acc + (a.points?.length || 0), 0) || 0;

    // Days left calculation
    let daysLeft = 'N/A';
    if (project.estimatedCompletion) {
      const deadline = toDateSafe(project.estimatedCompletion);
      if (deadline) {
        const diff = deadline.getTime() - new Date().getTime();
        daysLeft = Math.ceil(diff / (1000 * 60 * 60 * 24)).toString();
      }
    }

    return { agendas, points, daysLeft };
  }, [project]);

  const handleAddPoint = (agendaId: string, groupName?: string) => {
    setEditingPoint(null);
    setSelectedAgendaId(agendaId);
    setSelectedGroupName(groupName);
    setIsPointModalOpen(true);
  };

  const handleUpdatePoint = (agendaId: string, pointId: string, updates: Partial<Point>) => {
    if (updates.id) {
      // It's a full point object, open edit modal
      setEditingPoint(updates as Point);
      setSelectedAgendaId(agendaId);
      setIsPointModalOpen(true);
    } else {
      // It's a partial update
      updatePoint(project.id!, agendaId, pointId, updates);
    }
  };

  return (
    <Box 
      className="min-h-screen pb-32"
      sx={{ bgcolor: isDark ? '#0b0f19' : '#f8fafc' }}
    >
      {/* ── Hero Header ── */}
      <Box className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 pt-12 pb-8 px-6 text-white">
        {/* Decorative elements */}
        <Box className="absolute top-[-50px] right-[-50px] w-48 h-48 rounded-full bg-indigo-500/10 blur-3xl" />
        <Box className="absolute bottom-[-20px] left-[-20px] w-32 h-32 rounded-full bg-emerald-500/10 blur-2xl" />

        <Link href="/projects" passHref>
          <Button
            startIcon={<ArrowBackIcon />}
            className="mb-6 text-slate-400 hover:text-white normal-case font-bold"
          >
            Projects
          </Button>
        </Link>

        <Box className="flex justify-between items-start gap-6">
          <Box className="flex-1">
            <Box className="flex gap-2 mb-3">
              <Box className="px-3 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-[10px] font-black text-emerald-400 tracking-widest">
                {project.status.toUpperCase()}
              </Box>
              <Box className="px-3 py-0.5 rounded-full bg-white/10 text-[10px] font-black text-white/60 tracking-widest uppercase">
                {project.type}
              </Box>
            </Box>
            <Typography variant="h4" className="font-black tracking-tighter mb-2 leading-tight">
              {project.title}
            </Typography>
            <Typography variant="body2" className="text-slate-400 font-medium mb-6 line-clamp-3">
              {project.description}
            </Typography>

            <Box className="flex flex-wrap gap-4">
              {project.estimatedCompletion && (
                <Box className="flex items-center gap-2">
                  <CalendarIcon sx={{ fontSize: 14, color: '#f59e0b' }} />
                  <Typography variant="caption" className="text-amber-400 font-bold">
                    {toDateSafe(project.estimatedCompletion)?.toLocaleDateString()}
                  </Typography>
                </Box>
              )}
              {project.assignees && project.assignees.length > 0 && (
                <Box className="flex items-center gap-2">
                  <PeopleIcon sx={{ fontSize: 14, color: '#60a5fa' }} />
                  <Typography variant="caption" className="text-blue-400 font-bold">
                    {project.assignees.join(', ')}
                  </Typography>
                </Box>
              )}
              {project.budget && (
                <Box className="flex items-center gap-2">
                  <MoneyIcon sx={{ fontSize: 14, color: '#10b981' }} />
                  <Typography variant="caption" className="text-emerald-400 font-bold">
                    ${project.budget}
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>

          {/* Circular Progress */}
          <Box className="relative w-20 h-20 flex-shrink-0">
            <svg width="80" height="80" className="transform -rotate-90">
              <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
              <motion.circle
                cx="40" cy="40" r="34"
                fill="none"
                stroke="#6366f1"
                strokeWidth="8"
                strokeDasharray={213.6}
                initial={{ strokeDashoffset: 213.6 }}
                animate={{ strokeDashoffset: 213.6 * (1 - project.progress / 100) }}
                transition={{ duration: 1, ease: "easeOut" }}
                strokeLinecap="round"
              />
            </svg>
            <Box className="absolute inset-0 flex flex-col items-center justify-center">
              <Typography variant="h6" className="font-black leading-none">{project.progress}%</Typography>
            </Box>
          </Box>
        </Box>

        {/* Task Completion Bar */}
        <Box className="mt-8 p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
          <Box className="flex justify-between items-center mb-2">
            <Typography variant="caption" className="text-white/40 font-bold uppercase tracking-widest text-[9px]">Overall Progress</Typography>
            <Typography variant="caption" className="text-indigo-400 font-black tracking-tighter uppercase text-[10px]">Auto Calculated</Typography>
          </Box>
          <Box className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${project.progress}%` }}
              className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400"
            />
          </Box>
        </Box>
      </Box>

      {/* ── Stats Strip ── */}
      <Box 
        className="grid grid-cols-3 border-b"
        sx={{
          bgcolor: isDark ? '#0f172a' : '#ffffff',
          borderColor: isDark ? '#1e293b' : '#f1f5f9'
        }}
      >
        {[
          { label: 'Agendas', value: stats.agendas },
          { label: 'Points', value: stats.points },
          { label: 'Days Left', value: stats.daysLeft },
        ].map((s, i) => (
          <Box 
            key={i} 
            className="py-4 text-center border-r last:border-0"
            sx={{ borderColor: isDark ? '#1e293b' : '#f1f5f9' }}
          >
            <Typography variant="h5" className="font-black" sx={{ color: isDark ? '#ffffff' : '#0f172a' }}>{s.value}</Typography>
            <Typography variant="caption" className="font-bold uppercase tracking-widest text-[9px]" sx={{ color: isDark ? '#94a3b8' : '#64748b' }}>{s.label}</Typography>
          </Box>
        ))}
      </Box>

      {/* ── Agenda List ── */}
      <Container maxWidth="sm" className="mt-8 px-4">
        <Typography 
          variant="caption" 
          className="block mb-4 ml-1 font-black uppercase tracking-widest text-[10px]"
          sx={{ color: isDark ? '#94a3b8' : '#64748b' }}
        >
          Agendas
        </Typography>
        {project.agendas?.length > 0 ? (
          project.agendas.map((agenda, index) => (
            <AgendaBlock
              key={agenda.id}
              projectId={project.id!}
              agenda={agenda}
              onAddPoint={handleAddPoint}
              onUpdatePoint={handleUpdatePoint}
              onDeletePoint={(aId, pId) => deletePoint(project.id!, aId, pId)}
              isFirst={index === 0}
            />
          ))
        ) : (
          <Box className="py-12 text-center opacity-30">
            <Typography variant="h6" className="font-black mb-1" sx={{ color: isDark ? '#f1f5f9' : '#0f172a' }}>No agendas yet</Typography>
            <Typography variant="body2" sx={{ color: isDark ? '#94a3b8' : '#64748b' }}>Break down your project into agendas</Typography>
          </Box>
        )}

        <Button
          fullWidth
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={() => setIsAgendaModalOpen(true)}
          className="mt-4 py-4 rounded-[20px] border-2 border-dashed normal-case font-black transition-all"
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
          Add New Agenda
        </Button>
      </Container>

      {/* Modals */}
      <NewAgendaModal
        open={isAgendaModalOpen}
        onClose={() => setIsAgendaModalOpen(false)}
        projectId={project.id!}
      />
      <NewPointModal
        open={isPointModalOpen}
        onClose={() => {
          setIsPointModalOpen(false);
          setSelectedGroupName(undefined);
          setEditingPoint(null);
        }}
        projectId={project.id!}
        agendaId={selectedAgendaId!}
        initialGroupName={selectedGroupName}
        editPoint={editingPoint}
        existingGroups={existingGroups}
      />
    </Box>

  );
};

export default ProjectDetail;
