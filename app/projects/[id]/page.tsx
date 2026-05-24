'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { useProjects } from '@/app/lib/context/ProjectsContext';
import ProjectDetail from '@/components/projects/ProjectDetail';
import { Box, CircularProgress, Typography, Button } from '@mui/material';
import Link from 'next/link';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

export default function ProjectDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { projects, loading } = useProjects();

  const project = projects.find((p) => p.id === id);

  if (loading) {
    return (
      <Box className="flex justify-center items-center min-h-screen">
        <CircularProgress />
      </Box>
    );
  }

  if (!project) {
    return (
      <Box className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <Typography variant="h5" className="font-black mb-4">Project not found</Typography>
        <Link href="/projects" passHref>
          <Button variant="outlined" startIcon={<ArrowBackIcon />} className="rounded-xl font-bold">Back to Projects</Button>
        </Link>
      </Box>
    );
  }

  return <ProjectDetail project={project} />;
}
