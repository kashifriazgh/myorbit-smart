'use client';
import React from 'react';
import LogoutButton from './components/user/LogoutButton';
import Mood from './components/homepage/Mood';
import ImportantTasks from './components/homepage/ImportantTasks';
import OverdueTasks from './components/homepage/OverdueTasks';
import ExpectedExpenses from './components/homepage/ExpectedExpenses';
import JournalMemory from './components/homepage/JournalMemory';
import MostProductiveDay from './components/homepage/MostProductiveDay';
import ExpectedIncome from './components/homepage/ExpectedIncomes';
import MostFocusedTime from './components/homepage/MostFocusedTime';
import DashboardHome from './components/homepage/Opener';

export default function Homepage() {
  return (
    <>
      <div className="p-2 mx-auto flex-col flex max-w-2xl my-20 justify-center">
        <DashboardHome />
        <Mood />
        <ImportantTasks />
        <OverdueTasks />
        <ExpectedExpenses />
        <ExpectedIncome />
        <JournalMemory />
        <MostProductiveDay
          data={{
            date: '2025-07-18',
            tasksCompleted: 14,
            focusScore: 87,
          }}
        />
        <MostFocusedTime
          data={{
            hourStart: 21,
            hourEnd: 22,
            day: 'Sunday',
          }}
        />
        <div className="text-4xl text-center">
          Productivity Monitoring Cell (PMC)
        </div>
        <div className="font-semibold text-lg">Mood</div>
        <div className="">
          This will open a series of icons for mood selection. Display after
          each hour.
        </div>
        <hr />
        <div className="text-2xl text-blue-400">On this day</div>
        <div className="text-xl">Ideas</div>
        - Fetch Ideas create , converted to task or goal from this day of prev
        week, prev month and prev year.
        <br />
        <br /> - if created, show message On this day of prev month, you got
        this [fireIcon] idea. Have not you implemented it. If you like, I can
        create some suggestion with AI
        <br />
        <br /> - Fetch ideas from last three days. Offer User to show them.
        <div className="text-2xl text-blue-400">Daily Journal</div>
        - Fetch journals from this day of prev week, prev month and prev year.
        <br />
        <br />- Concise the activity from that day with AI and ask AI to give
        number from 1-10 either we should display on timeline or not. Show if
        greater than 6k.
        <br />
        <br />- Fetch journals from last 7 days, concise each day separately and
        then get conclusion which day was more productive of this week. For this
        purpose, We will also get data of Tasks or goals you have completed.
        <br />
        <br />- Save the weekly productivity in a separate collection to compare
        which week was more productive.
        <br />
        <br />- Get an overview of time (in hours) of creation or completion of
        tasks, goals, ideas, journals or working with finance to get the most
        productive or focused time.
        <div className="text-2xl text-blue-400">Tasks</div>
        - Fetch all tasks that have due date today and tomorrow (with hours)
        <br />
        <br />- Remind Users to complete early before deadline
        <div className="text-2xl text-blue-400">Finance</div>
        - Fetch All Expenditures with Due date today and tomorrow specifically
        and next 7 days generally. Remind Users to be ready. Also show financial
        effect of this expense on savings or total Cash.
        <br />
        <br />- Fetch all Income Sources expected to meet today and tomorrow
        specifically and from next 7 days in general.If yes, Remind users to be
        ready. Also show effect of this incoming income on your totalCash (after
        deducting the expenditures of next 7 days)
        <br />
        <br />- If there is no expenditures found from next 14 days and if you
        found any wish list of shopping, then remind user that you may have this
        product in your cart.
        <br />
        <br />- If there is no expected Income from next 14 days and
        expenditures or high, then caution user.
        <br />
        <br />- Check shopping list created from last 7 days or list that have
        mission date match today or tomorrow. (Note: create a new field
        missionDate in things-to-buy)
        <div className="text-2xl text-blue-400">Misc</div>
        - Show Streaks . compare current streak with prev streak
        <br />
        <br />- Display AI Summary.
      </div>

      <hr />
      <LogoutButton />
    </>
  );
}
