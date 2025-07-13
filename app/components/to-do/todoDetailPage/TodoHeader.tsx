'use client';
import { Typography, Divider } from '@mui/material';

interface TodoHeaderProps {
  title: string;
  description?: string;
}

export default function TodoHeader({ title, description }: TodoHeaderProps) {
  return (
    <>
      <Typography variant="h5" fontWeight="bold">
        {title}
      </Typography>
      {description && <Typography mb={1}>{description}</Typography>}
      <Divider sx={{ my: 2 }} />
    </>
  );
}
