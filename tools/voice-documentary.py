#!/usr/bin/env python3
import json, time, os, pathlib, subprocess
from gtts import gTTS

root=pathlib.Path('video-production')
scenes=json.loads((root/'narration.json').read_text())['scenes']
out=root/'voice'
out.mkdir(exist_ok=True)
audios=[]
for row in scenes:
    file=out/f"scene_{row['id']:02d}.mp3"
    for attempt in range(4):
        try:
            gTTS(text=row['text'],lang='ja',slow=False,tld='co.jp').save(str(file))
            break
        except Exception as e:
            print('TTS retry',row['id'],attempt,repr(e),flush=True)
            if attempt>=3:raise
            time.sleep(2+attempt)
    p=subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',str(file)],capture_output=True,text=True)
    duration=float(p.stdout.strip()) if p.returncode==0 else None
    audios.append({'id':row['id'],'path':file.name,'duration':duration,'title':row['title']})
    print('TTS',row['id'],file.stat().st_size,'duration',duration,flush=True)
(root/'voice-manifest.json').write_text(json.dumps(audios,ensure_ascii=False,indent=2))
print('AUDIO_TOTAL_DURATION',sum(r['duration'] for r in audios if r['duration'] is not None))
