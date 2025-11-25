#!/usr/bin/env python3
"""
Test Glitch captions in isolation to debug the issue
"""

import os
from opus_processor import OpusProcessor

def test_glitch_captions():
    """Test Glitch captions generation in isolation"""
    
    print("🔧 Testing Glitch captions in isolation...")
    
    # Create test segments (simulating word-level segments)
    test_segments = [
        {'text': 'This', 'start': 0.0, 'end': 0.5},
        {'text': 'is', 'start': 0.5, 'end': 0.8},
        {'text': 'a', 'start': 0.8, 'end': 1.0},
        {'text': 'glitch', 'start': 1.0, 'end': 1.5},
        {'text': 'test', 'start': 1.5, 'end': 2.0},
        {'text': 'with', 'start': 2.0, 'end': 2.3},
        {'text': 'digital', 'start': 2.3, 'end': 2.8},
        {'text': 'effects', 'start': 2.8, 'end': 3.5}
    ]
    
    # Initialize OpusProcessor
    processor = OpusProcessor()
    
    # Generate Glitch captions
    print("📝 Generating Glitch captions...")
    print(f"📋 Test segments: {len(test_segments)}")
    for i, seg in enumerate(test_segments):
        print(f"   {i+1}: '{seg['text']}' ({seg['start']:.1f}s - {seg['end']:.1f}s)")
    
    try:
        ass_content = processor.generate_karaoke_captions(test_segments, "Glitch")
        
        # Save to debug file
        debug_file = "debug_glitch_captions.ass"
        with open(debug_file, 'w', encoding='utf-8') as f:
            f.write(ass_content)
        
        print(f"✅ Glitch captions generated!")
        print(f"📋 ASS file saved to: {debug_file}")
        print(f"📋 ASS content length: {len(ass_content)} characters")
        
        # Show first few lines of ASS content
        lines = ass_content.split('\n')
        print(f"📋 First 10 lines of ASS:")
        for i, line in enumerate(lines[:10]):
            print(f"   {i+1}: {line}")
        
        # Count dialogue events
        dialogue_lines = [line for line in lines if line.startswith('Dialogue:')]
        print(f"📋 Dialogue events found: {len(dialogue_lines)}")
        
        if dialogue_lines:
            print(f"📋 Sample dialogue event:")
            print(f"   {dialogue_lines[0]}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error generating Glitch captions: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    test_glitch_captions()
