'use client';
import React from 'react';
import Mood from './components/homepage/Mood';
import ImportantTasks from './components/homepage/ImportantTasks';
import OverdueTasks from './components/homepage/OverdueTasks';
import ExpectedExpenses from './components/homepage/ExpectedExpenses';
import JournalMemory from './components/homepage/JournalMemory';
import MostProductiveDay from './components/homepage/MostProductiveDay';
import ExpectedIncome from './components/homepage/ExpectedIncomes';
// import MostFocusedTime from './components/homepage/MostFocusedTime';
import DashboardHome from './components/homepage/Opener';
import FinancialCheckPoints from './components/finance/FinancialCheckPoints';
// import OnBoardingInitializer from './components/global/initial-on-boarding/OnBoardingIntializer';
import OnGoingStreaks from './components/homepage/OnGoingStreaks';
import TimeTableNotifier from './components/homepage/TimeTableNotifier';
import { IncomeSourcesProvider } from './lib/context/IncomeSourcesContext';
import { useAuth } from './lib/context/userContext';
export default function Homepage() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <IncomeSourcesProvider userId={user.uid}>
      <div className="p-2 mx-auto flex-col flex max-w-2xl my-10 justify-center">
        {/* <OnBoardingInitializer /> */}
        <TimeTableNotifier />
        <DashboardHome />
        <FinancialCheckPoints />
        <Mood />
        <OnGoingStreaks />
        <ImportantTasks />
        <OverdueTasks />
        <ExpectedExpenses />
        <ExpectedIncome />
        <JournalMemory />

        <MostProductiveDay />

        {/* <MostFocusedTime
          data={{
            hourStart: 21,
            hourEnd: 22,
            day: 'Sunday',
          }}
        /> */}
      </div>
    </IncomeSourcesProvider>
  );
}
