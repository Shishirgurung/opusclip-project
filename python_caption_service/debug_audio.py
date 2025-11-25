#!/usr/bin/env python3
"""
Debug Audio Analysis
===================

Test script to debug audio channel analysis for speaker detection.
"""

import librosa
import numpy as np
import sys

def debug_audio_channels(audio_path: str):
    """Debug audio channels to understand stereo mapping."""
    
    print(f"Analyzing audio file: {audio_path}")
    
    # Load stereo audio
    audio, sr = librosa.load(audio_path, sr=16000, mono=False)
    
    print(f"Audio shape: {audio.shape}")
    print(f"Sample rate: {sr}")
    
    if len(audio.shape) == 1:
        print("MONO audio detected - no stereo separation possible")
        return
    
    # Analyze different segments
    segments = [
        (0, 10),    # First 10 seconds
        (30, 40),   # Middle segment
        (60, 70),   # Another segment
        (120, 130), # Later segment
    ]
    
    for start, end in segments:
        start_sample = int(start * sr)
        end_sample = int(end * sr)
        
        if end_sample > audio.shape[1]:
            continue
            
        left_channel = audio[0, start_sample:end_sample]
        right_channel = audio[1, start_sample:end_sample]
        
        left_energy = np.sqrt(np.mean(left_channel ** 2))
        right_energy = np.sqrt(np.mean(right_channel ** 2))
        
        print(f"\nSegment {start}s-{end}s:")
        print(f"  Left channel energy:  {left_energy:.6f}")
        print(f"  Right channel energy: {right_energy:.6f}")
        print(f"  Ratio (L/R): {left_energy/right_energy if right_energy > 0 else 'inf':.2f}")
        
        if left_energy > right_energy * 1.2:
            detected = "LEFT"
        elif right_energy > left_energy * 1.2:
            detected = "RIGHT"
        else:
            detected = "BALANCED"
            
        print(f"  Detected speaker: {detected}")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python debug_audio.py <audio_file>")
        sys.exit(1)
    
    debug_audio_channels(sys.argv[1])
