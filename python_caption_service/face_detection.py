"""
Face Detection Module for Auto Layout
====================================

Uses MediaPipe to detect and track faces in video for intelligent cropping.
"""

import cv2
import mediapipe as mp
import numpy as np
from typing import Tuple, Optional

class FaceDetector:
    def __init__(self):
        """Initialize MediaPipe face detection."""
        self.mp_face_detection = mp.solutions.face_detection
        self.mp_drawing = mp.solutions.drawing_utils
        self.face_detection = self.mp_face_detection.FaceDetection(
            model_selection=1, min_detection_confidence=0.1
        )
    
    def detect_face_center(self, video_path: str, prefer_left_side: bool = True, segment_time: Optional[float] = None) -> Tuple[int, int]:
        """
        Detect the center point of the most prominent face in the video.
        
        Args:
            video_path: Path to input video file
            
        Returns:
            Tuple of (x, y) coordinates for face center
        """
        cap = cv2.VideoCapture(video_path)
        
        if not cap.isOpened():
            raise ValueError(f"Could not open video: {video_path}")
        
        face_centers = []
        frame_count = 0
        sample_frames = 30  # Sample every 30 frames for performance
        
        try:
            while cap.isOpened() and frame_count < 300:  # Limit to first 10 seconds at 30fps
                ret, frame = cap.read()
                if not ret:
                    break
                
                if frame_count % sample_frames == 0:
                    # Convert BGR to RGB
                    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    results = self.face_detection.process(rgb_frame)
                    
                    if results.detections:
                        print(f"Frame {frame_count}: Found {len(results.detections)} faces")
                        # Process all detected faces and find the most prominent one
                        for i, detection in enumerate(results.detections):
                            bbox = detection.location_data.relative_bounding_box
                            h, w, _ = frame.shape
                            
                            # Calculate face center and size
                            face_x = int((bbox.xmin + bbox.width / 2) * w)
                            face_y = int((bbox.ymin + bbox.height / 2) * h)
                            face_size = bbox.width * bbox.height
                            confidence = detection.score[0]
                            
                            # Weight by both size and confidence to find most prominent face
                            prominence_score = face_size * confidence
                            
                            print(f"  Face {i}: center=({face_x}, {face_y}), size={face_size:.4f}, conf={confidence:.3f}, prominence={prominence_score:.4f}")
                            
                            face_centers.append({
                                'center': (face_x, face_y),
                                'size': face_size,
                                'confidence': confidence,
                                'prominence': prominence_score
                            })
                    else:
                        print(f"Frame {frame_count}: No faces detected")
                
                frame_count += 1
                
        finally:
            cap.release()
        
        if not face_centers:
            # No faces detected, return center of frame
            cap = cv2.VideoCapture(video_path)
            ret, frame = cap.read()
            if ret:
                h, w, _ = frame.shape
                cap.release()
                return (w // 2, h // 2)
            else:
                cap.release()
                raise ValueError("Could not read video frames")
        
        # Group faces by position (left vs right side of frame)
        cap_temp = cv2.VideoCapture(video_path)
        ret, frame = cap_temp.read()
        frame_width = frame.shape[1] if ret else 1080
        cap_temp.release()
        
        left_faces = [f for f in face_centers if f['center'][0] < frame_width * 0.5]
        right_faces = [f for f in face_centers if f['center'][0] >= frame_width * 0.5]
        
        print(f"Found {len(left_faces)} left-side faces and {len(right_faces)} right-side faces")
        
        # Simple time-based speaker alternation for podcasts
        if segment_time is not None:
            # Alternate speakers every 10 seconds for dynamic switching
            speaker_interval = 10.0  # seconds
            current_speaker = int(segment_time // speaker_interval) % 2
            
            if current_speaker == 0 and left_faces:
                target_faces = left_faces
                print(f"Time {segment_time:.1f}s: Selecting left-side speaker")
            elif current_speaker == 1 and right_faces:
                target_faces = right_faces
                print(f"Time {segment_time:.1f}s: Selecting right-side speaker")
            else:
                # Fallback to preference-based selection
                if prefer_left_side and left_faces:
                    target_faces = left_faces
                    print("Fallback: Selecting left-side speaker")
                elif not prefer_left_side and right_faces:
                    target_faces = right_faces
                    print("Fallback: Selecting right-side speaker")
                else:
                    target_faces = face_centers
                    print("Fallback: Using most prominent face overall")
        else:
            # Original preference-based selection
            if prefer_left_side and left_faces:
                target_faces = left_faces
                print("Selecting left-side speaker")
            elif not prefer_left_side and right_faces:
                target_faces = right_faces
                print("Selecting right-side speaker")
            else:
                target_faces = face_centers
                print("Using most prominent face overall")
        
        best_face = max(target_faces, key=lambda f: f['prominence'])
        similar_faces = [f for f in target_faces if f['prominence'] > best_face['prominence'] * 0.5]
        
        avg_x = int(np.mean([f['center'][0] for f in similar_faces]))
        avg_y = int(np.mean([f['center'][1] for f in similar_faces]))
        
        print(f"Selected face from {len(similar_faces)} detections at ({avg_x}, {avg_y})")
        return (avg_x, avg_y)
    
    def __del__(self):
        """Cleanup MediaPipe resources."""
        if hasattr(self, 'face_detection'):
            self.face_detection.close()
