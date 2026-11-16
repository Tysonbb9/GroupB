import type { Course } from '../types';

// These limits also appear in the courses table CHECK constraints.
export const MAX_COURSE_CODE = 40;
export const MAX_COURSE_NAME = 200;
export type NewCourse = { code: string; name: string };
export type CatalogCourse = Course & { enrolled: boolean };
export type CourseCreation = { created: boolean; course: Course };

/** Codes compare by their letters and numbers, ignoring whitespace and separators. */
export function normalizeCourseCode(code: string): string {
  return code.toUpperCase().replace(/[\s._-]/gu, '');
}

/** A readable id is separate from code identity: different codes can need a suffix. */
export function courseIdBase(code: string): string {
  return normalizeCourseCode(code).toLowerCase().replace(/[^a-z0-9]/g, '') || 'course';
}

/** Count Unicode characters like Postgres char_length, rather than UTF-16 units. */
export function courseInput(value: unknown): NewCourse | null {
  if (!value || typeof value !== 'object') return null;
  const { code, name } = value as Record<string, unknown>;
  if (typeof code !== 'string' || typeof name !== 'string') return null;
  const trimmed = { code: code.trim(), name: name.trim() };
  if (!normalizeCourseCode(trimmed.code) || !trimmed.name ||
      [...trimmed.code].length > MAX_COURSE_CODE || [...trimmed.name].length > MAX_COURSE_NAME ||
      trimmed.code.includes('\0') || trimmed.name.includes('\0')) return null;
  return trimmed;
}
