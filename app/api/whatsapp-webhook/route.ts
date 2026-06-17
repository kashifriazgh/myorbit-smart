import { NextResponse } from 'next/server';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';

function hasFirestoreCode(err: unknown, code: string): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    err.code === code
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { clientId, itemId, itemType, firestoreProjectId, completedAt } =
      body;

    console.log('📬 WhatsApp Webhook received request:', body);

    // Security check 1: Match configured client/project environment variables to verify ownership
    const expectedClientId = process.env.NEXT_PUBLIC_CLIENT_ID || clientId;
    const expectedProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

    if (!expectedProjectId) {
      console.error(
        'Missing required environment variables for webhook verification.',
      );
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 },
      );
    }

    if (clientId && clientId !== expectedClientId) {
      console.error(
        `❌ Security Violation: Client ID mismatch. Expected: ${expectedClientId}, Received: ${clientId}`,
      );
      return NextResponse.json(
        { error: 'Unauthorized Client ID' },
        { status: 401 },
      );
    }

    if (firestoreProjectId && firestoreProjectId !== expectedProjectId) {
      console.error(
        `❌ Security Violation: Project ID mismatch. Expected: ${expectedProjectId}, Received: ${firestoreProjectId}`,
      );
      return NextResponse.json(
        { error: 'Unauthorized Project ID' },
        { status: 401 },
      );
    }

    if (!itemId) {
      return NextResponse.json(
        { error: 'Missing itemId parameter' },
        { status: 400 },
      );
    }

    const taskTimestamp = completedAt || Date.now();

    // Perform updates based on the item type (currently only todo is implemented)
    switch (itemType) {
      case 'todo':
        const todoRef = doc(db, 'todos', itemId);
        try {
          await updateDoc(todoRef, {
            status: 'completed',
            completedAt: new Date(taskTimestamp),
            completedViaWhatsApp: true,
            updatedAt: new Date(),
          });
          console.log(
            `✅ Webhook updated Firestore production todo "${itemId}" to completed`,
          );
        } catch (err: unknown) {
          if (hasFirestoreCode(err, 'not-found')) {
            console.log(
              `ℹ️ Todo not found in 'todos'. Trying 'test-todos' for "${itemId}"...`,
            );
            const testTodoRef = doc(db, 'test-todos', itemId);
            await updateDoc(testTodoRef, {
              completed: true,
              completedAt: taskTimestamp,
              completedViaWhatsApp: true,
              updatedAt: Date.now(),
            });
            console.log(
              `✅ Webhook updated Firestore test todo "${itemId}" to completed`,
            );
          } else {
            throw err;
          }
        }
        break;

      case 'schedule':
        const scheduleRef = doc(db, 'schedules', itemId);
        await updateDoc(scheduleRef, {
          status: 'completed',
          completedViaWhatsApp: true,
          updatedAt: new Date(),
        });
        console.log(
          `✅ Webhook updated Firestore schedule "${itemId}" directly to completed`,
        );
        break;

      case 'goal':
        console.log(
          `🎯 Goal completed webhook trigger received (Not yet implemented in Firestore)`,
        );
        break;

      case 'habit':
        console.log(
          `💪 Habit completed webhook trigger received (Not yet implemented in Firestore)`,
        );
        break;

      default:
        console.log(`⚠️ Unknown itemType received: ${itemType}`);
        break;
    }

    return NextResponse.json({
      success: true,
      message: `Successfully updated ${itemType || 'item'} in Firestore`,
    });
  } catch (err) {
    console.error('❌ Webhook handler error:', err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
