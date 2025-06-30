'use client';

import {
  Box,
  Drawer,
  Divider,
  Button,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import StarRateIcon from '@mui/icons-material/StarRate';
import LabelImportantOutlineIcon from '@mui/icons-material/LabelImportantOutline';
import { useState, useEffect } from 'react';

type IdeaLevel = 'super' | 'important' | 'general';

export default function LevelDrawer({
  open,
  selected,
  onClose,
  onSave,
}: {
  open: boolean;
  selected: IdeaLevel;
  onClose: () => void;
  onSave: (val: IdeaLevel) => void;
}) {
  const [temp, setTemp] = useState<IdeaLevel>(selected);

  useEffect(() => {
    setTemp(selected);
  }, [selected]);

  return (
    <Drawer anchor="bottom" open={open} onClose={onClose}>
      <Box p={2}>
        <List>
          <li style={{ listStyle: 'none' }}>
            <ListItemButton onClick={() => setTemp('super')}>
              <ListItemIcon>
                <EmojiEventsIcon
                  color={temp === 'super' ? 'primary' : 'inherit'}
                />
              </ListItemIcon>
              <ListItemText primary="Super" />
            </ListItemButton>
          </li>

          <li style={{ listStyle: 'none' }}>
            <ListItemButton onClick={() => setTemp('important')}>
              <ListItemIcon>
                <StarRateIcon
                  color={temp === 'important' ? 'primary' : 'inherit'}
                />
              </ListItemIcon>
              <ListItemText primary="Important" />
            </ListItemButton>
          </li>

          <li style={{ listStyle: 'none' }}>
            <ListItemButton onClick={() => setTemp('general')}>
              <ListItemIcon>
                <LabelImportantOutlineIcon
                  color={temp === 'general' ? 'primary' : 'inherit'}
                />
              </ListItemIcon>
              <ListItemText primary="General" />
            </ListItemButton>
          </li>
        </List>

        <Divider sx={{ my: 2 }} />

        <Box display="flex" justifyContent="space-between">
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => onSave(temp)}
            disabled={temp === selected} // optional UX: disable if no change
          >
            Save
          </Button>
        </Box>
      </Box>
    </Drawer>
  );
}
