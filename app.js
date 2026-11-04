import {createStage,THEMES} from './stage.js?v=terrace8';
import {loadPerformer} from './performer.js?v=rig8';
import {createComparison} from './comparison.js';
const $=s=>document.querySelector(s);
const audio=$('#song'),canvas=$('#stage');
const play=$('#play'),seek=$('#seek');
let comparison,performer,stage,analysisData,context,analyser,source,destination,playing=false,theme='afterglow',cameraMode='director',last=performance.now(),recorder=null,recordChunks=[],currentEnergy=0;
let duration=45,freezeTime=0,exportView=null;
const fmt=t=>`${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`;
let toastTimeout;
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>$('#toast').classList.remove('visible'),3400);}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),15000);}
function setPlaying(on){playing=on;$('#play-icon').textContent=on?'Ⅱ':'▶';$('#play-text').textContent=on?'일시 정지':'재생';play.setAttribute('aria-label',on?'공연 일시 정지':'공연 재생');$('#play-comparison').textContent=on?'세 장면 일시 정지 Ⅱ':'세 장면 함께 재생 ▶';}
async function ensureAudio(){
  if(!context){context=new AudioContext();source=context.createMediaElementSource(audio);analyser=context.createAnalyser();analyser.fftSize=256;source.connect(analyser);analyser.connect(context.destination);destination=context.createMediaStreamDestination();source.connect(destination);}
  await context.resume();
}
async function start(){
  try{await ensureAudio();if(audio.currentTime>=duration-.04)audio.currentTime=0;await audio.play();setPlaying(true);}
  catch{toast('음악을 재생할 수 없습니다. 페이지를 새로 열어 다시 시도해주세요.');setPlaying(false);}
}
$('#play-comparison').addEventListener('click',()=>{if(playing){audio.pause();setPlaying(false);}else start();});
play.addEventListener('click',()=>{if(playing){audio.pause();setPlaying(false);}else start();});
audio.addEventListener('pause',()=>setPlaying(false));audio.addEventListener('ended',()=>finish());
audio.addEventListener('loadedmetadata',()=>{duration=Math.min(audio.duration,analysisData?.duration||45);seek.max=String(duration);$('#duration').textContent=fmt(duration);});
audio.addEventListener('error',()=>{$('#export-status').textContent='음원을 불러오지 못했습니다. 연결을 확인해주세요.';play.disabled=true;});
seek.addEventListener('input',()=>{audio.currentTime=Number(seek.value);freezeTime=audio.currentTime;$('#current-time').textContent=fmt(audio.currentTime);});
$('#mute').addEventListener('click',()=>{audio.muted=!audio.muted;$('#mute').textContent=audio.muted?'음소거':'소리 켜짐';$('#mute').setAttribute('aria-pressed',String(audio.muted));$('#mute').setAttribute('aria-label',audio.muted?'소리 켜기':'음소거');});
function selectTheme(value){theme=value;stage?.setTheme(value);$('#stage-label').textContent=THEMES[value].title;document.querySelectorAll('[data-scene]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.scene===value)));}
function selectCamera(value){cameraMode=value;document.querySelectorAll('[data-camera]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.camera===value)));}
function updateDirectionResult(){const cameras={director:'자동 카메라',wide:'전신 카메라',portrait:'포트레이트 카메라'};$('#direction-result').textContent=`${THEMES[theme].name} 무대 / ${cameras[cameraMode]}`;}
document.querySelectorAll('[data-scene]').forEach(b=>b.addEventListener('click',()=>{selectTheme(b.dataset.scene);updateDirectionResult();}));
document.querySelectorAll('[data-camera]').forEach(b=>b.addEventListener('click',()=>{selectCamera(b.dataset.camera);updateDirectionResult();}));
$('#apply-direction').addEventListener('click',()=>{
  const prompt=$('#direction').value.trim();if(!prompt){toast('원하는 장소나 색, 카메라를 적어주세요.');return;}
  let recognized=false;
  if(/네온|밤|야간|보라|파랑|neon|night|blue|purple/i.test(prompt)){selectTheme('midnight');recognized=true;}
  else if(/스튜디오|실내|낮|햇살|하얀|흰|데이라이트|daylight|white|green|초록|studio/i.test(prompt)){selectTheme('daylight');recognized=true;}
  else if(/한강|야경|노을|오렌지|주황|따뜻|sunset|orange|warm|hangang/i.test(prompt)){selectTheme('afterglow');recognized=true;}
  if(/가까.*전신|전신.*가까|자동|돌|이동|무빙|움직|넓어|automatic|orbit|move/i.test(prompt)){selectCamera('director');recognized=true;}
  else if(/얼굴|상반신|포트레이트|클로즈|close|portrait/i.test(prompt)){selectCamera('portrait');recognized=true;}
  else if(/전신|고정|full|wide|fixed/i.test(prompt)){selectCamera('wide');recognized=true;}
  updateDirectionResult();toast(recognized?'무대 연출을 적용했습니다.':'현재는 한강, 네온, 스튜디오와 카메라 연출을 인식합니다.');
});
$('#snapshot').addEventListener('click',()=>{stage.renderer.render(stage.scene,stage.camera);canvas.toBlob(b=>{if(b)download(b,'first-light-stage.png');},'image/png');});
function setExportBusy(on){if(on){const shell=$('#stage-shell');exportView={height:shell.style.height,minHeight:shell.style.minHeight,ratio:stage.renderer.getPixelRatio()};shell.style.minHeight='0';shell.style.height=(shell.clientWidth*16/9+.05)+'px';stage.renderer.setPixelRatio(1080/Math.max(1,shell.clientWidth));stage.resize();}else if(exportView){const shell=$('#stage-shell');shell.style.height=exportView.height;shell.style.minHeight=exportView.minHeight;stage.renderer.setPixelRatio(exportView.ratio);stage.resize();exportView=null;}$('#export-video').textContent=on?'녹화 중지 후 저장':'공연 영상 저장 ↓';seek.disabled=on;document.querySelectorAll('[data-scene],[data-camera],#apply-direction').forEach(b=>b.disabled=on);}
function finish(){audio.pause();setPlaying(false);if(recorder?.state==='recording')recorder.stop();}
$('#export-video').addEventListener('click',async()=>{
  if(recorder?.state==='recording'){finish();return;}
  if(!window.MediaRecorder||!canvas.captureStream){toast('이 브라우저에서는 영상 저장을 지원하지 않습니다. Chrome 또는 Edge에서 열어주세요.');return;}
  try{
    await ensureAudio();audio.pause();audio.currentTime=0;audio.muted=false;
    $('#mute').textContent='소리 켜짐';$('#mute').setAttribute('aria-pressed','false');$('#mute').setAttribute('aria-label','음소거');
    setExportBusy(true);stage.renderer.render(stage.scene,stage.camera);
    const stream=canvas.captureStream(30);for(const track of destination.stream.getAudioTracks())stream.addTrack(track);
    const mime=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(x=>MediaRecorder.isTypeSupported(x));
    if(!mime)throw new Error('No supported WebM codec');
    recordChunks=[];recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:6000000});
    recorder.ondataavailable=e=>{if(e.data.size)recordChunks.push(e.data);};
    recorder.onstop=()=>{const blob=new Blob(recordChunks,{type:mime});download(blob,'first-light-performance.webm');for(const t of stream.getVideoTracks())t.stop();setExportBusy(false);$('#export-status').textContent='공연 영상을 저장했습니다. 브라우저의 다운로드 목록을 확인해주세요.';recorder=null;};
    recorder.onerror=()=>{finish();setExportBusy(false);$('#export-status').textContent='녹화 중 오류가 발생했습니다. 다시 시도해주세요.';};
    recorder.start(1000);await start();
    if(!playing){recorder.stop();$('#export-status').textContent='음악 재생에 실패해 녹화를 중단했습니다.';}
  }catch{setExportBusy(false);toast('영상 저장을 시작하지 못했습니다. Chrome 또는 Edge에서 다시 시도해주세요.');}
});
function envelope(t){
  if(analysisData?.energy?.length){const i=Math.min(analysisData.energy.length-1,Math.max(0,Math.floor(t*analysisData.fps)));return analysisData.energy[i]||0;}
  return 0;
}
function animate(now){
  requestAnimationFrame(animate);const dt=Math.min((now-last)/1000,.05);last=now;
  const t=audio.currentTime||0;if(playing)freezeTime=t;
  currentEnergy=envelope(t);
  const shot=stage.update(t,currentEnergy,cameraMode,playing);
  performer?.update(t,dt,{bpm:analysisData?.bpm||118,energy:currentEnergy},stage.camera,{playing});
  stage.renderer.render(stage.scene,stage.camera);
  if(performer&&!exportView)comparison?.update(t,performer,playing);
  $('#comparison-time').textContent=fmt(t)+' / '+fmt(duration);
  $('#shot-label').textContent=`01 — ${shot}`;
  if(playing){seek.value=String(t);$('#current-time').textContent=fmt(t);}
  if(recorder?.state==='recording')$('#export-status').textContent=`녹화 중 ${fmt(t)} / ${fmt(duration)} — 이 탭을 유지해주세요.`;
  if(playing&&t>=duration-.02)finish();
}
async function boot(){
  try{
    stage=createStage(canvas);requestAnimationFrame(animate);
    const data=fetch('./audio-analysis.json').then(r=>{if(!r.ok)throw new Error('analysis');return r.json();}).catch(()=>null);
    performer=await loadPerformer(stage.scene,percent=>{if(percent)$('#loading').lastChild.textContent=`3D 가수를 불러오는 중 ${percent}%`;});
    analysisData=await data;if(analysisData){duration=Math.min(audio.duration||45,analysisData.duration);seek.max=String(duration);$('#duration').textContent=fmt(duration);}
    comparison=createComparison($('#pose-preview'),$('#avatar-preview'),stage);
    $('#loading').hidden=true;$('#render-status').textContent='VRM / AUDIO TIMELINE';play.disabled=!!audio.error;$('#play-comparison').disabled=!!audio.error;selectTheme(theme);
  }catch(e){console.error('Stage initialization failed:',e.message);$('#loading').textContent='3D 무대를 불러오지 못했습니다. WebGL을 지원하는 브라우저에서 다시 열어주세요.';$('#render-status').textContent='로딩 실패';}
}
boot();
