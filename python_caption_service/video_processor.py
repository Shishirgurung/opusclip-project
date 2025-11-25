#!/usr/bin/env python3
"""
Unified Video Processing System
===============================

A comprehensive video processing pipeline that combines layout modes, caption templates,
and video generation into a single command. Designed for both CLI usage and frontend integration.

Author: Senior Engineering Team
Version: 1.0.0
"""

import os
import sys
import json
import time
import argparse
import tempfile
import subprocess
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, asdict
from enum import Enum

from opus_processor import OpusProcessor
from production_layouts import ProductionLayoutProcessor
from intelligent_auto_layout import IntelligentAutoLayout
from faster_whisper import WhisperModel


class LayoutMode(Enum):
    """Available video layout modes."""
    FIT = "fit"
    FILL = "fill"
    SQUARE = "square"
    AUTO = "auto"
    SIDE_BY_SIDE = "side-by-side"
    PICTURE_IN_PICTURE = "picture-in-picture"
    STACKED = "stacked"


class ProcessingStatus(Enum):
    """Processing status codes."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class ProcessingConfig:
    """Configuration for video processing pipeline."""
    input_video: str
    output_video: str
    layout_mode: LayoutMode
    caption_template: str
    blur_strength: int = 10
    cleanup_temp_files: bool = True
    verbose: bool = True
    log_file: Optional[str] = None
    dynamic_speaker: bool = False


@dataclass
class ProcessingResult:
    """Result of video processing operation."""
    success: bool
    output_path: Optional[str] = None
    error_message: Optional[str] = None
    processing_time: Optional[float] = None
    metadata: Optional[Dict[str, Any]] = None


class VideoProcessingPipeline:
    """
    Unified video processing pipeline that handles the complete workflow:
    1. Input validation
    2. Video layout processing
    3. Caption generation
    4. Video and caption combination
    5. Cleanup and result reporting
    """
    
    def __init__(self):
        self.processor = OpusProcessor()
        self.production_layouts = ProductionLayoutProcessor()
        self.intelligent_auto = IntelligentAutoLayout()
        self.temp_files = []
        self.whisper_model = None
        
    def get_available_templates(self) -> List[str]:
        """Get list of available caption templates."""
        return list(self.processor.templates.keys())
    
    def get_available_layouts(self) -> List[str]:
        """Get list of available layout modes."""
        return [mode.value for mode in LayoutMode]
    
    def validate_config(self, config: ProcessingConfig) -> Tuple[bool, Optional[str]]:
        """
        Validate processing configuration.
        
        Returns:
            Tuple of (is_valid, error_message)
        """
        # Check input file exists
        if not os.path.exists(config.input_video):
            return False, f"Input video not found: {config.input_video}"
        
        # Check input is a video file
        video_extensions = {'.mp4', '.avi', '.mov', '.mkv', '.wmv', '.flv', '.webm'}
        if Path(config.input_video).suffix.lower() not in video_extensions:
            return False, f"Unsupported video format: {Path(config.input_video).suffix}"
        
        # Check template exists
        if config.caption_template not in self.get_available_templates():
            available = ', '.join(self.get_available_templates())
            return False, f"Template '{config.caption_template}' not found. Available: {available}"
        
        # Check layout mode is valid
        try:
            LayoutMode(config.layout_mode.value if isinstance(config.layout_mode, LayoutMode) else config.layout_mode)
        except ValueError:
            available = ', '.join(self.get_available_layouts())
            return False, f"Invalid layout mode. Available: {available}"
        
        # Check output directory is writable
        output_dir = os.path.dirname(os.path.abspath(config.output_video))
        if not os.access(output_dir, os.W_OK):
            return False, f"Output directory not writable: {output_dir}"
        
        return True, None
    
    def _log(self, message: str, config: ProcessingConfig):
        """Log message with timestamp and optional file output."""
        timestamp = datetime.now().strftime("%H:%M:%S")
        
        # Remove emojis for Windows console compatibility
        clean_message = message.encode('ascii', 'ignore').decode('ascii')
        print(f"[{timestamp}] {clean_message}")
        
        if config.log_file:
            with open(config.log_file, 'a', encoding='utf-8') as f:
                f.write(f"[{timestamp}] {message}\n")
    
    def _create_temp_file(self, suffix: str) -> str:
        """Create a temporary file and track it for cleanup."""
        temp_fd, temp_path = tempfile.mkstemp(suffix=suffix)
        os.close(temp_fd)  # Close the file descriptor, we just need the path
        self.temp_files.append(temp_path)
        return temp_path
    
    def _cleanup_temp_files(self, config: ProcessingConfig):
        """Clean up temporary files if cleanup is enabled."""
        if not config.cleanup_temp_files:
            return
            
        for temp_file in self.temp_files:
            try:
                if os.path.exists(temp_file):
                    os.remove(temp_file)
                    if config.verbose:
                        self._log(f"Cleaned up temp file: {os.path.basename(temp_file)}", config)
            except Exception as e:
                if config.verbose:
                    self._log(f"Warning: Could not clean up {temp_file}: {e}", config)
        
        self.temp_files.clear()
    
    def _extract_audio_from_video(self, video_path: str) -> str:
        """Extract audio from video for transcription."""
        audio_path = self._create_temp_file("_audio.wav")
        command = [
            'ffmpeg', '-y', '-i', video_path,
            '-vn', '-acodec', 'pcm_s16le', '-ar', '16000', '-ac', '1',
            audio_path
        ]
        try:
            subprocess.run(command, check=True, capture_output=True)
            return audio_path
        except subprocess.CalledProcessError as e:
            raise RuntimeError(f"Failed to extract audio: {e}")
    
    def _transcribe_video(self, video_path: str) -> List[Dict[str, Any]]:
        """Transcribe video using faster-whisper with word-level timestamps."""
        # Extract audio
        audio_path = self._extract_audio_from_video(video_path)
        
        # Load whisper model if not already loaded
        if self.whisper_model is None:
            self.whisper_model = WhisperModel("base", device="cpu", compute_type="int8")
        
        # Transcribe with word timestamps
        segments, info = self.whisper_model.transcribe(audio_path, word_timestamps=True)
        
        # Convert generator to list
        transcription_segments = list(segments)
        
        return transcription_segments
    
    def _combine_video_with_captions(self, video_path: str, caption_path: str, output_path: str):
        """Combine video with ASS subtitle file using MoviePy to preserve BeastMode animations."""
        try:
            # MoviePy imports moved to function level to avoid FFmpeg dependency issues
            from moviepy.editor import VideoFileClip, TextClip, CompositeVideoClip
            import re
            
            # Parse ASS file to extract subtitle data with timing and styling
            with open(caption_path, 'r', encoding='utf-8') as f:
                ass_content = f.read()
            
            # Extract dialogue lines with full styling information
            dialogue_pattern = r'Dialogue: \d+,(\d+:\d+:\d+\.\d+),(\d+:\d+:\d+\.\d+),.*?,,\d+,\d+,\d+,,(.+)'
            matches = re.findall(dialogue_pattern, ass_content)
            
            if not matches:
                print("No subtitles found - copying video without captions")
                import shutil
                shutil.copy2(video_path, output_path)
                return
            
            # Load the video
            video = VideoFileClip(video_path)
            
            # Create subtitle clips with BeastMode styling
            subtitle_clips = []
            for start_time_str, end_time_str, text in matches:
                # Parse timing
                start_parts = start_time_str.split(':')
                start_time = int(start_parts[0]) * 3600 + int(start_parts[1]) * 60 + float(start_parts[2])
                
                end_parts = end_time_str.split(':')
                end_time = int(end_parts[0]) * 3600 + int(end_parts[1]) * 60 + float(end_parts[2])
                
                # Extract clean text (remove ASS tags)
                clean_text = re.sub(r'\{[^}]*\}', '', text).strip()
                
                if clean_text and end_time > start_time:
                    # Create text clip with BeastMode styling
                    txt_clip = TextClip(
                        clean_text,
                        fontsize=80,
                        font='Impact',
                        color='lime',  # Green color for BeastMode
                        stroke_color='black',
                        stroke_width=3
                    ).set_position(('center', 'bottom')).set_start(start_time).set_duration(end_time - start_time)
                    
                    subtitle_clips.append(txt_clip)
            
            # Composite video with subtitles
            if subtitle_clips:
                final_video = CompositeVideoClip([video] + subtitle_clips)
            else:
                final_video = video
            
            # Write the result
            final_video.write_videofile(
                output_path,
                codec='libx264',
                audio_codec='aac',
                temp_audiofile='temp-audio.m4a',
                remove_temp=True,
                verbose=False,
                logger=None
            )
            
            # Clean up
            video.close()
            final_video.close()
            for clip in subtitle_clips:
                clip.close()
                
            print("MoviePy subtitle processing completed with BeastMode styling")
            
        except ImportError:
            print("MoviePy not available - using fallback method")
            self._direct_ffmpeg_combine(video_path, caption_path, output_path)
        except Exception as e:
            print(f"MoviePy processing failed: {e} - using fallback")
            self._direct_ffmpeg_combine(video_path, caption_path, output_path)
    
    def _direct_ffmpeg_combine(self, video_path: str, caption_path: str, output_path: str):
        """Preserve complex ASS animations using direct FFmpeg ASS filter."""
        import subprocess
        import os
        
        # Normalize paths for Windows
        abs_video_path = os.path.abspath(video_path).replace('\\', '/')
        abs_caption_path = os.path.abspath(caption_path).replace('\\', '/')
        abs_output_path = os.path.abspath(output_path)
        
        # Use subtitles filter with proper path escaping for Windows
        escaped_path = abs_caption_path.replace(':', '\\:')
        command = [
            'ffmpeg', '-y',
            '-i', abs_video_path,
            '-vf', f'subtitles=\'{escaped_path}\'',
            '-c:v', 'libx264',
            '-c:a', 'copy',
            '-preset', 'fast',
            '-crf', '23',
            abs_output_path
        ]
        
        try:
            result = subprocess.run(command, check=True, capture_output=True, text=True)
            print("BeastMode ASS animations preserved with libass filter")
        except subprocess.CalledProcessError as e:
            print(f"FFmpeg ASS filter failed: {e.stderr}")
            # Fallback: copy video without subtitles
            import shutil
            shutil.copy2(video_path, output_path)
            print("Created video without subtitles")
    
    def _opencv_subtitle_overlay(self, video_path: str, caption_path: str, output_path: str):
        """Use OpenCV to overlay subtitles frame by frame."""
        import cv2
        import re
        
        # Parse ASS file to extract text and timing
        with open(caption_path, 'r', encoding='utf-8') as f:
            ass_content = f.read()
        
        # Extract dialogue lines with timing
        dialogue_pattern = r'Dialogue: \d+,(\d+):(\d+):(\d+)\.(\d+),(\d+):(\d+):(\d+)\.(\d+),.*?,,\d+,\d+,\d+,,(.+)'
        matches = re.findall(dialogue_pattern, ass_content)
        
        subtitles = []
        for match in matches:
            start_h, start_m, start_s, start_ms = map(int, match[:4])
            end_h, end_m, end_s, end_ms = map(int, match[4:8])
            text = re.sub(r'\{[^}]*\}', '', match[8]).strip()  # Remove ASS tags
            
            start_time = start_h * 3600 + start_m * 60 + start_s + start_ms / 100
            end_time = end_h * 3600 + end_m * 60 + end_s + end_ms / 100
            
            if text:
                subtitles.append((start_time, end_time, text))
        
        # Process video with OpenCV
        cap = cv2.VideoCapture(video_path)
        fps = cap.get(cv2.CAP_PROP_FPS)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
        
        frame_count = 0
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            current_time = frame_count / fps
            
            # Find active subtitle
            for start_time, end_time, text in subtitles:
                if start_time <= current_time <= end_time:
                    # Add subtitle to frame
                    font = cv2.FONT_HERSHEY_SIMPLEX
                    font_scale = 2
                    color = (0, 255, 0)  # Green color for BeastMode style
                    thickness = 3
                    
                    # Position text at bottom center
                    text_size = cv2.getTextSize(text, font, font_scale, thickness)[0]
                    text_x = (width - text_size[0]) // 2
                    text_y = height - 100
                    
                    # Add black outline
                    cv2.putText(frame, text, (text_x, text_y), font, font_scale, (0, 0, 0), thickness + 2)
                    cv2.putText(frame, text, (text_x, text_y), font, font_scale, color, thickness)
                    break
            
            out.write(frame)
            frame_count += 1
        
        cap.release()
        out.release()
        
        print("OpenCV subtitle overlay completed")
    
    def _simple_ffmpeg_combine(self, video_path: str, caption_path: str, output_path: str):
        """Preserve full ASS animations using proper FFmpeg handling."""
        import shutil
        import tempfile
        
        # Create a temporary directory for processing
        with tempfile.TemporaryDirectory() as temp_dir:
            # Copy ASS file to temp directory with simple name
            temp_ass = os.path.join(temp_dir, "subs.ass")
            shutil.copy2(caption_path, temp_ass)
            
            # Use direct file input with subtitle stream - most reliable approach
            command = [
                'ffmpeg', '-y',
                '-i', video_path,
                '-i', temp_ass,
                '-c:v', 'libx264',
                '-c:a', 'copy',
                '-c:s', 'mov_text',
                '-map', '0:v:0',
                '-map', '0:a:0', 
                '-map', '1:s:0',
                '-preset', 'fast',
                '-crf', '23',
                output_path
            ]
            
            try:
                # First try: embed subtitles as stream
                result = subprocess.run(command, check=True, capture_output=True, text=True)
            except subprocess.CalledProcessError:
                try:
                    # Second try: burn subtitles with libass (most compatible with ASS)
                    command = [
                        'ffmpeg', '-y',
                        '-i', video_path,
                        '-vf', f'libass={temp_ass.replace(chr(92), "/")}',
                        '-c:v', 'libx264',
                        '-c:a', 'copy',
                        '-preset', 'fast', 
                        '-crf', '23',
                        output_path
                    ]
                    result = subprocess.run(command, check=True, capture_output=True, text=True)
                except subprocess.CalledProcessError:
                    # Final try: use subtitles filter with escaped path
                    escaped_path = temp_ass.replace('\\', '/').replace(':', r'\:')
                    command = [
                        'ffmpeg', '-y',
                        '-i', video_path,
                        '-vf', f'subtitles={escaped_path}',
                        '-c:v', 'libx264',
                        '-c:a', 'copy',
                        '-preset', 'fast',
                        '-crf', '23', 
                        output_path
                    ]
                    result = subprocess.run(command, check=True, capture_output=True, text=True)
    
    def _convert_ass_to_srt(self, ass_path: str, srt_path: str):
        """Convert ASS file to SRT format for better FFmpeg compatibility."""
        import re
        
        with open(ass_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Extract dialogue lines
        dialogue_pattern = r'Dialogue: \d+,(\d+:\d+:\d+\.\d+),(\d+:\d+:\d+\.\d+),.*?,,\d+,\d+,\d+,,(.+)'
        matches = re.findall(dialogue_pattern, content)
        
        srt_content = []
        for i, (start, end, text) in enumerate(matches, 1):
            # Clean ASS formatting tags
            clean_text = re.sub(r'\{[^}]*\}', '', text).strip()
            if clean_text:
                # Convert time format
                start_srt = start.replace('.', ',')
                end_srt = end.replace('.', ',')
                
                srt_content.append(f"{i}\n{start_srt} --> {end_srt}\n{clean_text}\n")
        
        with open(srt_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(srt_content))
    
    def _combine_with_burned_subtitles(self, video_path: str, caption_path: str, output_path: str):
        """Fallback method to burn subtitles directly into video."""
        import shutil
        
        output_filename = os.path.basename(output_path)
        
        # Use ass filter with proper escaping
        escaped_path = caption_path.replace('\\', '/').replace(':', '\\:')
        
        command = [
            'ffmpeg', '-y',
            '-i', video_path,
            '-vf', f'ass={escaped_path}',
            '-c:v', 'libx264',
            '-c:a', 'copy',
            '-preset', 'fast',
            '-crf', '23',
            output_filename
        ]
        
        try:
            result = subprocess.run(command, check=True, capture_output=True, text=True)
            
            # Move the file to the desired location if different
            if output_filename != output_path and os.path.exists(output_filename):
                shutil.move(output_filename, output_path)
                
        except subprocess.CalledProcessError as e:
            stderr_output = e.stderr if hasattr(e, 'stderr') else 'No error details'
            raise RuntimeError(f"FFmpeg failed to combine video with captions using both methods. Error: {stderr_output}")
    
    def process_video(self, config: ProcessingConfig) -> ProcessingResult:
        """
        Process video with specified configuration.
        
        Args:
            config: Processing configuration
            
        Returns:
            ProcessingResult with success status and details
        """
        start_time = time.time()
        
        try:
            # Step 1: Validate configuration
            self._log("🔍 Validating configuration...", config)
            is_valid, error_msg = self.validate_config(config)
            if not is_valid:
                return ProcessingResult(
                    success=False,
                    error_message=f"Configuration validation failed: {error_msg}"
                )
            
            self._log("✅ Configuration validated successfully", config)
            
            # Step 2: Process video layout
            self._log(f"🎬 Processing video layout ({config.layout_mode.value})...", config)
            layout_video = self._create_temp_file("_layout.mp4")
            
            # Process video with layout
            if config.layout_mode == LayoutMode.AUTO:
                # Use intelligent auto layout that switches between speakers based on audio
                self.intelligent_auto.create_intelligent_auto_layout(
                    config.input_video, 
                    layout_video,
                    config.blur_strength
                )
            elif config.layout_mode in [LayoutMode.SIDE_BY_SIDE, LayoutMode.PICTURE_IN_PICTURE, LayoutMode.STACKED]:
                # Use specific production-style layouts
                if config.layout_mode == LayoutMode.SIDE_BY_SIDE:
                    self.production_layouts.create_side_by_side_layout(
                        config.input_video, layout_video, config.blur_strength
                    )
                elif config.layout_mode == LayoutMode.PICTURE_IN_PICTURE:
                    self.production_layouts.create_picture_in_picture_layout(
                        config.input_video, layout_video, config.blur_strength
                    )
                elif config.layout_mode == LayoutMode.STACKED:
                    self.production_layouts.create_stacked_layout(
                        config.input_video, layout_video, config.blur_strength
                    )
            else:
                # Use standard processing
                self.processor.process_video_for_vertical(
                    config.input_video, 
                    layout_video,
                    config.blur_strength,
                    config.layout_mode.value
                )
            
            self._log("✅ Video layout processing completed", config)
            
            # Step 3: Generate captions
            self._log(f"🎬 Generating captions ({config.caption_template})...", config)
            segments = self._transcribe_video(config.input_video)
            
            caption_file = self.processor.generate_karaoke_captions(
                segments,
                config.caption_template,
                layout_mode=config.layout_mode.value
            )
            
            # Track caption file for cleanup
            self.temp_files.append(caption_file)
            self._log("✅ Caption generation completed", config)
            
            # Step 4: Combine video and captions
            self._log("🎯 Combining video and captions...", config)
            self._combine_video_with_captions(
                layout_video,
                caption_file,
                config.output_video
            )
            
            self._log("✅ Video and caption combination completed", config)
            
            # Step 5: Generate metadata
            processing_time = time.time() - start_time
            metadata = {
                "input_video": config.input_video,
                "layout_mode": config.layout_mode.value,
                "caption_template": config.caption_template,
                "processing_time_seconds": round(processing_time, 2),
                "output_format": "1080x1920 (vertical)",
                "segments_processed": len(segments),
                "caption_file": os.path.basename(caption_file)
            }
            
            # Step 6: Cleanup
            self._cleanup_temp_files(config)
            
            self._log(f"🎉 Processing completed successfully in {processing_time:.2f}s", config)
            self._log(f"📁 Output saved: {config.output_video}", config)
            
            return ProcessingResult(
                success=True,
                output_path=config.output_video,
                processing_time=processing_time,
                metadata=metadata
            )
            
        except Exception as e:
            # Cleanup on error
            self._cleanup_temp_files(config)
            
            error_msg = f"Processing failed: {str(e)}"
            self._log(f"❌ {error_msg}", config)
            
            return ProcessingResult(
                success=False,
                error_message=error_msg,
                processing_time=time.time() - start_time
            )


def create_config_from_args(args) -> ProcessingConfig:
    """Create ProcessingConfig from command line arguments."""
    return ProcessingConfig(
        input_video=args.input,
        output_video=args.output,
        layout_mode=LayoutMode(args.layout),
        caption_template=args.template,
        blur_strength=args.blur_strength,
        cleanup_temp_files=not args.keep_temp_files,
        verbose=not args.quiet,
        dynamic_speaker=args.dynamic_speaker
    )


def main():
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Unified Video Processing Pipeline",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s input.mp4 -o output.mp4 --layout square --template BeastMode
  %(prog)s video.mp4 -o result.mp4 -l fit -t RageMode --blur-strength 15
  %(prog)s input.mp4 -o output.mp4 -l fill -t HypeTrain --quiet
  
Available Templates: BeastMode, RageMode, HypeTrain, GlitchStreamer, CodeFlow
Available Layouts: fit, fill, square
        """
    )
    
    # Required arguments
    parser.add_argument('input', help='Input video file path')
    parser.add_argument('-o', '--output', required=True, help='Output video file path')
    
    # Processing options
    parser.add_argument('--layout', choices=['fit', 'fill', 'square', 'auto', 'side-by-side', 'picture-in-picture', 'stacked'], default='fit',
                        help='Video layout mode')
    parser.add_argument('--dynamic-speaker', action='store_true',
                        help='Enable dynamic speaker switching for podcasts (switches based on who is speaking)')
    
    parser.add_argument('-t', '--template',
                       default='BeastMode',
                       help='Caption template (default: BeastMode)')
    
    parser.add_argument('--blur-strength',
                       type=int, default=10, metavar='N',
                       help='Background blur strength 1-50 (default: 10)')
    
    # Utility options
    parser.add_argument('--list-templates', action='store_true',
                       help='List available caption templates and exit')
    
    parser.add_argument('--list-layouts', action='store_true',
                       help='List available layout modes and exit')
    
    parser.add_argument('--keep-temp-files', action='store_true',
                       help='Keep temporary files for debugging')
    
    parser.add_argument('-q', '--quiet', action='store_true',
                       help='Suppress verbose output')
    
    parser.add_argument('--json-output', action='store_true',
                       help='Output result as JSON')
    
    args = parser.parse_args()
    
    # Handle list commands
    pipeline = VideoProcessingPipeline()
    
    if args.list_templates:
        print("Available Caption Templates:")
        for template in pipeline.get_available_templates():
            print(f"  - {template}")
        sys.exit(0)
    
    if args.list_layouts:
        print("Available Layout Modes:")
        for layout in pipeline.get_available_layouts():
            print(f"  - {layout}")
        sys.exit(0)
    
    # Process video
    config = create_config_from_args(args)
    result = pipeline.process_video(config)
    
    # Output result
    if args.json_output:
        print(json.dumps(asdict(result), indent=2))
    elif not args.quiet:
        if result.success:
            print(f"\n🎉 SUCCESS!")
            print(f"📁 Output: {result.output_path}")
            print(f"⏱️  Time: {result.processing_time:.2f}s")
            if result.metadata:
                print(f"🎬 Layout: {result.metadata['layout_mode']}")
                print(f"📝 Template: {result.metadata['caption_template']}")
                print(f"📊 Segments: {result.metadata['segments_processed']}")
        else:
            print(f"\n❌ FAILED: {result.error_message}")
    
    sys.exit(0 if result.success else 1)


if __name__ == "__main__":
    main()
