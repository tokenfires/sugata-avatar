"""Encode preserved PNG pairs with explicit 20 Hz input timestamps and verify cadence."""
from pathlib import Path
import argparse, datetime, hashlib, json, subprocess
parser=argparse.ArgumentParser(); parser.add_argument('--protocol',choices=['head','ordinary'],required=True); args=parser.parse_args()
root=Path(f'captures/lower-{args.protocol}-v1'); view='right-profile' if args.protocol=='head' else 'left-profile'
read=lambda p:json.loads(p.read_text())
digest=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
reports=[read(root/f'{arm}-{view}-brown/report.json') for arm in ['baseline','candidate']]
expected=186 if args.protocol=='head' else 241
for arm,r in zip(['baseline','candidate'],reports):
    assert r['status']=='captured' and len(r['images'])==expected
    directory=root/f'{arm}-{view}-brown'
    assert sorted((directory/'frames').glob('*.png')) == [directory/i['file'] for i in r['images']]
    for image in r['images']: assert digest(directory/image['file'])==image['sha256']
output=root/'paired-preview.mp4'; assert not output.exists()
cmd=['ffmpeg','-hide_banner','-loglevel','error','-n']
for arm in ['baseline','candidate']: cmd+=['-framerate','20','-pattern_type','glob','-i',str(root/f'{arm}-{view}-brown/frames/*.png')]
cmd+=['-filter_complex','[0:v][1:v]hstack=inputs=2[v]','-map','[v]','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(output)]
subprocess.run(cmd,check=True)
probe=['ffprobe','-v','error','-select_streams','v:0','-show_frames','-show_streams','-of','json',str(output)]
data=json.loads(subprocess.check_output(probe)); frames=data['frames']; stream=data['streams'][0]
assert len(frames)==expected
assert all(abs(float(f['best_effort_timestamp_time'])-i/20)<1e-8 for i,f in enumerate(frames))
assert stream['width']==1800 and stream['height']==868
source=Path(__file__); (root/'encode-bob-lower-preview.py').write_bytes(source.read_bytes())
record=dict(status='encoded; uniform 20Hz presentation timestamps verified',generated=datetime.datetime.now(datetime.timezone.utc).isoformat(),
    command=cmd,probeCommand=probe,sha256=digest(output),frameCount=expected,duration=stream['duration'],width=stream['width'],height=stream['height'],
    sourceSha256=digest(source),frames=[dict(index=i,pts=f['best_effort_timestamp_time']) for i,f in enumerate(frames)],
    limits=['Compressed convenience preview, not original pixel evidence or continuous perceptual qualification.','Last captured pose remains for one display interval.'])
(root/'preview-cadence.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps({k:v for k,v in record.items() if k!='frames'},indent=2))
