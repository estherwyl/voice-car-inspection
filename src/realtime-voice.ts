import type { VoiceState } from './voice-session';
export type RealtimeCallbacks={onState:(state:VoiceState,active:boolean)=>void;onInterim:(text:string)=>void;onError:(text:string)=>void;onReply:(text:string)=>void;command:(text:string)=>string;context:()=>unknown};
export function executeVoiceTool(name:string,args:string,cb:Pick<RealtimeCallbacks,'command'|'context'>){
 try{const input=JSON.parse(args);if(name==='get_inspection')return cb.context();
  if(name!=='inspection_command'||typeof input.command!=='string'||!input.command.trim()||input.command.length>2000)return {error:'Invalid inspection command. Nothing changed.'};
  return {result:cb.command(input.command),inspection:cb.context()};
 }catch{return {error:'Could not apply that command. Ask the inspector to repeat it.'};}
}
export class RealtimeVoice {
 private pc:RTCPeerConnection|null=null;private channel:RTCDataChannel|null=null;private stream:MediaStream|null=null;private audio:HTMLAudioElement|null=null;
 private pending=new Map<string,{responseId:string;calls:any[]}>();private completed=new Set<string>();
 private captions={input:'',output:''};private captionEnds={input:0,output:0};private audioContext:AudioContext|null=null;private meterTimer:ReturnType<typeof setInterval>|undefined;private speaking=false;private ready=false;
 private heardInspector=false;private active=false;private version=0;private abort:AbortController|null=null;private timer:ReturnType<typeof setTimeout>|undefined;private seen=new Set<string>();
 constructor(private cb:RealtimeCallbacks){}
 private state(state:VoiceState){this.cb.onState(state,this.active);}
 private send(event:unknown){if(this.channel?.readyState==='open')this.channel.send(JSON.stringify(event));}
 async start(){
  if(this.active)return;this.active=true;const version=++this.version;this.cb.onError('');this.state('connecting');this.seen.clear();this.pending.clear();this.completed.clear();this.captions={input:"",output:""};this.captionEnds={input:0,output:0};this.heardInspector=false;this.ready=false;
  this.timer=setTimeout(()=>this.fail('Voice connection timed out. Tap to retry.'),30000);
  try{
   if(!navigator.mediaDevices?.getUserMedia)throw new Error('Microphone requires localhost or HTTPS and a supported browser.');
   const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
   if(version!==this.version){stream.getTracks().forEach(t=>t.stop());return;}this.stream=stream;
   const pc=new RTCPeerConnection();this.pc=pc;const audio=document.createElement('audio');audio.autoplay=true;this.audio=audio;
   pc.ontrack=e=>{const remote=new MediaStream([e.track]);audio.srcObject=remote;this.monitorPlayback(remote);void audio.play().catch(()=>this.fail('Audio playback was blocked. Tap the microphone to reconnect.'));};
   for(const track of stream.getTracks()){pc.addTrack(track,stream);track.onended=()=>{if(this.active)this.fail('Microphone disconnected. Tap to reconnect.');};}
   pc.onconnectionstatechange=()=>{if(this.active&&['failed','disconnected'].includes(pc.connectionState))this.fail('Voice connection lost. Your saved findings remain. Tap to reconnect.');};
   const channel=pc.createDataChannel('oai-events');this.channel=channel;
   // Live starts only after session.started; an open channel alone is not readiness.
   channel.onclose=()=>{if(this.active)this.fail('Voice connection closed. Tap to reconnect.');};
   channel.onmessage=e=>{if(version!==this.version)return;try{this.handle(JSON.parse(e.data));}catch{this.fail('Voice received an invalid event. Tap to reconnect.');}};
   const offer=await pc.createOffer();await pc.setLocalDescription(offer);
   if(pc.iceGatheringState!=='complete')await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Voice network setup timed out.')),8000);pc.addEventListener('icegatheringstatechange',()=>{if(pc.iceGatheringState==='complete'){clearTimeout(timer);resolve();}});});
   if(version!==this.version)return;
   this.abort=new AbortController();const response=await fetch('/api/voice/session',{method:'POST',headers:{'Content-Type':'application/sdp'},body:pc.localDescription?.sdp,signal:this.abort.signal});
   if(!response.ok){const error=await response.json();throw new Error(error.error||'Voice could not connect.');}
   const sdp=await response.text();if(version!==this.version)return;await pc.setRemoteDescription({type:'answer',sdp});
  }catch(e){if(version===this.version)this.fail(e instanceof DOMException&&e.name==='NotAllowedError'?'Microphone blocked. Allow access, then tap to retry.':e instanceof Error?e.message:'Voice could not connect.');}
 }
 private monitorPlayback(stream:MediaStream){
  // Live has no spoken-response-done event. Meter the received media, not backend completion.
  try{const context=new AudioContext();this.audioContext=context;void context.resume();const analyser=context.createAnalyser();analyser.fftSize=256;context.createMediaStreamSource(stream).connect(analyser);const samples=new Uint8Array(analyser.fftSize);let lastSound=0;
   this.meterTimer=setInterval(()=>{if(!this.active||!this.ready)return;analyser.getByteTimeDomainData(samples);if(samples.some(v=>Math.abs(v-128)>3))lastSound=Date.now();const speaking=Date.now()-lastSound<300;if(speaking!==this.speaking){this.speaking=speaking;this.state(speaking?'speaking':this.pending.size?'thinking':'listening');}},100);
  }catch{/* Voice still works where audio metering is unavailable. */}
 }
 private handle(e:any){
  if(e.type==='session.closed'){this.active=false;this.ready=false;this.pending.clear();this.cleanup();this.cb.onInterim('');this.state('idle');return;}
  if(!this.active)return;
  if(e.type==='error'){this.fail('OpenAI Live error. Check model access, quota and connection, then retry.');return;}
  if(e.type==='session.started'){
   if(this.ready)return;this.ready=true;clearTimeout(this.timer);this.state('listening');
   this.send({type:'session.instructions.append',event_id:crypto.randomUUID(),delegation_id:null,content:'Greet the inspector immediately in English: JARVICI is ready. Then pause and listen. Do not perform inspection actions until the inspector speaks.'});return;
  }
  if(e.type==='session.input_transcript.delta'||e.type==='session.output_transcript.delta'){
   const side=e.type==='session.input_transcript.delta'?'input':'output';
   if(e.start_ms-this.captionEnds[side]>1500)this.captions[side]='';
   this.captionEnds[side]=Math.max(this.captionEnds[side],e.end_ms||0);this.captions[side]=(this.captions[side]+(e.delta||'')).slice(-1500);
   if(side==='input'){if(e.delta?.trim())this.heardInspector=true;this.cb.onInterim(this.captions.input);}else this.cb.onReply(this.captions.output);return;
  }
  if(e.type!=='response.event'||!e.delegation_id)return;
  const event=e.event,key=e.delegation_id;
  if(event?.type==='response.created'){
   this.pending.set(key,{responseId:event.response.id,calls:[]});if(!this.speaking)this.state('thinking');return;
  }
  const batch=this.pending.get(key);if(!batch)return;
  if(event.type==='response.output_item.done'&&event.item?.type==='function_call'){
   if(event.response_id&&event.response_id!==batch.responseId)return;
   if(!batch.calls.some(c=>c.call_id===event.item.call_id))batch.calls.push(event.item);return;
  }
  if(['response.failed','response.cancelled','response.incomplete'].includes(event.type)){
   this.pending.delete(key);this.cb.onError('Inspection action was not completed. Please repeat it.');if(!this.speaking)this.state('listening');return;
  }
  if(event.type!=='response.completed'||event.response?.id!==batch.responseId||this.completed.has(batch.responseId))return;
  this.completed.add(batch.responseId);this.pending.delete(key);
  let called=false;
  for(const item of batch.calls){
   if(!item.call_id||this.seen.has(item.call_id))continue;this.seen.add(item.call_id);called=true;
   const output=item.name==='inspection_command'&&!this.heardInspector?{error:'No inspector speech received. Wait for the inspector; do not execute examples.'}:executeVoiceTool(item.name,item.arguments,this.cb);
   if(!this.active)return;
   this.send({type:'response.item.create',event_id:crypto.randomUUID(),item:{type:'function_call_output',call_id:item.call_id,output:JSON.stringify(output)}});
  }
  if(called){this.cb.onInterim('');this.send({type:'response.create',event_id:crypto.randomUUID()});}
  if(!this.speaking)this.state(called?'thinking':'listening');
 }
 private fail(message:string){this.stop();this.cb.onError(message);this.state('error');}
 private cleanup(){clearTimeout(this.timer);clearInterval(this.meterTimer);this.audioContext?.close().catch(()=>{});this.audioContext=null;this.channel?.close();this.channel=null;this.pc?.close();this.pc=null;this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;if(this.audio){this.audio.pause();this.audio.srcObject=null;this.audio=null;}}
 stop(){
  this.active=false;this.version++;clearTimeout(this.timer);this.abort?.abort();this.abort=null;
  // Stop capturing immediately while the control connection waits for final closure.
  this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;this.audio?.pause();
  if(this.ready&&this.channel?.readyState==='open'){
   const channel=this.channel,pc=this.pc,audio=this.audio,context=this.audioContext;clearInterval(this.meterTimer);
   channel.send(JSON.stringify({type:'session.close',event_id:crypto.randomUUID()}));
   this.channel=null;this.pc=null;this.audio=null;this.audioContext=null;
   const finish=()=>{clearTimeout(timeout);channel.close();pc?.close();if(audio)audio.srcObject=null;void context?.close().catch(()=>{});};
   const timeout=setTimeout(finish,3000);channel.onmessage=event=>{try{if(JSON.parse(event.data).type==='session.closed')finish();}catch{finish();}};channel.onclose=()=>{clearTimeout(timeout);pc?.close();};
  }else this.cleanup();
  this.ready=false;this.speaking=false;this.pending.clear();this.cb.onInterim('');this.state('idle');
 }
 dispose(){this.stop();}
}
