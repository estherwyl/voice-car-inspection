import { useState } from 'react';
import { X, Download, ChevronRight, Check } from 'lucide-react';
import { CHECKS, SECTIONS, checkById } from './checklist';
import { completeness, grade, statusOf, exportHtml, type RecordData, type Mutation } from './domain';
export function downloadReport(record:RecordData){
 const url=URL.createObjectURL(new Blob([exportHtml(record)],{type:'text/html;charset=utf-8'}));
 const a=document.createElement('a');a.href=url;a.download='inspection-subaru-xv-'+record.id.slice(0,8)+'.html';
 document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
export default function Review({record,onClose,onSelect,onMutate,saved}:{record:RecordData;onClose:()=>void;onSelect:(id:string)=>void;onMutate:(a:Mutation)=>void;saved:boolean}){
 const c=completeness(record),g=grade(record),[ack,setAck]=useState(false),[exported,setExported]=useState(false);
 const unknown=record.findings.filter(f=>f.severity==='unassessed');
 const missing=record.findings.filter(f=>!record.photos.some(p=>p.findingId===f.id));
 const missingFindings=CHECKS.filter(c=>statusOf(record,c.id)==='to-be-rectified'&&!record.findings.some(f=>f.checkId===c.id));
 const openCheck=(id:string)=>{onSelect(id);onClose();};
 return <div className="modal-backdrop" onClick={onClose}><section className="modal review-modal" role="dialog" aria-modal="true" aria-label="Review inspection" onClick={e=>e.stopPropagation()}>
  <header><h2>Review</h2><button className="icon-button" aria-label="Close review" onClick={onClose}><X size={20}/></button></header>
  <div className="review-summary"><div><span className="muted small">Checked</span><strong>{c.done}<small> / {c.total}</small></strong></div><div><span className="muted small">Condition grade</span><strong>{g.letter}<small>{g.letter==='—'?'Pending':g.score+'/100'}</small></strong></div></div>
  <p className="review-caption">{record.finalizedAt?'Finalized':'Draft'} · Illustrative grade{c.remaining>0?' · '+c.remaining+' unchecked':''}</p>
  {g.serious.length>0&&<div className="serious"><div><b>Serious findings</b>{g.serious.map(f=><button key={f.id} onClick={()=>openCheck(f.checkId)}>{checkById(f.checkId).name} · {f.severity}<ChevronRight size={14}/></button>)}</div></div>}
  <div className="review-list"><h3>Issues <span>{g.contributions.length}</span></h3>{g.contributions.length===0?<p className="muted small">No unresolved issues recorded.</p>:g.contributions.map(f=><button className="review-row" key={f.id} onClick={()=>openCheck(f.checkId)}><span className={'severity '+f.severity}>{f.severity}</span><span><b>{checkById(f.checkId).name}</b><small>{f.type} · {record.photos.filter(p=>p.findingId===f.id).length} photos</small></span><b>{f.severity==='unassessed'?'?':'−'+record.rules[f.severity]}</b><ChevronRight size={14}/></button>)}</div>
  {(unknown.length+missing.length+missingFindings.length)>0&&<details className="review-list" open={unknown.length>0||missingFindings.length>0}><summary>Needs review <span>{unknown.length+missing.length+missingFindings.length}</span></summary>{missingFindings.map(c=><button className="review-row" key={c.id} onClick={()=>openCheck(c.id)}>Add finding · {c.name}<ChevronRight size={14}/></button>)}{unknown.map(f=><button className="review-row" key={'severity-'+f.id} onClick={()=>openCheck(f.checkId)}>Severity · {checkById(f.checkId).name}<ChevronRight size={14}/></button>)}{missing.map(f=><button className="review-row" key={'photo-'+f.id} onClick={()=>openCheck(f.checkId)}>Photo missing · {checkById(f.checkId).name}<ChevronRight size={14}/></button>)}</details>}
  <details className="review-list"><summary>Unchecked <span>{c.remaining}</span></summary><div className="outstanding-list">{CHECKS.filter(ch=>statusOf(record,ch.id)==='not-inspected').map(ch=><button key={ch.id} onClick={()=>openCheck(ch.id)}>{ch.name}<small>{ch.section}</small><ChevronRight size={14}/></button>)}</div></details>
  <details className="review-list"><summary>Sections</summary><div className="section-summary">{SECTIONS.map(s=>{const sc=completeness(record,CHECKS.filter(x=>x.section===s));return <div key={s}><span>{s}</span><div className="progress"><i style={{width:sc.percent+'%'}}/></div><b>{sc.done}/{sc.total}</b></div>;})}</div></details>
  <details className="review-list"><summary>Grading rules</summary><div className="rules"><p>Illustrative deductions per unresolved finding. A ≥ 95, B ≥ 80, C ≥ 60, D &lt; 60. Serious findings cap the grade at C; critical findings at D. Rectified findings incur no deduction. Unchecked items remain unknown.</p>{Object.entries(record.rules).map(([key,value])=><label key={key}>{key}<input type="number" min="0" max="100" value={value} onChange={e=>onMutate({type:'rules',rules:{...record.rules,[key]:Math.max(0,Math.min(100,Number(e.target.value)))}})}/></label>)}</div></details>
  <label className="review-ack"><input type="checkbox" checked={ack} onChange={e=>setAck(e.target.checked)}/>I have reviewed the findings and evidence.</label>
  {c.remaining>0&&<p className="small muted">Finish all checks to finalize. Draft export is available.</p>}
  <footer><button disabled={!ack||c.remaining>0||unknown.length>0||missingFindings.length>0||!!record.finalizedAt||!saved} onClick={()=>onMutate({type:'finalize'})}><Check size={16}/>{record.finalizedAt?'Finalized':'Finalize'}</button><button className="primary" onClick={()=>{downloadReport(record);setExported(true);}}><Download size={16}/>Export {record.finalizedAt?'report':'draft'}</button></footer>
  {exported&&<><p className="small muted" role="status">HTML report prepared. Download requested.</p><details className="report-export-preview"><summary>Preview / print</summary><iframe title="Exported inspection report" srcDoc={exportHtml(record)} sandbox="allow-modals allow-same-origin"/><button onClick={()=>{const frame=document.querySelector('iframe[title="Exported inspection report"]') as HTMLIFrameElement;frame?.contentWindow?.print();}}>Print / save PDF</button></details></>}
 </section></div>;
}

