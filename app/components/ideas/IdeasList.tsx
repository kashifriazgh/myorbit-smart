'use client';
import { AutoAwesome } from '@mui/icons-material';
import {
  Box,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  FormControl,
  InputLabel,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import PublicIcon from '@mui/icons-material/Public';
import AssignmentIcon from '@mui/icons-material/Assignment';
import IdeaActionButton from './IdeaLevelButton';
import { IDEA_LEVELS } from '@/app/lib/constant';
import moment from 'moment-timezone';
import React, { useEffect, useState, useCallback } from 'react';
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  deleteDoc,
  query,
  where,
  addDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useAuth } from '@/app/lib/context/userContext';
import { Idea } from '@/app/lib/interface';
import PrivacyModal from '../global/PrivacyModal';
import DeleteConfirmModal from '../global/DeleteConfirmModal';
import LevelModal from '../global/LevelModal';
import AIEnhanceModal from '../global/AIModal';
import { useCustomTheme } from '@/app/lib/context/themeContext';

type PrivacyType = 'private' | 'public' | 'specific';

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
  const [aiModalOpen, setAIModalOpen] = useState(false);

  const [filter, setFilter] = useState({
    level: 'all',
    privacy: 'all',
  });

  const { theme } = useCustomTheme();

  const fetchIdeas = useCallback(async () => {
    if (!user) {
      console.warn('⛔ No user found.');
      return;
    }

    setLoading(true);

    try {
      const ideasRef = collection(db, 'ideas');
      const q = query(ideasRef, where('authorId', '==', user.uid));
      const snap = await getDocs(q);

      if (snap.empty) {
        console.warn('📭 No ideas found in Firestore.');
      }

      const allIdeas = snap.docs.map((doc) => {
        const data = doc.data();
        if (!data.localCreatedAt) {
          console.warn(`⚠️ Document ${doc.id} missing localCreatedAt`, data);
        }

        return {
          id: doc.id,
          ...(data as Idea),
        };
      });

      const now = moment().tz('Asia/Karachi');
      const startDate = now.clone().subtract(30, 'days').startOf('day');
      const endDate = now.clone().endOf('day');

      const filtered = allIdeas.filter((idea) => {
        const { level, privacy, localCreatedAt } = idea;

        const levelMatch = filter.level === 'all' || level === filter.level;
        const privacyMatch =
          filter.privacy === 'all' || privacy === filter.privacy;

        const timestamp = localCreatedAt?.seconds
          ? moment.unix(localCreatedAt.seconds).tz('Asia/Karachi')
          : null;

        const isInLast30Days = timestamp
          ? timestamp.isBetween(startDate, endDate, null, '[]')
          : false;

        return levelMatch && privacyMatch && isInLast30Days;
      });

      const sorted = filtered.sort((a, b) => {
        const t1 = a.localCreatedAt?.seconds || 0;
        const t2 = b.localCreatedAt?.seconds || 0;
        return t2 - t1;
      });

      console.log(`✅ ${sorted.length} ideas from last 30 days after filters`);
      setIdeas(sorted);
    } catch (error) {
      console.error('❌ Error while fetching ideas:', error.message || error);
    }

    setLoading(false);
  }, [user, filter]);

  useEffect(() => {
    fetchIdeas();
  }, [fetchIdeas]);

  const handleDelete = async () => {
    if (!deleteTargetId) return;
    setDeleting(true);
    await deleteDoc(doc(db, 'ideas', deleteTargetId));
    setDeleteModalOpen(false);
    setDeleting(false);
    fetchIdeas();
  };

  const handleCloseAIModal = () => {
    setAIModalOpen(false);
    setActiveIdea(null);
  };

  const handleConvertToTask = async (idea: Idea) => {
    if (!user) return;

    try {
      await addDoc(collection(db, 'todos'), {
        title: idea.text,
        description: `Converted from idea: ${idea.text}`,
        steps: [],
        priority:
          (idea.level as string) === 'super'
            ? 'critical'
            : (idea.level as string) === 'important'
            ? 'urgent'
            : 'routine',
        status: 'in_progress',
        progressPercent: 0,
        pinned: false,
        isArchived: false,
        authorId: user.uid,
        authorName: user.firstName || '',
        assignedUsers: [],
        sharedWith: [],
        startDate: Timestamp.fromDate(new Date()),
        dueDate: Timestamp.fromDate(
          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        ), // 7 days from now
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        privacy: idea.privacy,
        isImportant:
          (idea.level as string) === 'super' ||
          (idea.level as string) === 'important',
      });

      // Optionally delete the idea after converting
      // await deleteDoc(doc(db, 'ideas', idea.id));

      // Refresh the ideas list
      fetchIdeas();
    } catch (error) {
      console.error('Error converting idea to task:', error);
    }
  };

  if (!theme) return <CircularProgress />;

  return (
    <Box mt={4}>
      <Stack
        direction="row"
        spacing={2}
        mb={2}
        flexWrap="wrap"
        alignItems="center"
      >
        <FormControl size="small">
          <InputLabel>Level</InputLabel>
          <Select
            sx={{ fontSize: '10px' }}
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
            sx={{ fontSize: '10px' }}
            native
            value={filter.privacy}
            onChange={(e) =>
              setFilter((prev) => ({ ...prev, privacy: e.target.value }))
            }
          >
            <option value="all">All</option>
            <option value="private">Private</option>
            <option value="public">Public</option>
          </Select>
        </FormControl>
      </Stack>

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
              onClick={() =>
                setExpandedIdeaId((prev) => (prev === idea.id ? null : idea.id))
              }
              p={2}
              mb={2}
              border={
                theme.mode === 'dark'
                  ? '1px solid #475569'
                  : '1px solid #e0e0e0'
              }
              borderRadius={1}
              bgcolor={theme.mode === 'dark' ? '#334155' : '#fff'}
              boxShadow={
                theme.mode === 'dark'
                  ? '0 1px 4px rgba(0,0,0,0.2)'
                  : '0 1px 4px rgba(0,0,0,0.04)'
              }
              sx={{
                cursor: 'pointer',
                color: theme.mode === 'dark' ? '#f1f5f9' : 'inherit',
                '&:hover': {
                  boxShadow:
                    theme.mode === 'dark'
                      ? '0 2px 8px rgba(0,0,0,0.3)'
                      : '0 2px 8px rgba(0,0,0,0.08)',
                  borderColor: theme.mode === 'dark' ? '#64748b' : '#d0d0d0',
                },
              }}
            >
              <Typography
                variant="body1"
                sx={{ color: theme.mode === 'dark' ? '#f1f5f9' : 'inherit' }}
              >
                {idea.text || '(Untitled)'}
              </Typography>
              <Box mt={0.5} display="flex" gap={1} flexWrap="wrap">
                {idea.tags?.map((tag, i) => (
                  <Chip
                    key={i}
                    label={`#${tag}`}
                    size="small"
                    sx={{
                      bgcolor: theme.mode === 'dark' ? '#475569' : undefined,
                      color: theme.mode === 'dark' ? '#e2e8f0' : undefined,
                    }}
                  />
                ))}
              </Box>
              <Collapse in={isExpanded} timeout="auto">
                <Divider
                  sx={{
                    my: 1.5,
                    borderColor: theme.mode === 'dark' ? '#475569' : undefined,
                  }}
                />
                <Box
                  display="flex"
                  justifyContent="space-between"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Box display="flex" gap={1}>
                    <IdeaActionButton
                      icon={
                        <AutoAwesome
                          sx={{
                            color:
                              theme.mode === 'dark' ? '#e2e8f0' : undefined,
                          }}
                        />
                      }
                      tooltip="AI Assist"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveIdea(idea);
                        setAIModalOpen(true);
                      }}
                    />
                    <IdeaActionButton
                      icon={
                        <EmojiEventsIcon
                          sx={{
                            color:
                              theme.mode === 'dark' ? '#e2e8f0' : undefined,
                          }}
                        />
                      }
                      tooltip="Level"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLevelModalOpen(true);
                      }}
                    />
                    <IdeaActionButton
                      icon={
                        <PublicIcon
                          sx={{
                            color:
                              theme.mode === 'dark' ? '#e2e8f0' : undefined,
                          }}
                        />
                      }
                      tooltip="Privacy"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveIdea(idea);
                        setPrivacyModalOpen(true);
                      }}
                    />
                    <IdeaActionButton
                      icon={<AssignmentIcon sx={{ color: 'primary.main' }} />}
                      tooltip="Convert to Task"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleConvertToTask(idea);
                      }}
                    />
                    <IdeaActionButton
                      icon={<DeleteIcon sx={{ color: 'error.main' }} />}
                      tooltip="Delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTargetId(idea.id);
                        setDeleteModalOpen(true);
                      }}
                    />
                  </Box>
                </Box>

                <LevelModal
                  collectionName="ideas"
                  field="level"
                  options={IDEA_LEVELS}
                  currentValue={idea.level}
                  docId={idea.id}
                  open={levelModalOpen}
                  onClose={() => setLevelModalOpen(false)}
                />

                {activeIdea && (
                  <PrivacyModal
                    collectionName="ideas"
                    open={privacyModalOpen}
                    onClose={() => setPrivacyModalOpen(false)}
                    currentPrivacy={activeIdea.privacy as PrivacyType}
                    sharedWith={activeIdea.sharedWith || []}
                    docId={activeIdea.id}
                    user={user!}
                  />
                )}

                <DeleteConfirmModal
                  open={deleteModalOpen}
                  onClose={() => setDeleteModalOpen(false)}
                  onConfirm={handleDelete}
                  loading={deleting}
                  itemLabel="idea"
                />

                {activeIdea && (
                  <AIEnhanceModal
                    open={aiModalOpen}
                    onClose={handleCloseAIModal}
                    docId={activeIdea.id}
                    originalText={activeIdea.text}
                    onApply={async (txt) => {
                      await updateDoc(doc(db, 'ideas', activeIdea.id), {
                        text: txt,
                      });
                    }}
                  />
                )}
              </Collapse>
            </Box>
          );
        })
      )}
    </Box>
  );
}
