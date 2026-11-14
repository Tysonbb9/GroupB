import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * The worker's own clean-up, tested in a separate Node process: the worker is
 * an ES module, which Jest cannot load (see the comment at the top of
 * read-pdf.worker.mjs). Imported outside a worker thread, it does not start
 * reading, so its helpers can be called directly.
 */

const WORKER = pathToFileURL(path.join(__dirname, '..', 'syllabus', 'read-pdf.worker.mjs')).href;

/** Run a snippet that has the worker's exports as `worker`; return what it printed. */
function runWithWorker(snippet: string): { stdout: string; stderr: string } {
  const script = `const worker = await import(${JSON.stringify(WORKER)});\n${snippet}`;
  const result = { stdout: '', stderr: '' };
  try {
    result.stdout = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    const failed = error as { stdout?: string; stderr?: string };
    throw new Error(`The snippet failed:\n${failed.stderr ?? ''}${failed.stdout ?? ''}`);
  }
  return result;
}

describe('read-pdf.worker freeMemory (review #115, finding 6)', () => {
  it('keeps going, and logs, when freeing the PDF fails', () => {
    const script = `
      const original = console.error;
      const logged = [];
      console.error = (...args) => logged.push(args.map(String).join(' '));
      await worker.freeMemory({ loadingTask: { destroy: () => Promise.reject(new Error('boom')) } });
      console.error = original;
      console.log(JSON.stringify(logged));
    `;
    const logged: string[] = JSON.parse(runWithWorker(script).stdout);
    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatch(/could not free the PDF/);
    expect(logged[0]).toMatch(/boom/);
  });

  it('keeps going, and logs, when freeing the PDF throws straight away', () => {
    const script = `
      const original = console.error;
      const logged = [];
      console.error = (...args) => logged.push(args.map(String).join(' '));
      await worker.freeMemory({ loadingTask: { destroy: () => { throw new Error('sync boom'); } } });
      console.error = original;
      console.log(JSON.stringify(logged));
    `;
    const logged: string[] = JSON.parse(runWithWorker(script).stdout);
    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatch(/sync boom/);
  });

  it('does nothing, quietly, when there is nothing to free', () => {
    const script = `
      const logged = [];
      console.error = (...args) => logged.push(args.join(' '));
      await worker.freeMemory({});
      console.log(JSON.stringify(logged));
    `;
    expect(JSON.parse(runWithWorker(script).stdout)).toEqual([]);
  });

  it('does not start reading when imported outside a worker thread', () => {
    // If it did, it would fail on the missing PDF and print or crash.
    const result = runWithWorker(`console.log(typeof worker.freeMemory);`);
    expect(result.stdout.trim()).toBe('function');
  });

  it('frees the PDF through its loading task, as pdf.js 6 expects', () => {
    const script = `
      let freed = false;
      await worker.freeMemory({ loadingTask: { destroy: async () => { freed = true; } } });
      console.log(freed);
    `;
    expect(runWithWorker(script).stdout.trim()).toBe('true');
  });

  it('falls back to the document when there is no loading task', () => {
    const script = `
      let freed = false;
      await worker.freeMemory({ destroy: async () => { freed = true; } });
      console.log(freed);
    `;
    expect(runWithWorker(script).stdout.trim()).toBe('true');
  });
});
