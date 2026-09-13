import { test } from 'node:test';
import assert from 'node:assert/strict';
import { converse } from './conversation';
import { freshRecord, statusOf, partStatus, mutate } from './domain';
const fresh=()=>({record:freshRecord(),context:{partId:''}});
test('walking around: multiple named doors annotate automatically without selection',()=>{
 const {record,context}=fresh();
 const result=converse('Left front door is okay, the right rear door is okay. The left back door is fine.',record,context);
 assert.equal(result.changedChecks.length,3);
 for(const id of ['left-front-door','right-rear-door','left-rear-door'])assert.equal(statusOf(result.record,id),'pass');
 assert.equal(statusOf(result.record,'front-left-power-window-controls'),'not-inspected');
 assert.equal(partStatus(result.record,'left-front-door'),'partial');
 assert.equal(result.context.pending,undefined);
});
test('unpunctuated speech keeps observations and correction intact',()=>{
 const {record,context}=fresh();
 const result=converse('left front door is okay right rear door has a scratch',record,context);
 assert.equal(statusOf(result.record,'left-front-door'),'pass');
 assert.equal(result.record.findings.length,1);
 const corrected=converse('Actually that was the left rear door',result.record,result.context);
 assert.equal(corrected.record.findings[0].checkId,'left-rear-door');
});
test('spoken severity and correction retain linked evidence and support undo',()=>{
 const {record,context}=fresh();
 let result=converse('Right rear door has a scratch',record,context);
 result=converse('Minor',result.record,result.context);
 const id=result.record.findings[0].id;
 const withPhoto=mutate(result.record,{type:'photo',photo:{id:'test-photo',checkId:'right-rear-door',findingId:id,data:'data:image/png;base64,AA==',name:'Synthetic',createdAt:''}});
 result=converse('Actually that was the left front door',withPhoto,result.context);
 assert.equal(result.record.photos[0].checkId,'left-front-door');assert.equal(result.record.findings[0].severity,'minor');
 result=converse('Undo',result.record,result.context);assert.equal(result.record.photos[0].checkId,'right-rear-door');
});
test('unclear side is resolved by voice alone',()=>{
 const {record,context}=fresh();
 let result=converse('The rear back door is okay',record,context);
 assert.equal(result.record,record);assert.equal(result.context.pending?.kind,'door');
 result=converse('Right',result.record,result.context);
 assert.equal(statusOf(result.record,'right-rear-door'),'pass');assert.equal(result.context.pending,undefined);
});
test('check clarification accepts spoken answer and preserves defect intent',()=>{
 const {record,context}=fresh();
 let result=converse('The engine has a minor leak',record,context);
 assert.equal(result.context.pending?.kind,'check');
 result=converse('Engine oil',result.record,result.context);
 assert.equal(result.record.findings[0].checkId,'engine-oil');assert.equal(result.record.findings[0].type,'Leak');
});
test('explicit window and trim checks do not mark the exterior panel',()=>{
 const {record,context}=fresh();
 const result=converse('The front right window is okay. Right rear door trim is fine.',record,context);
 assert.equal(statusOf(result.record,'front-right-power-window-controls'),'pass');
 assert.equal(statusOf(result.record,'rear-right-door-trim-door-panels'),'pass');
 assert.equal(statusOf(result.record,'right-front-door'),'not-inspected');
});
test('uncertain speech never makes a positive observation',()=>{
 const {record,context}=fresh();
 for(const words of ['Left front door is not okay','Maybe right rear door is fine','It is okay']){
  assert.equal(converse(words,record,context).record,record);
 }
});
