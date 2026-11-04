"""Extract source-video joints without proprietary body-model assets.
Dependency: mediapipe (Apache-2.0), opencv-python-headless, numpy, scipy.
Model: pose_landmarker_full/float16/1, published by Google under Apache-2.0.
"""
from pathlib import Path
import argparse,sys,json,math
p=argparse.ArgumentParser();p.add_argument('video',type=Path);p.add_argument('output',type=Path);p.add_argument('--model',type=Path,required=True);p.add_argument('--deps',type=Path);args=p.parse_args()
if args.deps:sys.path.insert(0,str(args.deps.resolve()))
import numpy as np,cv2,mediapipe as mp
from mediapipe.tasks.python import vision
from scipy.ndimage import gaussian_filter1d,median_filter
cap=cv2.VideoCapture(str(args.video));fps=cap.get(cv2.CAP_PROP_FPS);frames=int(cap.get(cv2.CAP_PROP_FRAME_COUNT));duration=frames/fps
raw=np.full((frames,33,3),np.nan);screen=np.full((frames,33,3),np.nan);visibility=np.zeros((frames,33));valid=[]
options=vision.PoseLandmarkerOptions(base_options=mp.tasks.BaseOptions(model_asset_path=str(args.model)),running_mode=vision.RunningMode.VIDEO,num_poses=1,min_pose_detection_confidence=.4,min_pose_presence_confidence=.4,min_tracking_confidence=.45)
with vision.PoseLandmarker.create_from_options(options) as pose:
 for i in range(frames):
  ok,bgr=cap.read()
  if not ok:break
  rgb=cv2.cvtColor(bgr,cv2.COLOR_BGR2RGB);result=pose.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB,data=rgb),round(i*1000/fps))
  if result.pose_world_landmarks:
   raw[i]=[[q.x,-q.y,-q.z]for q in result.pose_world_landmarks[0]];screen[i]=[[q.x,q.y,q.z]for q in result.pose_landmarks[0]];visibility[i]=[q.visibility for q in result.pose_landmarks[0]];valid.append(i)
  if i%150==0:print('POSE',i,'/',frames,flush=True)
cap.release()
assert len(valid)>frames*.85,'Too many missing poses'
filled=raw.copy();image=screen.copy();times=np.arange(frames)
for j in range(33):
 for k in range(3):
  filled[:,j,k]=np.interp(times,valid,raw[valid,j,k]);image[:,j,k]=np.interp(times,valid,screen[valid,j,k])
# Median removes single-frame outliers; a short symmetric filter avoids temporal lag.
filled=gaussian_filter1d(median_filter(filled,size=(3,1,1)),.8,axis=0);image=gaussian_filter1d(image,.65,axis=0)
root=(filled[:,23]+filled[:,24])*.5;filled-=root[:,None,:]
result={'schema':'pose-landmarks-v1','fps':fps,'frames':frames,'duration':duration,'method':'MediaPipe Pose Landmarker Full float16 v1','coordinates':'x right, y up, z toward camera; root centered between hips','model_url':'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task','model_license':'Apache-2.0','model_license_confirmation':'https://github.com/google-ai-edge/mediapipe/issues/6306','detection_coverage':len(valid)/frames,'positions':filled.round(5).reshape(-1).tolist(),'image':image.round(5).reshape(-1).tolist(),'visibility':visibility.round(3).reshape(-1).tolist()}
args.output.write_text(json.dumps(result,separators=(',',':')));print({k:result[k]for k in ['method','fps','frames','duration','detection_coverage']},flush=True)
