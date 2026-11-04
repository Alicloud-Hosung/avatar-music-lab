import * as THREE from 'three';
import {sampleJoints} from './performer.js?v=male3';
const EDGES=[[11,12],[11,23],[12,24],[23,24],[11,13],[13,15],[15,17],[15,19],[12,14],[14,16],[16,18],[16,20],[23,25],[25,27],[27,29],[29,31],[24,26],[26,28],[28,30],[30,32],[7,8],[7,11],[8,12]];
export function createComparison(poseCanvas,avatarCanvas,stage){
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x16242d);
  const camera=new THREE.PerspectiveCamera(36,1,.05,30);camera.position.set(.15,1.2,3.3);camera.lookAt(0,.86,0);
  const renderer=new THREE.WebGLRenderer({canvas:poseCanvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(EDGES.length*6),3));
  const lines=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:0x9cd0b8}));scene.add(lines);
  const balls=[];const bm=new THREE.MeshBasicMaterial({color:0xf9c38c});
  for(let i=0;i<33;i++){const b=new THREE.Mesh(new THREE.SphereGeometry(i<11?.009:.014,8,6),bm);balls.push(b);scene.add(b);}
  const grid=new THREE.GridHelper(5,20,0x384d55,0x293b42);scene.add(grid);
  const avatarRenderer=new THREE.WebGLRenderer({canvas:avatarCanvas,antialias:true});avatarRenderer.setPixelRatio(Math.min(devicePixelRatio,1.5));avatarRenderer.outputColorSpace=THREE.SRGBColorSpace;avatarRenderer.toneMapping=THREE.ACESFilmicToneMapping;avatarRenderer.toneMappingExposure=1;avatarRenderer.shadowMap.enabled=true;avatarRenderer.shadowMap.type=THREE.PCFShadowMap;
  const avatarCamera=new THREE.PerspectiveCamera(34,1,.05,50);avatarCamera.position.set(.12,1.1,3.3);avatarCamera.lookAt(0,.85,0);
  const video=document.querySelector('#source-video');
  const resize=()=>{for(const [c,r,cam]of [[poseCanvas,renderer,camera],[avatarCanvas,avatarRenderer,avatarCamera]]){const box=c.getBoundingClientRect();r.setSize(box.width,box.height,false);cam.aspect=box.width/box.height;cam.updateProjectionMatrix();}};
  const observer=new ResizeObserver(resize);observer.observe(poseCanvas);observer.observe(avatarCanvas);resize();
  let videoPlaying=false;
  function update(t,performer,playing){
    const p=sampleJoints(performer.motion,t),footY=Math.min(p[27].y,p[28].y);
    const scale=1.0;for(let i=0;i<33;i++){balls[i].position.copy(p[i]).multiplyScalar(scale);balls[i].position.y-=footY;}
    const positions=geometry.attributes.position;
    for(let i=0;i<EDGES.length;i++){const [a,b]=EDGES[i];positions.setXYZ(i*2,...balls[a].position.toArray());positions.setXYZ(i*2+1,...balls[b].position.toArray());}positions.needsUpdate=true;
    renderer.render(scene,camera);avatarRenderer.render(stage.scene,avatarCamera);
    if(video.readyState>=2&&Math.abs(video.currentTime-t)>.18)video.currentTime=Math.min(t,video.duration||45);
    if(playing&&!videoPlaying){videoPlaying=true;video.play().catch(()=>{videoPlaying=false;});}
    if(!playing&&videoPlaying){video.pause();videoPlaying=false;}
  }
  return{update};
}
