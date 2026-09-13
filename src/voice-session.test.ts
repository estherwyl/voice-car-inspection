import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VoiceSession, type Recognition, type VoiceState } from './voice-session';
class FakeRecognition implements Recognition {
 continuous=false;interimResults=false;lang='';
 onstart:Recognition['onstart']=null;onresult:Recognition['onresult']=null;onerror:Recognition['onerror']=null;onend:Recognition['onend']=null;
 aborted=false;
 start(){this.onstart?.();}
 abort(){this.aborted=true;}
 emit(words:string[]){this.onresult?.({resultIndex:0,results:Object.assign(words.map(transcript=>({isFinal:true,0:{transcript}})),{length:words.length})});}
}
const wait=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
function fixture(){
 const recs:FakeRecognition[]=[],transcripts:string[]=[],errors:string[]=[],states:VoiceState[]=[];
 let finish=()=>{};
 const voice=new VoiceSession({create:()=>{const r=new FakeRecognition();recs.push(r);return r;},speak:(_,done)=>{finish=done;},cancelSpeech:()=>{}},
 {onState:s=>states.push(s),onInterim:()=>{},onError:e=>errors.push(e),onTranscript:t=>{transcripts.push(t);return 'Recorded.';}},5);
 return {voice,recs,transcripts,errors,states,finish:()=>finish()};
}
test('all final results in a speech event are processed and not replaced',async()=>{
 const f=fixture();f.voice.start();f.recs[0].emit(['Left front door is okay.','Right rear door has a scratch.']);
 await wait(25);assert.equal(f.transcripts.length,1);assert.match(f.transcripts[0],/Left front door/);assert.match(f.transcripts[0],/Right rear door/);
 assert.ok(f.recs[0].aborted);assert.equal(f.states.at(-1),'speaking');f.voice.dispose();
});
test('recognition resumes after spoken reply, avoiding self-transcription',async()=>{
 const f=fixture();f.voice.start();const old=f.recs[0];old.emit(['Left front door is okay.']);await wait(25);
 old.emit(['Recorded.']);assert.equal(f.transcripts.length,1);
 f.finish();await wait(290);assert.equal(f.recs.length,2);assert.equal(f.states.at(-1),'listening');f.voice.dispose();
});
test('ordinary recognition end restarts without another tap; pause prevents restart',async()=>{
 const f=fixture();f.voice.start();f.recs[0].onend?.();await wait(230);assert.equal(f.recs.length,2);
 f.voice.stop();await wait(230);assert.equal(f.recs.length,2);assert.equal(f.states.at(-1),'idle');f.voice.dispose();
});
test('permission denial stops the session and exposes a useful error',async()=>{
 const f=fixture();f.voice.start();f.recs[0].onerror?.({error:'not-allowed'});await wait(230);
 assert.equal(f.recs.length,1);assert.equal(f.states.at(-1),'error');assert.match(f.errors.at(-1)!,/Microphone blocked/);f.voice.dispose();
});
test('pause preserves final words already received, and duplicate final indexes are ignored',()=>{
 const f=fixture();f.voice.start();f.recs[0].emit(['Left front door is okay.']);f.recs[0].emit(['Left front door is okay.']);
 f.voice.stop();assert.equal(f.transcripts.length,1);assert.equal(f.transcripts[0],'Left front door is okay.');f.voice.dispose();
});
