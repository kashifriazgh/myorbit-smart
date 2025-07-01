// components/ideas/PrivacyModal.tsx

import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  Stack,
  Divider,
  Button,
  Checkbox,
  FormGroup,
  FormControlLabel,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { collection, doc, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { User } from 'firebase/auth'; // or your context type

interface Props {
  open: boolean;
  onClose: () => void;
  currentPrivacy: 'private' | 'public' | 'specific';
  sharedWith: string[]; // user ids
  docId: string;
  user: User | null; // 🔧 Add this
}

export default function PrivacyModal({
  open,
  onClose,
  currentPrivacy,
  sharedWith,
  docId,
  user,
}: Props) {
  const [selectedPrivacy, setSelectedPrivacy] = useState(currentPrivacy);
  const [selectedUsers, setSelectedUsers] = useState<string[]>(
    sharedWith || []
  );
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<{ uid: string; name: string }[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => {
    if (!open || !user) return;

    setSelectedPrivacy(currentPrivacy);
    setSelectedUsers(sharedWith || []);
    setUsers([]);
    setLoadingUsers(true);

    const fetchSubUsers = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'users'));
        const allUsers = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            uid: doc.id,
            name: data.name || 'Unnamed',
          };
        });

        // ✅ Filter out current user
        const subUsers = allUsers.filter((u) => u.uid !== user.uid);
        setUsers(subUsers);
      } catch (error) {
        console.error('Error fetching sub-users:', error);
      } finally {
        setLoadingUsers(false);
      }
    };

    fetchSubUsers();
  }, [open, currentPrivacy, sharedWith, user]);

  useEffect(() => {
    if (!open) {
      setSelectedPrivacy(currentPrivacy);
      setSelectedUsers(sharedWith || []);
    }
  }, [open, currentPrivacy, sharedWith]);

  const handleUserToggle = (uid: string) => {
    setSelectedUsers((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const ref = doc(db, 'ideas', docId);
      await updateDoc(ref, {
        privacy: selectedPrivacy,
        sharedWith: selectedPrivacy === 'specific' ? selectedUsers : [],
      });
      onClose();
    } catch (err) {
      console.error('Error updating privacy:', err);
    } finally {
      setSaving(false);
    }
  };

  const OptionBox = ({
    label,
    value,
    description,
  }: {
    label: string;
    value: 'private' | 'public' | 'specific';
    description: string;
  }) => {
    const selected = selectedPrivacy === value;
    return (
      <Box
        onClick={() => setSelectedPrivacy(value)}
        sx={{
          px: 2,
          py: 1,
          borderRadius: 2,
          cursor: 'pointer',
          backgroundColor: selected ? '#e0f7fa' : '#fafafa',
          '&:hover': { backgroundColor: selected ? '#b2ebf2' : '#f0f0f0' },
        }}
      >
        <Typography fontWeight={selected ? 600 : 500}>{label}</Typography>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      </Box>
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      disableEnforceFocus
      onClick={(e) => e.stopPropagation()}
    >
      <DialogTitle>Change Privacy</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={2}>
          <OptionBox
            label="Private"
            value="private"
            description="Only you will see the content"
          />
          <OptionBox
            label="Public"
            value="public"
            description="All your sub-users can see this"
          />
          <OptionBox
            label="Specific Users"
            value="specific"
            description="Only selected users can view"
          />
        </Stack>

        {selectedPrivacy === 'specific' && (
          <Box mt={2}>
            <Typography variant="subtitle2" gutterBottom>
              Select Users:
            </Typography>
            <FormGroup>
              {loadingUsers ? (
                <Typography variant="body2" color="text.secondary">
                  Loading users...
                </Typography>
              ) : users.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No sub-users found.
                </Typography>
              ) : (
                users.map((user) => (
                  <FormControlLabel
                    key={user.uid}
                    control={
                      <Checkbox
                        checked={selectedUsers.includes(user.uid)}
                        onChange={() => handleUserToggle(user.uid)}
                      />
                    }
                    label={user.name}
                  />
                ))
              )}
            </FormGroup>
          </Box>
        )}

        <Divider sx={{ my: 3 }} />

        <Box display="flex" justifyContent="flex-end" gap={2}>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={
              saving ||
              (selectedPrivacy === 'specific' && selectedUsers.length === 0)
            }
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
