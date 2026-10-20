#!/bin/sh
# v3: the ElevenLabs voice (video/audio/vo-v3.mp3) starts at 0.3 s and runs as recorded; the music
# (video/audio/music-v3.mp3, from 9.3 s where it starts) sits under it, ducked when the voice speaks, fade-out at the end.
cd "$(dirname "$0")"; mkdir -p out
ffmpeg -y -loglevel error -i audio/vo-v3.mp3 -i audio/music-v3.mp3 -filter_complex "\
[0:a]aresample=48000,adelay=300|300,apad=whole_dur=53.6,asplit=2[v][vsc];\
[1:a]atrim=9.3:62.9,asetpts=PTS-STARTPTS,aresample=48000,volume=0.38,afade=t=in:d=0.3,afade=t=out:st=50.6:d=3[m];\
[m][vsc]sidechaincompress=threshold=0.04:ratio=4:attack=25:release=350[md];\
[v][md]amix=inputs=2:normalize=0:duration=first,loudnorm=I=-15:TP=-1.5:LRA=11[out]" -map "[out]" -ar 48000 -ac 2 out/mix-v3.wav
ffprobe -v error -show_entries format=duration -of csv=p=0 out/mix-v3.wav
