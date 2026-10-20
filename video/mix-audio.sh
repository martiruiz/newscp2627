#!/bin/sh
# Places each scene's part of the ElevenLabs voice-over (video/audio/vo-full.mp3) at the start of its scene.
# Scene starts follow the default scene lengths in scp-video.html: 7.4, 5, 2.6, 13, 8, 9, 6.5, 6.8, 7 (total 65.3 s).
# Each line: start-in-voice end-in-voice  where-in-video (seconds)
cd "$(dirname "$0")"
mkdir -p out
SEGS="0.00 7.05 0.20
7.38 11.32 7.50
11.80 12.66 12.85
12.96 24.80 15.60
25.13 30.36 28.30
30.64 37.30 36.30
37.63 42.31 45.20
42.60 47.70 51.70
48.02 53.08 58.50"
i=0; INPUTS=""; FILTER=""; MIX=""
echo "$SEGS" | while read a b at; do echo "$a $b $at"; done > /dev/null
while read a b at; do
  ms=$(python3 -c "print(int(round($at*1000)))")
  FILTER="$FILTER[0:a]atrim=start=$a:end=$b,asetpts=PTS-STARTPTS,afade=t=in:d=0.03,afade=t=out:st=$(python3 -c "print(round($b-$a-0.04,3))"):d=0.04,adelay=${ms}|${ms}[s$i];"
  MIX="$MIX[s$i]"; i=$((i+1))
done <<SEGEOF
$SEGS
SEGEOF
# voice track
ffmpeg -y -loglevel error -i audio/vo-full.mp3 -filter_complex "${FILTER}${MIX}amix=inputs=$i:normalize=0:duration=longest,apad=whole_dur=65.3[out]" -map "[out]" -ar 48000 -ac 2 out/vo-mix.wav
# music (video/audio/music.mp3): first 65.3 s, under the voice and ducked when it speaks; half a second of silence
# before "Not anymore." (12.35–12.85 s) and a fade-out at the end
ffmpeg -y -loglevel error -i out/vo-mix.wav -i audio/music.mp3 -filter_complex "\
[1:a]atrim=0:65.3,asetpts=PTS-STARTPTS,aresample=48000,volume=0.32,\
volume=enable='between(t,12.35,12.95)':volume=0.02,afade=t=in:d=0.4,afade=t=out:st=62.3:d=3[m];\
[0:a]asplit=2[v][vsc];\
[m][vsc]sidechaincompress=threshold=0.04:ratio=5:attack=25:release=350:makeup=1[md];\
[v][md]amix=inputs=2:normalize=0:duration=first,loudnorm=I=-15:TP=-1.5:LRA=11[out]" -map "[out]" -ar 48000 -ac 2 out/mix.wav
ffprobe -v error -show_entries format=duration -of csv=p=0 out/mix.wav
