'use client';

import React from 'react';
import { Project } from '@/app/lib/interface';
import { Box, Typography, AvatarGroup, Avatar, Chip, LinearProgress } from '@mui/material';
import { motion } from 'framer-motion';
import TimeIcon from '@mui/icons-material/AccessTime';
import ProjectIcon from '@mui/icons-material/Assignment';
import Link from 'next/link';
import { toDateSafe } from '@/app/lib/utilts';

interface ProjectCardProps {
  project: Project;
}

const typeColors: Record<string, { bg: string, text: string, iconBg: string }> = {
  general: { bg: '#f1f5f9', text: '#475569', iconBg: '#e2e8f0' },
  learning: { bg: '#eff6ff', text: '#2563eb', iconBg: '#dbeafe' },
  freelance: { bg: '#fdf4ff', text: '#c026d3', iconBg: '#fae8ff' },
  health: { bg: '#f0fdf4', text: '#16a34a', iconBg: '#dcfce7' },
  personal: { bg: '#fff7ed', text: '#ea580c', iconBg: '#ffedd5' },
};

const statusColors: Record<string, string> = {
  active: '#10b981',
  planning: '#6366f1',
  completed: '#94a3b8',
  'on-hold': '#f59e0b',
};

const ProjectCard: React.FC<ProjectCardProps> = ({ project }) => {
  const styles = typeColors[project.type] || typeColors.general;

  return (
    <motion.div
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      whileTap={{ scale: 0.98 }}
    >
      <Link href={`/projects/${project.id}`}>
        <Box className="relative overflow-hidden p-5 rounded-[24px] border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-xl hover:shadow-indigo-500/10 transition-all">
          <Box className="flex justify-between items-start mb-4">
            <Box 
              className="p-3 rounded-2xl" 
              sx={{ bgcolor: styles.iconBg }}
            >
              <ProjectIcon sx={{ color: styles.text }} />
            </Box>
            <Chip 
              label={project.status.toUpperCase()} 
              size="small" 
              sx={{ 
                height: 20, 
                fontSize: '9px', 
                fontWeight: 900, 
                bgcolor: statusColors[project.status] + '20', 
                color: statusColors[project.status],
                border: `1px solid ${statusColors[project.status]}40`
              }} 
            />
          </Box>

          <Typography variant="h6" className="font-black text-slate-800 dark:text-slate-100 mb-1 leading-tight">
            {project.title}
          </Typography>
          <Typography variant="caption" className="text-slate-400 block mb-4 line-clamp-2">
            {project.description || 'No description provided.'}
          </Typography>

          <Box className="mb-4">
            <Box className="flex justify-between items-center mb-1.5">
              <Typography variant="caption" className="font-bold text-slate-500">
                Progress
              </Typography>
              <Typography variant="caption" className="font-black text-indigo-600">
                {project.progress}%
              </Typography>
            </Box>
            <LinearProgress 
              variant="determinate" 
              value={project.progress} 
              sx={{ 
                height: 6, 
                borderRadius: 3, 
                bgcolor: '#f1f5f9',
                '& .MuiLinearProgress-bar': {
                  borderRadius: 3,
                  backgroundImage: 'linear-gradient(90deg, #6366f1, #a855f7)'
                }
              }} 
            />
          </Box>

          <Box className="flex justify-between items-center mt-6 pt-4 border-t border-slate-50 dark:border-slate-800">
            <Box className="flex items-center gap-1.5">
              <TimeIcon sx={{ fontSize: 14, color: '#94a3b8' }} />
              <Typography variant="caption" className="text-slate-400 font-medium">
                {project.estimatedCompletion ? toDateSafe(project.estimatedCompletion)?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'No deadline'}
              </Typography>
            </Box>
            
            <AvatarGroup max={3} sx={{ '& .MuiAvatar-root': { width: 24, height: 24, fontSize: '10px', border: '2px solid #fff' } }}>
              {project.assignees?.map((name, i) => (
                <Avatar key={i} alt={name}>{name.charAt(0)}</Avatar>
              ))}
            </AvatarGroup>
          </Box>
        </Box>
      </Link>
    </motion.div>
  );
};

export default ProjectCard;
