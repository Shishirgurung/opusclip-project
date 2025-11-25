#!/usr/bin/env python3
"""
Test script to verify caption burning works
"""

import os
import subprocess
import tempfile

def test_caption_burning():
    """Test if caption burning works with a simple video"""
    
    # Create a simple test ASS file
    ass_content = """[Script Info]
Title: Test Captions
ScriptType: v4.00+

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial Black,72,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,3,0,2,10,10,50,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,0:00:05.00,Default,,0,0,0,,TEST CAPTIONS WORKING!
Dialogue: 0,0:00:05.00,0:00:10.00,Default,,0,0,0,,VIRAL CLIP GENERATOR
Dialogue: 0,0:00:10.00,0:00:15.00,Default,,0,0,0,,SWIPEUP STYLE CAPTIONS
Dialogue: 0,0:00:15.00,0:00:20.00,Default,,0,0,0,,CAPTION BURNING SUCCESS!
"""
    
    with tempfile.TemporaryDirectory() as temp_dir:
        # Save ASS file
        ass_path = os.path.join(temp_dir, "test_captions.ass")
        with open(ass_path, 'w', encoding='utf-8') as f:
            f.write(ass_content)
        
        # Check if we have any existing video files to test with
        clips_dir = "exports/clips"
        if os.path.exists(clips_dir):
            video_files = [f for f in os.listdir(clips_dir) if f.endswith('.mp4')]
            if video_files:
                input_video = os.path.join(clips_dir, video_files[0])
                output_video = os.path.join(clips_dir, "test_with_captions.mp4")
                
                print(f"🧪 Testing caption burning...")
                print(f"   Input: {input_video}")
                print(f"   Output: {output_video}")
                print(f"   ASS file: {ass_path}")
                
                # Change to temp directory
                original_cwd = os.getcwd()
                os.chdir(temp_dir)
                
                # Copy ASS file with simple name
                simple_ass_path = os.path.join(temp_dir, "captions.ass")
                with open(ass_path, 'r', encoding='utf-8') as src:
                    with open(simple_ass_path, 'w', encoding='utf-8') as dst:
                        dst.write(src.read())
                
                # FFmpeg command with ass filter
                ffmpeg_cmd = [
                    'ffmpeg', '-y',
                    '-i', os.path.abspath(input_video),
                    '-vf', 'ass=captions.ass',
                    '-c:v', 'libx264', '-crf', '23', '-preset', 'fast',
                    '-c:a', 'copy',
                    os.path.abspath(output_video)
                ]
                
                print(f"   📋 FFmpeg command: {' '.join(ffmpeg_cmd)}")
                
                result = subprocess.run(ffmpeg_cmd, capture_output=True, text=True, cwd=temp_dir)
                
                # Restore directory
                os.chdir(original_cwd)
                
                if result.returncode == 0:
                    print(f"   ✅ Caption burning test successful!")
                    print(f"   📁 Output file: {output_video}")
                    return True
                else:
                    print(f"   ❌ Caption burning test failed!")
                    print(f"   📋 FFmpeg stderr: {result.stderr}")
                    return False
            else:
                print("❌ No video files found in exports/clips to test with")
                return False
        else:
            print("❌ exports/clips directory not found")
            return False

if __name__ == "__main__":
    test_caption_burning()
