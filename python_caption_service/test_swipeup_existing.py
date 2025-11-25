#!/usr/bin/env python3
"""
Test SwipeUp captions using existing video files
"""

import os
from opus_processor import OpusProcessor

def test_swipeup_with_existing_video():
    """Test SwipeUp captions with existing video file"""
    
    # Check for existing video files
    video_files = [
        "final_caption_test.mp4",
        "test_caption_output.mp4", 
        "test_square_captions_fixed.mp4"
    ]
    
    input_video = None
    for video_file in video_files:
        if os.path.exists(video_file):
            input_video = video_file
            break
    
    if not input_video:
        print("❌ No existing video files found for testing")
        return False
    
    print(f"🧪 Testing SwipeUp captions with existing video: {input_video}")
    
    # Create test segments (simulating word-level timing)
    test_segments = [
        {"start": 0.0, "end": 0.5, "text": "HELLO"},
        {"start": 0.5, "end": 1.0, "text": "WORLD"},
        {"start": 1.0, "end": 1.5, "text": "THIS"},
        {"start": 1.5, "end": 2.0, "text": "IS"},
        {"start": 2.0, "end": 2.5, "text": "SWIPEUP"},
        {"start": 2.5, "end": 3.0, "text": "CAPTIONS"},
        {"start": 3.0, "end": 3.5, "text": "WITH"},
        {"start": 3.5, "end": 4.0, "text": "PROGRESSIVE"},
        {"start": 4.0, "end": 4.5, "text": "FILL"},
        {"start": 4.5, "end": 5.0, "text": "ANIMATION"}
    ]
    
    print(f"   📋 Created {len(test_segments)} test segments")
    
    # Initialize OpusProcessor
    processor = OpusProcessor()
    
    try:
        # Generate SwipeUp captions
        print("   📝 Generating SwipeUp captions...")
        ass_content = processor.generate_karaoke_captions(
            segments=test_segments,
            template_name="SwipeUp",
            audio_path=None,
            layout_mode="fit"
        )
        
        print(f"   ✅ ASS content generated: {len(ass_content)} characters")
        
        # Count dialogue events
        dialogue_count = ass_content.count('Dialogue:')
        print(f"   📋 Dialogue events: {dialogue_count}")
        
        if dialogue_count == 0:
            print("   ❌ No dialogue events found!")
            return False
        
        # Save ASS file
        ass_file = "test_swipeup_captions.ass"
        with open(ass_file, 'w', encoding='utf-8') as f:
            f.write(ass_content)
        print(f"   📁 ASS file saved: {ass_file}")
        
        # Test FFmpeg caption burning
        output_video = "test_swipeup_output.mp4"
        
        import subprocess
        import tempfile
        import shutil
        
        with tempfile.TemporaryDirectory() as temp_dir:
            # Copy ASS file to temp directory with simple name
            simple_ass_path = os.path.join(temp_dir, "captions.ass")
            shutil.copy2(ass_file, simple_ass_path)
            
            # Change to temp directory for FFmpeg
            original_cwd = os.getcwd()
            os.chdir(temp_dir)
            
            try:
                # FFmpeg command to burn captions
                ffmpeg_cmd = [
                    'ffmpeg', '-y',
                    '-i', os.path.abspath(os.path.join(original_cwd, input_video)),
                    '-vf', 'ass=captions.ass',
                    '-c:v', 'libx264', '-crf', '23', '-preset', 'fast',
                    '-c:a', 'copy',
                    '-t', '10',  # Only process first 10 seconds
                    os.path.abspath(os.path.join(original_cwd, output_video))
                ]
                
                print(f"   🔥 Burning captions with FFmpeg...")
                result = subprocess.run(ffmpeg_cmd, capture_output=True, text=True)
                
                # Restore directory
                os.chdir(original_cwd)
                
                if result.returncode == 0:
                    print(f"   ✅ SwipeUp captions burned successfully!")
                    print(f"   📁 Output video: {output_video}")
                    print(f"   🎬 Play the video to see SwipeUp progressive fill animations")
                    return True
                else:
                    print(f"   ❌ FFmpeg failed: {result.stderr}")
                    return False
                    
            except Exception as e:
                os.chdir(original_cwd)
                print(f"   ❌ Error during caption burning: {e}")
                return False
        
    except Exception as e:
        print(f"   ❌ Error generating SwipeUp captions: {e}")
        return False

if __name__ == "__main__":
    success = test_swipeup_with_existing_video()
    print(f"\n{'✅ SUCCESS' if success else '❌ FAILED'}: SwipeUp caption test")
