import os
import json
import subprocess
from opus_processor import OpusProcessor
from faster_whisper import WhisperModel

def extract_audio(video_path, audio_path):
    """Extracts audio from video file using ffmpeg."""
    print("Extracting audio from video...")
    command = [
        "ffmpeg", "-i", video_path, "-vn", "-acodec", "pcm_s16le", 
        "-ar", "16000", "-ac", "1", "-y", audio_path
    ]
    subprocess.run(command, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    print(f"Audio extracted to {audio_path}")

def transcribe_audio(audio_path):
    """Transcribes audio using faster-whisper and returns segments."""
    print("Loading Whisper model...")
    model = WhisperModel("base", device="cpu", compute_type="int8")
    print("Transcribing audio...")
    segments, _ = model.transcribe(audio_path, word_timestamps=True)
    word_segments = []
    for segment in segments:
        for word in segment.words:
            word_segments.append({
                'word': word.word,
                'start': word.start,
                'end': word.end
            })
    print("Transcription complete.")
    return word_segments

def main():
    video_path = "podcast.mp4"  # Using the lengthy podcast video
    audio_path = "podcast_lengthy_audio.wav"  # New audio file for lengthy podcast
    output_ass_path = "podcast_lengthy_captions.ass"  # New output file
    template_name = "PodcastPro"

    # Step 1: Extract audio from video
    if not os.path.exists(audio_path):
        print("Extracting audio from video...")
        extract_audio(video_path, audio_path)
        print(f"Audio extracted to {audio_path}")
    else:
        print(f"Audio file {audio_path} already exists.")

    # Step 2: Transcribe audio to get word segments
    segments = transcribe_audio(audio_path)

    # Step 3: Initialize OpusProcessor and generate captions
    processor = OpusProcessor()
    print(f"Generating captions with '{template_name}' style...")
    ass_content = processor.generate_karaoke_captions(
        segments=segments, 
        template_name=template_name, 
        audio_path=audio_path
    )

    # Step 4: Save the .ass file and perform final verification
    if not ass_content:
        print("\nFAILURE: The processor returned empty content.")
        return

    with open(output_ass_path, "w", encoding="utf-8") as f:
        f.write(ass_content)
    
    print(f"\nSuccessfully generated captions: {output_ass_path}")
    print("Performing final verification...")

    try:
        with open(output_ass_path, "r", encoding="utf-8") as f:
            content = f.read()
            if "1c&H" in content:
                print("\n--- VERIFICATION PASSED ---")
                print("SUCCESS: Color codes found in the file. The PodcastPro style is working.")
            else:
                print("\n--- VERIFICATION FAILED ---")
                print("FAILURE: Color codes were NOT found in the generated file.")
    except Exception as e:
        print(f"\nERROR: Could not read or verify the file: {e}")

if __name__ == "__main__":
    main()
