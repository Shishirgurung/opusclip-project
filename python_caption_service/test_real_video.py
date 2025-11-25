"""
Test script for processing real video files with karaoke captions.
This script can be used to test the karaoke animation with actual speech.
"""

import os
import sys
import argparse
import tempfile
import subprocess
from faster_whisper import WhisperModel
from opus_processor import OpusProcessor

def extract_audio_from_video(video_path, temp_dir):
    """Extract audio from video for transcription."""
    audio_path = os.path.join(temp_dir, "extracted_audio.wav")
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

def transcribe_video_with_whisper(video_path):
    """Transcribe video using faster-whisper with word-level timestamps."""
    print("Extracting audio from video...")
    
    with tempfile.TemporaryDirectory() as temp_dir:
        # Extract audio
        audio_path = extract_audio_from_video(video_path, temp_dir)
        
        print("Loading Whisper model...")
        # Load whisper model (same as your processing.py)
        model = WhisperModel("base", device="cpu", compute_type="int8")
        
        print("Transcribing audio (this may take a moment)...")
        # Transcribe with word timestamps
        segments, info = model.transcribe(audio_path, word_timestamps=True)
        
        # Convert generator to list
        transcription_segments = list(segments)
        
        print(f"Transcription complete! Language: {info.language} (confidence: {info.language_probability:.2f})")
        print(f"Found {len(transcription_segments)} segments")
        
        return transcription_segments

def process_real_video_captions(video_path, output_ass_path, template_name="OpusClipStyle", layout_mode="fit"):
    """
    Process a real video file and generate karaoke captions using actual transcription.
    """
    
    print(f"Processing video: {video_path}")
    print("Using REAL transcription from faster-whisper!")
    
    # Initialize processor
    processor = OpusProcessor()
    

    
    try:
        # Get real transcription from the video
        transcription_segments = transcribe_video_with_whisper(video_path)
        
        if not transcription_segments:
            print("Warning: No speech detected in video. Using sample data.")
            # Fallback to sample data if no speech detected
            from collections import namedtuple
            Word = namedtuple('Word', ['start', 'end', 'word', 'probability'])
            Segment = namedtuple('Segment', ['start', 'end', 'text', 'words'])
            transcription_segments = [
                Segment(
                    start=0.0, end=3.0, text="No speech detected in video",
                    words=[
                        Word(start=0.5, end=1.0, word="No", probability=0.95),
                        Word(start=1.0, end=1.5, word="speech", probability=0.95),
                        Word(start=1.5, end=2.0, word="detected", probability=0.95),
                    ]
                )
            ]
        else:
            # Print transcription preview
            print("\n=== TRANSCRIPTION PREVIEW ===")
            for i, segment in enumerate(transcription_segments[:3]):  # Show first 3 segments
                print(f"Segment {i+1}: {segment.text}")
                if hasattr(segment, 'words') and segment.words:
                    word_count = len(list(segment.words))
                    print(f"  Words: {word_count} words with timestamps")
            if len(transcription_segments) > 3:
                print(f"... and {len(transcription_segments) - 3} more segments")
            print("=== END PREVIEW ===\n")
        
    except Exception as e:
        print(f"Error during transcription: {e}")
        print("Falling back to sample data for testing...")
        # Use sample data as fallback
        from collections import namedtuple
        Word = namedtuple('Word', ['start', 'end', 'word', 'probability'])
        Segment = namedtuple('Segment', ['start', 'end', 'text', 'words'])
        transcription_segments = [
            Segment(
                start=0.0, end=6.5, text="Transcription failed - using sample data",
                words=[
                    Word(start=0.1, end=1.0, word="Transcription", probability=0.95),
                    Word(start=1.1, end=1.8, word="failed", probability=0.95),
                    Word(start=2.0, end=2.2, word="-", probability=0.95),
                    Word(start=2.3, end=2.8, word="using", probability=0.95),
                    Word(start=2.9, end=3.4, word="sample", probability=0.95),
                    Word(start=3.5, end=4.0, word="data", probability=0.95),
                ]
            )
        ]
    
    # Generate ASS content with real transcription
    print("Generating karaoke captions...")
    ass_content = processor.generate_karaoke_captions(
        segments=transcription_segments,
        template_name=template_name,
        layout_mode=layout_mode
    )
    
    # Save to file
    with open(output_ass_path, 'w', encoding='utf-8') as f:
        f.write(ass_content)
    
    print(f"Generated karaoke captions: {output_ass_path}")
    print("\nTo test:")
    print(f"1. Open VLC media player")
    print(f"2. Load your video: {video_path}")
    print(f"3. Add subtitle file: {output_ass_path}")
    print(f"4. Play and observe the karaoke animation sync with speech")

if __name__ == "__main__":
    import time

    parser = argparse.ArgumentParser(description="Generate karaoke captions and optionally process video for vertical format.")
    parser.add_argument("video_path", help="Path to the video file.")
    parser.add_argument("--vertical", action="store_true", help="Process the video into a 9:16 vertical format with a blurred background.")
    parser.add_argument("--template", default="OpusClipStyle", help="Template name for caption style (OpusClipStyle, SwipeUp, Karaoke, Beast, PodcastPro, CodeFlow, RageMode, HypeTrain, GlitchStreamer, BeastMode).")
    parser.add_argument("--layout", default="fit", choices=["fit", "square", "fill", "auto"], help="Video layout mode for caption positioning (fit=bottom safe zone, square=multiple positions, fill=center).")
    
    args = parser.parse_args()
    
    video_path = args.video_path
    if not os.path.exists(video_path):
        print(f"Error: Video file not found: {video_path}")
        sys.exit(1)
        
    video_name = os.path.splitext(os.path.basename(video_path))[0]
    timestamp = int(time.time())
    
    # --- Step 1: Process video if requested ---
    if args.vertical:
        print("\n--- Vertical Video Processing ---")
        processor = OpusProcessor()
        vertical_output_path = f"{video_name}_vertical_{timestamp}.mp4"
        print(f"Generating vertical video: {vertical_output_path}")
        try:
            processor.process_video_for_vertical(video_path, vertical_output_path)
            print(f"Successfully created vertical video: {vertical_output_path}")
            video_path = vertical_output_path  # Update video_path to use the new vertical video
        except Exception as e:
            print(f"Error during vertical video processing: {e}")
            sys.exit(1)
        print("--- End Vertical Video Processing ---\n")

    # --- Step 2: Generate captions (always) ---
    output_ass = f"{video_name}_{args.template.lower()}_{timestamp}.ass"
    process_real_video_captions(video_path, output_ass, args.template, args.layout)
