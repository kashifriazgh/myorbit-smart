import { useEffect, useState } from 'react';
import { useAuth } from '@/app/lib/context/userContext';
import { useTodoContext } from '@/app/lib/context/todoContext';
import { useSchedules } from '@/app/lib/context/SchedulesContext';
import { doc, onSnapshot, query, collection, where } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';

/* eslint-disable @typescript-eslint/no-explicit-any */
function buildUserContextParagraph(
  user: any,
  onboarding: any,
  todos: any[],
  schedules: any[],
  cashSnapshot: any,
  loans: any[]
): string {
/* eslint-enable @typescript-eslint/no-explicit-any */
  // 1. Profile information
  const name = `${onboarding?.firstName || user?.firstName || ''} ${onboarding?.lastName || user?.lastName || ''}`.trim() || 'User';
  const age = onboarding?.ageGroup?.value || 'unknown age';
  const gender = onboarding?.gender?.value || 'user';
  const education = onboarding?.education?.value || 'not specified';
  const profession = onboarding?.profession?.value || onboarding?.professionType?.value || 'not specified';
  const email = user?.email || 'not specified';
  const mobile = onboarding?.mobile?.value || 'not specified';
  
  let paragraph = `${name} is a ${age} years old ${gender}. `;
  paragraph += `They have ${education} education level and work in ${profession}. Contact details are Email: ${email} and Mobile: ${mobile}. `;

  // 2. Tasks info
  const todayStr = new Date().toISOString().split('T')[0];
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const completedToday = todos.filter(t => {
    if (t.status !== 'completed') return false;
    const compDate = t.completedAt ? new Date(t.completedAt) : null;
    return compDate && compDate >= startOfDay;
  });

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const completedLast7Days = todos.filter(t => {
    if (t.status !== 'completed') return false;
    const compDate = t.completedAt ? new Date(t.completedAt) : null;
    return compDate && compDate >= sevenDaysAgo;
  });

  const completedTitles = completedToday.map(t => `'${t.title}'`).join(', ');
  paragraph += `Today, they completed ${completedToday.length} task(s)${completedToday.length > 0 ? ` (${completedTitles})` : ''}. `;
  paragraph += `Over the last 7 days, they completed a total of ${completedLast7Days.length} task(s). `;

  const last5Completed = todos
    .filter(t => t.status === 'completed')
    .sort((a, b) => {
      const da = a.completedAt ? new Date(a.completedAt).getTime() : 0;
      const dbVal = b.completedAt ? new Date(b.completedAt).getTime() : 0;
      return dbVal - da;
    })
    .slice(0, 5);
  
  if (last5Completed.length > 0) {
    const last5Titles = last5Completed.map(t => `'${t.title}'`).join(', ');
    paragraph += `Their recently completed tasks are: ${last5Titles}. `;
  }

  const inProgress = todos
    .filter(t => t.status === 'in_progress' || t.status === 'hold')
    .sort((a, b) => {
      const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dbVal = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dbVal - da;
    })
    .slice(0, 5);

  if (inProgress.length > 0) {
    const inProgressTitles = inProgress.map(t => `'${t.title}'`).join(', ');
    paragraph += `Currently, they have ${inProgress.length} task(s) in progress: ${inProgressTitles}. `;
  }

  const overdue = todos
    .filter(t => {
      if (t.status === 'completed') return false;
      if (!t.dueDate) return false;
      const due = new Date(t.dueDate);
      return due < new Date();
    })
    .sort((a, b) => {
      const da = a.dueDate ? new Date(a.dueDate).getTime() : 0;
      const dbVal = b.dueDate ? new Date(b.dueDate).getTime() : 0;
      return da - dbVal;
    })
    .slice(0, 5);

  if (overdue.length > 0) {
    const overdueTitles = overdue.map(t => `'${t.title}'`).join(', ');
    paragraph += `They have ${overdue.length} overdue task(s): ${overdueTitles}. `;
  }

  const urgent = todos
    .filter(t => {
      if (t.status === 'completed') return false;
      return t.priority === 'critical' || t.priority === 'high' || t.priority === 'urgent';
    })
    .slice(0, 2);

  if (urgent.length > 0) {
    const urgentTitles = urgent.map(t => `'${t.title}'`).join(', ');
    paragraph += `Urgent task(s) requiring attention: ${urgentTitles}. `;
  }

  // 3. Schedules
  const dailySchedules = schedules.filter(s => {
    if (s.status === 'cancelled') return false;
    if (s.isFlexible) return true;
    return s.date === todayStr;
  });

  if (dailySchedules.length > 0) {
    const scheduleTitles = dailySchedules.map(s => `'${s.title}' at ${s.startTime}`).join(', ');
    paragraph += `Today's schedules include: ${scheduleTitles}. `;
  } else {
    paragraph += `There are no schedules set for today. `;
  }

  // 4. Finance info
  const totalAmount = cashSnapshot?.totalAmount ?? 0;
  const freezeAmount = cashSnapshot?.freezeAmount ?? 0;
  const availableAmount = totalAmount - freezeAmount;

  const borrowLoans = loans.filter(l => !l.isSettled && l.type === 'borrow');
  const lendLoans = loans.filter(l => !l.isSettled && l.type === 'lend');

  const amountPayback = borrowLoans.reduce((sum, l) => sum + (l.amount || 0), 0);
  const amountToReceive = lendLoans.reduce((sum, l) => sum + (l.amount || 0), 0);

  paragraph += `Financially, their overall amount is PKR ${totalAmount}, with PKR ${availableAmount} available cash. `;
  if (amountPayback > 0) {
    paragraph += `They have a payback liability of PKR ${amountPayback} to return to others. `;
  } else {
    paragraph += `They have no loans to payback. `;
  }
  
  if (amountToReceive > 0) {
    paragraph += `They are due to receive PKR ${amountToReceive} from others. `;
  }

  return paragraph;
}

