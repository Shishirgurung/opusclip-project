#!/usr/bin/env python3
"""
Test subtitle burning in isolation to debug the issue
"""
import os
import subprocess
from moviepy.editor import VideoFileClip, TextClip, CompositeVideoClip
from opus_processor import OpusProcessor

def test_subtitle_burning():
    # Use the existing video file
    input_video = "exports/processed_youtube_ZzI9JE0i6Lc_opus_swipeup_1757784960.mp4"
    
    if not os.path.exists(input_video):
        print(f"Input video not found: {input_video}")
        return
    
    print(f"Testing subtitle burning with: {input_video}")
    
    # Generate test subtitles
    processor = OpusProcessor()
    
    # Create a simple test transcription
    test_segments = [
        {"start": 0.0, "end": 3.0, "text": "This is a test caption"},
        {"start": 3.0, "end": 6.0, "text": "Testing subtitle burning"},
        {"start": 6.0, "end": 9.0, "text": "With SwipeUp template"}
    ]
    
    # Generate ASS file
    template = {
        "name": "SwipeUp",
        "fontFamily": "Arial",
        "fontSize": 48,
        "fontColor": "#FFFFFF",
        "shadowColor": "#000000",
        "position": "bottom"
    }
    
    ass_path = "test_subtitles.ass"
    # Use the correct method from processing.py
    ass_content = processor.generate_karaoke_captions(
        test_segments, template['name'], layout_mode="fit"
    )
    
    # Write ASS content to file
    with open(ass_path, 'w', encoding='utf-8') as f:
        f.write(ass_content)
    
    print(f"ASS file created: {os.path.exists(ass_path)}")
    
    if os.path.exists(ass_path):
        with open(ass_path, 'r', encoding='utf-8') as f:
            print("ASS content preview:")
            print(f.read()[:500])
    
    # Test FFmpeg subtitle burning
    output_path = "test_with_subtitles.mp4"
    
    try:
        print("Testing FFmpeg subtitle burning...")
        ffmpeg_cmd = [
            'ffmpeg', '-y',
            '-i', input_video,
            '-vf', f'subtitles={ass_path.replace(chr(92), "/")}',
            '-c:a', 'copy',
            '-c:v', 'libx264', '-crf', '23', '-preset', 'fast',
            output_path
        ]
        
        print(f"FFmpeg command: {' '.join(ffmpeg_cmd)}")
        result = subprocess.run(ffmpeg_cmd, capture_output=True, text=True, check=True)
        print("FFmpeg subtitle burning successful!")
        print(f"Output file created: {os.path.exists(output_path)}")
        
        if os.path.exists(output_path):
            # Get output video info
            probe_cmd = ['ffprobe', '-v', 'quiet', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', output_path]
            probe_result = subprocess.run(probe_cmd, capture_output=True, text=True)
            print(f"Output dimensions: {probe_result.stdout.strip()}")
        
    except subprocess.CalledProcessError as e:
        print(f"FFmpeg failed: {e}")
        print(f"FFmpeg stderr: {e.stderr}")
        
        # Try MoviePy as fallback
        print("Testing MoviePy subtitle rendering...")
        try:
            video = VideoFileClip(input_video)
            
            # Create simple text overlay
            txt_clip = TextClip("TEST SUBTITLE", fontsize=48, color='white', font='Arial')
            txt_clip = txt_clip.set_position(('center', 'bottom')).set_duration(10)
            
            final_video = CompositeVideoClip([video, txt_clip])
            moviepy_output = "test_moviepy_subtitles.mp4"
            final_video.write_videofile(moviepy_output, codec='libx264', audio_codec='aac')
            
            video.close()
            final_video.close()
            txt_clip.close()
            
            print(f"MoviePy output created: {os.path.exists(moviepy_output)}")
            
        except Exception as moviepy_error:
            print(f"MoviePy also failed: {moviepy_error}")

if __name__ == "__main__":
    test_subtitle_burning()
