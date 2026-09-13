import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../server/sites-worker';

const env = { APP_ORIGIN: 'https://inspection.example', OPENAI_API_KEY: 'test-secret', ASSETS: { fetch: async () => new Response('app') } };
const request = (body: string, headers: Record<string, string> = {}) => new Request(`${env.APP_ORIGIN}/api/voice/session`, {
  method: 'POST', body, headers: { origin: env.APP_ORIGIN, 'oai-authenticated-user-id': 'inspector', ...headers },
});

test('hosted voice rejects anonymous, cross-origin and oversized requests before contacting OpenAI', async () => {
  assert.equal((await worker.fetch(request('v=0', { 'oai-authenticated-user-id': '' }), env)).status, 401);
  assert.equal((await worker.fetch(request('v=0', { origin: 'https://elsewhere.example' }), env)).status, 403);
  assert.equal((await worker.fetch(request('v=0' + 'x'.repeat(100000)), env)).status, 413);
});

test('hosted voice proxies SDP using the server secret without returning it to the browser', async (t) => {
  t.mock.method(globalThis, 'fetch', async (_input: unknown, init: RequestInit) => {
    assert.equal((init.headers as Record<string, string>).Authorization, 'Bearer test-secret');
    const payload = JSON.parse(init.body as string);
    assert.equal(payload.transport.sdp, 'v=0\r\n');
    assert.equal(payload.session.model, 'gpt-live-1');
    return Response.json({ transport: { sdp: 'v=0\r\nanswer' } });
  });
  const result = await worker.fetch(request('v=0\r\n'), env);
  assert.equal(result.status, 200);
  assert.equal(result.headers.get('Content-Type'), 'application/sdp');
  assert.equal(await result.text(), 'v=0\r\nanswer');
});

test('hosted voice status reports configuration and static requests reach assets', async () => {
  const status = await worker.fetch(new Request(`${env.APP_ORIGIN}/api/voice/status`, { headers: { 'oai-authenticated-user-id': 'inspector' } }), env);
  assert.deepEqual(await status.json(), { configured: true, model: 'gpt-live-1' });
  assert.equal(await (await worker.fetch(new Request(env.APP_ORIGIN), env)).text(), 'app');
});