export default function ContextSynchronizer() {
  const { user, onboardingData, isGuest, updateContextParagraph } = useAuth();
  const { todos, loading: todosLoading } = useTodoContext();
  const { allSchedules, loading: schedulesLoading } = useSchedules();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [cashSnapshot, setCashSnapshot] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [loans, setLoans] = useState<any[]>([]);

  // 1. Subscribe to finance snapshot and loans in the main DB
  useEffect(() => {
    if (!user || isGuest) return;

    // Load initial values from localStorage cache to avoid database read latency
    const cachedCash = localStorage.getItem('myorbit_cached_cash_snapshot');
    if (cachedCash) {
      try { setCashSnapshot(JSON.parse(cachedCash)); } catch {}
    }
    const cachedLoans = localStorage.getItem('myorbit_cached_loans');
    if (cachedLoans) {
      try { setLoans(JSON.parse(cachedLoans)); } catch {}
    }

    const unsubCash = onSnapshot(doc(db, 'totalCashSnapshots', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setCashSnapshot(data);
        localStorage.setItem('myorbit_cached_cash_snapshot', JSON.stringify(data));
      }
    }, (err) => console.error('Error listening to totalCashSnapshots:', err));

    const qLoans = query(collection(db, 'loans'), where('userId', '==', user.uid));
    const unsubLoans = onSnapshot(qLoans, (querySnap) => {
      const list = querySnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setLoans(list);
      localStorage.setItem('myorbit_cached_loans', JSON.stringify(list));
    }, (err) => console.error('Error listening to loans:', err));

    return () => {
      unsubCash();
      unsubLoans();
    };
  }, [user, isGuest]);

  // 2. Monitor changes and regenerate/sync context paragraph (with debounce)
  useEffect(() => {
    if (!user || isGuest || todosLoading || schedulesLoading) return;

    const handler = setTimeout(async () => {
      const newParagraph = buildUserContextParagraph(
        user,
        onboardingData,
        todos,
        allSchedules,
        cashSnapshot,
        loans
      );

      const cached = localStorage.getItem('myorbit_cached_context_paragraph');
      if (newParagraph !== cached) {
        console.log('🔄 Profile or activity change detected, updates compiled. Syncing to database...');
        await updateContextParagraph(newParagraph);
      }
    }, 3000); // 3-second debounce

    return () => clearTimeout(handler);
  }, [user, onboardingData, todos, allSchedules, cashSnapshot, loans, isGuest, todosLoading, schedulesLoading, updateContextParagraph]);

  return null;
}
