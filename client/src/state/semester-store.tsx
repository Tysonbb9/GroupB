import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ErrorView, LoadingView } from '../components/ServerStatus';
import { fetchSemester, loadSampleSemester, saveWeekHours, saveWeeklyCapacity, TaskChange, updateTask } from '../lib/api';
import { Course, Semester, Task, WeekHours } from '../lib/types';

/**
 * Holds the one semester the app knows about, so both screens see the same
 * data. Marking a task done on the week screen has to change the forecast
 * on the semester screen — that shared update is the whole reward loop.
 *
 * Plain React context on purpose. No state library to learn.
 */

type SemesterStore = {
  semester: Semester;
  /** True when the semester came from the server, false for sample data and tests. */
  fromServer: boolean;
  /** Puts in tasks the server has just changed, matched by id (#155). */
  replaceTasks: (tasks: Task[]) => void;
  canLoadSample: boolean;
  loadingSample: boolean;
  sampleError: string | null;
  loadSample: () => Promise<void>;
  /** Adds a course the server has already enrolled. */
  addCourse: (course: Course) => void;
  toggleDone: (taskId: string) => void;
  /**
   * Saves a task's hours or due week (US-44), then uses them
   * everywhere. Rejects, changing nothing, when they could not be saved.
   */
  saveTask: (taskId: string, change: TaskChange) => Promise<void>;
  /** Adds tasks the server has already saved (US-30). */
  addTasks: (tasks: Task[]) => void;
  /**
   * Saves the hours the student has each week (US-32), then uses them
   * everywhere. Rejects, changing nothing, when they could not be saved.
   */
  setWeeklyCapacity: (hours: number) => Promise<void>;
  /**
   * Gives one week its own hours (#148), or clears them with null so the
   * weekly number applies again. Saves first, then uses them everywhere.
   * Rejects, changing nothing, when they could not be saved.
   */
  setWeekHours: (week: number, hours: number | null) => Promise<void>;
};

const SemesterContext = createContext<SemesterStore | null>(null);

/** Keeps new weekly hours somewhere, and returns the hours that were kept. */
type SaveCapacity = (hours: number) => Promise<number>;

/**
 * With no server (the fixture switch, and tests that pass `initial`), new
 * hours are kept only on this device, until the app is opened again.
 */
const keepOnDevice: SaveCapacity = async (hours) => hours;

/** Keeps a task's changed fields somewhere, and returns the fields that were kept. */
type SaveTask = (taskId: string, change: TaskChange) => Promise<TaskChange>;

/** Like keepOnDevice: with no server, a task's changes stay on this device. */
const keepTaskOnDevice: SaveTask = async (_taskId, change) => change;

/** With the server, PATCH /tasks/:id saves them, and the task it returns is what was kept. */
const saveTaskOnServer: SaveTask = async (taskId, change) => {
  const { dueWeek, estimatedHours } = await updateTask(taskId, change);
  return { dueWeek, estimatedHours };
};

/** Keeps one week's own hours somewhere, and returns every week that has some. */
type SaveWeek = (current: WeekHours[], week: number, hours: number | null) => Promise<WeekHours[]>;

/** Like keepOnDevice: with no server, the weeks' own hours stay on this device. */
const keepWeekOnDevice: SaveWeek = async (current, week, hours) =>
  [...current.filter((w) => w.week !== week), ...(hours === null ? [] : [{ week, hours }])].sort(
    (a, b) => a.week - b.week
  );

/** With the server, PATCH /semester/weeks/:week keeps them and says what it holds. */
const saveWeekOnServer: SaveWeek = (_current, week, hours) => saveWeekHours(week, hours);

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
      <SemesterState
        initial={initial}
        saveCapacity={keepOnDevice}
        persistTask={keepTaskOnDevice}
        saveWeek={keepWeekOnDevice}
        fromServer={false}
      >
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
    <SemesterState
      initial={semester}
      saveCapacity={saveWeeklyCapacity}
      persistTask={saveTaskOnServer}
      saveWeek={saveWeekOnServer}
      fetchSample={loadSampleSemester}
      fromServer
    >
      {children}
    </SemesterState>
  );
}

/** Holds the semester in state and hands it, with its updates, to the app. */
function SemesterState({
  children,
  initial,
  saveCapacity,
  persistTask,
  saveWeek,
  fromServer,
  fetchSample,
}: {
  children: React.ReactNode;
  initial: Semester;
  saveCapacity: SaveCapacity;
  persistTask: SaveTask;
  saveWeek: SaveWeek;
  fromServer: boolean;
  fetchSample?: () => Promise<Semester>;
}) {
  const [semester, setSemester] = useState<Semester>(initial);
  const [loadingSample, setLoadingSample] = useState(false);
  const [sampleError, setSampleError] = useState<string | null>(null);
  const samplePending = useRef(false);

  const value = useMemo<SemesterStore>(
    () => {
      const changeTask = (taskId: string, change: (task: Task) => Partial<Task>) =>
        setSemester((current) => ({
          ...current,
          tasks: current.tasks.map((t) =>
            t.id === taskId ? { ...t, ...change(t) } : t
          ),
        }));

      return {
        semester,
        fromServer,
        replaceTasks: (changed: Task[]) =>
          setSemester((current) => ({
            ...current,
            tasks: current.tasks.map((t) => changed.find((c) => c.id === t.id) ?? t),
          })),
        canLoadSample: fetchSample !== undefined,
        loadingSample,
        sampleError,
        loadSample: async () => {
          if (!fetchSample || samplePending.current) return;
          samplePending.current = true;
          setLoadingSample(true);
          setSampleError(null);
          try {
            setSemester(await fetchSample());
          } catch (error) {
            setSampleError((error as Error).message);
          } finally {
            samplePending.current = false;
            setLoadingSample(false);
          }
        },
        addCourse: (course: Course) => setSemester((current) => current.courses.some((item) => item.id === course.id)
          ? current : { ...current, courses: [...current.courses, course] }),
        toggleDone: (taskId: string) =>
          changeTask(taskId, (task) => ({ done: !task.done })),
        // Saved first, so the forecast only changes to what was kept.
        saveTask: async (taskId: string, change: TaskChange) => {
          const kept = await persistTask(taskId, change);
          changeTask(taskId, () => kept);
        },
        addTasks: (tasks: Task[]) =>
          setSemester((current) => ({ ...current, tasks: [...current.tasks, ...tasks] })),
        // Saved first, so the forecast only changes to hours that were kept.
        setWeeklyCapacity: async (hours: number) => {
          const kept = await saveCapacity(hours);
          setSemester((current) => ({ ...current, weeklyCapacity: kept }));
        },
        // Saved first too, so a week's line only moves to hours that were kept.
        setWeekHours: async (week: number, hours: number | null) => {
          const kept = await saveWeek(semester.weekHours ?? [], week, hours);
          setSemester((current) => ({ ...current, weekHours: kept }));
        },
      };
    },
    [semester, saveCapacity, persistTask, saveWeek, fetchSample, loadingSample, sampleError, fromServer]
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
