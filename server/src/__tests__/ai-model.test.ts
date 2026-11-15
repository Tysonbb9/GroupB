import { createModelClient, ModelError, readModelText } from '../ai/model';

/**
 * The model client (issue #145). fetch is replaced here, so no service is
 * called and no key is needed.
 */

const ENV = {
  AI_BASE_URL: 'https://ai.example.test/api/v1/',
  AI_API_KEY: 'test-key-not-real',
  AI_MODEL: 'test-model',
};

/** The parts of a fetch Response the client reads. */
const reply = (body: string, status = 200) =>
  ({ ok: status < 400, status, text: async () => body }) as Response;

/** A streamed answer in the shape Calvin's service sends, split across lines. */
const streamed = (...pieces: string[]) =>
  [
    ...pieces.map((p) => `data: ${JSON.stringify({ choices: [{ delta: { content: p } }] })}`),
    'data: [DONE]',
    '',
  ].join('\n\n');

describe('readModelText', () => {
  it('joins the pieces of a streamed answer', () => {
    expect(readModelText(streamed('{"a":', '1}'))).toBe('{"a":1}');
  });

  it('understands CRLF line endings and ignores lines that are not data', () => {
    const body = ': keep-alive\r\n' + streamed('he', 'llo').replace(/\n/g, '\r\n');
    expect(readModelText('data: {"choices":[{"delta":{"role":"assistant"}}]}\r\n' + body)).toBe('hello');
  });

  it('skips a data line that is not JSON', () => {
    expect(readModelText(`data: not json\n\n${streamed('ok')}`)).toBe('ok');
  });

  it('reads a stream that opens with a comment line before any data', () => {
    expect(readModelText(': keep-alive\n\n: still working\n\n' + streamed('hel', 'lo'))).toBe('hello');
    expect(readModelText('\n\nevent: message\n' + streamed('ok'))).toBe('ok');
  });

  it('joins the data lines of one event with a newline', () => {
    const event = 'data: {"choices":[{"delta":\ndata: {"content":"hi"}}]}\n\n';
    expect(readModelText(event + 'data: [DONE]\n\n')).toBe('hi');
  });

  it('reads a stream that has no blank line between events', () => {
    const body = ['a', 'b'].map((p) => `data: ${JSON.stringify({ choices: [{ delta: { content: p } }] })}`).join('\n');
    expect(readModelText(body + '\ndata: [DONE]')).toBe('ab');
  });

  it('reads a plain, non-streamed answer', () => {
    const body = JSON.stringify({ choices: [{ message: { content: '{"a":1}' } }] });
    expect(readModelText(body)).toBe('{"a":1}');
  });

  it.each([['', 'nothing'], ['not json', 'not JSON'], ['{"choices":[]}', 'no choices'], [streamed(), 'a stream with no text']])(
    'rejects an empty answer (%#: %s)',
    (body) => {
      expect(() => readModelText(body)).toThrow(ModelError);
    }
  );
});

describe('createModelClient', () => {
  it.each(['AI_BASE_URL', 'AI_API_KEY', 'AI_MODEL'])('is null when %s is missing', (name) => {
    expect(createModelClient({ ...ENV, [name]: undefined } as NodeJS.ProcessEnv)).toBeNull();
    expect(createModelClient({ ...ENV, [name]: '  ' } as NodeJS.ProcessEnv)).toBeNull();
  });

  it('is null with no settings at all', () => {
    expect(createModelClient({} as NodeJS.ProcessEnv)).toBeNull();
  });

  it('sends the prompt to the chat-completions address with the key and the model', async () => {
    const fetchMock = jest.fn().mockResolvedValue(reply(streamed('{"ok":true}')));
    const client = createModelClient(ENV as NodeJS.ProcessEnv, fetchMock as typeof fetch);

    const answer = await client!.complete('Read this');

    expect(answer).toBe('{"ok":true}');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://ai.example.test/api/v1/chat/completions'); // trailing slash removed
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer test-key-not-real');
    expect(JSON.parse(init.body)).toEqual({
      model: 'test-model',
      messages: [{ role: 'user', content: 'Read this' }],
      stream: false,
      response_format: { type: 'json_object' },
    });
  });

  it('says the service could not be reached, without the address or the key', async () => {
    const fetchMock = jest.fn().mockRejectedValue(new Error('connect ECONNREFUSED ai.example.test test-key-not-real'));
    const client = createModelClient(ENV as NodeJS.ProcessEnv, fetchMock as typeof fetch);

    const error = await client!.complete('x').catch((e: Error) => e);

    expect(error).toBeInstanceOf(ModelError);
    expect((error as Error).message).toMatch(/could not be reached/);
    expect((error as Error).message).not.toContain('example.test');
    expect((error as Error).message).not.toContain('test-key-not-real');
  });

  it('turns an error while the body is read into a ModelError, without the address or the key', async () => {
    const dying = {
      ok: true,
      status: 200,
      text: async () => {
        throw new Error('terminated: socket hang up https://ai.example.test/api/v1 test-key-not-real');
      },
    } as unknown as Response;
    const fetchMock = jest.fn().mockResolvedValue(dying);
    const client = createModelClient(ENV as NodeJS.ProcessEnv, fetchMock as typeof fetch);

    const error = await client!.complete('x').catch((e: Error) => e);

    expect(error).toBeInstanceOf(ModelError);
    expect((error as Error).message).toMatch(/stopped answering/);
    expect((error as Error).message).not.toContain('example.test');
    expect((error as Error).message).not.toContain('test-key-not-real');
  });

  it('reports a refusal from the service with its status', async () => {
    const fetchMock = jest.fn().mockResolvedValue(reply('{"error":"bad key test-key-not-real"}', 401));
    const client = createModelClient(ENV as NodeJS.ProcessEnv, fetchMock as typeof fetch);

    const error = await client!.complete('x').catch((e: Error) => e);

    expect(error).toBeInstanceOf(ModelError);
    expect((error as Error).message).toContain('401');
    expect((error as Error).message).not.toContain('test-key-not-real'); // the body is never passed on
  });
});
