import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readVoiceResponse, RealtimeVoice } from './realtime-voice';

test('empty and HTML error responses produce useful errors instead of JSON parsing failures',async()=>{
 await assert.rejects(readVoiceResponse(new Response(null,{status:404}),'sdp'),/HTTP 404/);
 await assert.rejects(readVoiceResponse(new Response('<html>gateway error</html>',{status:502}),'sdp'),/HTTP 502/);
 await assert.rejects(readVoiceResponse(new Response('<html>app</html>'),'json'),/restart the development server/);
 await assert.rejects(readVoiceResponse(new Response(''),'sdp'),/invalid connection/);
});
test('voice response preserves provider errors and accepts valid SDP',async()=>{
 await assert.rejects(readVoiceResponse(Response.json({error:'OpenAI quota reached'},{status:429}),'sdp'),/OpenAI quota reached/);
 assert.equal(await readVoiceResponse(new Response('v=0\r\n'),'sdp'),'v=0\r\n');
});
test('anonymous voice startup requests sign-in before opening microphone or WebRTC',async(t)=>{
 t.mock.method(globalThis,'fetch',async()=>Response.json({error:'Sign in to use voice inspection.'},{status:401}));
 const errors:string[]=[];
 const voice=new RealtimeVoice({onState:()=>{},onInterim:()=>{},onError:e=>errors.push(e),onReply:()=>{},command:()=>'',context:()=>({})});
 await voice.start();
 assert.equal(errors.at(-1),'Sign in to use voice inspection.');
 voice.dispose();
});
