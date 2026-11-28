#!/usr/bin/env python3
"""Create an MP4 from exact ECOSYSTEM LAB positions produced by record-ai2-preview.js.
Pure visualization; no simulation rules are changed or synthesized.
"""
import json
import math
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

DATA = Path('video-previews/ai2-source-frames.jsonl')
OUTPUT = Path('video-previews/ai2_real_simulation_preview.mp4')
W, H = 1280, 720
FPS = 15
WORLD_X, WORLD_Y, SCALE = 23, 84, 0.93
WORLD_W, WORLD_H = round(960*SCALE), round(600*SCALE)
SIDE_X = 940
FONT_PATH = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
def font(px, bold=False):
    boldpath = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
    return ImageFont.truetype(boldpath if bold else FONT_PATH, px)
F13=font(13);F15=font(15);F17=font(17);F21=font(21,True);F27=font(27,True);F36=font(36,True)
BG=(9,23,27);PANEL=(15,37,39);LINE=(58,84,79);MUTED=(157,187,177);LIGHT=(226,248,238)
frames=[]
with DATA.open() as f:
    for line in f:
        frames.append(json.loads(line))
assert len(frames)==360, len(frames)

def puttext(draw,xy,text,f=F17,fill=LIGHT):
    draw.text(xy,text,font=f,fill=fill)

def plot_sparkline(draw,history,key,x,y,w,h,maxv,color):
    draw.rounded_rectangle((x,y,x+w,y+h),radius=12,fill=(19,51,49))
    # horizontal grid: just two guide lines
    for ratio in [1/3,2/3]:
        gy=round(y+h-ratio*h)
        draw.line([(x+7,gy),(x+w-7,gy)],fill=(45,75,69),width=1)
    if len(history)<2:return
    points=[]
    for j,item in enumerate(history):
        v=item[key]
        xx=x+9+(w-18)*j/(len(frames)-1)
        yy=y+h-9-(h-18)*min(1,v/maxv)
        points.append((round(xx),round(yy)))
    if len(points)>=2:
        draw.line(points,fill=color,width=3,joint='curve')
        end=points[-1];draw.ellipse((end[0]-4,end[1]-4,end[0]+4,end[1]+4),fill=color)

def world(draw,row):
    x0,y0=WORLD_X,WORLD_Y
    draw.rounded_rectangle((x0-2,y0-2,x0+WORLD_W+2,y0+WORLD_H+2),
        radius=13,fill=(10,29,27),outline=(76,115,99),width=2)
    grass=row['vegetation']
    cellx=WORLD_W/32
    celly=WORLD_H/20
    for gy in range(20):
        for gx in range(32):
            v=grass[gy*32+gx]
            color=(int(14+11*v),int(39+39*v),int(30+21*v))
            ax=round(x0+gx*cellx);ay=round(y0+gy*celly)
            bx=round(x0+(gx+1)*cellx);by=round(y0+(gy+1)*celly)
            draw.rectangle((ax,ay,bx,by),fill=color)
            if v>.30:
                # Consistent deterministic grass tuft in each cell.
                tx=ax+3+((gx*19+gy*11)%20)*.83
                ty=ay+3+((gx*7+gy*31)%13)*1.0
                green=(int(40+32*v),int(101+84*v),int(51+29*v))
                draw.line([(tx-2,ty+2),(tx,ty-2),(tx+2,ty+2)],fill=green,width=1)
    # Animals are drawn from the real simulated positions, not synthetic paths.
    for px,py,ang,kind,energy in row['agents']:
        sx=x0+px*SCALE;sy=y0+py*SCALE
        dx=math.cos(ang);dy=math.sin(ang)
        if kind=='g':
            c=(116,226,150);head=(166,255,196);outline=(33,105,76);rad=5.4
        elif kind=='r':
            c=(243,118,102);head=(255,185,152);outline=(115,49,48);rad=6.7
        else:
            c=(107,170,246);head=(190,222,255);outline=(53,83,143);rad=7.2
        rr=rad
        # Avoid overly thick white glows when there are many creatures.
        draw.ellipse((sx-rr-1,sy-rr/1.7-1,sx+rr+1,sy+rr/1.7+1),fill=outline)
        draw.ellipse((sx-rr,sy-rr/1.8,sx+rr,sy+rr/1.8),fill=c)
        draw.ellipse((sx+dx*rr-2,sy+dy*rr-2,sx+dx*rr+2,sy+dy*rr+2),fill=head)
    draw.rounded_rectangle((x0+13,y0+12,x0+228,y0+44),radius=9,fill=(9,31,29))
    puttext(draw,(x0+26,y0+18),'SIMULATION / WORLD VIEW',F15,(203,248,218))

