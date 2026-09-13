import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {PARTS} from './checklist';
import {preparePartLayout,transitionPose,explodePhases,partCell} from './model-layout';
test('45 percent boundary separates spread from packing continuously',()=>{
 assert.deepEqual(explodePhases(0),{spread:0,pack:0});
 assert.deepEqual(explodePhases(.45),{spread:1,pack:0});
 assert.deepEqual(explodePhases(1),{spread:1,pack:1});
 assert.ok(explodePhases(.44999).spread>.9999);
 assert.ok(explodePhases(.45001).pack<.0001);
});
test('assembled pose restores exactly; packing preserves thickness with centres at z=0',()=>{
 const p=PARTS[0],g=new THREE.Group();
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(.2,.8,1.1));mesh.position.set(.1,.2,.3);g.add(mesh);g.position.set(...p.pos);
 preparePartLayout(g,p,true);
 const start=transitionPose(g,p,0,new THREE.Vector3());
 assert.ok(start.position.distanceTo(g.userData.basePosition)<1e-9);assert.equal(start.scale,1);
 const spread=transitionPose(g,p,.45,new THREE.Vector3());assert.ok(spread.position.distanceTo(start.position)>1);assert.equal(spread.scale,1);assert.ok(spread.rotation.angleTo(start.rotation)<1e-9);
 const cell=partCell(0,6,6),end=transitionPose(g,p,1,cell);
 g.position.copy(end.position);g.quaternion.copy(end.rotation);g.scale.setScalar(end.scale);g.updateMatrixWorld(true);
 const bounds=new THREE.Box3().setFromObject(g),centre=bounds.getCenter(new THREE.Vector3());
 assert.ok(centre.distanceTo(cell)<1e-6);assert.ok(bounds.getSize(new THREE.Vector3()).z>0);
 assert.equal(g.scale.x,g.scale.z);
 const restored=transitionPose(g,p,0,cell);assert.ok(restored.position.distanceTo(start.position)<1e-9);assert.equal(restored.scale,1);
});
