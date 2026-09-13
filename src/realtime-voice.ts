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
 private heardInspector=false;private active=false;private version=0;private abort:AbortController|null=null;private timer:ReturnType<typeof setTimeout>|undefined;private seen=new Set<string>();
 constructor(private cb:RealtimeCallbacks){}
 private state(state:VoiceState){this.cb.onState(state,this.active);}
 private send(event:unknown){if(this.channel?.readyState==='open')this.channel.send(JSON.stringify(event));}
 async start(){
  if(this.active)return;this.active=true;const version=++this.version;this.cb.onError('');this.state('connecting');this.seen.clear();this.heardInspector=false;
  this.timer=setTimeout(()=>this.fail('Voice connection timed out. Tap to retry.'),30000);
  try{
   if(!navigator.mediaDevices?.getUserMedia)throw new Error('Microphone requires localhost or HTTPS and a supported browser.');
   const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
   if(version!==this.version){stream.getTracks().forEach(t=>t.stop());return;}this.stream=stream;
   const pc=new RTCPeerConnection();this.pc=pc;const audio=document.createElement('audio');audio.autoplay=true;this.audio=audio;
   pc.ontrack=e=>{audio.srcObject=e.streams[0];void audio.play().catch(()=>this.fail('Audio playback was blocked. Tap the microphone to reconnect.'));};
   for(const track of stream.getTracks()){pc.addTrack(track,stream);track.onended=()=>{if(this.active)this.fail('Microphone disconnected. Tap to reconnect.');};}
   pc.onconnectionstatechange=()=>{if(this.active&&['failed','disconnected'].includes(pc.connectionState))this.fail('Voice connection lost. Your saved findings remain. Tap to reconnect.');};
   const channel=pc.createDataChannel('oai-events');this.channel=channel;
   channel.onopen=()=>{clearTimeout(this.timer);this.state('listening');this.send({type:'conversation.item.create',item:{type:'message',role:'user',content:[{type:'input_text',text:'Begin this inspection session. Read the current inspection then briefly say you are ready.'}]}});this.send({type:'response.create'});};
   channel.onclose=()=>{if(this.active)this.fail('Voice connection closed. Tap to reconnect.');};
   channel.onmessage=e=>{if(version!==this.version)return;try{this.handle(JSON.parse(e.data));}catch{this.fail('Voice received an invalid event. Tap to reconnect.');}};
   const offer=await pc.createOffer();await pc.setLocalDescription(offer);
   this.abort=new AbortController();const response=await fetch('/api/voice/session',{method:'POST',headers:{'Content-Type':'application/sdp'},body:offer.sdp,signal:this.abort.signal});
   if(!response.ok){const error=await response.json();throw new Error(error.error||'Voice could not connect.');}
   const sdp=await response.text();if(version!==this.version)return;await pc.setRemoteDescription({type:'answer',sdp});
  }catch(e){if(version===this.version)this.fail(e instanceof DOMException&&e.name==='NotAllowedError'?'Microphone blocked. Allow access, then tap to retry.':e instanceof Error?e.message:'Voice could not connect.');}
 }
 private handle(e:any){
  if(e.type==='error'){this.fail('OpenAI voice error. Check your API quota and connection, then retry.');return;}
  if(e.type==='input_audio_buffer.speech_started'){this.heardInspector=true;this.cb.onInterim('Listening…');this.state('listening');}
  if(e.type==='input_audio_buffer.speech_stopped')this.state('thinking');
  if(e.type==='conversation.item.input_audio_transcription.completed')this.cb.onInterim(e.transcript||'');
  if(e.type==='output_audio_buffer.started')this.state('speaking');
  if(e.type==='output_audio_buffer.stopped'||e.type==='output_audio_buffer.cleared'){this.cb.onInterim('');this.state('listening');}
  if(e.type==='response.output_audio_transcript.done')this.cb.onReply(e.transcript||'');
  if(e.type==='response.done'){
   if(e.response?.status==='failed'){this.fail('OpenAI could not answer. Check API billing or retry.');return;}
   let called=false;
   for(const item of e.response?.output??[]){
    if(item.type!=='function_call'||!item.call_id||this.seen.has(item.call_id))continue;
    this.seen.add(item.call_id);called=true;
    const output=item.name==='inspection_command'&&!this.heardInspector?{error:'No inspector speech received. Do not execute example commands. Wait for the inspector.'}:executeVoiceTool(item.name,item.arguments,this.cb);
    if(!this.active)return;
    this.send({type:'conversation.item.create',item:{type:'function_call_output',call_id:item.call_id,output:JSON.stringify(output)}});
   }
   if(called){this.cb.onInterim('');this.state('thinking');this.send({type:'response.create'});}
  }
 }
 private fail(message:string){this.stop();this.cb.onError(message);this.state('error');}
 stop(){this.active=false;this.version++;clearTimeout(this.timer);this.abort?.abort();this.abort=null;this.channel?.close();this.channel=null;this.pc?.close();this.pc=null;this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;if(this.audio){this.audio.pause();this.audio.srcObject=null;this.audio=null;}this.cb.onInterim('');this.state('idle');}
 dispose(){this.stop();}
}
