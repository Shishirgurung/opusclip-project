#!/usr/bin/env python3
"""
Dynamic Speaker Video Processor
===============================

Processes video with dynamic speaker switching - crops to whoever is speaking in each segment.
"""

import ffmpeg
import tempfile
import os
from typing import List, Dict, Any, Tuple
from speaker_detection import SpeakerDetector
from face_detection import FaceDetector

class DynamicSpeakerProcessor:
    def __init__(self):
        """Initialize dynamic speaker processor."""
        self.speaker_detector = SpeakerDetector()
        self.face_detector = FaceDetector()
        
    def analyze_speaker_segments(self, audio_path: str, segments: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Analyze each transcript segment to determine active speaker.
        
        Args:
            audio_path: Path to audio file
            segments: List of transcript segments with timing
            
        Returns:
            List of segments with speaker information added
        """
        enhanced_segments = []
        
        for segment in segments:
            start_time = segment.get('start', 0)
            end_time = segment.get('end', start_time + 1)
            
            # Determine active speaker for this segment
            active_speaker = self.speaker_detector.determine_active_speaker(
                audio_path, start_time, end_time
            )
            
            # Add speaker info to segment
            enhanced_segment = segment.copy()
            enhanced_segment['active_speaker'] = active_speaker
            enhanced_segment['prefer_left'] = (active_speaker == 'left')
            
            enhanced_segments.append(enhanced_segment)
            
        return enhanced_segments
    
    def get_face_coordinates_for_speaker(self, video_path: str, prefer_left: bool) -> Tuple[int, int]:
        """
        Get face coordinates for specified speaker preference.
        
        Args:
            video_path: Path to video file
            prefer_left: True for left speaker, False for right
            
        Returns:
            Tuple of (x, y) face center coordinates
        """
        return self.face_detector.detect_face_center(video_path, prefer_left_side=prefer_left)
    
    def create_speaker_segments(self, enhanced_segments: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Group consecutive segments by speaker to minimize switching.
        
        Args:
            enhanced_segments: Segments with speaker information
            
        Returns:
            List of speaker segments with start/end times and speaker preference
        """
        if not enhanced_segments:
            return []
            
        speaker_segments = []
        current_speaker = enhanced_segments[0]['active_speaker']
        segment_start = enhanced_segments[0].get('start', 0)
        segment_end = enhanced_segments[0].get('end', 1)
        
        for segment in enhanced_segments[1:]:
            if segment['active_speaker'] == current_speaker:
                # Extend current speaker segment
                segment_end = segment.get('end', segment_end + 1)
            else:
                # Speaker changed - save current segment and start new one
                speaker_segments.append({
                    'start': segment_start,
                    'end': segment_end,
                    'speaker': current_speaker,
                    'prefer_left': (current_speaker == 'left')
                })
                
                current_speaker = segment['active_speaker']
                segment_start = segment.get('start', segment_end)
                segment_end = segment.get('end', segment_start + 1)
        
        # Add final segment
        speaker_segments.append({
            'start': segment_start,
            'end': segment_end,
            'speaker': current_speaker,
            'prefer_left': (current_speaker == 'left')
        })
        
        return speaker_segments
    
    def process_video_with_dynamic_speakers(self, input_path: str, output_path: str, 
                                          segments: List[Dict[str, Any]], audio_path: str) -> None:
        """
        Process video with dynamic speaker switching.
        
        Args:
            input_path: Input video path
            output_path: Output video path
            segments: Transcript segments
            audio_path: Audio file path for analysis
        """
        # Analyze speakers for each segment
        enhanced_segments = self.analyze_speaker_segments(audio_path, segments)
        speaker_segments = self.create_speaker_segments(enhanced_segments)
        
        print(f"Created {len(speaker_segments)} speaker segments")
        
        # Get video info
        probe = ffmpeg.probe(input_path)
        video_info = next(s for s in probe['streams'] if s['codec_type'] == 'video')
        original_w = int(video_info['width'])
        original_h = int(video_info['height'])
        
        output_w = 1080
        output_h = 1920
        zoom_factor = 3.0
        
        # Create video segments for each speaker
        temp_segments = []
        
        for i, speaker_seg in enumerate(speaker_segments):
            print(f"Processing segment {i+1}/{len(speaker_segments)}: "
                  f"{speaker_seg['start']:.1f}s-{speaker_seg['end']:.1f}s "
                  f"({speaker_seg['speaker']} speaker)")
            
            # Get face coordinates for this speaker
            face_x, face_y = self.get_face_coordinates_for_speaker(
                input_path, speaker_seg['prefer_left']
            )
            
            # Calculate crop parameters
            crop_width = int(original_w / zoom_factor)
            crop_height = int(original_h / zoom_factor)
            crop_x = max(0, min(original_w - crop_width, face_x - crop_width // 2))
            crop_y = max(0, min(original_h - crop_height, face_y - crop_height // 2))
            
            # Create temp file for this segment
            temp_file = tempfile.NamedTemporaryFile(suffix='.mp4', delete=False)
            temp_file.close()
            temp_segments.append(temp_file.name)
            
            # Process this segment with specific crop
            input_stream = ffmpeg.input(input_path, ss=speaker_seg['start'], 
                                      t=speaker_seg['end'] - speaker_seg['start'])
            
            # Create background and foreground
            split_streams = input_stream.video.split()
            
            background = (
                split_streams[0]
                .filter('scale', w=-1, h=output_h)
                .filter('crop', w=output_w, h=output_h)
                .filter('boxblur', luma_radius=50, luma_power=5)
            )
            
            foreground = (
                split_streams[1]
                .filter('crop', w=crop_width, h=crop_height, x=crop_x, y=crop_y)
                .filter('scale', w=output_w, h=output_h)
            )
            
            # Combine and output
            output_stream = ffmpeg.overlay(background, foreground, x=0, y=0)
            
            ffmpeg.output(
                output_stream, input_stream.audio, temp_file.name,
                vcodec='libx264', acodec='copy', preset='fast', crf=23
            ).overwrite_output().run(quiet=True)
        
        # Concatenate all segments
        if len(temp_segments) == 1:
            # Single segment - just copy
            os.rename(temp_segments[0], output_path)
        else:
            # Multiple segments - concatenate
            inputs = [ffmpeg.input(seg) for seg in temp_segments]
            ffmpeg.concat(*inputs, v=1, a=1).output(output_path).overwrite_output().run(quiet=True)
            
            # Clean up temp files
            for temp_file in temp_segments:
                try:
                    os.unlink(temp_file)
                except:
                    pass
        
        print(f"Dynamic speaker video saved: {output_path}")
