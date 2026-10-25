#!/bin/sh
# Reel audio: the original voice (cleaned: high-pass, light denoise, gentle compression) + music ducked under it.
cd "$(dirname "$0")"; mkdir -p out
ffmpeg -y -loglevel error -i me/raw2.mp4 -i audio/music-v3.mp3 -filter_complex "\
[0:a]aresample=48000,highpass=f=80,afftdn=nf=-25,acompressor=threshold=-20dB:ratio=3:attack=10:release=150,loudnorm=I=-16:TP=-1.5:LRA=9,asplit=2[v][vsc];\
[1:a]atrim=9.3:20.1,asetpts=PTS-STARTPTS,aresample=48000,volume=0.30,afade=t=in:d=0.4,afade=t=out:st=9.4:d=1.3[m];\
[m][vsc]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=300[md];\
[v][md]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.95[out]" -map "[out]" -ar 48000 -ac 2 out/reel2-mix.wav
ffprobe -v error -show_entries format=duration -of csv=p=0 out/reel2-mix.wav
