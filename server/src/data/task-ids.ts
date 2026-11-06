/**
 * The first "<course>-syl-N" id that is not taken, the same pattern as the
 * client's processInputs. Tasks added from a syllabus get these ids, so they
 * never clash with the sample data's ids ("262-2" and so on).
 *
 * The caller adds each new id to `taken` before asking for the next one, so a
 * batch of tasks for the same course gets -syl-1, -syl-2, and so on.
 */
export function nextTaskId(courseId: string, taken: Set<string>): string {
  let n = 1;
  while (taken.has(`${courseId}-syl-${n}`)) n++;
  return `${courseId}-syl-${n}`;
}
