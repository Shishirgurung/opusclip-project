#!/usr/bin/env python3
"""
Speaker Detection Module
========================

Detects which person is speaking using audio analysis and maps to face positions.
"""

import numpy as np
import librosa
from typing import List, Tuple, Dict, Optional
import cv2

class SpeakerDetector:
    def __init__(self):
        """Initialize speaker detection."""
        self.sample_rate = 16000
        
    def detect_voice_activity(self, audio_path: str, segment_start: float, segment_end: float) -> Dict[str, float]:
        """
        Detect voice activity using spectral features and voice activity detection.
        For mono/mixed audio, uses temporal analysis to detect speaker changes.
        
        Args:
            audio_path: Path to audio file
            segment_start: Start time in seconds
            segment_end: End time in seconds
            
        Returns:
            Dict with 'left' and 'right' activity levels (simulated for mono)
        """
        try:
            # Load audio as mono for better analysis
            audio, sr = librosa.load(audio_path, sr=self.sample_rate, mono=True)
            
            # Convert time to samples
            start_sample = int(segment_start * sr)
            end_sample = int(segment_end * sr)
            
            # Extract segment
            segment = audio[start_sample:end_sample]
            
            if len(segment) == 0:
                return {'left': 0.0, 'right': 0.0}
            
            # Use spectral features to detect voice characteristics
            # Extract MFCC features for voice analysis
            mfccs = librosa.feature.mfcc(y=segment, sr=sr, n_mfcc=13)
            
            # Calculate spectral centroid (brightness of sound)
            spectral_centroid = librosa.feature.spectral_centroid(y=segment, sr=sr)[0]
            
            # Calculate zero crossing rate (voice vs noise)
            zcr = librosa.feature.zero_crossing_rate(segment)[0]
            
            # Voice activity based on energy and spectral features
            energy = np.sqrt(np.mean(segment ** 2))
            
            # Higher spectral centroid often indicates different speakers
            avg_centroid = np.mean(spectral_centroid)
            avg_zcr = np.mean(zcr)
            
            # Use spectral centroid to simulate speaker detection
            # Lower centroid = deeper voice (often left speaker)
            # Higher centroid = higher voice (often right speaker)
            if avg_centroid < 1500:  # Deeper voice
                left_activity = energy * 1.5
                right_activity = energy * 0.7
            else:  # Higher voice
                left_activity = energy * 0.7
                right_activity = energy * 1.5
            
            return {
                'left': float(left_activity),
                'right': float(right_activity)
            }
            
        except Exception as e:
            print(f"Audio analysis failed: {e}")
            return {'left': 0.5, 'right': 0.5}  # Default to balanced
    
    def determine_active_speaker(self, audio_path: str, segment_start: float, segment_end: float) -> str:
        """
        Determine which speaker is more active in the given time segment.
        
        Args:
            audio_path: Path to audio file
            segment_start: Start time in seconds
            segment_end: End time in seconds
            
        Returns:
            'left' or 'right' indicating which speaker is more active
        """
        activity = self.detect_voice_activity(audio_path, segment_start, segment_end)
        
        # Debug output
        print(f"  Audio analysis - Left: {activity['left']:.4f}, Right: {activity['right']:.4f}")
        
        # Compare activity levels with lower threshold for better sensitivity
        if activity['left'] > activity['right'] * 1.1:  # 10% threshold
            return 'left'
        elif activity['right'] > activity['left'] * 1.1:
            return 'right'
        else:
            # If similar activity, alternate or use previous context
            return 'right'  # Changed default to right for testing
    
    def get_speaker_preference_for_segment(self, audio_path: str, segment_start: float, segment_end: float) -> bool:
        """
        Get speaker preference for face detection based on audio analysis.
        
        Args:
            audio_path: Path to audio file
            segment_start: Start time in seconds
            segment_end: End time in seconds
            
        Returns:
            True for left-side preference, False for right-side preference
        """
        active_speaker = self.determine_active_speaker(audio_path, segment_start, segment_end)
        
        print(f"Segment {segment_start:.1f}s-{segment_end:.1f}s: {active_speaker} speaker is more active")
        
        return active_speaker == 'left'
