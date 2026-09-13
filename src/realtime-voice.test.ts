import test from 'node:test';
import assert from 'node:assert/strict';
import {executeVoiceTool,RealtimeVoice,type RealtimeCallbacks} from './realtime-voice';
import {converse} from './conversation';
import {freshRecord,statusOf} from './domain';
import {realtimeMiddleware,sessionConfig} from '../server/realtime';
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
 const event={type:'response.event',delegation_id:'delegation',event:{type:'response.completed',response:{id:'response',output:[]}}};
 voice.handle({type:'response.event',delegation_id:'delegation',event:{type:'response.created',response:{id:'response'}}});
 voice.handle({type:'response.event',delegation_id:'delegation',event:{type:'response.output_item.done',response_id:'response',item:{type:'function_call',call_id:'one',name:'inspection_command',arguments:JSON.stringify({command:'undo'})}}});
 assert.equal(calls,0);voice.handle(event);voice.handle(event);assert.equal(calls,1);voice.stop();assert.equal(stops,1);assert.equal(voice.active,false);
});
test('session proxy rejects foreign origins and sanitizes provider authentication errors',async()=>{
 let requests=0;const middleware=realtimeMiddleware({OPENAI_API_KEY:'test-secret'},async()=>{requests++;return new Response(JSON.stringify({error:{message:'sensitive provider response'}}),{status:401});});
 async function call(origin:string){const req=Readable.from(['v=0\r\n']) as any;req.url='/api/voice/session';req.method='POST';req.headers={host:'127.0.0.1:5173',origin};let body='';const res={statusCode:200,setHeader:()=>{},end:(value:string)=>{body=value;}} as any;await middleware(req,res,()=>{});return {status:res.statusCode,body};}
 assert.equal((await call('https://foreign.example')).status,403);assert.equal(requests,0);
 const denied=await call('http://127.0.0.1:5173');assert.equal(denied.status,401);assert.ok(!denied.body.includes('sensitive'));assert.ok(!denied.body.includes('test-secret'));
});

test('joining cannot execute example observations before inspector speech',()=>{
 let calls=0;const voice=new RealtimeVoice({onState:()=>{},onError:()=>{},onInterim:()=>{},onReply:()=>{},command:()=>{calls++;return 'saved';},context:()=>({})}) as any;voice.active=true;runCall(voice,'startup','open camera');assert.equal(calls,0);voice.stop();
});

function runCall(voice:any,id:string,command:string,terminal='response.completed'){
 const emit=(event:unknown)=>voice.handle({type:'response.event',delegation_id:id,event});
 emit({type:'response.created',response:{id}});emit({type:'response.output_item.done',response_id:id,item:{type:'function_call',call_id:id,name:'inspection_command',arguments:JSON.stringify({command})}});emit({type:terminal,response:{id,output:[]}});
}
test('Live cancels incomplete tool batches and uses the new result envelope',()=>{
 const sent:any[]=[];let calls=0;const voice=new RealtimeVoice({onState:()=>{},onError:()=>{},onInterim:()=>{},onReply:()=>{},command:()=>{calls++;return 'saved';},context:()=>({})}) as any;voice.active=true;voice.heardInspector=true;voice.channel={readyState:'open',send:(s:string)=>sent.push(JSON.parse(s)),close:()=>{}};
 runCall(voice,'cancelled','undo','response.cancelled');assert.equal(calls,0);runCall(voice,'complete','undo');assert.equal(calls,1);assert.deepEqual(sent.map(e=>e.type),['response.item.create','response.create']);assert.equal(sent[0].item.call_id,'complete');voice.stop();
});
test('Live captions append deltas independently and startup waits for session.started',()=>{
 const captions:string[]=[],sent:any[]=[];const voice=new RealtimeVoice({onState:()=>{},onError:()=>{},onInterim:t=>captions.push(t),onReply:()=>{},command:()=>'',context:()=>({})}) as any;voice.active=true;voice.channel={readyState:'open',send:(s:string)=>sent.push(JSON.parse(s)),close:()=>{}};
 voice.handle({type:'session.started'});assert.equal(sent[0].type,'session.instructions.append');
 voice.handle({type:'session.input_transcript.delta',delta:'Left ',start_ms:0,end_ms:100});voice.handle({type:'session.input_transcript.delta',delta:'door',start_ms:100,end_ms:200});assert.equal(captions.at(-1),'Left door');assert.equal(voice.heardInspector,true);voice.ready=false;voice.stop();
});
test('Live session selects the exact voice model and a separate sequential tool backend',()=>{
 const config=sessionConfig();assert.equal(config.model,'gpt-live-1');assert.equal(config.delegation.type,'responses');assert.equal(config.delegation.responses.model,'gpt-5.6-terra');assert.equal(config.delegation.responses.parallel_tool_calls,false);assert.equal(config.delegation.responses.tools.length,2);assert.ok(!('audio' in config));
});
test('Live proxy sends JSON session and transport to the Live endpoint',async()=>{
 let payload:any,url:any;const middleware=realtimeMiddleware({OPENAI_API_KEY:'test'},async(u,init)=>{url=u;payload=JSON.parse(String(init?.body));return Response.json({session:{id:'opaque'},transport:{type:'webrtc',sdp:'answer'}});});const req=Readable.from(['v=0\r\n']) as any;req.url='/api/voice/session';req.method='POST';req.headers={host:'localhost:5173',origin:'http://localhost:5173'};let body='';await middleware(req,{setHeader:()=>{},end:(v:string)=>{body=v;}} as any,()=>{});assert.equal(url,'https://api.openai.com/v1/live/sessions');assert.equal(payload.session.model,'gpt-live-1');assert.equal(payload.transport.type,'webrtc');assert.equal(body,'answer');
});
