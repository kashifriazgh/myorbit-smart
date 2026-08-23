// Guest Data Migration Utility
// This helps migrate guest user data to authenticated user when they sign up

import {
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { db } from './firebase';
import { isGuestUser } from './guestUser';

export interface MigrationResult {
  success: boolean;
  migratedCollections: string[];
  errors: string[];
}

/**
 * Migrate guest user data to authenticated user
 */
export async function migrateGuestDataToUser(
  guestUserId: string,
  authenticatedUserId: string
): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: true,
    migratedCollections: [],
    errors: [],
  };

  if (!isGuestUser(guestUserId)) {
    result.errors.push('Invalid guest user ID');
    result.success = false;
    return result;
  }

  try {
    // Collections to migrate
    const collectionsToMigrate = [
      'todos',
      'incomeSources',
      'expenditures',
      'totalCashSnapshots',
      'buyItems',
    ];

    for (const collectionName of collectionsToMigrate) {
      try {
        // Get all documents for the guest user
        const q = query(
          collection(db, collectionName),
          where('userId', '==', guestUserId)
        );

        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          // Migrate each document
          const batch = [];
          for (const docSnapshot of querySnapshot.docs) {
            const docData = docSnapshot.data();
            const newDocRef = doc(db, collectionName, docSnapshot.id);

            // Update userId to the authenticated user's ID
            const updatedData = {
              ...docData,
              userId: authenticatedUserId,
              migratedAt: new Date(),
              originalGuestUserId: guestUserId,
            };

            batch.push(setDoc(newDocRef, updatedData));
          }

          // Execute batch write
          await Promise.all(batch);
          result.migratedCollections.push(collectionName);
        }
      } catch (error) {
        console.error(`Error migrating ${collectionName}:`, error);
        result.errors.push(
          `Failed to migrate ${collectionName}: ${error.message}`
        );
      }
    }

    // Mark guest user as migrated
    await setDoc(doc(db, 'guestMigrations', guestUserId), {
      migratedTo: authenticatedUserId,
      migratedAt: new Date(),
      collectionsMigrated: result.migratedCollections,
    });
  } catch (error) {
    console.error('Migration failed:', error);
    result.errors.push(`Migration failed: ${error.message}`);
    result.success = false;
  }

  return result;
}

/**
 * Check if guest user data has been migrated
 */
export async function checkGuestMigrationStatus(
  guestUserId: string
): Promise<boolean> {
  try {
    const migrationDoc = await getDoc(doc(db, 'guestMigrations', guestUserId));
    return migrationDoc.exists();
  } catch (error) {
    console.error('Error checking migration status:', error);
    return false;
  }
}
