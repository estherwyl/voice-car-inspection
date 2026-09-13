import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { PARTS } from '../src/checklist.ts';
import { preparePartLayout, partCell, transitionPose } from '../src/model-layout.ts';
const bytes=await fs.readFile(new URL('../public/models/subaru-xv-inspection.glb',import.meta.url));
const gltf=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const roots=PARTS.map(p=>{const g=gltf.scene.getObjectByName(`part-${p.id}`) as THREE.Group;assert.ok(g,`Missing ${p.id}`);assert.equal(g.userData.partId,p.id);assert.ok(g.children.length);preparePartLayout(g,p,true);return g;});
let triangles=0;gltf.scene.traverse(o=>{if(o instanceof THREE.Mesh){assert.ok(o.geometry.getAttribute('position').count>0);triangles+=(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3;}});
for(const view of ['Exterior','Interior'])for(const columns of [3,5]){
 const entries=PARTS.map((p,i)=>({p,g:roots[i]})).filter(({p})=>(p.view===view||(view==='Interior'&&p.kind==='door'))&&!['engine','underbody'].includes(p.id));
 const rows=Math.ceil(entries.length/columns),boxes:THREE.Box3[]=[];
 entries.forEach(({p,g},i)=>{
  const inside=view==='Interior'?g.userData.interiorLayout:undefined;
  g.quaternion.copy(inside?.rotation??g.userData.flatRotation);
  g.scale.setScalar(inside?.scale??g.userData.flatScale);
  const cell=partCell(i,columns,rows);g.position.copy(cell).sub(inside?.center??g.userData.flatCenter);g.updateMatrixWorld(true);
  const box=new THREE.Box3();
  g.traverse(o=>{if(o instanceof THREE.Mesh&&!(view==='Interior'&&p.kind==='door'&&o.userData.surface!=='interior'))box.expandByObject(o);});
  const size=box.getSize(new THREE.Vector3());assert.ok(size.x<=1.181);assert.ok(size.y<=.781);box.min.z=-1;box.max.z=1;
  assert.ok(boxes.every(b=>!b.intersectsBox(box)),`Overlapping ${view} parts at ${columns} columns`);boxes.push(box);
 });
 entries.forEach(({g})=>{g.quaternion.copy(g.userData.originalRotation);g.scale.setScalar(1);g.position.copy(g.userData.basePosition);g.updateMatrixWorld(true);});
}
for(const columns of [4,6]){
 const boxes:THREE.Box3[]=[];
 roots.forEach((g,i)=>{
  const cell=partCell(i,columns,Math.ceil(roots.length/columns)),pose=transitionPose(g,PARTS[i],1,cell);
  g.position.copy(pose.position);g.quaternion.copy(pose.rotation);g.scale.setScalar(pose.scale);g.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(g);
  assert.ok(bounds.getCenter(new THREE.Vector3()).distanceTo(cell)<.001,`Packed centre: ${PARTS[i].id}`);
  assert.ok(bounds.getSize(new THREE.Vector3()).z>0,`Thickness: ${PARTS[i].id}`);
  bounds.min.z=-1;bounds.max.z=1;assert.ok(boxes.every(b=>!b.intersectsBox(bounds)));boxes.push(bounds);
 });
}
console.log(`Verified ${roots.length} Blender components, ${triangles.toLocaleString()} triangles, nonoverlapping layouts, and unified packed centres on z=0 with thickness preserved.`);
