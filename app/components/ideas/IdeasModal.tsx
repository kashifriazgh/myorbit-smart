'use client';
import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  TextField,
  Chip,
  Button,
  Paper,
  CircularProgress,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import PublicIcon from '@mui/icons-material/Public';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import LabelImportantOutlineIcon from '@mui/icons-material/LabelImportantOutline';
import StarRateIcon from '@mui/icons-material/StarRate';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useAuth } from '@/app/lib/context/userContext';

type IdeaLevel = 'super' | 'important' | 'general';
type Privacy = 'private' | 'public';

const levelIcons: Record<IdeaLevel, React.ReactNode> = {
  super: <EmojiEventsIcon fontSize="small" />,
  important: <StarRateIcon fontSize="small" />,
  general: <LabelImportantOutlineIcon fontSize="small" />,
};
const privacyIcons: Record<Privacy, React.ReactNode> = {
  private: <LockIcon fontSize="small" />,
  public: <PublicIcon fontSize="small" />,
};

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function IdeaModal({ open, onClose }: Props) {
  const [ideaText, setIdeaText] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [privacy, setPrivacy] = useState<Privacy>('private');
  const [level, setLevel] = useState<IdeaLevel>('general');
  const [loading, setLoading] = useState(false);
  const [openPrivacy, setOpenPrivacy] = useState(false);
  const [openLevel, setOpenLevel] = useState(false);

  const { user } = useAuth();

  const handleTagAdd = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) {
      setTags((prev) => [...prev, t]);
      setTagInput('');
    }
  };

  const handleSave = async () => {
    if (!ideaText.trim()) return;
    setLoading(true);
    await addDoc(collection(db, 'ideas'), {
      text: ideaText.trim(),
      tags,
      privacy,
      level,
      createdAt: serverTimestamp(),
      authorId: user.uid,
      authorName: user.displayName || '',
      sharedWith: [], // if planning to support later
    });

    setLoading(false);
    onClose();
  };

  return (
    <>
      {/* Main Dialog */}
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>💡 New Idea</DialogTitle>
        <DialogContent dividers>
          <TextField
            label="Idea"
            multiline
            rows={4}
            fullWidth
            value={ideaText}
            onChange={(e) => setIdeaText(e.target.value)}
            margin="dense"
          />
          <Box mt={2}>
            <TextField
              label="Add Tag"
              placeholder="Press Enter"
              fullWidth
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleTagAdd()}
              margin="dense"
            />
            <Paper
              variant="outlined"
              sx={{ mt: 1, p: 1, display: 'flex', flexWrap: 'wrap', gap: 1 }}
            >
              {tags.map((t, i) => (
                <Chip
                  key={i}
                  label={t}
                  onDelete={() => setTags(tags.filter((x) => x !== t))}
                />
              ))}
            </Paper>
          </Box>
          <Box
            mt={3}
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            <Box>
              <Button
                onClick={() => setOpenPrivacy(true)}
                startIcon={privacyIcons[privacy]}
              >
                {privacy === 'private' ? 'Only Me' : 'Public'}
              </Button>
              <Button
                onClick={() => setOpenLevel(true)}
                startIcon={levelIcons[level]}
              >
                {level}
              </Button>
            </Box>
            <Button variant="contained" onClick={handleSave} disabled={loading}>
              {loading ? <CircularProgress size={16} /> : 'Save'}
            </Button>
          </Box>
        </DialogContent>
      </Dialog>

      {/* Privacy Picker */}
      <Dialog open={openPrivacy} onClose={() => setOpenPrivacy(false)}>
        <DialogTitle>Select Privacy</DialogTitle>
        <List>
          <ListItemButton onClick={() => setPrivacy('public')}>
            <ListItemIcon>
              <PublicIcon
                color={privacy === 'public' ? 'primary' : 'inherit'}
              />
            </ListItemIcon>
            <ListItemText primary="Public" />
          </ListItemButton>
          <ListItemButton onClick={() => setPrivacy('private')}>
            <ListItemIcon>
              <LockIcon color={privacy === 'private' ? 'primary' : 'inherit'} />
            </ListItemIcon>
            <ListItemText primary="Only Me" />
          </ListItemButton>
        </List>
        <DialogActions>
          <Button onClick={() => setOpenPrivacy(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => setOpenPrivacy(false)}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Level Picker */}
      <Dialog open={openLevel} onClose={() => setOpenLevel(false)}>
        <DialogTitle>Select Level</DialogTitle>
        <List>
          <ListItemButton onClick={() => setLevel('super')}>
            <ListItemIcon>
              <EmojiEventsIcon
                color={level === 'super' ? 'primary' : 'inherit'}
              />
            </ListItemIcon>
            <ListItemText primary="Super" />
          </ListItemButton>
          <ListItemButton onClick={() => setLevel('important')}>
            <ListItemIcon>
              <StarRateIcon
                color={level === 'important' ? 'primary' : 'inherit'}
              />
            </ListItemIcon>
            <ListItemText primary="Important" />
          </ListItemButton>
          <ListItemButton onClick={() => setLevel('general')}>
            <ListItemIcon>
              <LabelImportantOutlineIcon
                color={level === 'general' ? 'primary' : 'inherit'}
              />
            </ListItemIcon>
            <ListItemText primary="General" />
          </ListItemButton>
        </List>
        <DialogActions>
          <Button onClick={() => setOpenLevel(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => setOpenLevel(false)}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
