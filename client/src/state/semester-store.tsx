import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ErrorView, LoadingView } from '../components/ServerStatus';
import { fetchSemester, saveWeeklyCapacity } from '../lib/api';
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
  /** Adds tasks the server has already saved (US-30). */
  addTasks: (tasks: Task[]) => void;
  /**
   * Saves the hours the student has each week (US-32), then uses them
   * everywhere. Rejects, changing nothing, when they could not be saved.
   */
  setWeeklyCapacity: (hours: number) => Promise<void>;
};

const SemesterContext = createContext<SemesterStore | null>(null);

/** Keeps new weekly hours somewhere, and returns the hours that were kept. */
type SaveCapacity = (hours: number) => Promise<number>;

/**
 * With no server (the fixture switch, and tests that pass `initial`), new
 * hours are kept only on this device, until the app is opened again.
 */
const keepOnDevice: SaveCapacity = async (hours) => hours;

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
    return (
      <SemesterState initial={initial} saveCapacity={keepOnDevice}>
        {children}
      </SemesterState>
    );
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
  return (
    <SemesterState initial={semester} saveCapacity={saveWeeklyCapacity}>
      {children}
    </SemesterState>
  );
}

/** Holds the semester in state and hands it, with its updates, to the app. */
function SemesterState({
  children,
  initial,
  saveCapacity,
}: {
  children: React.ReactNode;
  initial: Semester;
  saveCapacity: SaveCapacity;
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
        addTasks: (tasks: Task[]) =>
          setSemester((current) => ({ ...current, tasks: [...current.tasks, ...tasks] })),
        // Saved first, so the forecast only changes to hours that were kept.
        setWeeklyCapacity: async (hours: number) => {
          const kept = await saveCapacity(hours);
          setSemester((current) => ({ ...current, weeklyCapacity: kept }));
        },
      };
    },
    [semester, saveCapacity]
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