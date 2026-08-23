'use client';
import { IconButton } from '@mui/material';
import PublicIcon from '@mui/icons-material/Public';
import { useState } from 'react';
import { Todo, FirestoreUser } from '@/app/lib/interface';
import DeleteConfirmModal from '@/app/components/global/DeleteConfirmModal';
import PrivacyModal from '@/app/components/global/PrivacyModal';
import TodoEnhancementPanel from '@/app/components/to-do/TodoEnhancementPanel';
import { AutoAwesome } from '@mui/icons-material';
import { deleteTodoReminder } from '@/app/lib/utils/whatsapp-reminder';
import { useTodoContext } from '@/app/lib/context/todoContext';

interface TodoActionButtonsProps {
  todo: Todo;
  user: FirestoreUser;
  onDeleted?: () => void; // optional callback after deletion
}

export default function TodoActionButtons({
  todo,
  user,
  onDeleted,
}: TodoActionButtonsProps) {
  const { deleteTodo } = useTodoContext();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [enhanceOpen, setEnhanceOpen] = useState(false);

  const handleDelete = async () => {
    // Delete reminder (fire-and-forget)
    deleteTodoReminder(todo.id!).catch((err) =>
      console.error('Failed to delete todo reminder:', err)
    );

    // Use context deleteTodo: removes from React state + cache + Firestore
    await deleteTodo(todo.id!);

    setDeleteOpen(false);
    onDeleted?.();
  };

  return (
    <>
      <IconButton onClick={() => setEnhanceOpen(true)}>
        <AutoAwesome />
      </IconButton>

      <IconButton onClick={() => setPrivacyOpen(true)}>
        <PublicIcon />
      </IconButton>

      {/* Modals */}
      <DeleteConfirmModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        itemLabel="todo"
      />

      <PrivacyModal
        open={privacyOpen}
        onClose={() => setPrivacyOpen(false)}
        collectionName="todos"
        currentPrivacy={todo.privacy}
        sharedWith={todo.sharedWith}
        docId={todo.id!}
        user={user}
      />

      <TodoEnhancementPanel
        open={enhanceOpen}
        onClose={() => setEnhanceOpen(false)}
        todo={todo}
      />
    </>
  );
}
