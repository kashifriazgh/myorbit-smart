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
// import OnBoardingInitializer from './components/global/initial-on-boarding/OnBoardingIntializer';
import OnGoingStreaks from './components/homepage/OnGoingStreaks';
import TimeTableNotifier from './components/homepage/TimeTableNotifier';
export default function Homepage() {
  return (
    <div className="p-2 mx-auto flex-col flex max-w-2xl my-20 justify-center">
      {/* <OnBoardingInitializer /> */}
      <TimeTableNotifier />
      <DashboardHome />
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
  );
}
