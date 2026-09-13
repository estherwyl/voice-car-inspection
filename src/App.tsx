import { VEHICLES, vehicleById } from './vehicles';
import { useEffect, useRef, useState } from 'react';
import { Mic, Square, Camera, RotateCcw, Check, LoaderCircle, AlertCircle, X, ClipboardList, MoreHorizontal, Info, History, LayoutGrid, Car, Focus, ArrowLeft, ArrowRight } from 'lucide-react';
import CarScene from './CarScene';
import BrandHeader from './BrandHeader';
import DetailPanel, { EvidenceViewer } from './DetailPanel';
import CameraModal from './CameraModal';
import Review from './Review';
import { CHECKS, SECTIONS, checkById, partById, type Section } from './checklist';
import { completeness, grade, freshRecord, mutate, statusOf, STATUS, type RecordData, type Mutation, type Photo } from './domain';
import { converse, normalizeSpeech, type ConversationContext } from './conversation';
import { browserVoiceAdapter, VoiceSession, type VoiceState } from './voice-session';
import { RealtimeVoice } from './realtime-voice';
import { loadRecord, saveRecord } from './storage';
import './simple.css';

export default function App(){
 const [record,setRecord]=useState<RecordData|null>(null),recordRef=useRef<RecordData|null>(null);
 const [loadError,setLoadError]=useState(''),[save,setSave]=useState<'saving'|'saved'|'failed'>('saved'),saveQueue=useRef(Promise.resolve());
 const [switching,setSwitching]=useState(false);
 async function selectVehicle(id:string){if(switching)return;setSwitching(true);session.current?.stop();try{await saveQueue.current;if(recordRef.current)await saveRecord(recordRef.current);const next=await loadRecord(id)??freshRecord(id);commit(next);conversation.current={partId:''};setSelected('');setView('Exterior');setExpansion(0);setIsolated(false);setPanel(null);setMenu(false);setReview(false);setCamera(null);setPhoto(null);setReply('');setInterim('');setVoiceError('');setPage('inspection');}catch(e){setLoadError(String(e));}finally{setSwitching(false);}}
 const [page,setPage]=useState<'vehicles'|'inspection'>('vehicles');
 const [selected,setSelected]=useState(''),[checkId,setCheckId]=useState('left-front-door');
 const [view,setView]=useState<'Exterior'|'Interior'>('Exterior'),[expansion,setExpansion]=useState(0),[isolated,setIsolated]=useState(false),[reset,setReset]=useState(0);
 const [panel,setPanel]=useState<'report'|'detail'|'history'|'about'|null>(null),[menu,setMenu]=useState(false),[review,setReview]=useState(false);
 const [filter,setFilter]=useState('observed'),[section,setSection]=useState<Section|'All'>('All'),[detailTab,setDetailTab]=useState<'checks'|'findings'|'photos'>('checks');
 const [camera,setCamera]=useState<{checkId:string;findingId?:string}|null>(null),cameraRef=useRef<typeof camera>(null);
 const [cameraAction,setCameraAction]=useState<{id:number;action:'capture'|'save'|'retake'}>({id:0,action:'capture'});
 const [photo,setPhoto]=useState<Photo|null>(null),[toast,setToast]=useState('');
 const [voiceState,setVoiceState]=useState<VoiceState>('idle'),[active,setActive]=useState(false),[interim,setInterim]=useState(''),[reply,setReply]=useState(''),[voiceError,setVoiceError]=useState('');
 const session=useRef<VoiceSession|RealtimeVoice|null>(null),conversation=useRef<ConversationContext>({partId:''}),processRef=useRef<(text:string)=>string>(()=>'');
 cameraRef.current=camera;
 function commit(next:RecordData){recordRef.current=next;setRecord(next);}
 function apply(action:Mutation){
  if(!recordRef.current)return;
  try{const next=mutate(recordRef.current,action);commit(next);return next;}
  catch(e){setToast(e instanceof Error?e.message:'Could not save that change.');return undefined;}
 }
 function focusCheck(id:string,open=false){
  const c=checkById(id);if(!c)return;
  setCheckId(id);setSelected(c.partId);setView(c.section==='Interior'?'Interior':partById(c.partId).view);setIsolated(false);
  if(open){setDetailTab('checks');setPanel('detail');}
 }
 function choosePart(id:string){
  const finding=recordRef.current?.findings.filter(f=>checkById(f.checkId).partId===id&&!f.resolved).at(-1);
  const c=finding?checkById(finding.checkId):CHECKS.find(c=>c.partId===id&&c.section===view)??CHECKS.find(c=>c.partId===id);
  if(c){focusCheck(c.id,true);if(finding)setDetailTab('findings');}
 }
 function openCamera(findingId?:string){
  const r=recordRef.current;if(!r)return;
  const id=checkId,findings=r.findings.filter(f=>f.checkId===id);
  setCamera({checkId:id,findingId:findingId??(findings.length===1?findings[0].id:undefined)});
 }
 function process(text:string):string {
  const r=recordRef.current;if(!r)return 'Please wait for your inspection to load.';
  if(/^(stop|stop listening|pause inspection|pause|stop microphone|turn off (the )?microphone)[.!]?$/i.test(text.trim())){
   session.current?.stop();setReply('Paused.');return '';
  }
  if(cameraRef.current){
   const t=text.trim().toLowerCase().replace(/[.!]/g,'');
   if(/^(capture|capture photo|take it|snap|take (a |the )?photo)$/.test(t)){setCameraAction(a=>({id:a.id+1,action:'capture'}));return 'Capturing.';}
   if(/^(save|save photo|attach|attach photo|keep it|use (this|that)( photo)?)$/.test(t)){setCameraAction(a=>({id:a.id+1,action:'save'}));return 'Attaching the photo.';}
   if(/^(retake|try again|retake photo)$/.test(t)){setCameraAction(a=>({id:a.id+1,action:'retake'}));return 'Retaking the photo.';}
   if(/^(cancel|close camera)$/.test(t)){setCamera(null);return 'Camera closed.';}
  }
  const result=converse(text,r,conversation.current);conversation.current=result.context;
  if(result.record!==r)commit(result.record);
  const last=result.changedChecks.at(-1);if(last)focusCheck(last);
  let message=result.reply;
  for(const intent of result.effects){
   switch(intent.action){
    case 'select':{const c=CHECKS.find(c=>c.partId===intent.partId);if(c)focusCheck(c.id);message='Showing '+partById(intent.partId).name+'.';break;}
    case 'interior':setView('Interior');setSelected('driver-seat');setExpansion(1);setIsolated(false);message='Interior.';break;
    case 'exterior':setView('Exterior');setSelected('');setExpansion(0);setIsolated(false);message='Exterior.';break;
    case 'exploded':setExpansion(1);message='Parts view.';break;
    case 'assembled':setExpansion(0);message='Vehicle view.';break;
    case 'camera':{
     const named=CHECKS.filter(c=>normalizeSpeech(text).toLowerCase().includes(c.name.toLowerCase())).sort((a,b)=>b.name.length-a.name.length)[0];
     const id=last??named?.id??(selected?checkId:undefined);
     if(!id){message='Which part? Say open camera for the right front door, for example.';break;}
     const fs=result.record.findings.filter(f=>f.checkId===id);
     setCamera({checkId:id,findingId:fs.length===1?fs[0].id:undefined});message='Camera opening. Say capture, then save photo.';break;
    }
    case 'capture':message='Say open camera first.';break;
    case 'review':setReview(true);message='Your report is ready to review.';break;
    case 'outstanding':setFilter('unchecked');setSection('All');setPanel('report');break;
   }
  }
  setReply(message);return message;
 }
 processRef.current=process;
 useEffect(()=>{
  let live=true;loadRecord().then(r=>{if(live)commit(r??freshRecord());}).catch(e=>setLoadError(String(e)));return()=>{live=false;};
 },[]);
 useEffect(()=>{
  if(!record)return;setSave('saving');
  const timer=setTimeout(()=>{saveQueue.current=saveQueue.current.catch(()=>{}).then(()=>saveRecord(record)).then(()=>{if(recordRef.current===record)setSave('saved');}).catch(()=>setSave('failed'));},250);
  return()=>clearTimeout(timer);
 },[record]);
 useEffect(()=>{
  const adapter=browserVoiceAdapter();
  // Browser adapter is retained only for the isolated deterministic UI test harness.
  if(!location.pathname.startsWith('/tests/')){
   const voice=new RealtimeVoice({onState:(state,on)=>{setVoiceState(state);setActive(on);},onInterim:setInterim,onError:setVoiceError,onReply:setReply,command:text=>processRef.current(text),context:()=>{const r=recordRef.current;return r?{vehicle:vehicleById(r.vehicleId),completeness:completeness(r),grade:grade(r),checks:CHECKS.map(c=>({id:c.id,name:c.name,status:statusOf(r,c.id)})),findings:r.findings,photos:r.photos.map(p=>({id:p.id,checkId:p.checkId,findingId:p.findingId})),cameraOpen:!!cameraRef.current}:{};}});
   session.current=voice;return()=>{voice.dispose();session.current=null;};
  }
  if(!adapter)return;
  const voice=new VoiceSession(adapter,{onState:(state,on)=>{setVoiceState(state);setActive(on);},onInterim:setInterim,onError:setVoiceError,onTranscript:text=>processRef.current(text)});
  session.current=voice;return()=>{voice.dispose();session.current=null;};
 },[]);
 useEffect(()=>{
  const close=(e:KeyboardEvent)=>{if(e.key==='Escape'){setPanel(null);setReview(false);setPhoto(null);setCamera(null);setMenu(false);}};
  const warn=(e:BeforeUnloadEvent)=>{if(save!=='saved')e.preventDefault();};
  window.addEventListener('keydown',close);window.addEventListener('beforeunload',warn);
  return()=>{window.removeEventListener('keydown',close);window.removeEventListener('beforeunload',warn);};
 },[save]);
 useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(''),4500);return()=>clearTimeout(timer);},[toast]);
 function toggleVoice(){
  if(!session.current){setVoiceError('Voice is unavailable in this browser. Open the app in a browser with speech recognition and allow microphone access.');setVoiceState('error');return;}
  if(active){session.current.stop();return;}
  if(!recordRef.current?.started)apply({type:'start'});
  setReply('');session.current.start();
 }
 if(loadError)return <div className="load-screen"><AlertCircle/><h1>Inspection could not load</h1><p>{loadError}</p><button onClick={()=>location.reload()}>Retry</button></div>;
 if(!record)return <div className="load-screen"><LoaderCircle className="spin"/></div>;
 const vehicle=vehicleById(record.vehicleId);
 const complete=completeness(record),issues=record.findings.filter(f=>!f.resolved).length;
 const rows=CHECKS.filter(c=>(section==='All'||c.section===section)&&(filter==='all'||filter==='unchecked'&&statusOf(record,c.id)==='not-inspected'||filter==='issues'&&statusOf(record,c.id)==='to-be-rectified'||filter==='observed'&&statusOf(record,c.id)!=='not-inspected'));
 const label=voiceState==='listening'?'Listening':voiceState==='speaking'?'Companion speaking':voiceState==='thinking'?'Updating':voiceState==='connecting'?'Connecting':voiceState==='error'?'Tap to retry':reply?'Tap to continue':'Tap to inspect';
 if(page==='vehicles')return <div className="vehicle-landing"><BrandHeader/><main><h2>Select a vehicle</h2><div className="vehicle-grid">{VEHICLES.map(v=><button key={v.id} className="vehicle-choice" disabled={switching} onClick={()=>void selectVehicle(v.id)} aria-label={`Select ${v.year} ${v.name} ${v.variant}`}><CarScene record={freshRecord(v.id)} selected="" onSelect={()=>{}} view="Exterior" exploded={false} expansion={0} isolated={false} reset={0} preview minimal/><span className="vehicle-choice-info"><span><small>{v.year} · {v.variant}</small><strong>{v.name}</strong></span><span className="vehicle-choice-action">{record.vehicleId===v.id&&record.started?'Resume':'Inspect'}<ArrowRight size={18}/></span></span></button>)}</div></main></div>;
 return <div className="simple-app">
  <header className="simple-header"><button className="icon-button vehicle-back" aria-label="Choose vehicle" onClick={()=>{session.current?.stop();setPage('vehicles');}}><ArrowLeft size={19}/></button><div className="simple-vehicle-title"><span className="simple-brand">JARVICI</span><h1>{vehicle.inspectionName} <small>{vehicle.year}</small></h1></div><div className="simple-header-actions">
   <span className={'simple-save '+save} title={save==='saved'?'Saved in this browser':save==='saving'?'Saving':'Save failed'} aria-label={save==='saved'?'Saved locally':save==='saving'?'Saving locally':'Save failed'} role="status">{save==='saving'?<LoaderCircle size={15} className="spin"/>:save==='saved'?<Check size={15}/>:<AlertCircle size={15}/>}</span>
   <button className="report-open" aria-label={'Report '+complete.done+'/'+complete.total} onClick={()=>setPanel('report')}><ClipboardList size={17}/><span>Report</span><b>{complete.done}/{complete.total}</b></button>
   <div className="simple-menu"><button className="icon-button" aria-label="More options" onClick={()=>setMenu(!menu)}><MoreHorizontal size={22}/></button>{menu&&<div className="menu-popover"><button onClick={()=>{setMenu(false);setPanel('history');}}><History size={16}/>History</button><button onClick={()=>{setMenu(false);setPanel('about');}}><Info size={16}/>About</button></div>}</div>
  </div></header>
  {save==='failed'&&<div className="simple-error" role="alert">Not saved. <button onClick={()=>commit({...record})}>Retry</button><button onClick={()=>setReview(true)}>Export backup</button></div>}
  <main className="simple-workspace">
   <div className="simple-toolbar"><div className="segmented" role="tablist" aria-label="Vehicle view">{(['Exterior','Interior'] as const).map(tab=><button key={tab} id={`view-${tab.toLowerCase()}`} role="tab" aria-selected={view===tab} aria-controls="vehicle-view" className={view===tab?'active':''} onClick={()=>{setView(tab);setSelected('');setIsolated(false);setReset(n=>n+1);}}>{tab}</button>)}</div></div>
   <div className="explode-control"><label htmlFor="explode-slider">Assembled <span>{Math.round(expansion*100)}%</span> Parts</label><input id="explode-slider" aria-label="Explode vehicle" type="range" min="0" max="100" step="1" value={Math.round(expansion*100)} onChange={e=>{setExpansion(Number(e.target.value)/100);setIsolated(false);}}/><small>{expansion>=.94?'Drag to pan · Pinch to zoom':'Drag to rotate'}</small></div>
   <section id="vehicle-view" role="tabpanel" aria-labelledby={`view-${view.toLowerCase()}`} className={'simple-stage '+(expansion>=.94?'is-packed':'')}><CarScene key={record.vehicleId} record={record} selected={selected} onSelect={choosePart} view={view} exploded={expansion===1} expansion={expansion} isolated={isolated} reset={reset} minimal/><button className="stage-reset icon-button" aria-label="Reset vehicle view" onClick={()=>{setExpansion(0);setIsolated(false);setReset(v=>v+1);}}><RotateCcw size={16}/></button>{selected&&<button className="stage-isolate icon-button" aria-label={isolated?'Show all parts':'Isolate selected part'} onClick={()=>setIsolated(!isolated)}><Focus size={17}/></button>}</section>
   <div className="simple-progress"><div className="progress"><i style={{width:complete.percent+'%'}}/></div><button onClick={()=>setPanel('report')}>{complete.done} checked <span>·</span> {issues} {issues===1?'issue':'issues'}</button></div>
  </main>
  <section className={'voice-control '+voiceState} aria-label="Voice companion">
   <div className="voice-feedback" aria-live="polite">{interim?<p className="interim">“{interim}”</p>:reply?<p>{reply}</p>:<p className="voice-example">“Left front door is okay.”</p>}</div>
   <div className="voice-control-row"><button className="voice-utility" aria-label="Add photo" disabled={!selected} title={selected?'Add photo':'Describe a part first'} onClick={()=>openCamera()}><Camera size={22}/></button>
    <button className={'voice-avatar '+voiceState} aria-label={active?'Pause microphone':'Start microphone'} aria-pressed={active} onClick={toggleVoice}><span className="avatar-rings"/><span className="avatar-face">{active?(voiceState==='listening'?<span className="sound-bars">{[0,1,2,3,4].map(n=><i key={n} style={{animationDelay:(n*.1)+'s'}}/>)}</span>:voiceState==='connecting'||voiceState==='thinking'?<LoaderCircle className="spin" size={30}/>:<span className="avatar-eyes"><i/><i/></span>):<Mic size={31}/>}</span>{active&&<span className="pause-mark"><Square size={9} fill="currentColor"/></span>}</button>
    <button className="voice-utility" aria-label="Undo last change" disabled={!record.undo.length} onClick={()=>{apply({type:'undo'});setReply('Last change undone.');}}><RotateCcw size={22}/></button></div>
   <b className="voice-state-label">{label}</b>{voiceError&&<p className="simple-voice-error" role="alert">{voiceError}{voiceError==='Sign in to use voice inspection.'&&<> <a href="/signin-with-chatgpt?return_to=%2F" target="_top">Sign in with ChatGPT</a></>}</p>}<small className="voice-engine">GPT-Live-1 · automatic annotation</small>
  </section>
  {panel&&<div className="simple-backdrop" onClick={()=>setPanel(null)}><section className={'simple-sheet '+(panel==='detail'?'details-sheet':'')} role="dialog" aria-modal="true" aria-label={panel==='report'?'Inspection report':panel==='detail'?'Component details':panel==='history'?'Edit history':'About voice inspection'} onClick={e=>e.stopPropagation()}>
   <header className="sheet-header"><h2>{panel==='report'?'Report':panel==='detail'?'Component':panel==='history'?'History':'About'}</h2><button className="icon-button" onClick={()=>setPanel(null)} aria-label="Close panel"><X size={21}/></button></header>
   {panel==='report'&&<><div className="sheet-summary"><strong>{complete.done}<small> / {complete.total}</small></strong><span>checks</span><b>{issues} {issues===1?'issue':'issues'}</b></div><div className="simple-filters">{[['observed','Checked'],['issues','Issues'],['unchecked','Unchecked'],['all','All']].map(([id,name])=><button key={id} className={filter===id?'active':''} onClick={()=>setFilter(id)}>{name}</button>)}</div><select className="section-select" aria-label="Report section" value={section} onChange={e=>setSection(e.target.value as Section|'All')}><option>All</option>{SECTIONS.map(s=><option key={s}>{s}</option>)}</select><div className="simple-report-rows">{rows.length===0&&<p className="simple-empty">{filter==='issues'?'No issues recorded.':'No checks yet. Start talking.'}</p>}{rows.map(c=>{const status=statusOf(record,c.id),fs=record.findings.filter(f=>f.checkId===c.id);return <button key={c.id} data-check-id={c.id} onClick={()=>focusCheck(c.id,true)}><span className={'status-dot '+status}>{status==='not-inspected'?'?':status==='to-be-rectified'?'!':status==='not-applicable'?'−':'✓'}</span><span><b>{c.name}</b><small>{fs.length?fs.map(f=>f.type+' · '+f.severity).join(', '):STATUS[status]}</small></span>{record.photos.some(p=>p.checkId===c.id)&&<Camera size={16}/>}</button>;})}</div><footer className="sheet-footer"><button className="primary" onClick={()=>{setPanel(null);setReview(true);}}>Review & export</button></footer></>}
   {panel==='detail'&&<DetailPanel record={record} partId={selected||'left-front-door'} checkId={checkId} onCheck={id=>focusCheck(id)} onMutate={apply} onCamera={openCamera} onPhoto={setPhoto} tab={detailTab} setTab={setDetailTab}/>}
   {panel==='history'&&<div className="simple-history">{record.history.length?record.history.slice().reverse().map(e=><div key={e.id}><p>{e.message}</p><small>{new Date(e.at).toLocaleTimeString()}</small></div>):<p>No changes yet.</p>}</div>}
   {panel==='about'&&<div className="simple-about"><p><strong>JARVICI</strong><br/>Just A Rather Very Intelligent Car Inspector</p><p>Inspired by Tony Stark’s JARVIS.</p><p>Tap the microphone. Name the part and what you see. The companion records it and updates the car.</p>
    <details><summary>Voice commands</summary><p>“Left front door is okay.”<br/>“Right rear door has a scratch.”<br/>“Minor.”<br/>“Actually, that was the left rear door.”<br/>“What is left?”<br/>“Open camera.”<br/>“Capture.” · “Save photo.”<br/>“Undo.” · “Review the report.”</p></details>
    <details><summary>What gets checked?</summary><p>A named door means its exterior panel. Window controls and trim are separate checks. The companion asks verbally when a part or result is unclear. Left and right are vehicle-relative.</p></details>
    <details><summary>Voice & storage</summary><p>GPT-Live-1 powers voice, with a delegated backend handling inspection tool calls. Audio and inspection context are sent to OpenAI while connected. The API key stays on the local server. Notes and photos save in this browser; use one tab per inspection.</p><p>Keep the app open while inspecting. Microphone permission and an internet connection are required.</p></details>
    <details><summary>Model & checklist</summary><p>{vehicle.year} {vehicle.name} {vehicle.variant}. Detailed Blender reference geometry is approximate. Shared inspection template: 165 CARSOME source rows plus 7 overview/guidance checks; all begin unchecked. BMW listing outcomes are not imported. Grading is illustrative.</p><a href={vehicle.sourceUrl} target="_blank" rel="noreferrer">Source report</a></details>
   </div>}
  </section></div>}
  {review&&<Review record={record} onClose={()=>setReview(false)} onSelect={id=>focusCheck(id,true)} onMutate={apply} saved={save==='saved'}/>}
  {camera&&<CameraModal record={record} checkId={camera.checkId} initialFindingId={camera.findingId} captureSignal={0} voiceAction={cameraAction} autoOpen onClose={()=>setCamera(null)} onSave={p=>{apply({type:'photo',photo:p});setReply('Photo attached.');}}/>}
  {photo&&record.photos.some(p=>p.id===photo.id)&&<EvidenceViewer photo={record.photos.find(p=>p.id===photo.id)!} record={record} onClose={()=>setPhoto(null)} onMutate={apply}/>}
  {toast&&<div className="toast" role="status">{toast}<button className="icon-button" aria-label="Dismiss notification" onClick={()=>setToast('')}><X size={16}/></button></div>}
 </div>;
}
