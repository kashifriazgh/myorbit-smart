'use client';

import { Box, Typography, Card, CardContent } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';

const OngoingPlanCard = () => {
  return (
    <Box className="p-4">
      {/* Header */}
      <Box className="flex justify-between items-center mb-3">
        <Typography variant="subtitle1" fontWeight="bold">
          On Going Plan
        </Typography>
        <Typography variant="body2" color="primary" className="cursor-pointer">
          See all
        </Typography>
      </Box>

      {/* Card */}
      <Card className="rounded-xl shadow-sm hover:shadow-md transition">
        <CardContent>
          {/* Main Task Title */}
          <Box className="flex items-start gap-2 mb-3">
            <span className="text-2xl">📚</span>
            <Typography variant="subtitle1" fontWeight="medium">
              Creating webflow design and responsive on mobile
            </Typography>
          </Box>

          {/* Sub-Tasks */}
          <Box className="flex items-center gap-2 mb-1">
            <CheckCircleIcon className="text-green-500" fontSize="small" />
            <Typography variant="body2" className="line-through text-gray-500">
              Create Lo Fi
            </Typography>
          </Box>

          <Box className="flex items-center gap-2">
            <RadioButtonUncheckedIcon
              className="text-gray-400"
              fontSize="small"
            />
            <Typography variant="body2">Create Landing Page</Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default OngoingPlanCard;
