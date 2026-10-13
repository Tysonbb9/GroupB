import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ErrorView, LoadingView } from '../components/ServerStatus';
import { fetchSemester } from '../lib/api';
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

/**
 * What the app is given at the top. With no `initial`, the semester is
 * fetched from the server, behind a loading screen and an error screen with
 * a retry. Tests, and the fixture switch in the root layout, pass `initial`
 * to skip the server.
 */
export function SemesterProvider({
  children,
  initial,
}: {
  children: React.ReactNode;
  initial?: Semester;
}) {
  if (initial !== undefined) {
    return <SemesterState initial={initial}>{children}</SemesterState>;
  }
  return <SemesterFromServer>{children}</SemesterFromServer>;
}

/** Fetches the semester once, and only renders the app when it has arrived. */
function SemesterFromServer({ children }: { children: React.ReactNode }) {
  const [semester, setSemester] = useState<Semester | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Changing this number is what makes the effect below run again.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchSemester()
      .then((loaded) => {
        if (!cancelled) setSemester(loaded);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = () => {
    setError(null);
    setAttempt((n) => n + 1);
  };

  if (semester === null) {
    return error === null ? <LoadingView /> : <ErrorView message={error} onRetry={retry} />;
  }
  return <SemesterState initial={semester}>{children}</SemesterState>;
}

/** Holds the semester in state and hands it, with its two updates, to the app. */
function SemesterState({
  children,
  initial,
}: {
  children: React.ReactNode;
  initial: Semester;
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
