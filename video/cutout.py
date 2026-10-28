# The presenter cut out over the platform screens (reel 6): bottom-centred, scaled, soft shadow, rising in at the start
# of each screen. Writes cutout.mov (ProRes 4444 with alpha), transparent elsewhere.
#   mask-raw.mp4 (video/personmask.swift, Apple Vision, raw) → per frame: median of the previous, current and next mask
#   (no flicker and no lag behind the hands) → guided filter on the real frame (edges follow the hair and fingers)
#   → slight choke + green despill on the edge (grass behind).
import cv2, subprocess, numpy as np
SCREENS=[(0,5.02),(7.6,15.2),(19.74,21.9)]
S=0.68; fps=30; W,H=1080,1920; sw,sh=int(W*S),int(H*S)

def guided(I, p, r, eps):
    mI=cv2.boxFilter(I,-1,(r,r)); mp=cv2.boxFilter(p,-1,(r,r))
    cov=cv2.boxFilter(I*p,-1,(r,r))-mI*mp; var=cv2.boxFilter(I*I,-1,(r,r))-mI*mI
    a=cov/(var+eps); b=mp-a*mI
    return cv2.boxFilter(a,-1,(r,r))*I+cv2.boxFilter(b,-1,(r,r))

v=cv2.VideoCapture("cut2.mov"); m=cv2.VideoCapture("mask-raw.mp4")
frames=[];masks=[]
while True:
    ok,f=v.read(); ok2,mk=m.read()
    if not ok: break
    frames.append(f); masks.append(cv2.cvtColor(mk,cv2.COLOR_BGR2GRAY) if ok2 else masks[-1])
n=len(frames)
ff=subprocess.Popen(["ffmpeg","-v","error","-y","-f","rawvideo","-pix_fmt","bgra","-s","1080x1920","-r","30","-i","-","-c:v","prores_ks","-profile:v","4444","-pix_fmt","yuva444p10le","cutout.mov"],stdin=subprocess.PIPE)
empty=np.zeros((H,W,4),np.uint8)
def ease(x): x=max(0,min(1,x)); return 1-(1-x)**3
for i in range(n):
    t=i/fps; r=next(((a,b) for a,b in SCREENS if a<=t<b),None)
    if not r: ff.stdin.write(empty.tobytes()); continue
    k=ease((t-r[0])/0.3)
    if t>r[1]-0.2: k*=1-ease((t-(r[1]-0.2))/0.2)
    off=int((1-k)*500)
    f=frames[i]
    mm=np.median(np.stack([masks[max(0,i-1)],masks[i],masks[min(n-1,i+1)]]),axis=0).astype(np.float32)/255
    # guided filter at half resolution, guided by the frame itself
    g=cv2.cvtColor(cv2.resize(f,(540,960),interpolation=cv2.INTER_AREA),cv2.COLOR_BGR2GRAY).astype(np.float32)/255
    a=guided(g,cv2.resize(mm,(540,960),interpolation=cv2.INTER_AREA),9,2e-4)
    a=cv2.resize(np.clip(a,0,1),(W,H),interpolation=cv2.INTER_LINEAR)
    a=np.clip((a-0.25)/0.55,0,1)
    a=cv2.erode(a,np.ones((3,3),np.uint8))
    ff_=f.astype(np.float32); edge=a<0.98
    ff_[...,1]=np.where(edge,np.minimum(ff_[...,1],(ff_[...,0]+ff_[...,2])/2+6),ff_[...,1])
    fs=cv2.resize(ff_,(sw,sh),interpolation=cv2.INTER_AREA); as_=cv2.resize(a,(sw,sh),interpolation=cv2.INTER_AREA)
    x0=(W-sw)//2; y0=H-sh+off
    out=np.zeros((H,W,4),np.float32)
    sha=np.zeros((H,W),np.float32); ys=max(0,y0+18); h=min(H,y0+18+sh)-ys
    if h>0: sha[ys:ys+h,x0:x0+sw]=as_[:h]
    out[...,3]=cv2.GaussianBlur(sha,(0,0),22)*0.65*255
    ys=max(0,y0); h=min(H,y0+sh)-ys
    if h>0:
        al=as_[:h][...,None]; reg=out[ys:ys+h,x0:x0+sw]
        reg[...,:3]=fs[:h]*al+reg[...,:3]*(1-al)
        reg[...,3]=np.maximum(reg[...,3],al[...,0]*255)
    ff.stdin.write(np.clip(out,0,255).astype(np.uint8).tobytes())
ff.stdin.close(); ff.wait(); print(n,"frames")
