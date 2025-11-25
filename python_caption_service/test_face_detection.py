#!/usr/bin/env python3
"""
Test Face Detection Module
==========================

Simple test to verify MediaPipe face detection is working correctly.
"""

import sys
from face_detection import FaceDetector

def test_face_detection():
    """Test face detection on the podcast video."""
    print("Testing face detection...")
    
    try:
        detector = FaceDetector()
        print("✓ FaceDetector initialized successfully")
        
        # Test with podcast video
        video_path = "podcast.mp4"
        print(f"Processing video: {video_path}")
        
        face_center = detector.detect_face_center(video_path)
        print(f"Face center detected at: {face_center}")
        
        # Check if we got fallback coordinates (center of 1080x1920 frame)
        if face_center == (540, 960):
            print("⚠️  WARNING: Got fallback coordinates - no faces detected!")
            return False
        else:
            print("✓ Face detection working - got non-fallback coordinates")
            return True
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    success = test_face_detection()
    sys.exit(0 if success else 1)
