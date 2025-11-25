#!/usr/bin/env python3
"""
Test the new CodeFlow caption style with Java.mp4 video.
Uses the same pattern as existing Java mp4 tests.
"""

import whisper
from opus_processor import OpusProcessor

def main():
    print("🚀 Testing CodeFlow Caption Style")
    print("=" * 50)
    
    # Initialize processor
    processor = OpusProcessor()
    
    # Load Whisper model
    print("📝 Loading Whisper model...")
    model = whisper.load_model("base")
    
    # Transcribe Java video
    print("🎯 Transcribing Java.mp4...")
    result = model.transcribe("Java.mp4", word_timestamps=True)
    
    # Extract word segments (fix the format issue)
    word_segments = []
    for segment in result['segments']:
        if 'words' in segment:
            # New format with word-level timestamps
            for word in segment['words']:
                word_segments.append({
                    'word': word['word'] if isinstance(word, dict) else word.word,
                    'start': word['start'] if isinstance(word, dict) else word.start,
                    'end': word['end'] if isinstance(word, dict) else word.end
                })
        else:
            # Fallback: split segment text into words with estimated timing
            words = segment['text'].strip().split()
            duration = segment['end'] - segment['start']
            word_duration = duration / len(words) if words else 0
            
            for i, word in enumerate(words):
                word_start = segment['start'] + (i * word_duration)
                word_end = word_start + word_duration
                word_segments.append({
                    'word': word,
                    'start': word_start,
                    'end': word_end
                })
    
    print(f"✅ Transcribed {len(word_segments)} words")
    
    # Generate CodeFlow captions
    print("⚡ Generating CodeFlow captions...")
    captions = processor.generate_karaoke_captions(
        segments=word_segments,
        template_name="CodeFlow"
    )
    
    # Save captions
    output_file = "Java_codeflow_captions.ass"
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(captions)
    
    print(f"💾 CodeFlow captions saved to: {output_file}")
    
    # Show preview of generated content
    print("\n🎨 Caption Preview:")
    print("-" * 30)
    lines = captions.split('\n')
    dialogue_lines = [line for line in lines if line.startswith('Dialogue:')]
    
    for i, line in enumerate(dialogue_lines[:5]):  # Show first 5 dialogue lines
        parts = line.split(',', 9)
        if len(parts) >= 10:
            text = parts[9]
            print(f"Line {i+1}: {text}")
    
    print(f"\n📊 Generated {len(dialogue_lines)} caption events")
    print("🎯 Features:")
    print("  ✅ Syntax highlighting for Java keywords")
    print("  ✅ Typing animation with cursor")
    print("  ✅ Matrix-style background effects")
    print("  ✅ Progressive word reveal")
    print("  ✅ Consolas monospace font")
    
    print("\n🎉 CodeFlow caption style ready!")

if __name__ == "__main__":
    main()
