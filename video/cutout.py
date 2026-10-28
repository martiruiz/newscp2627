# The presenter cut out (mask.mp4 from video/personmask.swift) over the platform screens: bottom-centred, scaled,
# soft shadow, rising in at the start of each screen. Writes cutout.mov (ProRes 4444 with alpha), transparent elsewhere.
import cv2, subprocess, numpy as np
SCREENS=[(0,5.02),(7.6,15.2),(19.74,21.9)]
S=0.68; fps=30
v=cv2.VideoCapture("cut2.mov"); m=cv2.VideoCapture("mask.mp4")
W,H=1080,1920; sw,sh=int(W*S),int(H*S)
ff=subprocess.Popen(["ffmpeg","-v","error","-y","-f","rawvideo","-pix_fmt","bgra","-s","1080x1920","-r","30","-i","-","-c:v","prores_ks","-profile:v","4444","-pix_fmt","yuva444p10le","cutout.mov"],stdin=subprocess.PIPE)
empty=np.zeros((H,W,4),np.uint8); i=0
def ease(x): x=max(0,min(1,x)); return 1-(1-x)**3
while True:
    ok,f=v.read(); ok2,mk=m.read()
    if not ok: break
    t=i/fps; r=next(((a,b) for a,b in SCREENS if a<=t<b),None)
    if not r: ff.stdin.write(empty.tobytes()); i+=1; continue
    k=ease((t-r[0])/0.3)*(1-ease((t-(r[1]-0.2))/0.2)) if t>r[1]-0.2 else ease((t-r[0])/0.3)
    off=int((1-k)*500)
    a=cv2.cvtColor(mk,cv2.COLOR_BGR2GRAY).astype(np.float32)/255
    a=cv2.erode(a,np.ones((7,7),np.uint8)); a=cv2.GaussianBlur(a,(0,0),1.6); a=np.clip((a-0.3)/0.6,0,1)
    # despill: on the soft edge, no channel greener than the mean of red and blue (grass behind)
    edge=(a<0.98)[...,None]; f=f.astype(np.float32); g=np.minimum(f[...,1],(f[...,0]+f[...,2])/2+6)
    f[...,1]=np.where(edge[...,0],g,f[...,1]); f=f.astype(np.uint8)
    fs=cv2.resize(f,(sw,sh),interpolation=cv2.INTER_AREA); as_=cv2.resize(a,(sw,sh),interpolation=cv2.INTER_AREA)
    x0=(W-sw)//2; y0=H-sh+off
    out=np.zeros((H,W,4),np.float32)
    # shadow: blurred silhouette, a bit lower
    sh_a=np.zeros((H,W),np.float32)
    ys=max(0,y0+18); h=min(H,y0+18+sh)-ys
    if h>0: sh_a[ys:ys+h,x0:x0+sw]=as_[:h]
    sh_a=cv2.GaussianBlur(sh_a,(0,0),22)*0.65
    out[...,3]=sh_a*255
    ys=max(0,y0); h=min(H,y0+sh)-ys
    if h>0:
        al=as_[:h][...,None]; reg=out[ys:ys+h,x0:x0+sw]
        reg[...,:3]=fs[:h]*al+reg[...,:3]*(1-al)
        reg[...,3]=np.maximum(reg[...,3],al[...,0]*255)
    ff.stdin.write(np.clip(out,0,255).astype(np.uint8).tobytes()); i+=1
ff.stdin.close(); ff.wait(); print(i,"frames")
