import type { IncomingMessage, ServerResponse } from 'node:http';
import { CHECKS } from '../src/checklist';
export function sessionConfig(model='gpt-live-1',backendModel='gpt-5.6-terra') {
 return {model,instructions:'You are JARVICI, a concise car inspection voice companion. Speak English until the inspector chooses another language. Delegate every observation, correction, severity answer, camera request, navigation and report question to the backend. Do not claim a change was saved until the backend confirms it. Ask the clarification returned by the backend. Never invent results or execute examples. Wait for the inspector after a brief greeting.',delegation:{type:'responses',responses:{model:backendModel,parallel_tool_calls:false,instructions:`You are JARVICI (Just A Rather Very Intelligent Car Inspector), a concise voice companion for inspecting a 2022 Subaru XV GT Edition, petrol, right-hand drive. Speak briefly in the user's language. Never invent observations, severity, photos or grades. Left/right are vehicle-relative. A door okay means only the exterior panel, not its window or trim. Ask briefly when ambiguous. Use get_inspection for current state on joining and before answering progress questions. Every observation, correction, severity answer, camera action or navigation must use inspection_command before claiming it happened. Translate natural speech into concise English commands, preserving all facts and uncertainty. Commands include: 'Left front door is okay', 'Right rear door has a minor scratch', 'minor', 'Actually that was the left rear door', 'undo', 'open camera for the left front door', 'capture', 'save photo', 'retake', 'close camera', 'interior', 'exterior', 'exploded', 'assembled', 'what is left', 'review the report', 'pause'. These commands are syntax examples only: never execute them unless the inspector actually requests them. On joining, only read the inspection and greet, then wait for speech. Send each independent observation once in order. If a tool asks a clarification, ask that question and pass the answer to the tool; never assume it saved. Never retry a successful observation. Camera actions start an operation; do not claim evidence saved until get_inspection confirms it. Grading is illustrative and finalization requires the inspector's review. Checklist names: ${CHECKS.map(c=>c.name).join('; ')}`,
 tools:[{type:'function',name:'inspection_command',description:'Apply a spoken inspection observation or app action. Returns actual result, including any needed clarification.',parameters:{type:'object',properties:{command:{type:'string'}},required:['command'],additionalProperties:false}},{type:'function',name:'get_inspection',description:'Read current checklist statuses, findings, photo counts and proposed grade.',parameters:{type:'object',properties:{},additionalProperties:false}}],tool_choice:'auto'}}};
}
export function realtimeMiddleware(env:Record<string,string>,request:typeof fetch=fetch){
 let starts:number[]=[];
 return async(req:IncomingMessage,res:ServerResponse,next:()=>void)=>{
  if(!req.url?.startsWith('/api/voice/'))return next();
  res.setHeader('Cache-Control','no-store');
  const json=(code:number,error:unknown)=>{res.statusCode=code;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(error));};
  if(req.url==='/api/voice/status'&&req.method==='GET')return json(200,{configured:!!env.OPENAI_API_KEY,model:env.OPENAI_LIVE_MODEL||'gpt-live-1'});
  if(req.url!=='/api/voice/session'||req.method!=='POST')return json(404,{error:'Not found'});
  const origin=req.headers.origin;
  if(!origin||!['http://127.0.0.1:'+req.headers.host?.split(':').at(-1),'http://localhost:'+req.headers.host?.split(':').at(-1)].includes(origin))return json(403,{error:'Voice sessions are restricted to this local app.'});
  if(!env.OPENAI_API_KEY)return json(503,{error:'Add OPENAI_API_KEY to .env.local and restart the app.'});
  starts=starts.filter(t=>Date.now()-t<60000);if(starts.length>=6)return json(429,{error:'Too many reconnects. Wait a minute and retry.'});starts.push(Date.now());
  try{
   let body='';for await(const chunk of req){body+=chunk;if(body.length>100000)return json(413,{error:'Session request too large.'});}
   if(!body.startsWith('v=0'))return json(400,{error:'Invalid voice connection request.'});
   const data=JSON.stringify({session:sessionConfig(env.OPENAI_LIVE_MODEL,env.OPENAI_DELEGATION_MODEL),transport:{type:'webrtc',sdp:body}});
   const result=await request('https://api.openai.com/v1/live/sessions',{method:'POST',headers:{Authorization:`Bearer ${env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:data,signal:AbortSignal.timeout(20000)});
   if(!result.ok){const status=result.status;await result.body?.cancel();return json(status,{error:status===401?'OpenAI rejected the API key. Update the server key.':status===429?'OpenAI quota or rate limit reached. Check API billing and retry.':status===403?'This key cannot access the voice model. Check project permissions.':'OpenAI could not start voice. Please retry.'});}
   const answer=await result.json();if(typeof answer.transport?.sdp!=='string')return json(502,{error:'OpenAI returned an invalid voice connection.'});res.setHeader('Content-Type','application/sdp');res.end(answer.transport.sdp);
  }catch{return json(502,{error:'Unable to connect to OpenAI. Check the network and retry.'});}
 };
}
