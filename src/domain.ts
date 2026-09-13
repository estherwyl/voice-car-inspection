import { vehicleById } from './vehicles';
import { CHECKS, PARTS, VEHICLE, checkById, partById, type Check } from './checklist';
export type Status='not-inspected'|'pass'|'rectified'|'to-be-rectified'|'not-applicable';
export const STATUS:Record<Status,string>={'not-inspected':'Not inspected',pass:'Pass',rectified:'Rectified','to-be-rectified':'To Be Rectified','not-applicable':'Not Applicable'};
export type Severity='unassessed'|'minor'|'moderate'|'serious'|'critical';
export type Finding={id:string;checkId:string;type:string;severity:Severity;notes:string;originalObservation?:string;location:string;resolved:boolean;createdAt:string};
export type Photo={id:string;checkId:string;findingId?:string;data:string;name:string;createdAt:string};
export type CheckState={status:Status;notes:string};
export type Snapshot={checks:Record<string,CheckState>;findings:Finding[];photos:Photo[];started:boolean;finalizedAt?:string;rules:Record<Exclude<Severity,'unassessed'>,number>};
export type RecordData=Snapshot&{schemaVersion:1;id:string;vehicleId:string;createdAt:string;updatedAt:string;history:{id:string;at:string;message:string}[];undo:Snapshot[];rules:Record<Exclude<Severity,'unassessed'>,number>};
export const uid=()=>crypto.randomUUID();
export const now=()=>new Date().toISOString();
export function freshRecord(vehicleId=VEHICLE.id):RecordData{vehicleById(vehicleId);return {schemaVersion:1,id:uid(),vehicleId,createdAt:now(),updatedAt:now(),started:false,checks:Object.fromEntries(CHECKS.map(c=>[c.id,{status:'not-inspected',notes:''}])),findings:[],photos:[],history:[],undo:[],rules:{minor:2,moderate:8,serious:25,critical:50}};}
function snapshot(r:RecordData):Snapshot {return {checks:r.checks,findings:r.findings,photos:r.photos,started:r.started,finalizedAt:r.finalizedAt,rules:r.rules};}
export type Mutation={type:'start'}|{type:'status';checkId:string;status:Status;notes?:string}|{type:'finding';checkId:string;defect:string;severity:Severity;notes:string;location?:string}|{type:'edit-finding';id:string;patch:Partial<Pick<Finding,'type'|'severity'|'notes'|'location'|'resolved'>>}|{type:'move';id:string;checkId:string}|{type:'photo';photo:Photo}|{type:'remove-photo';id:string}|{type:'reassign-photo';id:string;checkId:string;findingId?:string}|{type:'undo'}|{type:'finalize'}|{type:'rules';rules:RecordData['rules']};
export function mutate(r:RecordData,a:Mutation):RecordData {
 if(a.type==='undo'){const before=r.undo.at(-1);if(!before)return r;return {...r,...before,undo:r.undo.slice(0,-1),updatedAt:now(),history:[...r.history,{id:uid(),at:now(),message:'Undid the last change'}]};}
 let next:RecordData={...r,checks:{...r.checks},findings:[...r.findings],photos:[...r.photos],finalizedAt:undefined,updatedAt:now()};let message='';
 const check=('checkId'in a)?checkById(a.checkId):undefined;
 if('checkId'in a&&!check)throw Error('Unknown inspection check.');
 switch(a.type){
 case 'start':next.started=true;message='Inspection started';break;
 case 'status':{
  if(a.status==='pass'&&r.findings.some(f=>f.checkId===a.checkId&&!f.resolved))throw Error('Resolve the existing findings with Rectified before marking this check as passed.');
  if(a.status==='not-applicable'&&r.findings.some(f=>f.checkId===a.checkId))throw Error('This check has recorded findings; review them before changing applicability.');
  if(a.status==='not-inspected'&&r.findings.some(f=>f.checkId===a.checkId))throw Error('This check has findings. Use undo or correct the finding instead.');
  next.checks[a.checkId]={status:a.status,notes:a.notes??r.checks[a.checkId].notes};
  if(a.status==='rectified')next.findings=next.findings.map(f=>f.checkId===a.checkId?{...f,resolved:true}:f);
  message=`${check!.name}: ${STATUS[a.status]}`;break;}
 case 'finding':next.findings.push({id:uid(),checkId:a.checkId,type:a.defect,severity:a.severity,notes:a.notes,originalObservation:a.notes,location:a.location||check!.name,resolved:false,createdAt:now()});message=`Recorded ${a.defect} on ${check!.name}`;break;
 case 'edit-finding':next.findings=next.findings.map(f=>f.id===a.id?{...f,...a.patch}:f);message='Updated finding details';break;
 case 'move':{const f=r.findings.find(f=>f.id===a.id);if(!f)throw Error('Finding no longer exists.');
  const oldName=checkById(f.checkId).name;
  const oldAlias=partById(checkById(f.checkId).partId).name.replace('rear','back');
  const literalPattern=(s:string)=>new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi');
  const correctedNotes=f.notes.replace(literalPattern(oldName),()=>check!.name).replace(literalPattern(oldAlias),()=>partById(check!.partId).name);
  next.findings=next.findings.map(f=>f.id===a.id?{...f,checkId:a.checkId,location:check!.name,notes:correctedNotes,originalObservation:f.originalObservation??f.notes}:f);
  next.photos=next.photos.map(p=>p.findingId===a.id?{...p,checkId:a.checkId}:p);message=`Moved ${f.type} from ${checkById(f.checkId).name} to ${check!.name}, including linked photos`;break;}
 case 'photo':if(a.photo.findingId&&!r.findings.some(f=>f.id===a.photo.findingId&&f.checkId===a.photo.checkId))throw Error('Select a valid finding for this photo.');next.photos.push(a.photo);message=`Attached photo to ${checkById(a.photo.checkId).name}`;break;
 case 'remove-photo':next.photos=next.photos.filter(p=>p.id!==a.id);message='Removed photo (undo available)';break;
 case 'reassign-photo':if(a.findingId&&!r.findings.some(f=>f.id===a.findingId&&f.checkId===a.checkId))throw Error('Photo destination and finding must match.');next.photos=next.photos.map(p=>p.id===a.id?{...p,checkId:a.checkId,findingId:a.findingId}:p);message=`Reassigned photo to ${check!.name}`;break;
 case 'rules':next.rules=a.rules;message='Updated illustrative grading deductions';break;
 case 'finalize':if(completeness(r).remaining||r.findings.some(f=>f.severity==='unassessed')||CHECKS.some(c=>statusOf(r,c.id)==='to-be-rectified'&&!r.findings.some(f=>f.checkId===c.id)))throw Error('Complete outstanding checks and assess all finding severities before finalizing.');next.finalizedAt=now();message='Inspector reviewed and finalized inspection';break;
 }
 return {...next,history:[...r.history,{id:uid(),at:now(),message}],undo:[...r.undo,snapshot(r)].slice(-20)};
}
export function statusOf(r:RecordData,id:string):Status{const f=r.findings.filter(f=>f.checkId===id);if(f.some(f=>!f.resolved))return 'to-be-rectified';if(f.length&&f.every(f=>f.resolved))return 'rectified';return r.checks[id]?.status??'not-inspected';}
export function partStatus(r:RecordData,id:string):'flagged'|'partial'|'pass'|'not-inspected'|'not-applicable'{const statuses=CHECKS.filter(c=>c.partId===id).map(c=>statusOf(r,c.id));if(statuses.includes('to-be-rectified'))return 'flagged';if(statuses.every(s=>s==='not-inspected'))return 'not-inspected';if(statuses.every(s=>s==='not-applicable'))return 'not-applicable';if(statuses.some(s=>s==='not-inspected'))return 'partial';return 'pass';}
export function completeness(r:RecordData,checks=CHECKS){const total=checks.length,remaining=checks.filter(c=>statusOf(r,c.id)==='not-inspected').length;return {total,remaining,done:total-remaining,percent:Math.round((total-remaining)/total*100),na:checks.filter(c=>statusOf(r,c.id)==='not-applicable').length};}
export function grade(r:RecordData){
 const active=r.findings.filter(f=>!f.resolved);
 const pending=active.some(f=>f.severity==='unassessed')||CHECKS.some(c=>statusOf(r,c.id)==='to-be-rectified'&&!r.findings.some(f=>f.checkId===c.id));
 const score=Math.max(0,100-active.reduce((s,f)=>s+(f.severity==='unassessed'?0:r.rules[f.severity]),0));
 const serious=r.findings.filter(f=>f.severity==='critical'||f.severity==='serious');
 let letter=score>=95?'A':score>=80?'B':score>=60?'C':'D';
 if(active.some(f=>f.severity==='serious')&&['A','B'].includes(letter))letter='C';
 if(active.some(f=>f.severity==='critical'))letter='D';
 if(pending||completeness(r).done===completeness(r).na)letter='—';
 return {score,letter,serious,pending,contributions:active,provisional:!r.finalizedAt};
}
export const findingTypes=(c:Check)=>c.kind==='cosmetic'?['Scratch','Dent','Crack','Wear','Stain','Other']:c.kind==='structural'?['Repair signs','Corrosion','Flood signs','Structural damage','Other']:c.kind==='mechanical'?['Leak','Noise','Vibration','Functional failure','Wear','Other']:['Functional failure','Noise','Damage','Other'];
export type Intent={action:'start'|'camera'|'capture'|'undo'|'review'|'outstanding'|'exterior'|'interior'|'exploded'|'assembled'}|{action:'select';partId:string}|{action:'clarify';partId:string;checks:Check[];text:string}|{action:'status';checkId:string;status:Status;notes:string}|{action:'finding';checkId:string;defect:string;severity:Severity;notes:string}|{action:'move';id:string;checkId:string}|{action:'severity';id:string;severity:Severity}|{action:'unknown';text:string};
export function parseCommand(text:string,r:RecordData,selected:string,confirmedCheckId?:string):Intent {
 const t=text.toLowerCase().replace(/[’']/g,'').replace(/\bback door\b/g,'rear door').replace(/\bhood\b/g,'bonnet');
 if(/^(undo|undo that|undo last change)[.!]?$/.test(t))return {action:'undo'};
 if(/(start|begin).*(inspection)|going to do the inspection/.test(t))return {action:'start'};
 if(/(open|start).*(camera)|take (a )?photo/.test(t))return {action:'camera'};
 if(/^(capture|capture photo|take it|snap)[.!]?$/.test(t))return {action:'capture'};
 if(/(outstanding|unchecked|what.*left|remaining checks)/.test(t))return {action:'outstanding'};
 if(/(review|export|grade|finalize).*report|review inspection|show grade|^(finish|complete|end)( the)? inspection/.test(t))return {action:'review'};
 if(/explod|2d|flat layout|^(show |open |switch to )?(the )?parts( view)?[.!]?$/.test(t))return {action:'exploded'};
 if(/assembl|3d/.test(t))return {action:'assembled'};
 if(/^(show |switch to |open )?(the )?interior( view)?[.!]?$/.test(t))return {action:'interior'};
 if(/^(show |switch to |open )?(the )?exterior( view)?[.!]?$/.test(t))return {action:'exterior'};
 const last=r.findings.at(-1),severity=(['critical','serious','moderate','minor'] as const).find(s=>new RegExp(`\\b${s}\\b`).test(t))??'unassessed';
 if(last&&severity!=='unassessed'&&/^(it is |its |that is |severity is |severity )?(a )?(minor|moderate|serious|critical)( severity)?[.!]?$/.test(t))return {action:'severity',id:last.id,severity};
 let part=PARTS.filter(p=>t.includes(p.name.toLowerCase().split(' ·')[0])||t.includes(p.id.replaceAll('-',' '))).sort((a,b)=>b.name.length-a.name.length)[0];
 const side=/\bleft\b/.test(t)?'left':/\bright\b/.test(t)?'right':null;
 if(side&&/door|window/.test(t)&&/front|rear/.test(t))part=partById(`${side}-${/rear/.test(t)?'rear':'front'}-door`);
 if(/driver seat/.test(t))part=partById('driver-seat');
 if(/passenger seat/.test(t))part=partById('passenger-seat');
 if(/rear seat/.test(t))part=partById('rear-seat');
 if(/^(actually|correction|correct that|move (that|the|last) finding)/.test(t)){
  if(!last||!part)return {action:'unknown',text:'Name the destination part for the most recent finding.'};
  const old=checkById(last.checkId);const dest=CHECKS.find(c=>c.partId===part.id&&c.group===old.group&&c.kind===old.kind);
  if(!dest)return {action:'unknown',text:'That destination uses different checks. Reassign the finding in its detail panel.'};
  return {action:'move',id:last.id,checkId:dest.id};
 }
 const exact=CHECKS.filter(c=>t.includes(c.name.toLowerCase())).sort((a,b)=>b.name.length-a.name.length)[0];
 const target=confirmedCheckId?checkById(confirmedCheckId).partId:part?.id??(exact?.partId||selected),candidates=CHECKS.filter(c=>c.partId===target);
 if(/^(show|select|open|inspect|go to) /.test(t)&&part&&!/scratch|dent|pass|fine/.test(t))return {action:'select',partId:part.id};
 if((t.match(/\bleft\b/g)&&t.match(/\bright\b/g))||/\band (the )?(left|right)\b/.test(t))return {action:'unknown',text:'Please give one observation at a time so I can link each finding correctly.'};
 const defect=/scratch/.test(t)?'Scratch':/dent/.test(t)?'Dent':/leak/.test(t)?'Leak':/noise|rattle|squeak/.test(t)?'Noise':/crack/.test(t)?'Crack':/stain/.test(t)?'Stain':/worn|wear|tear/.test(t)?'Wear':/doesnt work|not working|fail/.test(t)?'Functional failure':undefined;
 const isPass=/\b(pass|passed|fine|good|okay|ok)\b/.test(t),na=/not applicable|\bn\/?a\b/.test(t),rectified=/rectified|repaired/.test(t);
 // Never invert a negated or uncertain observation into a pass or defect.
 if(/\b(no|not|without|dont|isnt|maybe|might|possibly|think|unsure)\b/.test(t)&&!na&&!/not working/.test(t))return {action:'unknown',text:'Please confirm the exact check and result, for example “left rear door exterior passed”.'};
 if(!defect&&!isPass&&!na&&!rectified)return {action:'unknown',text:'Tell me the part and what you observed.'};
 if(!target)return {action:'unknown',text:'Which part are you checking?'};
 let check=confirmedCheckId?checkById(confirmedCheckId):exact?.partId===target?exact:undefined;
 if(/window/.test(t))check=candidates.find(c=>c.name.includes('Power Window'))??check;
 else if(/trim/.test(t))check=candidates.find(c=>c.name.includes('Trim'))??check;
 else if(/exterior|paint|body|scratch|dent/.test(t))check=candidates.find(c=>c.section==='Exterior'&&c.kind==='cosmetic')??check;
 // An ordinary named-door observation refers to its exterior panel. Other mapped checks stay unchecked.
 if(!confirmedCheckId&&part?.kind==='door'&&!/window|trim/.test(t))check=candidates.find(c=>c.id===part.id)??check;
 if(!check&&candidates.length===1)check=candidates[0];
 if(!check)return {action:'clarify',partId:target,checks:candidates,text:'Which check does this observation refer to?'};
 if(defect){if(!findingTypes(check).includes(defect))return {action:'unknown',text:`${defect} is not a suitable finding type for ${check.name}. Select the intended check in the report.`};return {action:'finding',checkId:check.id,defect,severity,notes:text};}
 return {action:'status',checkId:check.id,status:na?'not-applicable':rectified?'rectified':'pass',notes:text};
}
const escape=(s:unknown)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function exportHtml(r:RecordData){const vehicle=vehicleById(r.vehicleId);const complete=completeness(r),g=grade(r);return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Inspection ${escape(r.id)}</title><style>body{font:15px/1.6 system-ui;color:#18322f;max-width:1000px;margin:40px auto;padding:24px}h1{font-size:34px}h2{border-bottom:2px solid #288473;margin-top:36px}table{border-collapse:collapse;width:100%}th,td{text-align:left;border-bottom:1px solid #ddd;padding:12px;vertical-align:top}small{color:#566}img{max-width:240px;max-height:180px;object-fit:contain}tr{break-inside:avoid}.alert{padding:16px;background:#fff2e9}@media print{body{margin:0;padding:0}a{color:inherit}}</style><h1>JARVICI</h1><p>Just A Rather Very Intelligent Car Inspector</p><h2>${vehicle.year} ${vehicle.name} ${vehicle.variant}</h2><p>${vehicle.fuel} · ${vehicle.transmission} · ${vehicle.drive} · Source vehicle ${vehicle.sourceId}</p><p>Inspection ${escape(r.id)}<br>Started ${escape(r.createdAt)} · Updated ${escape(r.updatedAt)}<br>${r.finalizedAt?'Finalized '+escape(r.finalizedAt):'DRAFT — not finalized'}</p><p>Completeness: <strong>${complete.done}/${complete.total} (${complete.percent}%)</strong>; ${complete.na} not applicable; ${complete.remaining} not inspected.</p><h2>Illustrative proposed condition grade: ${g.letter}</h2><p>${complete.done?`Score on recorded findings: ${g.score}/100.`:'No condition assessment yet.'} ${g.pending?'Missing finding details or severity: grade withheld.':''} Incomplete inspections cannot establish overall vehicle condition. This is a prototype rubric, not a certification.</p><p>Deductions per unresolved finding: ${Object.entries(r.rules).map(([k,v])=>`${k}: ${v}`).join(', ')}. Critical findings cap the grade at D; serious findings cap it at C. Resolved findings remain visible without a deduction.</p>${g.serious.length?`<div class="alert"><strong>Serious findings requiring attention</strong>${g.serious.map(f=>`<p>${escape(checkById(f.checkId).name)} — ${escape(f.severity)}: ${escape(f.notes)} (${f.resolved?'rectified':'open'})</p>`).join('')}</div>`:''}${['Exterior','Interior','Underbody','Road test','Major'].map(section=>`<h2>${section}</h2><table><thead><tr><th>Check</th><th>Status</th><th>Findings & evidence</th></tr></thead><tbody>${CHECKS.filter(c=>c.section===section).map(c=>`<tr><td>${escape(c.name)}<br><small>${escape(c.group)} · ${escape(c.source)}</small></td><td>${STATUS[statusOf(r,c.id)]}</td><td>${escape(r.checks[c.id].notes)}${r.findings.filter(f=>f.checkId===c.id).map(f=>`<p><strong>${escape(f.type)} · ${escape(f.severity)}</strong> · ${f.resolved?'Rectified':'Open'}<br>${escape(f.location)}<br>${escape(f.notes)}<br><small>Finding ${escape(f.id)}</small></p>`).join('')}${r.photos.filter(p=>p.checkId===c.id).map(p=>`<figure><img src="${/^data:image\/(jpeg|png|webp);base64,/.test(p.data)?p.data:''}" alt="${escape(p.name)}"><figcaption>${escape(p.name)} · photo ${escape(p.id)}${p.findingId?' · finding '+escape(p.findingId):' · check evidence'}</figcaption></figure>`).join('')}</td></tr>`).join('')}</tbody></table>`).join('')}<h2>Edit history</h2>${r.history.map(e=>`<p><small>${escape(e.at)}</small> ${escape(e.message)}</p>`).join('')}<h2>Source & scope</h2><p>Vehicle reference: <a href="${escape(vehicle.sourceUrl)}">${escape(vehicle.sourceId)}</a>. Shared inspection template; not a transcription of the BMW listing or its inspection outcomes.</p><p>Checklist transcribed from the CARSOME CTNF600 webpage on 13 September 2026. 165 named rows, 3 major overview checks, and 4 tyre checks derived from the report guidance. Source results were not imported. All results in this report are inspector observations. Approximate reference geometry is not condition evidence.</p><p><a href="https://www.carsome.my/buy-car/subaru/xv/2022-subaru-xv-gt-edition-eyesight-2.0/ctnf600/full-report#Exterior">Source checklist</a></p></html>`;}
