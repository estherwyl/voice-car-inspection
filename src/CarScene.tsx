import { vehicleById } from './vehicles';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { PARTS, type Part } from './checklist';
import { partStatus, type RecordData } from './domain';
import { preparePartLayout, partCell, transitionPose, explodePhases } from './model-layout';
export const MARKS={pass:'✓',flagged:'!',partial:'◐','not-inspected':'?','not-applicable':'−'};
export const PART_STATUS={pass:'Pass',flagged:'Flagged',partial:'Partial','not-inspected':'Not inspected','not-applicable':'Not applicable'};
type Props={record:RecordData;selected:string;onSelect:(id:string)=>void;view:'Exterior'|'Interior';exploded:boolean;isolated:boolean;reset:number;preview?:boolean;minimal?:boolean;expansion?:number};
const paint=new THREE.Color('#dae1df');
function material(color:string,metalness=.1,roughness=.4){return new THREE.MeshStandardMaterial({color,metalness,roughness});}
function makePart(p:Part){
 const group=new THREE.Group();group.userData.partId=p.id;
 const white=material('#e5e9e7',.34,.27),dark=material('#192d33',.5,.22),rubber=material('#202728',0,.85),metal=material('#a8b4b5',.8,.26);
 const add=(size:number[],pos:number[],mat:THREE.Material,round=.05)=>{const mesh=new THREE.Mesh(new RoundedBoxGeometry(size[0],size[1],size[2],2,round),mat);mesh.position.set(pos[0],pos[1],pos[2]);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;};
 const side=p.pos[0]>0?1:-1;let rotation=new THREE.Euler();
 if(p.kind==='door'){
  rotation.y=side*Math.PI/2;
  add([1.1,.7,.08],[0,-.06,0],white);add([.99,.47,.035],[0,.5,-.05],dark,.04);
  add([.045,.55,.055],[.52,.5,-.01],rubber);add([.99,.035,.04],[0,.75,-.04],metal);
  add([.19,.035,.05],[-.28,.16,.06],metal);add([1.08,.06,.095],[0,-.38,.005],rubber);
 }else if(p.kind==='fender'){
  rotation.y=side*Math.PI/2;
  const shape=new THREE.Shape();shape.moveTo(-.47,-.34);shape.lineTo(-.47,.37);shape.quadraticCurveTo(0,.43,.47,.31);shape.lineTo(.47,-.34);shape.lineTo(.4,-.34);shape.absarc(0,-.34,.4,0,Math.PI,false);shape.lineTo(-.47,-.34);
  const mesh=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.07,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.025,bevelThickness:.025}),white);group.add(mesh);mesh.castShadow=true;
 }else if(p.kind==='wheel'){
  rotation.y=side*Math.PI/2;
  const tire=new THREE.Mesh(new THREE.CylinderGeometry(.43,.43,.26,40),rubber);tire.rotation.x=Math.PI/2;group.add(tire);tire.castShadow=true;
  const rim=new THREE.Mesh(new THREE.CylinderGeometry(.3,.3,.275,32),metal);rim.rotation.x=Math.PI/2;group.add(rim);
  const inner=new THREE.Mesh(new THREE.CylinderGeometry(.255,.255,.284,32),rubber);inner.rotation.x=Math.PI/2;group.add(inner);
  for(let i=0;i<10;i++){const a=i/10*Math.PI*2;const spoke=add([.035,.255,.022],[Math.sin(a)*.13,Math.cos(a)*.13,.15],metal,.01);spoke.rotation.z=-a;}
  const hub=new THREE.Mesh(new THREE.SphereGeometry(.085,16,12),metal);hub.scale.z=.3;hub.position.z=.16;group.add(hub);
 }else if(p.kind==='seat'){
  const leather=material('#59645f',.02,.83);add([p.size[0],.2,.68],[0,-.2,0],leather,.1);const back=add([p.size[0],.7,.2],[0,.17,.26],leather,.09);back.rotation.x=-.12;
  add([p.size[0]*.52,.22,.18],[0,.62,.28],leather,.07);
  for(const x of [-.22,.22])add([.018,.53,.015],[x,.18,.14],metal,.004);
 }else if(p.kind==='steering'){
  rotation.x=-.4;const ring=new THREE.Mesh(new THREE.TorusGeometry(.23,.035,12,40),rubber);group.add(ring);add([.33,.07,.06],[0,0,0],rubber);add([.08,.24,.06],[0,-.08,0],rubber);
 }else if(p.kind==='windshield'||p.kind==='rear-glass'){
  rotation.x=p.kind==='windshield'?.67:-.65;add(p.size,[0,0,0],dark,.045);
 }else if(p.kind==='bonnet'){
  rotation.x=-.045;add(p.size,[0,0,0],white,.07);add([.022,.01,.83],[-.65,.07,0],metal,.005);add([.022,.01,.83],[.65,.07,0],metal,.005);
 }else if(p.kind==='bumper'){
  add(p.size,[0,0,0],white,.1);add([1.76,.17,p.size[2]+.04],[0,-.12,0],rubber,.04);
  if(p.id==='front-bumper'){add([.8,.22,.05],[0,.15,-.16],dark,.02);add([.43,.1,.02],[0,-.025,-.18],metal,.006);}
 }else if(p.kind==='lights'){
  for(const x of [-.72,.72])add([.46,.15,.1],[x,0,0],material('#e9f7fc',.3,.15),.035);
 }else if(p.kind==='boot'){
  add(p.size,[0,0,0],white,.07);for(const x of [-.77,.77])add([.26,.19,.05],[x,.12,.09],material('#863c39',.1,.2));add([.6,.13,.025],[0,-.1,.085],dark);
 }else if(p.kind==='dash'){
  add(p.size,[0,0,0],rubber,.1);add([.35,.25,.06],[0,.23,.12],dark,.025);add([.3,.17,.015],[0,.23,.155],material('#567975',.3,.3),.02);
 }else if(p.kind==='engine'){
  add(p.size,[0,0,0],rubber);add([.8,.16,.6],[0,.3,0],metal);for(let i=0;i<5;i++)add([.06,.04,.5],[-.3+i*.15,.4,0],rubber);
 }else add(p.size,[0,0,0],p.kind==='underbody'||p.kind==='console'||p.kind==='trim'||p.kind==='belts'?rubber:p.kind==='mirror'?white:white,.06);
 group.rotation.copy(rotation);group.position.set(...p.pos);
 group.userData.originalRotation=new THREE.Quaternion().setFromEuler(rotation);group.userData.mainMaterial=white;
 return group;
}
export default function CarScene(props:Props){
 const host=useRef<HTMLDivElement>(null),latest=useRef(props),labels=useRef<Record<string,HTMLButtonElement|null>>({}),[failed,setFailed]=useState(false),[modelState,setModelState]=useState('Loading Blender model…'),[sceneWidth,setSceneWidth]=useState(600);
 latest.current=props;
 useEffect(()=>{
  if(!host.current)return;const container=host.current;let renderer:THREE.WebGLRenderer;
  try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});}catch{setFailed(true);return;}
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.setClearColor('#f4f7f6',0);container.prepend(renderer.domElement);
  const scene=new THREE.Scene();const camera=new THREE.OrthographicCamera(-4,4,3,-3,.1,100);camera.position.set(6,4.2,-7);camera.lookAt(0,.8,0);
  const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,.85,0);controls.enableDamping=true;controls.dampingFactor=.09;controls.minZoom=.65;controls.maxZoom=2.5;controls.maxPolarAngle=Math.PI;controls.enablePan=false;
  scene.add(new THREE.HemisphereLight('#ffffff','#8a9890',3));
  const key=new THREE.DirectionalLight('#fff5e6',4);key.position.set(4,8,-3);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-5;key.shadow.camera.right=5;key.shadow.camera.top=5;key.shadow.camera.bottom=-5;key.shadow.bias=-.001;scene.add(key);
  const fill=new THREE.DirectionalLight('#c4e0eb',2);fill.position.set(-4,4,4);scene.add(fill);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(30,30),new THREE.ShadowMaterial({opacity:.13}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;floor.position.y=.06;scene.add(floor);
  const grid=new THREE.GridHelper(16,32,'#dfe8e2','#e8eeea');grid.position.y=.04;(grid.material as THREE.Material).transparent=true;(grid.material as THREE.Material).opacity=.7;scene.add(grid);
  let groups=PARTS.map(makePart);groups.forEach(g=>scene.add(g));
  let disposed=false,blenderLoaded=false;
  groups.forEach((g,i)=>preparePartLayout(g,PARTS[i]));
  new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load(vehicleById(props.record.vehicleId).model,gltf=>{
   if(disposed){gltf.scene.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();}});return;}
   const imported=PARTS.map(part=>gltf.scene.getObjectByName(`part-${part.id}`));
   if(imported.some(p=>!p)){setModelState('Model component mapping failed · basic geometry');return;}
   groups.forEach(g=>{scene.remove(g);g.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());}});});
   groups=imported.map((node,i)=>{const g=node as THREE.Group;g.removeFromParent();g.userData.partId=PARTS[i].id;scene.add(g);g.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;const mats=Array.isArray(o.material)?o.material:[o.material];const cloned=mats.map(m=>{const clone=m.clone() as THREE.MeshStandardMaterial;clone.userData.originalColor=clone.color.clone();return clone;});o.material=Array.isArray(o.material)?cloned:cloned[0];}});preparePartLayout(g,PARTS[i],true);return g;});
   blenderLoaded=true;settle=1;setModelState('');
  },undefined,()=>{if(!disposed)setModelState('Detailed model unavailable · basic geometry');});
  const base=new THREE.Mesh(new RoundedBoxGeometry(1.86,.35,3.82,3,.2),material('#c2cdca',.2,.42));base.position.set(0,.59,0);base.castShadow=true;scene.add(base);
  let width=600,height=500,raf=0,amount=0,previousTarget=0,settle=1,reset=props.reset,previousSelection=props.selected,previousIsolation=props.isolated,previousView=props.view;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const orbitPosition=camera.position.clone(),orbitTarget=controls.target.clone();
  const resize=()=>{if(!container.clientWidth||!container.clientHeight)return;width=container.clientWidth;height=container.clientHeight;renderer.setSize(width,height);settle=1;};
  const ro=new ResizeObserver(resize);ro.observe(container);resize();
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let down=[0,0];
  const pointerDown=(e:PointerEvent)=>{down=[e.clientX,e.clientY];};
  const pointerUp=(e:PointerEvent)=>{
   if(Math.hypot(e.clientX-down[0],e.clientY-down[1])>6)return;
   const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);
   const hit=raycaster.intersectObjects(groups.filter(g=>g.visible),true)[0];
   if(hit){let obj=hit.object;while(obj.parent&&!obj.userData.partId)obj=obj.parent;latest.current.onSelect(obj.userData.partId);}
  };
  renderer.domElement.addEventListener('pointerdown',pointerDown);renderer.domElement.addEventListener('pointerup',pointerUp);
  const temp=new THREE.Vector3(),allBounds=new THREE.Box3();let last=performance.now();
  function animate(time:number){
   const dt=Math.min((time-last)/1000,.05);last=time;const p=latest.current;
   if(!container.clientWidth||!container.clientHeight){raf=requestAnimationFrame(animate);return;}
   const target=Math.max(0,Math.min(1,p.expansion??(p.exploded?1:0)));
   if(target!==previousTarget){
    if(previousTarget===0){orbitPosition.copy(camera.position);orbitTarget.copy(controls.target);}
    settle=1;previousTarget=target;
   }
   if(reset!==p.reset){reset=p.reset;orbitPosition.set(6,4.2,-7);orbitTarget.set(0,.85,0);settle=1;}
   if(previousView!==p.view){previousView=p.view;settle=1;}
   if(previousIsolation!==p.isolated||previousSelection!==p.selected){previousIsolation=p.isolated;previousSelection=p.selected;settle=1;}
   const speed=reduced?1:1-Math.exp(-dt*10);
   amount=THREE.MathUtils.lerp(amount,target,speed);if(Math.abs(amount-target)<.0002)amount=target;
   settle=Math.max(0,settle-dt);
   const {spread,pack}=explodePhases(amount),packed=amount>=.94;
   const visibleParts=PARTS.filter(part=>(p.view==='Interior'?part.view==='Interior':target===0||part.view==='Exterior')&&(!p.isolated||part.id===p.selected));
   const cols=p.isolated?1:width<550?4:6,rows=Math.ceil(visibleParts.length/cols),aspect=width/height;
   allBounds.makeEmpty();
   groups.forEach((g,i)=>{
    const part=PARTS[i],index=visibleParts.findIndex(v=>v.id===part.id);
    g.visible=index>=0;if(!g.visible)return;
    const pose=transitionPose(g,part,amount,partCell(index,cols,rows));
    g.position.copy(pose.position);g.quaternion.copy(pose.rotation);g.scale.setScalar(pose.scale);g.updateMatrixWorld(true);
    allBounds.expandByObject(g);
    const status=partStatus(p.record,part.id),isSelected=p.selected===part.id;
    if(blenderLoaded)g.traverse(o=>{if(o instanceof THREE.Mesh){
     o.visible=true;
     const materials=Array.isArray(o.material)?o.material:[o.material];
     materials.forEach((m:THREE.MeshStandardMaterial)=>{m.color.copy(m.userData.originalColor);if(isSelected)m.color.lerp(new THREE.Color('#74b79a'),.34);else if(status==='flagged')m.color.lerp(new THREE.Color('#cc9858'),.2);});
    }});
    else (g.userData.mainMaterial as THREE.MeshStandardMaterial).color.copy(isSelected?new THREE.Color('#83bdab'):paint);
   });
   const center=allBounds.getCenter(new THREE.Vector3()),size=allBounds.getSize(new THREE.Vector3());
   const baseHalf=Math.max(1.95,3/aspect),spreadHalf=Math.max(size.length()*.48,size.length()*.45/aspect);
   const packedHalf=Math.max(size.y/2+.55,(size.x/2+.4)/aspect);
   let half=THREE.MathUtils.lerp(baseHalf,spreadHalf,spread);half=THREE.MathUtils.lerp(half,packedHalf,pack);
   if(p.isolated)half=Math.max(.65,size.length()*.65,size.length()*.6/aspect);
   if(settle>0||amount!==target){
    const look=orbitTarget.clone().lerp(center,spread).lerp(new THREE.Vector3(),pack);
    if(p.isolated)look.copy(center);
    const offset=orbitPosition.clone().sub(orbitTarget).lerp(new THREE.Vector3(0,0,14),pack);
    camera.position.lerp(look.clone().add(offset),speed);controls.target.lerp(look,speed);
    camera.top=THREE.MathUtils.lerp(camera.top,half,speed);camera.zoom=THREE.MathUtils.lerp(camera.zoom,1,speed);
   }
   camera.bottom=-camera.top;camera.right=camera.top*aspect;camera.left=-camera.right;
   controls.enabled=!p.preview;controls.enableRotate=!packed;controls.enablePan=packed;controls.screenSpacePanning=true;controls.maxPolarAngle=Math.PI;
   controls.mouseButtons.LEFT=packed?THREE.MOUSE.PAN:THREE.MOUSE.ROTATE;
   controls.touches.ONE=packed?THREE.TOUCH.PAN:THREE.TOUCH.ROTATE;
   controls.touches.TWO=packed?THREE.TOUCH.DOLLY_PAN:THREE.TOUCH.DOLLY_ROTATE;
   controls.update();camera.updateProjectionMatrix();
   floor.visible=amount<.5;grid.visible=amount<.15;base.visible=p.view==='Exterior'&&!blenderLoaded&&amount<.01&&!p.isolated;
   groups.forEach((g,i)=>{
    const part=PARTS[i],label=labels.current[part.id];if(!label)return;
    const selected=p.selected===part.id,status=partStatus(p.record,part.id);
    const behind=amount<.1&&!selected&&((part.pos[0]>.8&&camera.position.x<0)||(part.pos[0]<-.8&&camera.position.x>0));
    label.style.display=g.visible&&!behind&&!p.preview&&(!p.minimal||pack>.8||selected||status!=='not-inspected')?'flex':'none';
    const box=new THREE.Box3().setFromObject(g);box.getCenter(temp);temp.y-=pack>.8?box.getSize(new THREE.Vector3()).y/2+.16:0;
    temp.project(camera);label.style.left=((temp.x*.5+.5)*width)+'px';label.style.top=((-temp.y*.5+.5)*height)+'px';
   });
   container.dataset.layoutReady=settle===0&&amount===target?'true':'false';
   container.dataset.view=p.view;container.dataset.visibleParts=visibleParts.map(part=>part.id).join(',');
   container.dataset.layoutMode=amount===0?'assembled':amount<=.45?'spread':'packed';
   container.dataset.expansion=amount.toFixed(3);container.dataset.gesture=packed?'pan':'rotate';
   container.dataset.cameraTarget=controls.target.toArray().map(n=>n.toFixed(3)).join(',');
   renderer.render(scene,camera);raf=requestAnimationFrame(animate);
  }

  raf=requestAnimationFrame(animate);
  return()=>{disposed=true;cancelAnimationFrame(raf);ro.disconnect();controls.dispose();scene.traverse(obj=>{if(obj instanceof THREE.Mesh){obj.geometry.dispose();const mats=Array.isArray(obj.material)?obj.material:[obj.material];mats.forEach(m=>m.dispose());}});renderer.dispose();renderer.domElement.remove();};
 },[]);
 const amount=props.expansion??(props.exploded?1:0);
 return <div ref={host} className={'car-scene '+(amount>.94?'flat ':'')+(props.preview?'preview':'')} role="group" aria-label="Interactive vehicle and parts">
  {modelState&&<div className="model-load-state" role="status">{modelState}</div>}
  {!failed&&!props.preview&&PARTS.map(p=><button key={p.id} ref={el=>{labels.current[p.id]=el;}} onClick={()=>props.onSelect(p.id)} className={`part-pin ${partStatus(props.record,p.id)} ${props.selected===p.id?'selected':''}`} title={`${p.name} · ${PART_STATUS[partStatus(props.record,p.id)]}`} aria-label={`${p.name}: ${PART_STATUS[partStatus(props.record,p.id)]}`}><span>{MARKS[partStatus(props.record,p.id)]}</span><b>{p.name}</b></button>)}
  {failed&&props.preview&&<img src={vehicleById(props.record.vehicleId).image} alt={vehicleById(props.record.vehicleId).name}/>}
  {failed&&!props.preview&&<div className="scene-fallback"><p>3D graphics unavailable. Select a component to continue inspecting.</p>{PARTS.filter(p=>p.view===props.view).map(p=><button key={p.id} onClick={()=>props.onSelect(p.id)}>{p.name} · {PART_STATUS[partStatus(props.record,p.id)]}</button>)}</div>}
 </div>;
}
