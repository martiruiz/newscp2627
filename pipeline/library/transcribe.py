# Transcribes a 16 kHz mono WAV with faster-whisper (CPU) and prints JSON: {"language": "es", "text": "..."}.
# Used by ai-video.mjs. The audio is read with the wave module so the av package's version never matters.
import json, sys, wave
import numpy as np
from faster_whisper import WhisperModel

w = wave.open(sys.argv[1])
audio = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
segments, info = WhisperModel("base", device="cpu", compute_type="int8").transcribe(audio, vad_filter=True)
text = " ".join(s.text.strip() for s in segments)
print(json.dumps({"language": info.language if text else None, "text": text[:4000]}))
