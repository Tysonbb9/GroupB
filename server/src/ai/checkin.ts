import type { CourseCheckin, Semester } from '../types';

export const RECENTLY_CONFIRMED_DAYS = 7;

export type CheckinSnapshot = {
  currentWeek: number;
  courses: {
    courseId: string;
    code: string;
    name: string;
    openTasks: { title: string; dueWeek: number }[];
    lastConfirmed: string | null;
  }[];
};

export function buildSnapshot(semester: Semester, checkins: (CourseCheckin | null)[], now: Date): CheckinSnapshot {
  const answeredAt = new Map<string, string>();
  for (const checkin of checkins) {
    if (checkin) answeredAt.set(checkin.courseId, checkin.answeredAt);
  }

  const all = semester.courses.map((course) => ({
    courseId: course.id,
    code: course.code,
    name: course.name,
    openTasks: semester.tasks
      .filter((t) => t.courseId === course.id && !t.done && t.dueWeek >= semester.currentWeek)
      .map((t) => ({ title: t.title, dueWeek: t.dueWeek })),
    lastConfirmed: answeredAt.get(course.id) ?? null,
  }));

  const weekMs = RECENTLY_CONFIRMED_DAYS * 24 * 60 * 60 * 1000;
  const courses = all
    .filter((c) => c.openTasks.length > 0)
    .filter((c) => c.lastConfirmed === null || now.getTime() - new Date(c.lastConfirmed).getTime() >= weekMs);

  return { currentWeek: semester.currentWeek, courses };
}

export function checkModelAnswer(answer: unknown, snapshot: CheckinSnapshot) {
    if (typeof answer !== 'object' || answer === null) return null;
    const { courseId, reason } = answer as Record<string, unknown>;
  
    if (typeof courseId !== 'string') return null;
    if (!snapshot.courses.some((c) => c.courseId === courseId)) return null;

    let checkedReason: string | null = null;
    if (typeof reason === 'string') {
      const trimmed = reason.trim();
      if (trimmed !== '' && trimmed.length <= 200 && !/\d/.test(trimmed)) {
        checkedReason = trimmed;
      }
    }
  
    return { courseId, reason: checkedReason };
  }


export const CHECKIN_INSTRUCTIONS = 'Pick ONE course to ask about. Answer with JSON only: {"courseId": "...", "reason": "..."} with no numbers.';