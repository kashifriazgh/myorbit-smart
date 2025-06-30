'use client';

import { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import {
  collection,
  addDoc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
} from 'firebase/firestore';

type Idea = {
  id: string;
  text?: string;
  createdAt?: Date; // Optional because serverTimestamp may initially be `null`
};

export default function TestFirestorePage() {
  const [idea, setIdea] = useState('');
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);

  const ideasRef = collection(db, 'ideas');

  // Realtime subscription to ideas collection
  useEffect(() => {
    const q = query(ideasRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setIdeas(list);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idea.trim()) return;

    await addDoc(ideasRef, {
      text: idea.trim(),
      createdAt: serverTimestamp(),
    });

    setIdea('');
  };

  return (
    <div className="max-w-xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold">💡 Save Your Ideas</h1>

      <form onSubmit={handleSubmit} className="space-y-2">
        <input
          type="text"
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          placeholder="Enter your idea..."
          className="w-full border border-gray-300 rounded px-3 py-2"
        />
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Save Idea
        </button>
      </form>

      <div className="mt-6">
        <h2 className="text-xl font-semibold mb-2">📃 Saved Ideas</h2>
        {loading ? (
          <p>Loading...</p>
        ) : ideas.length === 0 ? (
          <p>No ideas yet.</p>
        ) : (
          <ul className="space-y-2">
            {ideas.map((item) => (
              <li key={item.id} className="border px-3 py-2 rounded bg-gray-50">
                {item.text}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
