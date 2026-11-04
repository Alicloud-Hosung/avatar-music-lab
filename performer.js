import * as THREE from 'three';
import { GLTFLoader } from './GLTFLoader.js?v=2';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
const v=()=>new THREE.Vector3(),clamp=THREE.MathUtils.clamp;
function orientBone(bone,child,target){
 bone.updateWorldMatrix(true,true);const a=bone.getWorldPosition(v()),from=child.getWorldPosition(v()).sub(a).normalize(),to=target.clone().sub(a).normalize();
 const world=bone.getWorldQuaternion(new THREE.Quaternion()).premultiply(new THREE.Quaternion().setFromUnitVectors(from,to));
 bone.quaternion.copy(bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(world));bone.updateWorldMatrix(false,true);
}
function worldRotation(bone,q){bone.quaternion.copy(bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(q));bone.updateWorldMatrix(false,true);}
function torsoFrame(left,right,up){
 const x=left.clone().sub(right).normalize(),y=up.clone().addScaledVector(x,-up.dot(x)).normalize(),z=x.clone().cross(y).normalize();
 return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,y,z));
}
export function sampleJoints(motion,time){
 const frame=clamp(time*motion.fps,0,motion.frames-1),a=Math.floor(frame),b=Math.min(a+1,motion.frames-1),u=frame-a;
 return Array.from({length:33},(_,j)=>v().fromArray(motion.positions,(a*33+j)*3).lerp(v().fromArray(motion.positions,(b*33+j)*3),u));
}
export async function loadPerformer(scene,onProgress){
 const loader=new GLTFLoader();loader.register(parser=>new VRMLoaderPlugin(parser));
 const [gltf,motion,hands,lip]=await Promise.all([
  loader.loadAsync('./singer.vrm?v=male1',e=>onProgress?.(e.total?Math.round(e.loaded/e.total*100):0)),
  fetch('./pose-motion.json').then(r=>{if(!r.ok)throw new Error('Motion unavailable');return r.json();}),
  fetch('./hand-motion.json').then(r=>r.ok?r.json():null),
  fetch('./word-timing.json').then(r=>r.ok?r.json():null)
 ]);
 const vrm=gltf.userData.vrm;VRMUtils.rotateVRM0(vrm);VRMUtils.removeUnnecessaryVertices(vrm.scene);
 const materialCache=new Map();
 vrm.scene.traverse(o=>{
  o.frustumCulled=false;if(o.isMesh){o.castShadow=true;o.receiveShadow=false;}
  if(o.material){const array=Array.isArray(o.material)?o.material:[o.material];const next=array.map(m=>{
   if(materialCache.has(m))return materialCache.get(m);
   const hair=/HAIR/.test(m.name),cloth=/CLOTH/.test(m.name),eye=/EYE/.test(m.name);
   const n=new THREE.MeshStandardMaterial({name:m.name,map:m.map,color:m.color?.clone()||new THREE.Color(0xffffff),transparent:m.transparent,opacity:m.opacity,alphaTest:m.alphaTest,depthWrite:m.depthWrite,side:m.side,roughness:hair?.46:eye?.36:.78,metalness:0});
   if(/Tops/.test(m.name))n.color.set(0x334753);
   if(/Bottoms/.test(m.name))n.color.set(0x5a6579);
   if(hair){n.color.set(0xe3d0b2);n.roughness=.48;n.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',"#include <map_fragment>\nfloat hairLuma=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));diffuseColor.rgb=vec3(.72,.61,.45)*(.42+hairLuma*.8);");};n.customProgramCacheKey=()=> 'first-light-ash-hair';}
   if(eye)n.roughness=.32;
   materialCache.set(m,n);return n;
  });o.material=Array.isArray(o.material)?next:next[0];}
 });
 scene.add(vrm.scene);vrm.humanoid.resetNormalizedPose();vrm.update(0);
 const bone=n=>vrm.humanoid.getNormalizedBoneNode(n),raw=n=>vrm.humanoid.getRawBoneNode(n);
 const restHip=bone('hips').position.clone(),hipWorld=bone('hips').getWorldPosition(v());
 const restHipWorldQ=bone('hips').getWorldQuaternion(new THREE.Quaternion()),restChestWorldQ=bone('chest').getWorldQuaternion(new THREE.Quaternion());
 const feet={};for(const side of ['left','right']){
  const upper=bone(side+'UpperLeg'),lower=bone(side+'LowerLeg'),foot=bone(side+'Foot');
  const a=upper.getWorldPosition(v()),b=lower.getWorldPosition(v()),c=foot.getWorldPosition(v());
  feet[side]={upper,lower,foot,length1:a.distanceTo(b),length2:b.distanceTo(c),rest:c.clone(),restWorldQ:foot.getWorldQuaternion(new THREE.Quaternion())};
 }
 const first=sampleJoints(motion,0),sourceLeg=first[23].distanceTo(first[25])+first[25].distanceTo(first[27]);
 const scale=(feet.left.length1+feet.left.length2)/sourceLeg;
 // The rest foot pivot is above the visible sole. Preserve that offset at contact.
 const groundOffset=Math.min(feet.left.rest.y,feet.right.rest.y);
 const target=new THREE.Object3D();scene.add(target);if(vrm.lookAt)vrm.lookAt.target=target;
 // A small headset makes the stage role readable without licensed wardrobe assets.
 const head=raw('head');if(head){const micMat=new THREE.MeshStandardMaterial({color:0x333b43,roughness:.4,metalness:.5});const ear=new THREE.Mesh(new THREE.TorusGeometry(.018,.004,8,24),micMat);ear.position.set(.078,.025,.012);head.add(ear);}
 const springs=vrm.springBoneManager?.joints;if(springs)for(const j of springs){if(j.settings){j.settings.stiffness=Math.max(j.settings.stiffness,1.5);j.settings.dragForce=Math.max(j.settings.dragForce,.75);}}
 function pose(n,x=0,y=0,z=0){bone(n)?.rotation.set(x,y,z);}
 function limb(side,start,mid,end,ids,points){
  const a=bone(side+start),b=bone(side+mid),c=bone(side+end);
  const pa=a.getWorldPosition(v()),dir1=points[ids[1]].clone().sub(points[ids[0]]).normalize();
  orientBone(a,b,pa.clone().add(dir1));
  const pb=b.getWorldPosition(v()),dir2=points[ids[2]].clone().sub(points[ids[1]]).normalize();
  orientBone(b,c,pb.clone().add(dir2));
 }
 function legIK(side,target,pole,orientation){
  const f=feet[side],a=f.upper.getWorldPosition(v()),delta=target.clone().sub(a),reach=clamp(delta.length(),.02,f.length1+f.length2-.003),d=delta.normalize();
  const poleDirection=pole.clone().sub(a);poleDirection.addScaledVector(d,-poleDirection.dot(d));if(poleDirection.length()<.001)poleDirection.set(0,0,1).addScaledVector(d,-d.z);const bend=poleDirection.normalize(),along=(f.length1*f.length1+reach*reach-f.length2*f.length2)/(2*reach),height=Math.sqrt(Math.max(0,f.length1*f.length1-along*along));
  orientBone(f.upper,f.lower,a.clone().addScaledVector(d,along).addScaledVector(bend,height));orientBone(f.lower,f.foot,target);
  worldRotation(f.foot,orientation||f.restWorldQ);
 }
 const handFrames={};
 for(const side of ['left','right']){
  const hand=bone(side+'Hand'),middle=bone(side+'MiddleProximal'),index=bone(side+'IndexProximal'),little=bone(side+'LittleProximal');
  const hp=hand.getWorldPosition(v()),forward=middle.getWorldPosition(v()).sub(hp).normalize();
  const sideways=index.getWorldPosition(v()).sub(little.getWorldPosition(v())).normalize();
  const normal=(side==='left'?forward.clone().cross(sideways):sideways.clone().cross(forward)).normalize();
  const sourceNormal=forward.clone().cross(sideways).normalize(),basisX=sourceNormal.clone().cross(forward).normalize(),basisY=forward.clone().cross(basisX).normalize();
  const restBasisWorld=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(basisX,basisY,forward));
  const inverse=hand.getWorldQuaternion(new THREE.Quaternion()).invert(),localBasis=inverse.clone().multiply(restBasisWorld);
  handFrames[side]={forward:forward.applyQuaternion(inverse),normal:normal.applyQuaternion(inverse),basisInverse:localBasis.invert()};
 }
 function bend(b,axis,angle){const q=b.getWorldQuaternion(new THREE.Quaternion());q.premultiply(new THREE.Quaternion().setFromAxisAngle(axis,angle));worldRotation(b,q);}
 function fingers(side,index,time){
  const frame=clamp(Math.round(time*(hands?.fps||30)),0,(hands?.frames||1)-1),values=hands?.values;
  const hand=bone(side+'Hand'),hq=hand.getWorldQuaternion(new THREE.Quaternion()),basis=handFrames[side];
  const forward=basis.forward.clone().applyQuaternion(hq),normal=basis.normal.clone().applyQuaternion(hq),axis=forward.clone().cross(normal).normalize();
  const bends=[];
  for(let digit=0;digit<5;digit++)bends.push([0,1,2].map(j=>{const value=values?values[frame*40+index*20+digit*4+j]:.45;return clamp((.78-value)/1.65,0,.92);}));
  for(const [digit,name]of ['Index','Middle','Ring','Little'].entries()){
   for(const [joint,suffix]of ['Proximal','Intermediate','Distal'].entries()){
    const angle=bends[digit+1][joint]*[1.10,1.35,.88][joint];bend(bone(side+name+suffix),axis,angle);
   }
  }
  const thumb=bone(side+'ThumbMetacarpal'),proximal=bone(side+'ThumbProximal');
  const a=thumb.getWorldPosition(v()),original=proximal.getWorldPosition(v()).sub(a).normalize();
  const closure=(bends[1][0]+bends[2][0]+bends[3][0]+bends[4][0])*.25;
  const destination=bone(side+'IndexProximal').getWorldPosition(v()).addScaledVector(forward,.018).addScaledVector(normal,.006+closure*.012);
  const toward=destination.sub(a).normalize(),desired=original.lerp(toward,.45+closure*.3).normalize();
  orientBone(thumb,proximal,a.clone().add(desired));
  const thumbForward=bone(side+'ThumbDistal').getWorldPosition(v()).sub(proximal.getWorldPosition(v())).normalize();
  const thumbAxis=thumbForward.clone().cross(normal).normalize();
  bend(proximal,thumbAxis,.10+bends[0][1]*.50);bend(bone(side+'ThumbDistal'),thumbAxis,bends[0][2]*.65);
 }
 function update(time,dt,analysis,camera){
  const p=sampleJoints(motion,time),hip=p[23].clone().add(p[24]).multiplyScalar(.5),shoulder=p[11].clone().add(p[12]).multiplyScalar(.5);
  vrm.humanoid.resetNormalizedPose();
  const lowest=Math.min(p[27].y,p[28].y),height=-lowest*scale+groundOffset;
  const fi=clamp(Math.round(time*motion.fps),0,motion.frames-1);const ix=motion.image[fi*99+23*3],jx=motion.image[fi*99+24*3];
  const rootGoal=hipWorld.clone();rootGoal.x+=clamp(((ix+jx)*.5-.5)*1.8,-.38,.38);rootGoal.y=height;bone('hips').position.copy(bone('hips').parent.worldToLocal(rootGoal));
  const bodyQ=torsoFrame(p[23],p[24],shoulder.clone().sub(hip));const bodyFacing=new THREE.Vector3(0,0,1).applyQuaternion(bodyQ),bodyYaw=Math.atan2(bodyFacing.x,bodyFacing.z);worldRotation(bone('hips'),bodyQ.multiply(restHipWorldQ));
  const upperQ=torsoFrame(p[11],p[12],shoulder.clone().sub(hip));worldRotation(bone('chest'),upperQ.multiply(restChestWorldQ));
  // Transfer measured upper/lower limb directions; no preset dance cycle.
  limb('left','UpperArm','LowerArm','Hand',[11,13,15],p);limb('right','UpperArm','LowerArm','Hand',[12,14,16],p);
  limb('left','UpperLeg','LowerLeg','Foot',[23,25,27],p);limb('right','UpperLeg','LowerLeg','Foot',[24,26,28],p);
  const root=bone('hips').getWorldPosition(v());
  for(const [i,side]of ['left','right'].entries()){
   const id=i===0?27:28,knee=i===0?25:26,heel=i===0?29:30,toe=i===0?31:32;
   const t=root.clone().addScaledVector(p[id],scale);t.y=Math.max(groundOffset,t.y);
   const pole=root.clone().addScaledVector(p[knee],scale),footDirection=p[toe].clone().sub(p[heel]);
   let measuredYaw=Math.atan2(footDirection.x,footDirection.z);while(measuredYaw-bodyYaw>Math.PI)measuredYaw-=Math.PI*2;while(measuredYaw-bodyYaw< -Math.PI)measuredYaw+=Math.PI*2;
   const yaw=bodyYaw+clamp(measuredYaw-bodyYaw,-.65,.65)*.55;
   const footQ=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),yaw).multiply(feet[side].restWorldQ);
   legIK(side,t,pole,footQ);
   // Palm follows source forearm, with a conservative bend to avoid wrist flips.
   pose(side+'Hand',-.025,0,0);
   if(hands?.palmRelative){
    const si=i===0?11:12,ei=i===0?13:14,wi=i===0?15:16,fa=p[wi].clone().sub(p[ei]).normalize(),normal=p[ei].clone().sub(p[si]).cross(p[wi].clone().sub(p[ei]));
    if(normal.length()>.007){
     const x=normal.clone().cross(fa).normalize(),y=fa.clone().cross(x).normalize();
     const armQ=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,y,fa));
     const hf=clamp(time*hands.fps,0,hands.frames-1),ha=Math.floor(hf),hb=Math.min(ha+1,hands.frames-1);
     const qa=new THREE.Quaternion().fromArray(hands.palmRelative,(ha*2+i)*4),qb=new THREE.Quaternion().fromArray(hands.palmRelative,(hb*2+i)*4);qa.slerp(qb,hf-ha);
     const desired=armQ.multiply(qa).multiply(handFrames[side].basisInverse),current=bone(side+'Hand').getWorldQuaternion(new THREE.Quaternion()),angle=current.angleTo(desired);
     current.slerp(desired,Math.min(1,1.40/Math.max(.001,angle)));worldRotation(bone(side+'Hand'),current);
    }
   }
   fingers(side,i,time);
  }
  pose('neck',-.025,0,0);
  const headTilt=clamp((p[7].y-p[8].y)*1.4,-.17,.17),headYaw=clamp((p[0].x-(p[7].x+p[8].x)*.5)*.5,-.18,.18);
  pose('head',0,headYaw,headTilt);
  const ex=vrm.expressionManager;for(const n of ['aa','ih','ou','ee','oh','happy','relaxed','blink'])ex?.setValue(n,0);
  const cue=lip?.syllable_cues.find(c=>time>=c.start-.025&&time<c.end+.025);
  if(cue){
   const code=cue.text.charCodeAt(0)-0xAC00,progress=clamp((time-cue.start)/Math.max(.04,cue.end-cue.start),0,1);
   if(code>=0&&code<11172){
    const vowel=Math.floor(code%588/28),initial=Math.floor(code/588),coda=code%28;
    const groups=[['aa'],['ee'],['aa'],['ee'],['oh','aa'],['ee'],['oh','aa'],['ee'],['oh'],['aa','oh'],['ee','oh'],['ee','oh'],['oh'],['ou'],['oh','ou'],['ee','ou'],['ih','ou'],['ou'],['ih'],['ih'],['ih']];
    let weight=.64*Math.min(1,progress/.13)*Math.min(1,(1-progress)/.16);
    if([6,7,17].includes(initial)&&progress<.19)weight*=progress/.19;
    if([16,17,18].includes(coda)&&progress>.77)weight*=(1-progress)/.23;
    const targets=groups[vowel];for(const n of targets)ex?.setValue(n,weight/targets.length);
   }
  }
  ex?.setValue('happy',.08);
  const blink=(time+1.35)%4.3;ex?.setValue('blink',blink<.16?Math.sin(blink/.16*Math.PI):0);
  target.position.copy(camera.position);target.position.y=Math.max(camera.position.y,1.4);vrm.update(Math.min(dt,.033));
 }
 return{vrm,update,motion,hands,lip,meta:vrm.meta};
}
