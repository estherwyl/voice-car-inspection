import * as THREE from 'three';
import type { Part } from './checklist';
export function flatQuaternion(part:Part,fromBlender=false){
 const q=new THREE.Quaternion();
 if(['roof','bonnet','underbody'].includes(part.kind))q.setFromEuler(new THREE.Euler(Math.PI/2,0,0));
 else if(['windshield','rear-glass'].includes(part.kind))q.setFromEuler(new THREE.Euler(part.kind==='windshield'?-.8:.8,0,0));
 else if(fromBlender&&['door','fender','wheel','mirror'].includes(part.kind))q.setFromEuler(new THREE.Euler(0,(part.pos[0]>0?-1:1)*Math.PI/2,0));
 else if(fromBlender&&(part.id==='front-bumper'||part.id==='lights'))q.setFromEuler(new THREE.Euler(0,Math.PI,0));
 return q;
}
export function preparePartLayout(g:THREE.Group,part:Part,fromBlender=false){
 g.updateMatrixWorld(true);
 const assembled=new THREE.Box3().setFromObject(g);
 g.userData.assembledCenter=assembled.getCenter(new THREE.Vector3());
 g.userData.assembledSize=assembled.getSize(new THREE.Vector3());
 g.userData.basePosition=g.position.clone();
 g.userData.originalRotation=g.quaternion.clone();
 const flatQ=flatQuaternion(part,fromBlender);g.quaternion.copy(flatQ);g.updateMatrixWorld(true);
 const bounds=new THREE.Box3().setFromObject(g),size=bounds.getSize(new THREE.Vector3());
 const scale=Math.min(1.18/Math.max(size.x,.01),.78/Math.max(size.y,.01));
 g.userData.flatRotation=flatQ;g.userData.flatScale=scale;
 g.userData.flatCenter=bounds.getCenter(new THREE.Vector3()).sub(g.position).multiplyScalar(scale);
 if(fromBlender&&part.kind==='door'){
  const interiorQ=flatQ.clone().invert();g.quaternion.copy(interiorQ);g.updateMatrixWorld(true);
  const inside=new THREE.Box3();g.traverse(o=>{if(o instanceof THREE.Mesh&&o.userData.surface==='interior')inside.expandByObject(o);});
  if(!inside.isEmpty()){
   const size=inside.getSize(new THREE.Vector3()),interiorScale=Math.min(1.18/size.x,.78/size.y);
   g.userData.interiorLayout={rotation:interiorQ,scale:interiorScale,center:inside.getCenter(new THREE.Vector3()).sub(g.position).multiplyScalar(interiorScale)};
  }
 }
 g.quaternion.copy(g.userData.originalRotation);g.updateMatrixWorld(true);
}
export function partCell(index:number,columns:number,rows:number){return new THREE.Vector3((index%columns-(columns-1)/2)*1.7,((rows-1)/2-Math.floor(index/columns))*1.4+.08,0);}

export const EXPLODE_SPLIT=.45;
const smooth=(t:number)=>{const n=Math.max(0,Math.min(1,t));return n*n*(3-2*n);};
export function explodePhases(amount:number){return {spread:smooth(amount/EXPLODE_SPLIT),pack:smooth((amount-EXPLODE_SPLIT)/(1-EXPLODE_SPLIT))};}
/** Vehicle systems separate first; the cabin, drivetrain and outer shell stay recognizable. */
export function systemOffset(part:Part){
 if(part.id==='engine')return new THREE.Vector3(0,.6,-3.3);
 if(part.id==='underbody')return new THREE.Vector3(0,-1.4,.3);
 if(part.view==='Interior')return new THREE.Vector3(part.pos[0]*.8,2.8,part.pos[2]*.8);
 if(part.kind==='wheel')return new THREE.Vector3(Math.sign(part.pos[0])*2,-.5,Math.sign(part.pos[2])*.8);
 if(['roof','windshield','rear-glass'].includes(part.kind))return new THREE.Vector3(0,2,part.pos[2]*.65);
 return new THREE.Vector3(part.pos[0]*1.8,.25,part.pos[2]*.8);
}
/** Uniform scale preserves depth. At 100%, the rotated bounding-box centre is on z=0. */
export function transitionPose(group:THREE.Group,part:Part,amount:number,cell:THREE.Vector3){
 const {spread,pack}=explodePhases(amount),d=group.userData;
 const separated=(d.basePosition as THREE.Vector3).clone().addScaledVector(systemOffset(part),spread);
 const packed=cell.clone().sub(d.flatCenter);
 return {
  position:separated.lerp(packed,pack),
  rotation:(d.originalRotation as THREE.Quaternion).clone().slerp(d.flatRotation,pack),
  scale:THREE.MathUtils.lerp(1,d.flatScale,pack),
 };
}
