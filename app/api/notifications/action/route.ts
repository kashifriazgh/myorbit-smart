import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/lib/firebase';
import { doc, updateDoc, getDoc, Timestamp, serverTimestamp } from 'firebase/firestore';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action, notificationType, entityId, userId: _userId } = body;

    console.log(`[Notification Action API] Received action: "${action}" for type: "${notificationType}", entityId: "${entityId}"`);

    if (!action || !entityId) {
      return NextResponse.json({ error: 'Missing action or entityId' }, { status: 400 });
    }

    if (action === 'done' || action === 'action_done') {
      if (notificationType === 'todo') {
        const todoRef = doc(db, 'todos', entityId);
        const snap = await getDoc(todoRef);
        if (snap.exists()) {
          await updateDoc(todoRef, {
            status: 'completed',
            progressPercent: 100,
            updatedAt: serverTimestamp(),
          });
          console.log(`[Notification Action API] Todo ${entityId} marked as completed.`);
          return NextResponse.json({ success: true, message: 'Task completed successfully!' });
        }
      } else if (notificationType === 'schedule') {
        const scheduleRef = doc(db, 'schedules', entityId);
        const snap = await getDoc(scheduleRef);
        if (snap.exists()) {
          await updateDoc(scheduleRef, {
            status: 'completed',
            updatedAt: serverTimestamp(),
          });
          console.log(`[Notification Action API] Schedule ${entityId} marked as completed.`);
          return NextResponse.json({ success: true, message: 'Schedule completed successfully!' });
        }
      }
    } else if (action === 'snooze' || action === 'action_snooze') {
      const snoozeMinutes = 15;
      const newReminderDate = new Date(Date.now() + snoozeMinutes * 60000);

      if (notificationType === 'todo') {
        const todoRef = doc(db, 'todos', entityId);
        const snap = await getDoc(todoRef);
        if (snap.exists()) {
          await updateDoc(todoRef, {
            reminderDate: Timestamp.fromDate(newReminderDate),
            updatedAt: serverTimestamp(),
          });
          console.log(`[Notification Action API] Todo ${entityId} snoozed by ${snoozeMinutes}m.`);
          return NextResponse.json({ success: true, message: `Task snoozed by ${snoozeMinutes} minutes!` });
        }
      } else if (notificationType === 'schedule') {
        const scheduleRef = doc(db, 'schedules', entityId);
        const snap = await getDoc(scheduleRef);
        if (snap.exists()) {
          await updateDoc(scheduleRef, {
            reminderDate: Timestamp.fromDate(newReminderDate),
            updatedAt: serverTimestamp(),
          });
          console.log(`[Notification Action API] Schedule ${entityId} snoozed by ${snoozeMinutes}m.`);
          return NextResponse.json({ success: true, message: `Schedule snoozed by ${snoozeMinutes} minutes!` });
        }
      }
    }

    return NextResponse.json({ success: true, message: 'Action acknowledged.' });
  } catch (err) {
    console.error('[Notification Action API] Error processing notification action:', err);
    return NextResponse.json({ error: (err as Error).message || 'Failed to process action' }, { status: 500 });
  }
}
