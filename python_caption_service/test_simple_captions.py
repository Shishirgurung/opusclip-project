#!/usr/bin/env python3
"""
Test script to manually burn simple captions into an existing video
"""

import os
import subprocess

def test_simple_caption_burning():
    """Test caption burning with a very simple ASS file"""
    
    # Create a very simple ASS file that should definitely be visible
    simple_ass_content = """[Script Info]
Title: Simple Test
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial Black,100,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,4,2,2,50,50,100,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,0:00:30.00,Default,,0,0,0,,HELLO WORLD - TEST CAPTIONS
Dialogue: 0,0:00:05.00,0:00:25.00,Default,,0,0,0,,THIS IS A SIMPLE TEST
Dialogue: 0,0:00:10.00,0:00:20.00,Default,,0,0,0,,CAPTIONS SHOULD BE VISIBLE
"""
    
    # Check if we have video files to test with
    clips_dir = "exports/clips"
    if os.path.exists(clips_dir):
        video_files = [f for f in os.listdir(clips_dir) if f.endswith('.mp4')]
        if video_files:
            input_video = os.path.join(clips_dir, video_files[0])
            output_video = os.path.join(clips_dir, "test_simple_captions.mp4")
            ass_file = "test_simple.ass"
            
            # Write the simple ASS file
            with open(ass_file, 'w', encoding='utf-8') as f:
                f.write(simple_ass_content)
            
            print(f"🧪 Testing simple caption burning...")
            print(f"   Input: {input_video}")
            print(f"   Output: {output_video}")
            print(f"   ASS file: {ass_file}")
            
            # FFmpeg command with subtitles filter (more compatible)
            ffmpeg_cmd = [
                'ffmpeg', '-y',
                '-i', input_video,
                '-vf', f'subtitles={ass_file}',
                '-c:v', 'libx264', '-crf', '23', '-preset', 'fast',
                '-c:a', 'copy',
                output_video
            ]
            
            print(f"   📋 FFmpeg command: {' '.join(ffmpeg_cmd)}")
            
            result = subprocess.run(ffmpeg_cmd, capture_output=True, text=True)
            
            if result.returncode == 0:
                print(f"   ✅ Simple caption burning successful!")
                print(f"   📁 Test output: {output_video}")
                print(f"   🎬 Try playing this file to see if captions appear")
                return True
            else:
                print(f"   ❌ Simple caption burning failed!")
                print(f"   📋 FFmpeg stderr: {result.stderr}")
                return False
        else:
            print("❌ No video files found to test with")
            return False
    else:
        print("❌ exports/clips directory not found")
        return False

if __name__ == "__main__":
    test_simple_caption_burning()
