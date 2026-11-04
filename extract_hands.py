"""Offline source-video hand capture. No network calls or preset gesture cycle."""
from pathlib import Path
import os,sys,json,math,argparse
BASE=Path(__file__).resolve().parent
os.environ.setdefault('MPLCONFIGDIR',str(BASE/'cache'))
deps=BASE/'deps'
if deps.exists():sys.path.insert(0,str(deps))
import cv2,numpy as np,mediapipe as mp
from scipy.ndimage import median_filter,gaussian_filter1d
from scipy.spatial.transform import Rotation,Slerp
from mediapipe.tasks.python import vision

def unit(a):return a/max(float(np.linalg.norm(a)),1e-8)
def angle(a,b):return math.degrees(math.acos(float(np.clip(np.dot(unit(a),unit(b)),-1,1))))
def world(points):return np.asarray([[p.x,-p.y,-p.z] for p in points],float)
def frame(forward,up):
    z=unit(forward);x=unit(np.cross(up,z));y=unit(np.cross(z,x))
    if np.linalg.norm(x)<.5:return None
    return np.stack([x,y,z],axis=1)

def curves(h):
    # Measured per-joint flexion, represented as normalized stretch channels.
    # Positive is a comfortably extended finger; negative curls toward the palm.
    p=h;values=[];palm=unit(p[9]-p[0]);normal=unit(np.cross(p[5]-p[0],p[17]-p[0]))
    curls=[]
    for finger,ids in enumerate([(1,2,3,4),(5,6,7,8),(9,10,11,12),(13,14,15,16),(17,18,19,20)]):
        a,b,c,d=ids
        if finger==0:
            bends=[angle(p[2]-p[0],p[3]-p[2]),angle(p[2]-p[1],p[3]-p[2]),angle(p[3]-p[2],p[4]-p[3])]
            stretch=[np.clip(.45-bends[0]/75*1.20,-.8,.55),np.clip(.65-bends[1]/85*1.45,-.9,.7),np.clip(.65-bends[2]/85*1.5,-.9,.7)]
            spread=0
        else:
            bends=[angle(p[a]-p[0],p[b]-p[a]),angle(p[b]-p[a],p[c]-p[b]),angle(p[c]-p[b],p[d]-p[c])]
            stretch=[np.clip(.68-bends[0]/95*1.63,-.95,.72),np.clip(.78-bends[1]/110*1.73,-.95,.8),np.clip(.72-bends[2]/85*1.67,-.95,.75)]
            reach=np.linalg.norm(p[d]-p[0])/max(np.linalg.norm(p[a]-p[0]),1e-6)
            closure=float(np.clip((1.42-reach)/.34,0,1));closure=closure*closure*(3-2*closure)
            # Fist tips overlap the palm in the source; monocular joint depth
            # often underestimates their bend. Couple the joints anatomically.
            stretch=[(1-closure)*value+closure*closed for value,closed in zip(stretch,[-.78,-.88,-.80])]
            proximal=unit(p[b]-p[a]);deviation=math.degrees(math.atan2(np.dot(np.cross(palm,proximal),normal),np.dot(palm,proximal)))
            spread=float(np.clip(deviation/70,-.28,.28));curls.append(float(np.mean(bends)))
        values.extend([float(x) for x in stretch]+[spread])
    # A folded thumb is expected when all four fingers are curled. Avoid a
    # sticking-out thumb from ambiguous foreshortening in a fist.
    closure=np.clip((np.mean(curls)-45)/35,0,1)
    values[0:3]=[(1-closure)*values[i]+closure*x for i,x in enumerate([-.55,-.62,-.55])]
    return values

