export type VoiceState = 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'error';
export type RecognitionEvent = { resultIndex:number; results:{length:number;[i:number]:{isFinal:boolean;0:{transcript:string}}} };
export interface Recognition {
 continuous:boolean; interimResults:boolean; lang:string;
 onstart:(()=>void)|null; onresult:((e:RecognitionEvent)=>void)|null;
 onerror:((e:{error:string})=>void)|null; onend:(()=>void)|null;
 start():void; abort():void;
}
export type VoiceCallbacks = {
 onState:(state:VoiceState,active:boolean)=>void;
 onInterim:(text:string)=>void;
 onError:(text:string)=>void;
 onTranscript:(text:string)=>string;
};
export type VoiceAdapter = {
 create:()=>Recognition;
 speak:(text:string,done:()=>void)=>void;
 cancelSpeech:()=>void;
};
/** Owns one microphone session. Final results are queued, never replaced by a UI timer. */
export class VoiceSession {
 private active=false;
 private rec:Recognition|null=null;
 private state:VoiceState='idle';
 private pending:string[]=[];
 private flushTimer:ReturnType<typeof setTimeout>|undefined;
 private retryTimer:ReturnType<typeof setTimeout>|undefined;
 private failures=0;
 private disposed=false;
 private speechVersion=0;
 constructor(private adapter:VoiceAdapter,private cb:VoiceCallbacks,private debounce=650){}
 private update(state:VoiceState){this.state=state;this.cb.onState(state,this.active);}
 start(){if(this.active||this.disposed)return;this.active=true;this.failures=0;this.cb.onError('');this.listen();}
 stop(){
  this.active=false;clearTimeout(this.retryTimer);clearTimeout(this.flushTimer);
  this.disconnect();this.speechVersion++;this.adapter.cancelSpeech();
  // Keep finalized words already received, even if the inspector taps Stop immediately.
  if(this.pending.length){const words=this.pending.splice(0).join(' ');this.cb.onTranscript(words);}
  this.cb.onInterim('');this.update('idle');
 }
 private disconnect(){const rec=this.rec;this.rec=null;if(rec){rec.onend=null;rec.onresult=null;rec.onstart=null;rec.onerror=null;rec.abort();}}
 private scheduleListen(delay=200){clearTimeout(this.retryTimer);if(this.active)this.retryTimer=setTimeout(()=>this.listen(),delay);}
 private listen(){
  if(!this.active||this.disposed||this.rec||this.state==='speaking')return;
  this.update('connecting');
  const rec=this.adapter.create();this.rec=rec;const seen=new Set<number>();
  rec.continuous=true;rec.interimResults=true;rec.lang='en-MY';
  rec.onstart=()=>{if(this.rec===rec)this.update('listening');};
  rec.onresult=e=>{
   if(this.rec!==rec||!this.active)return;
   let interim='';this.failures=0;
   for(let i=e.resultIndex;i<e.results.length;i++){
    const result=e.results[i];
    if(result.isFinal&&!seen.has(i)){seen.add(i);if(result[0].transcript.trim())this.pending.push(result[0].transcript.trim());}
    else if(!result.isFinal)interim+=result[0].transcript;
   }
   this.cb.onInterim([...this.pending,interim].filter(Boolean).join(' '));
   clearTimeout(this.flushTimer);
   if(this.pending.length)this.flushTimer=setTimeout(()=>this.flush(),this.debounce);
  };
  rec.onerror=e=>{
   if(this.rec!==rec)return;
   this.disconnect();
   if(e.error==='no-speech'||e.error==='aborted'){this.update('connecting');this.scheduleListen();return;}
   if(e.error==='network'&&++this.failures<3){this.update('connecting');this.scheduleListen(750*this.failures);return;}
   this.active=false;clearTimeout(this.flushTimer);
   if(this.pending.length)this.cb.onTranscript(this.pending.splice(0).join(' '));
   this.cb.onInterim('');
   const errors:Record<string,string>={
    'not-allowed':'Microphone blocked. Allow access in browser settings, then tap to retry.',
    'service-not-allowed':'Voice is unavailable here. Open this app in a browser with speech recognition.',
    'audio-capture':'No microphone found. Connect one, then tap to retry.',
    network:'Voice connection lost. Check your connection, then tap to reconnect.',
    'language-not-supported':'This browser does not support the selected speech language.',
   };
   this.cb.onError(errors[e.error]??'Voice stopped. Tap the microphone to reconnect.');
   this.update('error');
  };
  rec.onend=()=>{
   if(this.rec!==rec)return;this.rec=null;this.update('connecting');
   if(this.pending.length){clearTimeout(this.flushTimer);this.flushTimer=setTimeout(()=>this.flush(),this.debounce);}
   else this.scheduleListen();
  };
  try{rec.start();}catch{this.disconnect();this.active=false;this.cb.onError('Could not start the microphone. Tap to retry.');this.update('error');}
 }
 private flush(){
  if(!this.pending.length||this.disposed)return;
  clearTimeout(this.flushTimer);this.disconnect();this.update('thinking');
  const text=this.pending.splice(0).join(' ');this.cb.onInterim('');
  const reply=this.cb.onTranscript(text);
  if(this.active)this.respond(reply);else this.update('idle');
 }
 respond(text:string){
  if(!this.active||!text)return;
  this.disconnect();this.update('speaking');const version=++this.speechVersion;
  this.adapter.cancelSpeech();
  this.adapter.speak(text,()=>{
   if(version!==this.speechVersion||this.disposed)return;
   this.update('connecting');this.scheduleListen(250);
  });
 }
 dispose(){this.stop();this.disposed=true;}
}
export function browserVoiceAdapter():VoiceAdapter|null {
 const w=window as unknown as {SpeechRecognition?:new()=>Recognition;webkitSpeechRecognition?:new()=>Recognition};
 const Constructor=w.SpeechRecognition??w.webkitSpeechRecognition;
 if(!Constructor)return null;
 return {
  create:()=>new Constructor(),
  cancelSpeech:()=>window.speechSynthesis?.cancel(),
  speak:(text,done)=>{
   if(!window.speechSynthesis){done();return;}
   const utterance=new SpeechSynthesisUtterance(text);utterance.lang='en-GB';utterance.rate=1.06;
   let finished=false;const finish=()=>{if(!finished){finished=true;clearTimeout(timeout);done();}};
   const timeout=setTimeout(finish,Math.max(6000,text.length*100));
   utterance.onend=finish;utterance.onerror=finish;
   window.speechSynthesis.speak(utterance);
  }
 };
}
