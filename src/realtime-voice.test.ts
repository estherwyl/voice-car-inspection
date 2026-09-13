import test from 'node:test';
import assert from 'node:assert/strict';
import {executeVoiceTool,RealtimeVoice,type RealtimeCallbacks} from './realtime-voice';
import {converse} from './conversation';
import {freshRecord,statusOf} from './domain';
import {realtimeMiddleware} from '../server/realtime';
import {Readable} from 'node:stream';
test('live tool commands record and correct findings without passing sibling checks',()=>{
 let record=freshRecord();let context={partId:''};
 const cb={command:(text:string)=>{const r=converse(text,record,context);record=r.record;context=r.context;return r.reply;},context:()=>({photos:record.photos.length})};
 executeVoiceTool('inspection_command',JSON.stringify({command:'Left front door is okay'}),cb);
 assert.equal(statusOf(record,'left-front-door'),'pass');
 executeVoiceTool('inspection_command',JSON.stringify({command:'Right rear door has a minor scratch'}),cb);
 executeVoiceTool('inspection_command',JSON.stringify({command:'Actually that was the left rear door'}),cb);
 assert.equal(record.findings.length,1);assert.equal(record.findings[0].checkId,'left-rear-door');
 const before=record;executeVoiceTool('bad_tool','{}',cb);executeVoiceTool('inspection_command','{',cb);assert.equal(record,before);
});
test('duplicate completed tool events apply only once and stopped sessions do not keep microphone tracks',()=>{
 let calls=0,stops=0;const cb:RealtimeCallbacks={onState:()=>{},onError:()=>{},onInterim:()=>{},onReply:()=>{},command:()=>{calls++;return 'saved';},context:()=>({})};
 const voice=new RealtimeVoice(cb) as any;voice.active=true;voice.heardInspector=true;voice.stream={getTracks:()=>[{stop:()=>stops++}]};
 const event={type:'response.done',response:{output:[{type:'function_call',call_id:'one',name:'inspection_command',arguments:'{"command":"undo"}'}]}};
 voice.handle(event);voice.handle(event);assert.equal(calls,1);voice.stop();assert.equal(stops,1);assert.equal(voice.active,false);
});
test('session proxy rejects foreign origins and sanitizes provider authentication errors',async()=>{
 let requests=0;const middleware=realtimeMiddleware({OPENAI_API_KEY:'test-secret'},async()=>{requests++;return new Response(JSON.stringify({error:{message:'sensitive provider response'}}),{status:401});});
 async function call(origin:string){const req=Readable.from(['v=0\r\n']) as any;req.url='/api/voice/session';req.method='POST';req.headers={host:'127.0.0.1:5173',origin};let body='';const res={statusCode:200,setHeader:()=>{},end:(value:string)=>{body=value;}} as any;await middleware(req,res,()=>{});return {status:res.statusCode,body};}
 assert.equal((await call('https://foreign.example')).status,403);assert.equal(requests,0);
 const denied=await call('http://127.0.0.1:5173');assert.equal(denied.status,401);assert.ok(!denied.body.includes('sensitive'));assert.ok(!denied.body.includes('test-secret'));
});

test('joining cannot execute example observations before inspector speech',()=>{
 let calls=0;const voice=new RealtimeVoice({onState:()=>{},onError:()=>{},onInterim:()=>{},onReply:()=>{},command:()=>{calls++;return 'saved';},context:()=>({})}) as any;voice.active=true;voice.handle({type:'response.done',response:{output:[{type:'function_call',call_id:'startup',name:'inspection_command',arguments:'{"command":"open camera"}'}]}});assert.equal(calls,0);voice.stop();
});