def track(video,output,models,fps=15):
    hand_options=dict(base_options=mp.tasks.BaseOptions(model_asset_path=str(models/'hand_landmarker.task')),num_hands=2,min_hand_detection_confidence=.3,min_hand_presence_confidence=.3)
    hands=[vision.HandLandmarker.create_from_options(vision.HandLandmarkerOptions(**hand_options)) for _ in range(2)]
    pose=vision.PoseLandmarker.create_from_options(vision.PoseLandmarkerOptions(base_options=mp.tasks.BaseOptions(model_asset_path=str(models/'pose_landmarker_lite.task')),running_mode=vision.RunningMode.VIDEO,num_poses=1,min_pose_detection_confidence=.35,min_pose_presence_confidence=.35))
    cap=cv2.VideoCapture(str(video));source_fps=cap.get(cv2.CAP_PROP_FPS);total=int(cap.get(cv2.CAP_PROP_FRAME_COUNT));duration=total/source_fps
    count=math.ceil(duration*fps);raw=np.full((count,2,20),np.nan);rel=np.full((count,2,4),np.nan);conf=np.zeros((count,2));positions=np.full((count,2,2),np.nan);last_arm=[None,None];evidence=[]
    for i in range(count):
        cap.set(cv2.CAP_PROP_POS_FRAMES,round(i*source_fps/fps));ok,bgr=cap.read()
        if not ok:break
        rgb=cv2.cvtColor(bgr,cv2.COLOR_BGR2RGB);height,width=rgb.shape[:2]
        detected=pose.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB,data=rgb),round(i*1000/fps))
        if not detected.pose_landmarks:continue
        body=detected.pose_landmarks[0];body3=world(detected.pose_world_landmarks[0]);candidates=[]
        for side,(wi,el) in enumerate([(15,13),(16,14)]):
            q,e=body[wi],body[el];positions[i,side]=[q.x,q.y]
            if min(q.visibility,e.visibility)<.45:continue
            cx=(q.x+.18*(q.x-e.x))*width;cy=(q.y+.18*(q.y-e.y))*height
            shoulder_width=math.hypot((body[11].x-body[12].x)*width,(body[11].y-body[12].y)*height)
            size=int(np.clip(shoulder_width*.85,110,175));x=max(0,min(width-size,int(cx-size/2)));y=max(0,min(height-size,int(cy-size/2)))
            crop=np.ascontiguousarray(cv2.resize(rgb[y:y+size,x:x+size],(384,384)))
            result=hands[side].detect(mp.Image(image_format=mp.ImageFormat.SRGB,data=crop))
            for lm,wm,category in zip(result.hand_landmarks,result.hand_world_landmarks,result.handedness):
                points=np.asarray([[p.x*size+x,p.y*size+y] for p in lm]);wrist=points[0];dist=np.linalg.norm(wrist-np.array([q.x*width,q.y*height]))
                score=category[0].score
                if dist>size*.42 or score<.55:continue
                quality=float(score*math.exp(-dist*dist/(size*.35)**2))
                candidates.append((quality,side,points,world(wm),category[0].category_name))
        used=[]
        for quality,side,points,h,label in sorted(candidates,key=lambda row:-row[0]):
            if conf[i,side]>0 or any(np.linalg.norm(points[0]-prev)<16 for prev in used):continue
            # Wrong-handed duplicate detections around crossed wrists are held
            # through the gap rather than assigned to the other anatomical hand.
            expected='Left' if side==0 else 'Right'
            if label!=expected and quality<.75:continue
            raw[i,side]=curves(h);conf[i,side]=quality;used.append(points[0])
            sh,el,wi=(11,13,15) if side==0 else (12,14,16)
            fa=body3[wi]-body3[el];normal=np.cross(body3[el]-body3[sh],fa)
            if np.linalg.norm(normal)<.007 and last_arm[side] is not None:arm=last_arm[side]
            else:arm=frame(fa,normal)
            palm=frame(h[9]-h[0],np.cross(h[9]-h[0],h[5]-h[17]))
            if arm is not None and palm is not None:
                last_arm[side]=arm;rel[i,side]=Rotation.from_matrix(arm.T@palm).as_quat()
            if i%(fps*3)==0:evidence.append({'frame':i,'side':side,'quality':quality,'points':points.tolist()})
        if i%75==0:print('HAND TRACK',i,'/',count,flush=True)
    cap.release();pose.close()
    for hand in hands:hand.close()
    output_count=round(duration*30);times=np.arange(count)/fps;target=np.arange(output_count)/30;values=np.zeros((output_count,2,20));rotations=np.zeros((output_count,2,4));coverage=[]
    for side in range(2):
        valid=np.isfinite(raw[:,side,0]);coverage.append(float(valid.mean()));assert valid.sum()>fps,'Not enough source hand observations'
        # Fill only from neighboring source observations, never a timed gesture sequence.
        for c in range(20):
            filled=np.interp(times,times[valid],raw[valid,side,c]);filtered=gaussian_filter1d(median_filter(filled,size=3),.7)
            values[:,side,c]=np.interp(target,times,filtered)
        validq=np.isfinite(rel[:,side,0]);quats=rel[validq,side];qt=times[validq]
        for k in range(1,len(quats)):
            if np.dot(quats[k],quats[k-1])<0:quats[k]*=-1
        if len(quats)>1:rotations[:,side]=Slerp(qt,Rotation.from_quat(quats))(np.clip(target,qt[0],qt[-1])).as_quat()
        else:rotations[:,side,3]=1
        closed=np.clip((-.25-values[:,side,[4,8,12,16]].mean(axis=1))/.48,0,1)
        for k,value in enumerate([-.55,-.62,-.55]):values[:,side,k]=values[:,side,k]*(1-closed)+closed*value
        for finger in range(1,5):values[:,side,finger*4+3]*=1-.9*np.clip((-.2-values[:,side,finger*4])/.55,0,1)
        for f in range(1,output_count):
            if np.dot(rotations[f,side],rotations[f-1,side])<0:rotations[f,side]*=-1
        for c in range(4):rotations[:,side,c]=gaussian_filter1d(rotations[:,side,c],2)
        rotations[:,side]/=np.linalg.norm(rotations[:,side],axis=1)[:,None]
    channels=[side+'Hand.'+finger+'.'+joint for side in ['Left','Right'] for finger in ['Thumb','Index','Middle','Ring','Little'] for joint in ['1 Stretched','2 Stretched','3 Stretched','Spread']]
    result={'version':1,'method':'source_hand_landmarks_v19','fps':30,'frames':output_count,'source_fps':source_fps,'duration':duration,'channels':channels,'values':values.reshape(-1).round(5).tolist(),'palmRelative':rotations.reshape(-1).round(6).tolist(),'coverage':coverage,'source_samples':count,'valid_samples':[int((conf[:,s]>0).sum()) for s in range(2)],'gap_policy':'interpolate neighboring source observations; no invented gesture cycle','finger_anatomy':'tip-to-palm reach guides coupled flexion for foreshortened fists'}
    output.parent.mkdir(parents=True,exist_ok=True);output.write_text(json.dumps(result,separators=(',',':')))
    np.savez_compressed(output.with_suffix('.raw.npz'),raw=raw,relative=rel,confidence=conf,positions=positions)
    output.with_suffix('.evidence.json').write_text(json.dumps(evidence))
    print(json.dumps({k:result[k] for k in ['method','frames','coverage','valid_samples']}),flush=True)
    return result

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('video',type=Path);parser.add_argument('output',type=Path);parser.add_argument('--models',type=Path,default=BASE/'models');parser.add_argument('--fps',type=int,default=15);a=parser.parse_args();track(a.video,a.output,a.models,a.fps)
