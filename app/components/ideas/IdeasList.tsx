'use client';

import {
  Box,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  InputLabel,
  Select,
  Stack,
  Typography,
  Collapse,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import ShareIcon from '@mui/icons-material/Share';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import LabelImportantOutlineIcon from '@mui/icons-material/LabelImportantOutline';
import StarRateIcon from '@mui/icons-material/StarRate';
import LockIcon from '@mui/icons-material/Lock';
import PublicIcon from '@mui/icons-material/Public';
import IdeaActionButton from './IdeaLevelButton';
import LevelModal from './LevelModal';

import React, { useEffect, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
} from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useAuth } from '@/app/lib/context/userContext';
import { Idea } from '@/app/lib/interface';
import PrivacyModal from './PrivacyModal';
import DeleteConfirmModal from './DeleteConfirmModal';

type IdeaLevel = 'super' | 'important' | 'general';
type Privacy = 'private' | 'public';

const levelIcons: Record<IdeaLevel, React.ReactNode> = {
  super: <EmojiEventsIcon />,
  important: <StarRateIcon />,
  general: <LabelImportantOutlineIcon />,
};

const privacyIcons: Record<Privacy, React.ReactNode> = {
  private: <LockIcon />,
  public: <PublicIcon />,
};

export default function IdeasList() {
  const { user } = useAuth();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIdeaId, setExpandedIdeaId] = useState<string | null>(null);
  const [levelModalOpen, setLevelModalOpen] = useState(false);
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);
  const [activeIdea, setActiveIdea] = useState<Idea | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const [filter, setFilter] = useState<{
    level: string;
    privacy: string;
    scope: 'own' | 'shared' | 'all';
  }>({ level: 'all', privacy: 'all', scope: 'all' });

  useEffect(() => {
    if (!user) return;

    const ideasRef = collection(db, 'ideas');
    const q = query(ideasRef);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allIdeas: Idea[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<Idea, 'id'>),
      }));

      const filtered = allIdeas.filter((idea) => {
        const isOwn = idea.authorId === user.uid;
        const isShared = idea.sharedWith?.includes(user.uid);

        const matchScope =
          filter.scope === 'own'
            ? isOwn
            : filter.scope === 'shared'
            ? isShared
            : isOwn || isShared;

        const matchPrivacy =
          filter.privacy === 'all' || idea.privacy === filter.privacy;

        const matchLevel =
          filter.level === 'all' || idea.level === filter.level;

        return matchScope && matchPrivacy && matchLevel;
      });

      const sorted = filtered.sort(
        (a, b) =>
          ['super', 'important', 'general'].indexOf(a.level || 'general') -
          ['super', 'important', 'general'].indexOf(b.level || 'general')
      );

      setIdeas(sorted);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, filter]);

  const handleCardClick = (id: string) => {
    if (levelModalOpen) return; // prevent collapse if modal open
    setExpandedIdeaId((prev) => (prev === id ? null : id));
  };
  const handleOpenPrivacyModal = (idea: Idea) => {
    setActiveIdea(idea);
    setPrivacyModalOpen(true);
  };
  const handleClosePrivacyModal = () => {
    setPrivacyModalOpen(false);
    setActiveIdea(null);
  };

  const handleOpenDeleteModal = (ideaId: string) => {
    setDeleteTargetId(ideaId);
    setDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTargetId) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'ideas', deleteTargetId));
      setDeleteModalOpen(false);
      setDeleteTargetId(null);
    } catch (err) {
      console.error('Error deleting idea:', err);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Box mt={4}>
      {/* Filters */}
      <Stack direction="row" spacing={2} mb={2}>
        <FormControl size="small">
          <InputLabel>Level</InputLabel>
          <Select
            native
            value={filter.level}
            onChange={(e) =>
              setFilter((prev) => ({ ...prev, level: e.target.value }))
            }
          >
            <option value="all">All</option>
            <option value="super">Super</option>
            <option value="important">Important</option>
            <option value="general">General</option>
          </Select>
        </FormControl>

        <FormControl size="small">
          <InputLabel>Privacy</InputLabel>
          <Select
            native
            value={filter.privacy}
            onChange={(e) =>
              setFilter((prev) => ({ ...prev, privacy: e.target.value }))
            }
          >
            <option value="all">All</option>
            <option value="private">Only Me</option>
            <option value="public">Public</option>
          </Select>
        </FormControl>

        <FormControl size="small">
          <InputLabel>Scope</InputLabel>
          <Select
            native
            value={filter.scope}
            onChange={(e) =>
              setFilter((prev) => ({
                ...prev,
                scope: e.target.value as 'own' | 'shared' | 'all',
              }))
            }
          >
            <option value="all">All</option>
            <option value="own">Own</option>
            <option value="shared">Shared With Me</option>
          </Select>
        </FormControl>
      </Stack>

      {/* Loading State */}
      {loading ? (
        <Box display="flex" justifyContent="center" my={6}>
          <CircularProgress />
        </Box>
      ) : ideas.length === 0 ? (
        <Typography>No ideas found.</Typography>
      ) : (
        ideas.map((idea) => {
          const isExpanded = expandedIdeaId === idea.id;

          return (
            <Box
              key={idea.id}
              onClick={() => handleCardClick(idea.id)}
              p={2}
              mb={2}
              border="1px solid #ccc"
              borderRadius={2}
              bgcolor="#fafafa"
              sx={{
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': { backgroundColor: '#f5f5f5' },
              }}
            >
              <Typography variant="body1" gutterBottom>
                {idea.text || '(Untitled)'}
              </Typography>

              {/* Hashtags */}
              <Box mt={0.5} display="flex" gap={1} flexWrap="wrap">
                {idea.tags?.map((tag, idx) => (
                  <Chip key={idx} label={`#${tag}`} size="small" />
                ))}
              </Box>

              {/* Expanded section */}
              <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                <Divider sx={{ my: 1.5 }} />

                <Box
                  display="flex"
                  justifyContent="space-between"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Box display="flex" alignItems="center" gap={2}>
                    {idea.level && levelIcons[idea.level as IdeaLevel]}
                    {idea.privacy && privacyIcons[idea.privacy as Privacy]}
                  </Box>
                  <Box display="flex" gap={1}>
                    <IdeaActionButton
                      icon={<EmojiEventsIcon />}
                      tooltip="Level"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLevelModalOpen(true);
                      }}
                    />
                    <IdeaActionButton
                      icon={<PublicIcon />} // or any icon
                      tooltip="Privacy"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenPrivacyModal(idea);
                      }}
                    />
                    <IdeaActionButton
                      icon={<DeleteIcon sx={{ color: 'error.main' }} />}
                      tooltip="Delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenDeleteModal(idea.id);
                      }}
                    />

                    <IdeaActionButton
                      icon={<ShareIcon />}
                      tooltip="Share"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </Box>
                </Box>

                <LevelModal
                  currentLevel={idea.level}
                  docId={idea.id}
                  open={levelModalOpen}
                  onClose={() => setLevelModalOpen(false)}
                />
                {activeIdea && (
                  <PrivacyModal
                    open={privacyModalOpen}
                    onClose={handleClosePrivacyModal}
                    currentPrivacy={
                      activeIdea.privacy as 'private' | 'public' | 'specific'
                    }
                    sharedWith={activeIdea.sharedWith || []}
                    docId={activeIdea.id}
                    user={user}
                  />
                )}

                <DeleteConfirmModal
                  open={deleteModalOpen}
                  onClose={() => setDeleteModalOpen(false)}
                  onConfirm={handleDelete}
                  loading={deleting}
                  itemLabel="idea"
                />
              </Collapse>
            </Box>
          );
        })
      )}
    </Box>
  );
}
