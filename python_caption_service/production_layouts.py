#!/usr/bin/env python3
"""
Production-Style Video Layouts
===============================

Professional video layouts used by production companies like Ssemble and OpusClip.
Simple, reliable, and industry-standard approaches.
"""

import ffmpeg
import cv2
import numpy as np
from typing import Tuple, Dict, Any, Optional
from face_detection import FaceDetector

class ProductionLayoutProcessor:
    def __init__(self):
        """Initialize production layout processor."""
        self.face_detector = FaceDetector()
        
    def detect_speakers(self, video_path: str) -> Dict[str, Tuple[int, int]]:
        """
        Detect two main speakers in the video.
        
        Args:
            video_path: Path to input video
            
        Returns:
            Dict with 'left' and 'right' speaker coordinates
        """
        # Use existing face detection to find both speakers
        left_face = self.face_detector.detect_face_center(video_path, prefer_left_side=True)
        right_face = self.face_detector.detect_face_center(video_path, prefer_left_side=False)
        
        return {
            'left': left_face,
            'right': right_face
        }
    
    def create_side_by_side_layout(self, input_path: str, output_path: str, blur_strength: int = 10) -> None:
        """
        Create side-by-side dual speaker layout.
        
        Args:
            input_path: Input video path
            output_path: Output video path
            blur_strength: Background blur strength
        """
        print("🎬 Creating side-by-side layout...")
        
        # Get video info
        probe = ffmpeg.probe(input_path)
        video_info = next(s for s in probe['streams'] if s['codec_type'] == 'video')
        original_w = int(video_info['width'])
        original_h = int(video_info['height'])
        
        # Output dimensions for vertical video
        output_w = 1080
        output_h = 1920
        
        # Detect speaker positions
        speakers = self.detect_speakers(input_path)
        left_x, left_y = speakers['left']
        right_x, right_y = speakers['right']
        
        print(f"Left speaker at: ({left_x}, {left_y})")
        print(f"Right speaker at: ({right_x}, {right_y})")
        
        # Calculate crop dimensions for each speaker (half width each)
        crop_w = output_w // 2
        crop_h = int(crop_w * (original_h / original_w))  # Maintain aspect ratio
        
        # Calculate crop positions
        left_crop_x = max(0, min(original_w - crop_w, left_x - crop_w // 2))
        left_crop_y = max(0, min(original_h - crop_h, left_y - crop_h // 2))
        
        right_crop_x = max(0, min(original_w - crop_w, right_x - crop_w // 2))
        right_crop_y = max(0, min(original_h - crop_h, right_y - crop_h // 2))
        
        # Create input stream
        input_stream = ffmpeg.input(input_path)
        
        # Create left speaker crop
        left_speaker = (
            input_stream
            .video
            .filter('crop', w=crop_w, h=crop_h, x=left_crop_x, y=left_crop_y)
            .filter('scale', w=crop_w, h=output_h)
        )
        
        # Create right speaker crop  
        right_speaker = (
            input_stream
            .video
            .filter('crop', w=crop_w, h=crop_h, x=right_crop_x, y=right_crop_y)
            .filter('scale', w=crop_w, h=output_h)
        )
        
        # Combine side by side
        combined = ffmpeg.filter([left_speaker, right_speaker], 'hstack')
        
        # Output with audio
        try:
            ffmpeg.output(
                combined, input_stream.audio, output_path,
                vcodec='libx264', acodec='copy', preset='fast', crf=23
            ).overwrite_output().run()
            print(f"✅ Side-by-side layout saved: {output_path}")
        except ffmpeg.Error as e:
            error_msg = e.stderr.decode() if e.stderr else "Unknown ffmpeg error"
            print(f"FFmpeg error: {error_msg}")
            raise Exception(f"FFmpeg processing failed: {error_msg}")
    
    def create_picture_in_picture_layout(self, input_path: str, output_path: str, blur_strength: int = 10) -> None:
        """
        Create picture-in-picture layout with main speaker and smaller overlay.
        
        Args:
            input_path: Input video path
            output_path: Output video path
            blur_strength: Background blur strength
        """
        print("🎬 Creating picture-in-picture layout...")
        
        # Get video info
        probe = ffmpeg.probe(input_path)
        video_info = next(s for s in probe['streams'] if s['codec_type'] == 'video')
        original_w = int(video_info['width'])
        original_h = int(video_info['height'])
        
        # Output dimensions
        output_w = 1080
        output_h = 1920
        
        # Detect speakers
        speakers = self.detect_speakers(input_path)
        left_x, left_y = speakers['left']
        right_x, right_y = speakers['right']
        
        # Determine main speaker (left side gets priority)
        main_x, main_y = left_x, left_y
        pip_x, pip_y = right_x, right_y
        
        print(f"Main speaker at: ({main_x}, main_y)")
        print(f"PiP speaker at: ({pip_x}, {pip_y})")
        
        # Create input streams
        input_stream = ffmpeg.input(input_path)
        split_streams = input_stream.video.split()
        
        # Create blurred background
        background = (
            split_streams[0]
            .filter('scale', w=-1, h=output_h)
            .filter('crop', w=output_w, h=output_h)
            .filter('boxblur', luma_radius=blur_strength*5, luma_power=5)
        )
        
        # Main speaker (75% of screen height)
        main_crop_h = int(output_h * 0.75)
        main_crop_w = int(main_crop_h * (original_w / original_h))
        main_crop_x = max(0, min(original_w - main_crop_w, main_x - main_crop_w // 2))
        main_crop_y = max(0, min(original_h - main_crop_h, main_y - main_crop_h // 2))
        
        main_speaker = (
            split_streams[1]
            .filter('crop', w=main_crop_w, h=main_crop_h, x=main_crop_x, y=main_crop_y)
            .filter('scale', w=output_w, h=main_crop_h)
        )
        
        # Picture-in-picture (25% of screen width)
        pip_w = output_w // 4
        pip_h = int(pip_w * (original_h / original_w))
        pip_crop_x = max(0, min(original_w - pip_w, pip_x - pip_w // 2))
        pip_crop_y = max(0, min(original_h - pip_h, pip_y - pip_h // 2))
        
        pip_speaker = (
            split_streams[2]
            .filter('crop', w=pip_w, h=pip_h, x=pip_crop_x, y=pip_crop_y)
            .filter('scale', w=pip_w, h=pip_h)
        )
        
        # Overlay main speaker on background
        main_overlay = ffmpeg.overlay(background, main_speaker, x=0, y=(output_h - main_crop_h) // 2)
        
        # Add PiP in bottom right corner
        final_output = ffmpeg.overlay(main_overlay, pip_speaker, x=output_w - pip_w - 20, y=output_h - pip_h - 20)
        
        # Output with audio
        ffmpeg.output(
            final_output, input_stream.audio, output_path,
            vcodec='libx264', acodec='copy', preset='fast', crf=23
        ).overwrite_output().run(quiet=True)
        
        print(f"✅ Picture-in-picture layout saved: {output_path}")
    
    def create_stacked_layout(self, input_path: str, output_path: str, blur_strength: int = 10) -> None:
        """
        Create vertically stacked dual speaker layout.
        
        Args:
            input_path: Input video path
            output_path: Output video path
            blur_strength: Background blur strength
        """
        print("🎬 Creating stacked layout...")
        
        # Get video info
        probe = ffmpeg.probe(input_path)
        video_info = next(s for s in probe['streams'] if s['codec_type'] == 'video')
        original_w = int(video_info['width'])
        original_h = int(video_info['height'])
        
        # Output dimensions
        output_w = 1080
        output_h = 1920
        
        # Detect speakers
        speakers = self.detect_speakers(input_path)
        left_x, left_y = speakers['left']
        right_x, right_y = speakers['right']
        
        print(f"Top speaker at: ({left_x}, {left_y})")
        print(f"Bottom speaker at: ({right_x}, {right_y})")
        
        # Each speaker gets half the height
        speaker_h = output_h // 2
        speaker_w = output_w
        
        # Calculate crop dimensions maintaining aspect ratio
        crop_h = int(speaker_w * (original_h / original_w))
        crop_w = original_w
        
        # Create input stream
        input_stream = ffmpeg.input(input_path)
        
        # Top speaker
        top_crop_x = max(0, min(original_w - crop_w, left_x - crop_w // 2))
        top_crop_y = max(0, min(original_h - crop_h, left_y - crop_h // 2))
        
        top_speaker = (
            input_stream
            .video
            .filter('crop', w=crop_w, h=crop_h, x=top_crop_x, y=top_crop_y)
            .filter('scale', w=speaker_w, h=speaker_h)
        )
        
        # Bottom speaker
        bottom_crop_x = max(0, min(original_w - crop_w, right_x - crop_w // 2))
        bottom_crop_y = max(0, min(original_h - crop_h, right_y - crop_h // 2))
        
        bottom_speaker = (
            input_stream
            .video
            .filter('crop', w=crop_w, h=crop_h, x=bottom_crop_x, y=bottom_crop_y)
            .filter('scale', w=speaker_w, h=speaker_h)
        )
        
        # Stack vertically
        combined = ffmpeg.filter([top_speaker, bottom_speaker], 'vstack')
        
        # Output with audio
        ffmpeg.output(
            combined, input_stream.audio, output_path,
            vcodec='libx264', acodec='copy', preset='fast', crf=23
        ).overwrite_output().run(quiet=True)
        
        print(f"✅ Stacked layout saved: {output_path}")
