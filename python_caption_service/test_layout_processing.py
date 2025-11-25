"""
Test script for video layout processing with square/fit/fill modes.
This tests the complete video processing pipeline including layout scaling.
"""

import os
import sys
import argparse
from opus_processor import OpusProcessor

def test_layout_processing(input_video, layout_mode, output_video=None):
    """Test video layout processing with different modes using existing vertical processing."""
    
    if not os.path.exists(input_video):
        print(f"Error: Input video not found: {input_video}")
        return False
    
    if not output_video:
        video_name = os.path.splitext(os.path.basename(input_video))[0]
        output_video = f"{video_name}_{layout_mode}_layout.mp4"
    
    print(f"Processing video: {input_video}")
    print(f"Layout mode: {layout_mode}")
    print(f"Output: {output_video}")
    
    try:
        # Use existing vertical processing with layout mode
        processor = OpusProcessor()
        processor.process_video_for_vertical(
            input_path=input_video,
            output_path=output_video,
            layout_mode=layout_mode
        )
        
        print(f"✅ Success! Layout processed video saved: {output_video}")
        print(f"📱 Video format: 1080x1920 (vertical)")
        
        if layout_mode.lower() == "square":
            print("🔲 Square mode: Square aspect ratio (1080px) positioned slightly higher")
            print("📍 Caption space: Bottom blur area clear for captions")
        elif layout_mode.lower() == "fit":
            print("📐 Fit mode: Standard video scaling with blur background")
            print("📍 Caption space: Safe zones available")
            
        return True
        
    except Exception as e:
        print(f"❌ Error during layout processing: {e}")
        return False

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Test video layout processing")
    parser.add_argument("input_video", help="Path to input video file")
    parser.add_argument("--layout", default="square", choices=["fit", "square", "fill"], 
                       help="Layout mode to test")
    parser.add_argument("--output", help="Output video path (optional)")
    
    args = parser.parse_args()
    
    success = test_layout_processing(args.input_video, args.layout, args.output)
    sys.exit(0 if success else 1)
