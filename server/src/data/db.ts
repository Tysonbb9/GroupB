// server/src/data/db.ts
import { semester as seed } from './semester';
import { Inputs, Semester } from '../types';

/**
 * The live in-memory "database". It starts as a deep copy of the seed data,
 * so PATCH requests never modify the seed itself. Tests call resetDb() so
 * each one starts from the same known state.
 */
export let db: Semester = structuredClone(seed);

/** US-22: what the student has handed us. Starts empty. */
export let inputs: Inputs = { reviews: [] };

export function resetDb(): void {
  db = structuredClone(seed);
  inputs = { reviews: [] };
}