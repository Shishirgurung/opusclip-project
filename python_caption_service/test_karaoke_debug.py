#!/usr/bin/env python3
"""
Debug script to test Karaoke caption generation in isolation
"""

from opus_processor import OpusProcessor

def test_karaoke_generation():
    """Test Karaoke caption generation with simple segments"""
    
    # Create simple test segments
    test_segments = [
        {"start": 0.0, "end": 1.0, "text": "Hello"},
        {"start": 1.0, "end": 2.0, "text": "world"},
        {"start": 2.0, "end": 3.0, "text": "test"},
        {"start": 3.0, "end": 4.0, "text": "captions"}
    ]
    
    print("🧪 Testing Karaoke caption generation...")
    print(f"   Input segments: {len(test_segments)}")
    
    # Initialize OpusProcessor
    processor = OpusProcessor()
    
    try:
        # Generate Karaoke captions
        ass_content = processor.generate_karaoke_captions(
            segments=test_segments,
            template_name="Karaoke",
            audio_path=None,
            layout_mode="fit"
        )
        
        print(f"   ✅ ASS content generated: {len(ass_content)} characters")
        
        # Count dialogue events
        dialogue_count = ass_content.count('Dialogue:')
        print(f"   📋 Dialogue events: {dialogue_count}")
        
        # Save for inspection
        with open("test_karaoke_output.ass", 'w', encoding='utf-8') as f:
            f.write(ass_content)
        
        print(f"   📁 Saved to: test_karaoke_output.ass")
        
        # Show preview
        print(f"   📋 Preview:")
        print(ass_content[:500] + "..." if len(ass_content) > 500 else ass_content)
        
        return dialogue_count > 0
        
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False

if __name__ == "__main__":
    success = test_karaoke_generation()
    print(f"\n{'✅ SUCCESS' if success else '❌ FAILED'}: Karaoke generation test")
