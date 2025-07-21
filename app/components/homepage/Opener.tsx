'use client';

import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Card,
  CardContent,
} from '@mui/material';
import { Person, Work } from '@mui/icons-material';

export default function DashboardHome() {
  return (
    <Box className="p-4 space-y-6">
      {/* Header */}
      <Box className="flex justify-between items-center">
        <div>
          <Typography variant="body2" color="textSecondary">
            Welcome Back
          </Typography>
          <Typography variant="h6" fontWeight="bold">
            Zaire Carder
          </Typography>
        </div>
        {/* Notification bell placeholder */}
        <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
          <span role="img" aria-label="bell">
            🔔
          </span>
        </div>
      </Box>

      {/* Plan Status Card */}
      <Card className="bg-[#0A1930] text-white rounded-2xl">
        <CardContent className="flex items-center justify-between">
          <Box>
            <Typography variant="body1">
              Excellent, Today’s your plan is almost done
            </Typography>
            <Button
              variant="contained"
              color="primary"
              className="mt-3 bg-white text-black normal-case shadow-none"
            >
              View Plan
            </Button>
          </Box>
          <Box className="relative w-[80px] h-[80px] flex items-center justify-center">
            <CircularProgress
              variant="determinate"
              value={80}
              size={80}
              thickness={5}
              style={{ color: '#ffffff55' }}
            />
            <Typography className="absolute text-lg font-semibold">
              80%
            </Typography>
          </Box>
        </CardContent>
      </Card>

      {/* Category Section */}
      <Box>
        <Box className="flex justify-between items-center mb-3">
          <Typography variant="subtitle1" fontWeight="medium">
            Category
          </Typography>
          <Typography
            variant="body2"
            color="primary"
            className="cursor-pointer"
          >
            See all
          </Typography>
        </Box>

        <Box className="grid grid-cols-2 gap-4">
          {/* Personal Plan Card */}
          <Card className="rounded-xl border shadow-sm hover:shadow-md transition">
            <CardContent>
              <Box className="flex items-center gap-2 mb-2">
                <Person className="text-gray-600" />
                <Typography variant="subtitle1" fontWeight="medium">
                  Personal Plan
                </Typography>
              </Box>
              <Typography
                variant="body2"
                color="textSecondary"
                className="mb-2"
              >
                3 Plans Remaining
              </Typography>
              <Button size="small" className="normal-case">
                Go to Plan →
              </Button>
            </CardContent>
          </Card>

          {/* Work Plan Card */}
          <Card className="rounded-xl border shadow-sm hover:shadow-md transition">
            <CardContent>
              <Box className="flex items-center gap-2 mb-2">
                <Work className="text-gray-600" />
                <Typography variant="subtitle1" fontWeight="medium">
                  Work Plan
                </Typography>
              </Box>
              <Typography
                variant="body2"
                color="textSecondary"
                className="mb-2"
              >
                8 Plans Remaining
              </Typography>
              <Button size="small" className="normal-case">
                Go to Plan →
              </Button>
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Box>
  );
}
