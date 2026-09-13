import { CHECKS, PARTS, checkById, partById } from './checklist';
import { mutate, parseCommand, statusOf, type RecordData, type Intent } from './domain';
export type Pending = {kind:'check';original:string;partId:string;checkIds:string[]} | {kind:'door';original:string;partIds:string[]};
export type ConversationContext={partId:string;pending?:Pending};
export type ConversationResult={record:RecordData;context:ConversationContext;reply:string;effects:Intent[];changedChecks:string[]};
export function normalizeSpeech(text:string){
 return text.trim().replace(/[’']/g,"").replace(/\bback\b/gi,'rear')
  .replace(/\brear\s+rear\b/gi,'rear')
  .replace(/\b(front|rear)\s+(left|right)\b/gi,'$2 $1')
  .replace(/\b(?:drivers|driver's)\b/gi,'driver')
  .replace(/\bhood\b/gi,'bonnet');
}
export function splitObservations(text:string):string[]{
 const t=normalizeSpeech(text);
 // Each independently named observation is handled in order, including in one final transcript.
 const clauses=t.split(/[.;!?]+\s*|,\s*(?=(?:the\s+)?(?:left|right|driver|front passenger|rear seat|actually)\b)|\s+(?:and|also|then)\s+(?=(?:the\s+)?(?:left|right|driver|front passenger|rear seat|actually)\b)/i).map(s=>s.trim()).filter(Boolean);
 return clauses.flatMap(clause=>{
  const out:string[]=[];let start=0;
  for(const match of clause.matchAll(/\s+(?=(?:the\s+)?(?:left|right)\s+(?:front|rear)\s+(?:door|window)\b)/gi)){
   const prefix=clause.slice(start,match.index);
   if(/\b(okay|ok|fine|good|passed|pass|scratch|dent|crack|leak|noise|working|rectified|repaired|applicable)\b/i.test(prefix)){out.push(prefix.trim());start=match.index!;}
  }
  out.push(clause.slice(start).trim());return out;
 });
}
export function converse(text:string,record:RecordData,context:ConversationContext):ConversationResult {
 let r=record,ctx={...context};const effects:Intent[]=[],changedChecks:string[]=[],messages:string[]=[];
 const pieces=splitObservations(text);
 for(let words of pieces){
  let confirmed:string|undefined;
  const pending=ctx.pending;
  if(pending?.kind==='check'){
   const exact=pending.checkIds.filter(id=>{const name=checkById(id).name.toLowerCase();return name===words.toLowerCase()||name.includes(words.toLowerCase().replace(/^(the |its |it is )/i,''));});
   const token=words.toLowerCase();
   const match=exact.length===1?exact[0]:pending.checkIds.find(id=>/\b(window|windows)\b/.test(token)&&/power window/i.test(checkById(id).name)||/\btrim\b/.test(token)&&/trim/i.test(checkById(id).name));
   if(match){confirmed=match;words=pending.original;ctx.pending=undefined;}
  }else if(pending?.kind==='door'&&/^(the |its |it is )?(left|right)( (front|rear)( door)?)?[.!]?$/i.test(words)){
   const matches=pending.partIds.filter(id=>(!/\bleft\b/i.test(words)||id.includes('left'))&&(!/\bright\b/i.test(words)||id.includes('right'))&&(!/\bfront\b/i.test(words)||id.includes('front'))&&(!/\brear\b/i.test(words)||id.includes('rear')));
   if(matches.length===1){words=pending.original.replace(/\b(?:(?:left|right)\s+)?(?:(?:front|rear)\s+)?door\b/i,partById(matches[0]).name);ctx.pending=undefined;}
  }
  const door=/\bdoor\b/i.test(words),side=/\b(left|right)\b/i.exec(words)?.[1]?.toLowerCase(),end=/\b(front|rear)\b/i.exec(words)?.[1]?.toLowerCase();
  if(door&&(!side||!end)){
   const ids=PARTS.filter(p=>p.kind==='door'&&(!side||p.id.includes(side))&&(!end||p.id.includes(end))).map(p=>p.id);
   ctx.pending={kind:'door',original:words,partIds:ids};
   messages.push(side?'Front or rear door?':end?'Left or right '+end+' door?':'Which door: left front, left rear, right front, or right rear?');continue;
  }
  const intent=parseCommand(words,r,ctx.partId,confirmed);
  if(intent.action!=='unknown'&&intent.action!=='clarify')ctx.pending=undefined;
  try{
   switch(intent.action){
    case 'status':
     r=mutate(r,{type:'status',checkId:intent.checkId,status:intent.status,notes:intent.notes});
     ctx.partId=checkById(intent.checkId).partId;changedChecks.push(intent.checkId);
     messages.push(checkById(intent.checkId).name+(ctx.partId.includes('door')&&intent.checkId===ctx.partId?' panel':'')+': '+(intent.status==='pass'?'okay':intent.status==='not-applicable'?'not applicable':'rectified')+'.');break;
    case 'finding':
     r=mutate(r,{type:'finding',checkId:intent.checkId,defect:intent.defect,severity:intent.severity,notes:intent.notes});
     ctx.partId=checkById(intent.checkId).partId;changedChecks.push(intent.checkId);
     messages.push(intent.defect+' on '+checkById(intent.checkId).name+'.'+(intent.severity==='unassessed'?' Minor, moderate, serious, or critical?':' '+intent.severity+'.'));break;
    case 'severity':
     r=mutate(r,{type:'edit-finding',id:intent.id,patch:{severity:intent.severity}});messages.push('Severity: '+intent.severity+'.');break;
    case 'move':
     r=mutate(r,{type:'move',id:intent.id,checkId:intent.checkId});ctx.partId=checkById(intent.checkId).partId;
     changedChecks.push(intent.checkId);messages.push('Corrected to '+checkById(intent.checkId).name+'. Photos moved too.');break;
    case 'undo':r=mutate(r,{type:'undo'});messages.push('Last change undone.');break;
    case 'start':if(!r.started)r=mutate(r,{type:'start'});messages.push('Ready. Tell me what you see.');break;
    case 'clarify':ctx.pending={kind:'check',original:words,partId:intent.partId,checkIds:intent.checks.map(c=>c.id)};ctx.partId=intent.partId;messages.push('Which check? '+intent.checks.slice(0,3).map(c=>c.name).join(', ')+'.');break;
    case 'unknown':messages.push(intent.text);break;
    case 'outstanding':{const left=CHECKS.filter(c=>statusOf(r,c.id)==='not-inspected');messages.push(left.length+' checks left. '+left.slice(0,2).map(c=>c.name).join(', ')+'.');effects.push(intent);break;}
    default:effects.push(intent);break;
   }
  }catch(e){messages.push(e instanceof Error?e.message:'Please repeat that observation.');}
 }
 return {record:r,context:ctx,reply:messages.join(' ')||'Ready.',effects,changedChecks};
}
