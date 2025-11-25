#!/usr/bin/env python3
"""
Intelligent Auto Layout
=======================

Smart auto layout that switches between speakers based on who is actually talking.
Uses audio analysis to determine active speaker and switches camera focus accordingly.
"""

import ffmpeg
import numpy as np
import librosa
from typing import List, Dict, Any, Tuple
from face_detection import FaceDetector

class IntelligentAutoLayout:
    def __init__(self):
        """Initialize intelligent auto layout processor."""
        self.face_detector = FaceDetector()
        self.sample_rate = 16000
        
    def analyze_audio_segments(self, audio_path: str, segment_duration: float = 5.0) -> List[Dict[str, Any]]:
        """
        Analyze audio to determine which speaker is active in each segment.
        
        Args:
            audio_path: Path to audio file
            segment_duration: Duration of each analysis segment in seconds
            
        Returns:
            List of segments with speaker activity information
        """
        try:
            # Load stereo audio
            audio, sr = librosa.load(audio_path, sr=self.sample_rate, mono=False)
            
            # Get audio duration
            duration = len(audio[0]) / sr if len(audio.shape) > 1 else len(audio) / sr
            
            segments = []
            current_time = 0
            
            while current_time < duration:
                end_time = min(current_time + segment_duration, duration)
                
                # Convert time to samples
                start_sample = int(current_time * sr)
                end_sample = int(end_time * sr)
                
                # Extract segment
                if len(audio.shape) == 1:
                    # Mono audio - assume single speaker
                    left_energy = np.sqrt(np.mean(audio[start_sample:end_sample] ** 2))
                    right_energy = 0
                else:
                    # Stereo audio
                    left_channel = audio[0, start_sample:end_sample]
                    right_channel = audio[1, start_sample:end_sample]
                    
                    left_energy = np.sqrt(np.mean(left_channel ** 2)) if len(left_channel) > 0 else 0
                    right_energy = np.sqrt(np.mean(right_channel ** 2)) if len(right_channel) > 0 else 0
                
                # Determine active speaker
                if left_energy > right_energy * 1.3:  # 30% threshold to avoid noise switching
                    active_speaker = 'left'
                elif right_energy > left_energy * 1.3:
                    active_speaker = 'right'
                else:
                    # Similar activity - keep previous speaker or default to left
                    active_speaker = segments[-1]['active_speaker'] if segments else 'left'
                
                segments.append({
                    'start': current_time,
                    'end': end_time,
                    'active_speaker': active_speaker,
                    'left_energy': left_energy,
                    'right_energy': right_energy
                })
                
                current_time = end_time
                
            return segments
            
        except Exception as e:
            print(f"Audio analysis failed: {e}")
            # Fallback to single segment
            return [{'start': 0, 'end': 60, 'active_speaker': 'left', 'left_energy': 1, 'right_energy': 0}]
    
    def get_speaker_coordinates(self, video_path: str) -> Dict[str, Tuple[int, int]]:
        """
        Get face coordinates for both speakers.
        
        Args:
            video_path: Path to video file
            
        Returns:
            Dict with 'left' and 'right' speaker coordinates
        """
        left_face = self.face_detector.detect_face_center(video_path, prefer_left_side=True)
        right_face = self.face_detector.detect_face_center(video_path, prefer_left_side=False)
        
        return {
            'left': left_face,
            'right': right_face
        }
    
    def group_consecutive_segments(self, segments: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Group consecutive segments with the same speaker to minimize switching.
        
        Args:
            segments: List of audio analysis segments
            
        Returns:
            List of grouped segments
        """
        if not segments:
            return []
            
        grouped = []
        current_speaker = segments[0]['active_speaker']
        segment_start = segments[0]['start']
        segment_end = segments[0]['end']
        
        for segment in segments[1:]:
            if segment['active_speaker'] == current_speaker:
                # Extend current segment
                segment_end = segment['end']
            else:
                # Speaker changed - save current segment and start new one
                grouped.append({
                    'start': segment_start,
                    'end': segment_end,
                    'active_speaker': current_speaker
                })
                
                current_speaker = segment['active_speaker']
                segment_start = segment['start']
                segment_end = segment['end']
        
        # Add final segment
        grouped.append({
            'start': segment_start,
            'end': segment_end,
            'active_speaker': current_speaker
        })
        
        return grouped
    
    def create_intelligent_auto_layout(self, input_path: str, output_path: str, blur_strength: int = 10) -> None:
        """
        Create intelligent auto layout that switches between speakers based on audio analysis.
        
        Args:
            input_path: Input video path
            output_path: Output video path
            blur_strength: Background blur strength
        """
        print("🎬 Creating intelligent auto layout...")
        
        # Extract audio for analysis
        import tempfile
        temp_audio = tempfile.NamedTemporaryFile(suffix='.wav', delete=False)
        temp_audio.close()
        
        try:
            # Extract stereo audio
            ffmpeg.input(input_path).output(
                temp_audio.name, ac=2, ar=self.sample_rate
            ).overwrite_output().run(quiet=True)
            
            # Analyze audio segments
            segments = self.analyze_audio_segments(temp_audio.name)
            grouped_segments = self.group_consecutive_segments(segments)
            
            print(f"Found {len(grouped_segments)} speaker segments:")
            for i, seg in enumerate(grouped_segments):
                print(f"  Segment {i+1}: {seg['start']:.1f}s-{seg['end']:.1f}s ({seg['active_speaker']} speaker)")
            
            # Get speaker coordinates
            speakers = self.get_speaker_coordinates(input_path)
            
            # Get video info
            probe = ffmpeg.probe(input_path)
            video_info = next(s for s in probe['streams'] if s['codec_type'] == 'video')
            original_w = int(video_info['width'])
            original_h = int(video_info['height'])
            
            # Output dimensions
            output_w = 1080
            output_h = 1920
            zoom_factor = 3.0
            
            # Create video segments for each speaker change
            temp_segments = []
            
            for i, speaker_seg in enumerate(grouped_segments):
                print(f"Processing segment {i+1}/{len(grouped_segments)}: "
                      f"{speaker_seg['start']:.1f}s-{speaker_seg['end']:.1f}s "
                      f"({speaker_seg['active_speaker']} speaker)")
                
                # Get face coordinates for active speaker
                if speaker_seg['active_speaker'] == 'left':
                    face_x, face_y = speakers['left']
                else:
                    face_x, face_y = speakers['right']
                
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
                    .filter('boxblur', luma_radius=blur_strength*5, luma_power=5)
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
                # Single segment - copy instead of rename to avoid conflicts
                import shutil
                shutil.copy2(temp_segments[0], output_path)
                # Clean up temp file
                import os
                try:
                    os.unlink(temp_segments[0])
                except:
                    pass
            else:
                # Multiple segments - concatenate
                inputs = [ffmpeg.input(seg) for seg in temp_segments]
                ffmpeg.concat(*inputs, v=1, a=1).output(output_path).overwrite_output().run(quiet=True)
                
                # Clean up temp files
                import os
                for temp_file in temp_segments:
                    try:
                        os.unlink(temp_file)
                    except:
                        pass
            
            print(f"✅ Intelligent auto layout saved: {output_path}")
            
        finally:
            # Clean up temp audio
            import os
            try:
                os.unlink(temp_audio.name)
            except:
                pass
