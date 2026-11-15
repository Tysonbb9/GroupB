/**
 * The one place the server talks to a language model (issue #145).
 *
 * It uses the OpenAI-style "chat completions" API, so changing provider is a
 * change to server/.env and not to code:
 *
 *   AI_BASE_URL  the service address, e.g. https://localai.calvin.edu/api/v1
 *   AI_API_KEY   the key. A secret: never in the client, a test, a log or a chat.
 *   AI_MODEL     the model name, e.g. nvidia-qwen3-6-35b-a3b-nvfp4
 *
 * With any of the three missing there is no model (createModelClient returns
 * null), and the app works as it did before the AI existed.
 *
 * Everything that uses a model takes a ModelClient, so tests hand it a fake
 * one and never call a real service.
 */
export type ModelClient = {
  /** Sends one prompt and returns the model's answer as text. */
  complete(prompt: string): Promise<string>;
};

/** A problem with the model service. The message is safe to show a student. */
export class ModelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ModelError';
  }
}

/** How long to wait for one answer. A syllabus takes about 20 seconds. */
export const MODEL_TIMEOUT_MS = 60_000;

/**
 * Turns the body of a chat-completions answer into the model's text.
 *
 * Calvin's service always streams: even when the request says stream: false,
 * the body is a list of "data: {...}" lines (Server-Sent Events), each with a
 * piece of the answer in choices[0].delta.content, ending with "data: [DONE]".
 * Other services send one plain JSON object with choices[0].message.content.
 * Both are understood.
 */
export function readModelText(body: string): string {
  let text = '';

  // A plain answer is one JSON value, so it starts with { (or [). Anything
  // else is read as a stream. This does not depend on the stream starting with
  // "data:": a service may open with a ": keep-alive" comment line first.
  const first = body.trimStart().charAt(0);
  if (first === '{' || first === '[') {
    try {
      const content = JSON.parse(body)?.choices?.[0]?.message?.content;
      if (typeof content === 'string') text = content;
    } catch {
      // Not JSON after all: handled as an empty answer below.
    }
  } else {
    for (const data of streamEvents(body)) {
      if (data === '[DONE]') continue;
      try {
        const piece = JSON.parse(data)?.choices?.[0]?.delta?.content;
        if (typeof piece === 'string') text += piece;
      } catch {
        // An event that is not JSON carries no text. Skip it.
      }
    }
  }

  if (text.trim() === '') {
    throw new ModelError('The AI service sent an empty answer.');
  }
  return text;
}

/**
 * The data of each event in a Server-Sent Events body. Lines that start with
 * ":" are comments and lines such as "event:" or "id:" are not data, so both
 * are ignored. An event ends at a blank line, and an event with several
 * "data:" lines has them joined with a newline. If that joined text is not
 * JSON (a service that never sends blank lines between events), each line is
 * treated as an event of its own.
 */
function streamEvents(body: string): string[] {
  const events: string[] = [];
  let lines: string[] = [];

  const flush = () => {
    if (lines.length === 0) return;
    const joined = lines.join('\n');
    if (lines.length === 1 || isJson(joined)) events.push(joined);
    else events.push(...lines);
    lines = [];
  };

  for (const line of body.split(/\r?\n/)) {
    if (line === '') {
      flush();
    } else if (line.startsWith('data:')) {
      const data = line.slice('data:'.length).replace(/^ /, '');
      if (data.trim() !== '') lines.push(data.trim() === '[DONE]' ? '[DONE]' : data);
    }
  }
  flush();
  return events;
}

function isJson(text: string): boolean {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * The model client for this server, or null when it is not set up.
 * `env` and `fetchFn` are parameters only so tests can replace them.
 */
export function createModelClient(
  env: NodeJS.ProcessEnv = process.env,
  fetchFn: typeof fetch = fetch
): ModelClient | null {
  const baseUrl = env.AI_BASE_URL?.trim().replace(/\/+$/, '');
  const apiKey = env.AI_API_KEY?.trim();
  const model = env.AI_MODEL?.trim();
  if (!baseUrl || !apiKey || !model) return null;

  return {
    async complete(prompt: string): Promise<string> {
      let response: Response;
      try {
        response = await fetchFn(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
            stream: false,
            response_format: { type: 'json_object' },
          }),
          signal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
        });
      } catch {
        // Deliberately says nothing about the cause: the error text of a
        // failed request can include the address, and none of it helps a student.
        throw new ModelError('The AI service could not be reached. Try again in a moment.');
      }

      if (!response.ok) {
        throw new ModelError(`The AI service answered ${response.status}. Try again in a moment.`);
      }

      // The answer can still fail after the headers arrive (a timeout or a
      // dropped connection while the body is read), so reading it is inside
      // the same boundary. Like the request, it says nothing about the cause.
      let body: string;
      try {
        body = await response.text();
      } catch {
        throw new ModelError('The AI service stopped answering. Try again in a moment.');
      }
      return readModelText(body);
    },
  };
}
