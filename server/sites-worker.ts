import { sessionConfig } from './realtime';

type Env = {
  OPENAI_API_KEY?: string;
  OPENAI_LIVE_MODEL?: string;
  OPENAI_DELEGATION_MODEL?: string;
  APP_ORIGIN: string;
  ASSETS: { fetch(request: Request): Promise<Response> };
};

const starts = new Map<string, number[]>();
const json = (status: number, data: unknown) => Response.json(data, {
  status, headers: { 'Cache-Control': 'no-store' },
});

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    const user = request.headers.get('oai-authenticated-user-id');
    if (!user) return json(401, { error: 'Sign in to use voice inspection.' });
    if (url.pathname === '/api/voice/status' && request.method === 'GET') {
      return json(200, { configured: !!env.OPENAI_API_KEY, model: env.OPENAI_LIVE_MODEL || 'gpt-live-1' });
    }
    if (url.pathname !== '/api/voice/session' || request.method !== 'POST') return json(404, { error: 'Not found' });
    if (!env.APP_ORIGIN || request.headers.get('origin') !== env.APP_ORIGIN) {
      return json(403, { error: 'Start voice from this app.' });
    }
    if (!env.OPENAI_API_KEY) return json(503, { error: 'Voice is not configured. Contact the site owner.' });
    const now = Date.now();
    for (const [id, times] of starts) if (!times.some(t => now - t < 60000)) starts.delete(id);
    const recent = (starts.get(user) || []).filter(t => now - t < 60000);
    if (recent.length >= 6) return json(429, { error: 'Too many reconnects. Wait a minute and retry.' });
    starts.set(user, [...recent, now]);
    try {
      const reader = request.body?.getReader();
      if (!reader) return json(400, { error: 'Invalid voice connection request.' });
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 100000) { await reader.cancel(); return json(413, { error: 'Session request too large.' }); }
        chunks.push(value);
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      const sdp = new TextDecoder().decode(bytes);
      if (!sdp.startsWith('v=0')) return json(400, { error: 'Invalid voice connection request.' });
      const result = await fetch('https://api.openai.com/v1/live/sessions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ session: sessionConfig(env.OPENAI_LIVE_MODEL, env.OPENAI_DELEGATION_MODEL), transport: { type: 'webrtc', sdp } }),
        signal: AbortSignal.timeout(20000),
      });
      if (!result.ok) {
        await result.body?.cancel();
        return json(result.status, { error: result.status === 429 ? 'OpenAI quota or rate limit reached. Check API billing and retry.' : result.status === 401 ? 'OpenAI rejected the server API key.' : result.status === 403 ? 'This key cannot access the voice model.' : 'OpenAI could not start voice. Please retry.' });
      }
      const answer = await result.json() as { transport?: { sdp?: string } };
      if (typeof answer.transport?.sdp !== 'string') return json(502, { error: 'OpenAI returned an invalid voice connection.' });
      return new Response(answer.transport.sdp, { headers: { 'Content-Type': 'application/sdp', 'Cache-Control': 'no-store' } });
    } catch {
      return json(502, { error: 'Unable to connect to OpenAI. Please retry.' });
    }
  },
};
