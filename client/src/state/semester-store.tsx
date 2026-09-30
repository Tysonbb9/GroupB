import React, { createContext, useContext, useMemo, useState } from 'react';
import { semester as fixture } from '../data/semester';
import { Semester, Task } from '../lib/types';

/**
 * Holds the one semester the app knows about, so both screens see the same
 * data. Marking a task done on the week screen has to change the forecast
 * on the semester screen — that shared update is the whole reward loop.
 *
 * Plain React context on purpose. No state library to learn.
 */

type SemesterStore = {
  semester: Semester;
  toggleDone: (taskId: string) => void;
  /** Sets a task's estimated hours; null clears it. */
  setEstimate: (taskId: string, hours: number | null) => void;
};

const SemesterContext = createContext<SemesterStore | null>(null);

export function SemesterProvider({
  children,
  initial = fixture,
}: {
  children: React.ReactNode;
  /** Tests pass their own semester in here. */
  initial?: Semester;
}) {
  const [semester, setSemester] = useState<Semester>(initial);

  const value = useMemo<SemesterStore>(
    () => {
      const updateTask = (taskId: string, change: (task: Task) => Partial<Task>) =>
        setSemester((current) => ({
          ...current,
          tasks: current.tasks.map((t) =>
            t.id === taskId ? { ...t, ...change(t) } : t
          ),
        }));

      return {
        semester,
        toggleDone: (taskId: string) =>
          updateTask(taskId, (task) => ({ done: !task.done })),
        setEstimate: (taskId: string, hours: number | null) =>
          updateTask(taskId, () => ({ estimatedHours: hours })),
      };
    },
    [semester]
  );

  return (
    <SemesterContext.Provider value={value}>{children}</SemesterContext.Provider>
  );
}

export function useSemester(): SemesterStore {
  const store = useContext(SemesterContext);
  if (store === null) {
    throw new Error('useSemester must be used inside a SemesterProvider');
  }
  return store;
}