def frame_image(row,seen):
    im=Image.new('RGB',(W,H),BG)
    d=ImageDraw.Draw(im)
    d.rectangle((0,0,W,8),fill=(101,219,149))
    puttext(d,(24,19),'ECOSYSTEM LAB',F27,(206,255,225))
    puttext(d,(293,29),'AI2  /  HERITABLE FLOCK BEHAVIOR',F17,(167,218,198))
    puttext(d,(1030,29),'SEED 20261117',F17,(180,215,202))
    world(d,row)
    d.rounded_rectangle((SIDE_X,84,1263,643),radius=13,fill=PANEL,outline=(52,88,79),width=2)
    puttext(d,(SIDE_X+18,99),'EXPERIMENT / DAY',F15,(154,192,172))
    puttext(d,(SIDE_X+18,129),f"{row['day']:05.1f}  /  100",F36,(231,254,236))
    d.line([(SIDE_X+20,183),(1246,183)],fill=LINE,width=2)
    puttext(d,(SIDE_X+19,198),'GREEN  /  HERBIVORES',F15,(151,220,175))
    puttext(d,(SIDE_X+19,218),str(row['g']),F36,(123,233,155))
    puttext(d,(SIDE_X+167,198),'RED  /  PREDATORS',F15,(245,175,160))
    puttext(d,(SIDE_X+168,218),str(row['r']),F36,(252,145,127))
    puttext(d,(SIDE_X+20,273),'POPULATION TREND',F15,(193,225,210))
    maxg=max(200,max(x['g'] for x in frames))
    maxr=max(35,max(x['r'] for x in frames))
    plot_sparkline(d,seen,'g',SIDE_X+19,301,286,91,maxg,(121,231,159))
    plot_sparkline(d,seen,'r',SIDE_X+19,404,286,71,maxr,(251,137,111))
    d.ellipse((SIDE_X+20,488,SIDE_X+31,499),fill=(121,231,159))
    puttext(d,(SIDE_X+37,484),'GREEN',F13,MUTED)
    d.ellipse((SIDE_X+132,488,SIDE_X+143,499),fill=(251,137,111))
    puttext(d,(SIDE_X+149,484),'RED',F13,MUTED)
    d.line([(SIDE_X+20,517),(1247,517)],fill=LINE,width=1)
    puttext(d,(SIDE_X+19,534),'GRASS COVER',F15,(169,198,179))
    puttext(d,(SIDE_X+205,529),f"{row['grass']:.1f}%",F21,(233,243,195))
    puttext(d,(SIDE_X+19,572),'MEAN GREEN GENERATION',F15,(169,198,179))
    puttext(d,(SIDE_X+223,565),f"{row['gen']:.1f}",F21,(211,213,253))
    puttext(d,(24,672),'Accelerated recording of the original simulation (DAY 0–100)',F17,(197,225,210))
    d.rounded_rectangle((24,702,1256,708),radius=3,fill=(44,79,71))
    progress=max(0,min(1,row['day']/100))
    if progress:
        d.rounded_rectangle((24,702,24+1232*progress,708),radius=3,fill=(112,228,160))
    puttext(d,(1094,670),'VIDEO PREVIEW',F15,(158,204,186))
    return im

OUTPUT.parent.mkdir(parents=True,exist_ok=True)
cmd=['ffmpeg','-y','-hide_banner','-loglevel','error','-f','rawvideo','-pix_fmt','rgb24',
     '-s',f'{W}x{H}','-r',str(FPS),'-i','pipe:0',
     '-c:v','libx264','-preset','veryfast','-crf','22',
     '-pix_fmt','yuv420p','-movflags','+faststart',str(OUTPUT)]
with subprocess.Popen(cmd,stdin=subprocess.PIPE) as p:
    for i,row in enumerate(frames):
        image=frame_image(row,frames[:i+1])
        p.stdin.write(image.tobytes())
        if i%60==0:print('RENDER',i,'/',len(frames),flush=True)
    p.stdin.close()
    return_code=p.wait()
    if return_code:raise RuntimeError(f'ffmpeg failed {return_code}')
print('VIDEO_RENDERED',str(OUTPUT),OUTPUT.stat().st_size,flush=True)
