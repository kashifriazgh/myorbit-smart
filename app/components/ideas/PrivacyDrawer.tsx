'use client';

import {
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Button,
} from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import PublicIcon from '@mui/icons-material/Public';
import { useState } from 'react';

export default function PrivacyDrawer({
  open,
  selected,
  onClose,
  onSave,
}: {
  open: boolean;
  selected: 'public' | 'private';
  onClose: () => void;
  onSave: (val: 'public' | 'private') => void;
}) {
  const [temp, setTemp] = useState<'public' | 'private'>(selected);

  return (
    <Drawer anchor="bottom" open={open} onClose={onClose}>
      <Box p={2}>
        <List>
          <li style={{ listStyle: 'none' }}>
            <ListItemButton onClick={() => setTemp('public')}>
              <ListItemIcon>
                <PublicIcon color={temp === 'public' ? 'primary' : 'inherit'} />
              </ListItemIcon>
              <ListItemText primary="Public" />
            </ListItemButton>
          </li>
          <li style={{ listStyle: 'none' }}>
            <ListItemButton onClick={() => setTemp('private')}>
              <ListItemIcon>
                <LockIcon color={temp === 'private' ? 'primary' : 'inherit'} />
              </ListItemIcon>
              <ListItemText primary="Only Me" />
            </ListItemButton>
          </li>
        </List>

        <Divider sx={{ my: 2 }} />

        <Box display="flex" justifyContent="space-between">
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => onSave(temp)}
            disabled={temp === selected} // disable if unchanged
          >
            Save
          </Button>
        </Box>
      </Box>
    </Drawer>
  );
}
