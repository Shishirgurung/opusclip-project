#!/usr/bin/env python3
"""
Test Spectral Analysis for Speaker Detection
===========================================

Test the new spectral-based speaker detection on specific segments.
"""

import librosa
import numpy as np
import sys

def test_spectral_detection(audio_path: str):
    """Test spectral analysis on specific time segments."""
    
    print(f"Testing spectral analysis on: {audio_path}")
    
    # Load audio as mono
    audio, sr = librosa.load(audio_path, sr=16000, mono=True)
    
    # Test segments where we know speakers are talking
    test_segments = [
        (30, 35, "Early segment"),
        (60, 65, "Mid segment"), 
        (90, 95, "Later segment"),
        (120, 125, "Even later"),
        (150, 155, "Much later"),
    ]
    
    for start, end, desc in test_segments:
        start_sample = int(start * sr)
        end_sample = int(end * sr)
        
        if end_sample > len(audio):
            continue
            
        segment = audio[start_sample:end_sample]
        
        if len(segment) == 0:
            continue
        
        # Extract spectral features
        spectral_centroid = librosa.feature.spectral_centroid(y=segment, sr=sr)[0]
        zcr = librosa.feature.zero_crossing_rate(segment)[0]
        energy = np.sqrt(np.mean(segment ** 2))
        
        avg_centroid = np.mean(spectral_centroid)
        avg_zcr = np.mean(zcr)
        
        # Speaker detection logic
        if avg_centroid < 1500:  # Deeper voice
            left_activity = energy * 1.5
            right_activity = energy * 0.7
            predicted = "LEFT (deeper voice)"
        else:  # Higher voice
            left_activity = energy * 0.7
            right_activity = energy * 1.5
            predicted = "RIGHT (higher voice)"
        
        print(f"\n{desc} ({start}s-{end}s):")
        print(f"  Energy: {energy:.4f}")
        print(f"  Spectral Centroid: {avg_centroid:.1f} Hz")
        print(f"  Zero Crossing Rate: {avg_zcr:.4f}")
        print(f"  Left Activity: {left_activity:.4f}")
        print(f"  Right Activity: {right_activity:.4f}")
        print(f"  Predicted Speaker: {predicted}")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python test_spectral_analysis.py <audio_file>")
        sys.exit(1)
    
    test_spectral_detection(sys.argv[1])
