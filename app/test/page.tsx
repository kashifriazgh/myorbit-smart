'use client';

import { useState } from 'react';

interface SmartCriteria {
  specific: boolean;
  measurable: boolean;
  achievable: boolean;
  relevant: boolean;
  timeBound: boolean;
  summary: string;
}

interface ImproveGoalResult {
  isSMART: SmartCriteria;
  needsBreakdown: boolean;
  milestones?: string[];
}

export default function ImproveGoalTest() {
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImproveGoalResult | null>(null);

  const handleSubmit = async () => {
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch('/api/improve-goal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title, dueDate }),
      });

      const data = await res.json();
      setResult(data.result);
    } catch (err) {
      console.error(err);
    }

    setLoading(false);
  };

  return (
    <div className="p-6 max-w-xl mx-auto space-y-4 border dark:border-slate-600 rounded-xl">
      <h2 className="text-xl font-bold dark:text-slate-50">
        Improve Goal (AI)
      </h2>

      <input
        type="text"
        placeholder="Goal Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full p-2 border rounded"
      />

      <input
        type="date"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
        className="w-full p-2 border rounded"
      />

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="bg-black dark:bg-slate-800 text-white dark:text-slate-50 px-4 py-2 rounded"
      >
        {loading ? 'Analyzing...' : 'Analyze Goal'}
      </button>

      {result && (
        <div className="mt-4 space-y-3">
          <h3 className="font-semibold">SMART Analysis</h3>

          <ul className="text-sm dark:text-slate-300 space-y-1">
            <li>Specific: {result.isSMART.specific ? '✅' : '❌'}</li>
            <li>Measurable: {result.isSMART.measurable ? '✅' : '❌'}</li>
            <li>Achievable: {result.isSMART.achievable ? '✅' : '❌'}</li>
            <li>Relevant: {result.isSMART.relevant ? '✅' : '❌'}</li>
            <li>Time Bound: {result.isSMART.timeBound ? '✅' : '❌'}</li>
          </ul>

          <p className="text-sm text-gray-600 dark:text-gray-400">
            {result.isSMART.summary}
          </p>

          {result.needsBreakdown && result.milestones?.length > 0 && (
            <div>
              <h3 className="font-semibold mt-3">Milestones</h3>
              <ul className="list-disc ml-5 text-sm dark:text-slate-300">
                {result.milestones.map((m: string, i: number) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
