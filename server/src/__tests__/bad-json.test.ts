import { signedIn, type Api } from '../testing/session';

let api: Api;
beforeAll(async () => {
  api = await signedIn();
});

describe('a body that is not valid JSON', () => {
  it('returns 400 with an error message, not 500', async () => {
    const res = await api
      .patch('/tasks/262-2')
      .set('Content-Type', 'application/json')
      .send('{bad');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/JSON/);
  });
});