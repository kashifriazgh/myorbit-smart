'use client';

import React, { useState } from 'react';
import { useProjects } from '@/app/lib/context/ProjectsContext';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import ProjectCard from '@/components/projects/ProjectCard';
import NewProjectModal from '@/components/projects/NewProjectModal';
import { Box, Typography, Button, Tabs, Tab, CircularProgress, Container } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { motion, AnimatePresence } from 'framer-motion';

export default function ProjectsPage() {
  const { projects, loading } = useProjects();
  useCustomTheme();
  const [filter, setFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const filteredProjects = projects.filter((p) => {
    if (filter === 'all') return true;
    return p.status === filter;
  });

  if (loading) {
    return (
      <Box className="flex justify-center items-center min-h-[80vh]">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="sm" className="px-4 py-8 pb-32">
      <Box className="flex justify-between items-center mb-8">
        <Box>
          <Typography variant="h4" className="font-black text-slate-900 dark:text-white tracking-tighter">
            Projects
          </Typography>
          <Typography variant="body2" className="text-slate-500 font-medium">
            Manage your big ideas and goals
          </Typography>
        </Box>
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setIsModalOpen(true)}
            className="rounded-2xl px-6 py-3 bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-500/30 normal-case font-black"
          >
            New Project
          </Button>
        </motion.div>
      </Box>

      <Box className="mb-8 sticky top-0 z-10 bg-gray-50/80 dark:bg-gray-900/80 backdrop-blur-md py-2">
        <Tabs
          value={filter}
          onChange={(_, val) => setFilter(val)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            '& .MuiTabs-indicator': { height: 4, borderRadius: '4px 4px 0 0', bgcolor: '#6366f1' },
            '& .MuiTab-root': { textTransform: 'none', fontWeight: 900, fontSize: '0.875rem', minWidth: 80, color: '#94a3b8' },
            '& .Mui-selected': { color: '#6366f1 !important' },
          }}
        >
          <Tab label="All" value="all" />
          <Tab label="Active" value="active" />
          <Tab label="Planning" value="planning" />
          <Tab label="Completed" value="completed" />
          <Tab label="On Hold" value="on-hold" />
        </Tabs>
      </Box>

      <Box className="grid grid-cols-1 gap-6">
        <AnimatePresence mode="popLayout">
          {filteredProjects.length > 0 ? (
            filteredProjects.map((project, index) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <ProjectCard project={project} />
              </motion.div>
            ))
          ) : (
            <Box className="flex flex-col items-center justify-center py-20 text-center opacity-40">
              <Typography variant="h5" className="font-black mb-2">No projects found</Typography>
              <Typography variant="body2">Try a different filter or create a new one</Typography>
            </Box>
          )}
        </AnimatePresence>
      </Box>

      <NewProjectModal open={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </Container>
  );
}
