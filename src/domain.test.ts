import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHECKS, PARTS } from './checklist';
import { freshRecord, mutate, statusOf, partStatus, parseCommand, completeness, exportHtml, grade } from './domain';
import type { Photo } from './domain';
const initial=()=>freshRecord();
test('source inventory is 165 rows plus 3 overview and 4 guidance checks, all map to components',()=>{
 assert.equal(CHECKS.filter(c=>c.source==='report-row').length,165);assert.equal(CHECKS.length,172);assert.equal(new Set(CHECKS.map(c=>c.id)).size,172);assert.ok(CHECKS.every(c=>PARTS.some(p=>p.id===c.partId)));
 const r=initial();assert.equal(completeness(r).done,0);assert.equal(grade(r).letter,'—');assert.ok(CHECKS.every(c=>statusOf(r,c.id)==='not-inspected'));
});
test('left back door alias passes its exterior panel without a part selection',()=>{
 const r=initial();const intent=parseCommand('The left back door is fine.',r,'');assert.equal(intent.action,'status');if(intent.action!=='status')return;assert.equal(intent.checkId,'left-rear-door');
 const confirmed=parseCommand('The left back door is fine.',r,'left-rear-door','left-rear-door');assert.equal(confirmed.action,'status');if(confirmed.action!=='status')return;
 const saved=mutate(r,{type:'status',checkId:confirmed.checkId,status:confirmed.status});assert.equal(statusOf(saved,'left-rear-door'),'pass');assert.equal(statusOf(saved,'rear-left-power-window-controls'),'not-inspected');assert.equal(partStatus(saved,'left-rear-door'),'partial');assert.equal(completeness(saved).done,1);
});
test('negated or uncertain passing statements do not fabricate observations',()=>{
 for(const sentence of ['The left rear door is not fine','The left rear door might be fine','I think the left front door is good','The left front door has no scratch'])assert.equal(parseCommand(sentence,initial(),'left-front-door').action,'unknown');
});
test('clarifying a leak cannot accidentally turn it into a pass',()=>{
 const r=initial(),intent=parseCommand('The engine has a minor leak',r,'engine');assert.equal(intent.action,'clarify');const confirmed=parseCommand('The engine has a minor leak',r,'engine','engine-oil');assert.equal(confirmed.action,'finding');if(confirmed.action==='finding'){assert.equal(confirmed.defect,'Leak');assert.equal(confirmed.checkId,'engine-oil');}
});
test('defect correction moves only intended finding and evidence; undo restores them exactly',()=>{
 let r=mutate(initial(),{type:'finding',checkId:'left-front-door',defect:'Dent',severity:'minor',notes:'An earlier dent'});
 r=mutate(r,{type:'finding',checkId:'left-front-door',defect:'Scratch',severity:'moderate',notes:'A scratch under the handle'});const id=r.findings.at(-1)!.id;
 const p:Photo={id:'evidence-one',checkId:'left-front-door',findingId:id,data:'data:image/png;base64,aGVsbG8=',name:'Test evidence',createdAt:new Date().toISOString()};r=mutate(r,{type:'photo',photo:p});
 const intent=parseCommand('Actually, that was the right front door.',r,'left-front-door');assert.equal(intent.action,'move');if(intent.action!=='move')return;
 r=mutate(r,{type:'move',id:intent.id,checkId:intent.checkId});assert.equal(r.findings.length,2);assert.equal(r.findings[0].checkId,'left-front-door');assert.equal(r.findings[1].checkId,'right-front-door');assert.equal(r.photos[0].checkId,'right-front-door');assert.equal(r.photos[0].findingId,id);
 const corrected=r;r=mutate(r,{type:'undo'});assert.equal(r.photos[0].checkId,'left-front-door');assert.equal(r.findings[1].checkId,'left-front-door');assert.equal(r.history.length,corrected.history.length+1);
});
test('moving the sole finding restores the source check to its previous state',()=>{
 let r=mutate(initial(),{type:'finding',checkId:'left-front-door',defect:'Scratch',severity:'minor',notes:'Scratch'});r=mutate(r,{type:'move',id:r.findings[0].id,checkId:'right-front-door'});assert.equal(statusOf(r,'left-front-door'),'not-inspected');assert.equal(statusOf(r,'right-front-door'),'to-be-rectified');
});
test('multiple findings remain flagged until all are rectified; pass cannot conceal open defects',()=>{
 let r=mutate(initial(),{type:'finding',checkId:'left-front-door',defect:'Scratch',severity:'minor',notes:'One'});r=mutate(r,{type:'finding',checkId:'left-front-door',defect:'Dent',severity:'moderate',notes:'Two'});
 assert.throws(()=>mutate(r,{type:'status',checkId:'left-front-door',status:'pass'}));r=mutate(r,{type:'edit-finding',id:r.findings[0].id,patch:{resolved:true}});assert.equal(statusOf(r,'left-front-door'),'to-be-rectified');r=mutate(r,{type:'status',checkId:'left-front-door',status:'rectified'});assert.equal(statusOf(r,'left-front-door'),'rectified');assert.equal(r.findings.length,2);
});
test('unknown severity withholds grade; serious and critical findings cap grade even with small deductions',()=>{
 let r=mutate(initial(),{type:'finding',checkId:'left-front-door',defect:'Scratch',severity:'unassessed',notes:'Assess me'});assert.equal(grade(r).letter,'—');r=mutate(r,{type:'edit-finding',id:r.findings[0].id,patch:{severity:'serious'}});r=mutate(r,{type:'rules',rules:{minor:1,moderate:1,serious:1,critical:1}});assert.equal(grade(r).letter,'C');r=mutate(r,{type:'edit-finding',id:r.findings[0].id,patch:{severity:'critical'}});assert.equal(grade(r).letter,'D');assert.equal(grade(r).serious.length,1);
});
test('photos cannot link to a finding on a different check',()=>{
 let r=mutate(initial(),{type:'finding',checkId:'left-front-door',defect:'Scratch',severity:'minor',notes:'Test'});assert.throws(()=>mutate(r,{type:'photo',photo:{id:'bad',checkId:'right-front-door',findingId:r.findings[0].id,data:'data:image/png;base64,AA==',name:'bad',createdAt:''}}));
});
test('a serious-finding grade cap never raises a lower score-derived grade',()=>{
 let r=initial();
 for(let i=0;i<3;i++)r=mutate(r,{type:'finding',checkId:'brake-operation',defect:'Functional failure',severity:'serious',notes:`Test finding ${i}`});
 assert.equal(grade(r).score,25);assert.equal(grade(r).letter,'D');
});
test('serialized record retains findings, evidence and edit history; export escapes text and includes corrected linkage',()=>{
 let r=mutate(initial(),{type:'finding',checkId:'left-front-door',defect:'Scratch',severity:'minor',notes:'<script>alert(1)</script> & observation'});const id=r.findings[0].id;r=mutate(r,{type:'photo',photo:{id:'photo-x',checkId:'left-front-door',findingId:id,data:'data:image/png;base64,aGVsbG8=',name:'Fixture',createdAt:'2026-09-13'}});r=mutate(r,{type:'move',id,checkId:'right-front-door'});
 const loaded=JSON.parse(JSON.stringify(r));assert.equal(JSON.stringify(loaded),JSON.stringify(r));const html=exportHtml(loaded);assert.ok(html.includes('data:image/png;base64,aGVsbG8='));assert.ok(html.includes('photo-x'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('1/172'));assert.ok(html.includes('DRAFT'));assert.ok(html.includes('Right Front Door'));assert.ok(html.includes(id));
});
test('finalization requires complete checks and becomes draft again on changes',()=>{
 let r=initial();assert.throws(()=>mutate(r,{type:'finalize'}));for(const c of CHECKS)r=mutate(r,{type:'status',checkId:c.id,status:'not-applicable',notes:'Test-only applicability fixture'});r=mutate(r,{type:'finalize'});assert.ok(r.finalizedAt);r=mutate(r,{type:'status',checkId:'left-front-door',status:'pass'});assert.equal(r.finalizedAt,undefined);
});
test('correction rewrites the report location while preserving original observation',()=>{
 let r=mutate(initial(),{type:'finding',checkId:'left-front-door',defect:'Scratch',severity:'minor',notes:'The left front door has a minor scratch.'});r=mutate(r,{type:'move',id:r.findings[0].id,checkId:'right-front-door'});assert.match(r.findings[0].notes,/right front door/i);assert.doesNotMatch(r.findings[0].notes,/left front door/i);assert.match(r.findings[0].originalObservation!,/left front door/);
});
test('a flagged status without finding detail withholds grading and blocks finalization',()=>{
 let r=initial();for(const c of CHECKS)r=mutate(r,{type:'status',checkId:c.id,status:'pass'});r=mutate(r,{type:'status',checkId:'left-front-door',status:'to-be-rectified'});assert.equal(grade(r).letter,'—');assert.throws(()=>mutate(r,{type:'finalize'}));
});
test('grading rule edits participate in undo',()=>{
 let r=initial();r=mutate(r,{type:'rules',rules:{minor:7,moderate:9,serious:12,critical:20}});r=mutate(r,{type:'undo'});assert.equal(r.rules.minor,2);
});
