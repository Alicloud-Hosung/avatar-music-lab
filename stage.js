import * as THREE from 'three';
export const THEMES={
 afterglow:{title:'HANGANG / BLUE HOUR',name:'한강',background:0x1d334e,accent:0xffb684,secondary:0x90b5d3,light:0xffefdb},
 midnight:{title:'HANGANG / NIGHT SESSION',name:'네온',background:0x13203a,accent:0xb3bfff,secondary:0x8bcac9,light:0xeaf1ff},
 daylight:{title:'STUDIO / SOFT LIGHT',name:'스튜디오',background:0xd6dbd3,accent:0xe7ae80,secondary:0xadc3ac,light:0xfff3e3}
};
export function createStage(canvas){
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.10;
 const scene=new THREE.Scene();scene.background=new THREE.Color(0x1d334e);
 const camera=new THREE.PerspectiveCamera(34,1,.05,100);camera.position.set(.22,1.17,3.7);
 scene.add(new THREE.HemisphereLight(0xdbe9f1,0x73716a,1.0));
 const key=new THREE.DirectionalLight(0xffefdb,1.65);key.position.set(2.5,4,4);key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-3,right:3,top:4,bottom:-3});key.shadow.bias=-.0002;key.shadow.normalBias=.012;scene.add(key);
 const fill=new THREE.DirectionalLight(0xe3eaf1,.90);fill.position.set(-3,2.5,3);scene.add(fill);
 const rim=new THREE.DirectionalLight(0xd3defd,1.65);rim.position.set(-1.5,3,-2.5);scene.add(rim);
 // A small procedural studio environment provides soft reflections without external HDR assets.
 const environmentScene=new THREE.Scene();environmentScene.background=new THREE.Color(0x333c49);
 const panel=new THREE.Mesh(new THREE.BoxGeometry(8,4,.1),new THREE.MeshBasicMaterial({color:0xe8e8e2}));panel.position.set(0,2,5);environmentScene.add(panel);
 const ceiling=new THREE.Mesh(new THREE.BoxGeometry(10,.1,10),new THREE.MeshBasicMaterial({color:0xa6b4bb}));ceiling.position.y=5;environmentScene.add(ceiling);
 const pmrem=new THREE.PMREMGenerator(renderer),environment=pmrem.fromScene(environmentScene,.06);scene.environment=environment.texture;scene.environmentIntensity=.45;pmrem.dispose();
 const mat=(color,roughness=.65,metalness=.03)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
 const add=(g,m,x=0,y=0,z=0)=>{const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;scene.add(o);return o;};
 const floorMat=mat(0x6b7476,.67,.08),ground=add(new THREE.PlaneGeometry(35,35),floorMat,0,-.014,0);ground.rotation.x=-Math.PI/2;
 // Subtle paving seams establish physical depth and an unambiguous contact plane.
 const seamMat=new THREE.MeshBasicMaterial({color:0x586267});
 for(let i=-12;i<=12;i++){
  const line=add(new THREE.PlaneGeometry(.006,28),seamMat,i*.8,-.012,0);line.rotation.x=-Math.PI/2;line.castShadow=false;line.receiveShadow=false;
  const cross=add(new THREE.PlaneGeometry(28,.006),seamMat,0,-.011,i*.8);cross.rotation.x=-Math.PI/2;cross.castShadow=false;cross.receiveShadow=false;
 }
 const texture=new THREE.TextureLoader().load('./city-backdrop.png');texture.colorSpace=THREE.SRGBColorSpace;
 const backdrop=add(new THREE.PlaneGeometry(24,12),new THREE.MeshBasicMaterial({map:texture,color:0xdce6ed}),0,1.25,-11);backdrop.castShadow=false;backdrop.receiveShadow=false;
 // The photograph is the distant backdrop; railing, deck, shadows and fixtures are 3D.
 const railMat=mat(0x747d7e,.36,.75),glassMat=new THREE.MeshPhysicalMaterial({color:0xc3d5dc,transparent:true,opacity:.07,roughness:.18,metalness:0,side:THREE.DoubleSide,depthWrite:false});
 const glass=add(new THREE.PlaneGeometry(15,.64),glassMat,0,.43,-3.15);glass.castShadow=false;glass.receiveShadow=false;
 add(new THREE.CylinderGeometry(.012,.012,15,10),railMat,0,.78,-3.15).rotation.z=Math.PI/2;
 for(let i=-7;i<=7;i+=2)add(new THREE.CylinderGeometry(.012,.012,.83,10),railMat,i,.40,-3.15);
 const ledMat=new THREE.MeshBasicMaterial({color:0xffc49a}),leds=[];
 for(const side of [-1,1]){
  const line=add(new THREE.BoxGeometry(.018,.012,5.0),ledMat,side*2.2,-.001,.05);line.castShadow=false;line.receiveShadow=false;
  for(let i=0;i<3;i++){
   const x=side*(2.7+i*.5),z=-1.5-i*.48;
   const body=add(new THREE.BoxGeometry(.11,.12,.18),mat(0x252e39,.5,.3),x,.05,z);body.rotation.x=-.25;
   const bulb=add(new THREE.PlaneGeometry(.06,.055),ledMat,x,.114,z+.075);bulb.rotation.x=-Math.PI*.37;bulb.castShadow=false;leds.push(bulb);
  }
 }
 let theme='afterglow';
 function setTheme(name){theme=name in THEMES?name:'afterglow';const t=THEMES[theme];scene.background.set(t.background);ledMat.color.set(t.accent);key.color.set(t.light);rim.color.set(t.secondary);backdrop.visible=theme!=='daylight';glass.visible=theme!=='daylight';floorMat.color.set(theme==='daylight'?0xa4aaa2:0x6b7476);scene.environmentIntensity=theme==='daylight'?.6:.45;}
 const look=new THREE.Vector3();
 function update(time,energy,mode='director'){
  let shot='WIDE',x=.20,y=1.16,z=3.85,target=.92;
  if(mode==='portrait'){x=.18;y=1.46;z=2.45;target=1.28;shot='PORTRAIT';}
  else if(mode==='director'&&time>.001){const progress=(1-Math.cos(time/24*Math.PI*2))*.5;x=Math.sin(time*.12)*.68;z=4.10-progress*.92;y=1.15+progress*.20;target=.91+progress*.18;shot=progress>.68?'MEDIUM':Math.abs(x)>.45?'ARC':'WIDE';}
  camera.position.set(x,y,z);look.set(0,target,0);camera.lookAt(look);leds.forEach(l=>{l.scale.setScalar(1+energy*.035);});return shot;
 }
 function resize(){const b=canvas.getBoundingClientRect();renderer.setSize(b.width,b.height,false);camera.aspect=b.width/Math.max(1,b.height);camera.updateProjectionMatrix();}
 const observer=new ResizeObserver(resize);observer.observe(canvas.parentElement);resize();
 return{scene,camera,renderer,update,setTheme,resize,dispose:()=>{observer.disconnect();environment.dispose();}};
}
