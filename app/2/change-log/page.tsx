'use client';

import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Stack,
  Divider,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import HistoryIcon from '@mui/icons-material/History';
import UpdateIcon from '@mui/icons-material/Update';
import BugReportIcon from '@mui/icons-material/BugReport';
import StarIcon from '@mui/icons-material/Star';

export default function ChangeLogPage() {
  const { theme } = useCustomTheme();
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('sm'));

  if (!theme) return null;

  const changelogEntries = [
    {
      version: 'v2.1.0',
      date: '2024-01-15',
      type: 'feature',
      title: 'AI-Powered Step Generation',
      description:
        'Added AI-powered step generation for tasks using Gemini AI. Users can now generate realistic, actionable steps for their tasks with language detection and context awareness.',
      changes: [
        'Implemented AI step generator modal for task creation',
        'Added language detection (Roman Urdu/Urdu/English)',
        'Context-aware step generation based on task complexity',
        'Editable AI-generated steps with professional UI',
        'Integrated with both task creation and detail pages',
      ],
    },
    {
      version: 'v2.0.0',
      date: '2024-01-10',
      type: 'feature',
      title: 'User-Specific Theme System',
      description:
        'Implemented user-specific theme settings with Firestore integration. Each user now has their own personalized theme that persists across sessions.',
      changes: [
        'Created user-specific theme documents in Firestore',
        'Added theme synchronization on login/logout',
        'Implemented dual caching system for better performance',
        'Added real-time theme updates across devices',
        'Fixed theme persistence across browser refreshes',
      ],
    },
    {
      version: 'v1.9.0',
      date: '2024-01-05',
      type: 'feature',
      title: 'Real-time Journal Updates',
      description:
        'Enhanced journal functionality with real-time updates using Firestore onSnapshot for better user experience.',
      changes: [
        'Implemented JournalContext for centralized state management',
        'Added real-time journal synchronization',
        'Optimized performance with server-side filtering',
        'Fixed journal display issues on page refresh',
        'Added proper TypeScript type safety',
      ],
    },
    {
      version: 'v1.8.0',
      date: '2023-12-28',
      type: 'improvement',
      title: 'Homepage Component Reordering',
      description:
        'Reorganized homepage components based on priority and user needs for better workflow.',
      changes: [
        'Prioritized ImportantTasks and OverdueTasks',
        'Reordered components for better user experience',
        'Improved component loading sequence',
      ],
    },
  ];

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'feature':
        return <StarIcon sx={{ fontSize: 20 }} />;
      case 'improvement':
        return <UpdateIcon sx={{ fontSize: 20 }} />;
      case 'bugfix':
        return <BugReportIcon sx={{ fontSize: 20 }} />;
      default:
        return <UpdateIcon sx={{ fontSize: 20 }} />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'feature':
        return 'success';
      case 'improvement':
        return 'primary';
      case 'bugfix':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', my: 4, px: isMobile ? 2 : 3 }}>
      {/* Header */}
      <Box mb={4}>
        <Typography
          variant="h4"
          fontWeight="bold"
          gutterBottom
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            color: theme.mode === 'dark' ? '#f1f5f9' : '#0f172a',
          }}
        >
          <HistoryIcon sx={{ fontSize: 40, color: 'primary.main' }} />
          Change Log
        </Typography>
        <Typography variant="subtitle1" color="text.secondary" sx={{ ml: 6 }}>
          Track all the improvements, features, and fixes made to MyOrbit
        </Typography>
      </Box>

      {/* Changelog Entries */}
      <Stack spacing={3}>
        {changelogEntries.map((entry, index) => (
          <Card
            key={index}
            elevation={2}
            sx={{
              border: `1px solid ${muiTheme.palette.divider}`,
              transition: 'all 0.3s ease',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: muiTheme.shadows[8],
              },
            }}
          >
            <CardContent sx={{ p: isMobile ? 2 : 3 }}>
              {/* Version Header */}
              <Box
                display="flex"
                justifyContent="space-between"
                alignItems="flex-start"
                mb={2}
                flexWrap="wrap"
                gap={1}
              >
                <Box display="flex" alignItems="center" gap={2}>
                  <Typography variant="h6" fontWeight="bold" color="primary">
                    {entry.version}
                  </Typography>
                  <Chip
                    icon={getTypeIcon(entry.type)}
                    label={
                      entry.type.charAt(0).toUpperCase() + entry.type.slice(1)
                    }
                    color={getTypeColor(entry.type)}
                    size="small"
                    variant="outlined"
                  />
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {new Date(entry.date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </Typography>
              </Box>

              {/* Title and Description */}
              <Typography variant="h6" fontWeight="600" mb={1}>
                {entry.title}
              </Typography>
              <Typography variant="body1" color="text.secondary" mb={2}>
                {entry.description}
              </Typography>

              <Divider sx={{ my: 2 }} />

              {/* Changes List */}
              <Typography variant="subtitle2" fontWeight="600" mb={1}>
                Changes:
              </Typography>
              <Stack spacing={1}>
                {entry.changes.map((change, changeIndex) => (
                  <Box
                    key={changeIndex}
                    display="flex"
                    alignItems="flex-start"
                    gap={1}
                  >
                    <Typography
                      variant="body2"
                      sx={{
                        color: 'primary.main',
                        fontWeight: 600,
                        minWidth: 'fit-content',
                        mt: 0.1,
                      }}
                    >
                      •
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {change}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>

      {/* Footer */}
      <Box mt={6} textAlign="center">
        <Typography variant="body2" color="text.secondary">
          Stay updated with the latest improvements to MyOrbit
        </Typography>
      </Box>
    </Box>
  );
}
