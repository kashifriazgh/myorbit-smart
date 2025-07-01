// components/shared/IdeaActionButton.tsx

import { IconButton, Tooltip } from '@mui/material';
import React from 'react';

interface Props {
  icon: React.ReactNode;
  tooltip: string;
  onClick: (e: React.MouseEvent) => void;
  color?: 'primary' | 'secondary' | 'default';
}

const IdeaActionButton: React.FC<Props> = ({
  icon,
  tooltip,
  onClick,
  color = 'default',
}) => {
  return (
    <Tooltip title={tooltip}>
      <IconButton size="small" onClick={onClick} color={color}>
        {icon}
      </IconButton>
    </Tooltip>
  );
};

export default IdeaActionButton;
