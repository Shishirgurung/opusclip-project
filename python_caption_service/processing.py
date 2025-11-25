import os
from faster_whisper import WhisperModel
import shutil
import tempfile
import subprocess

import json
import re
import uuid
import time
import sys
import traceback
from rq import get_current_job

# Import the OpusProcessor and its constants from the correct file
from opus_processor import OpusProcessor, OPUS_TEMPLATES, OPUS_ANIMATION_STYLES, DEFAULT_HIGHLIGHT_COLORS

# --- Helper Functions ---

def update_job_progress(percentage, stage, message):
    """Helper to update the job progress in Redis."""
    job = get_current_job()
    if job:
        job.meta['progress'] = {
            'percentage': percentage,
            'stage': stage,
            'message': message
        }
        job.save_meta()
        print(f"Job {job.id} Progress: {percentage}% - {stage} - {message}")

def validate_youtube_url(url):
    if not url or not isinstance(url, str): return False, "URL must be a non-empty string"
    youtube_patterns = [
        r'(?:https?://)?(?:www\.)?youtube\.com/watch\?v=([a-zA-Z0-9_-]{11})',
        r'(?:https?://)?(?:www\.)?youtu\.be/([a-zA-Z0-9_-]{11})',
        r'(?:https?://)?(?:www\.)?youtube\.com/embed/([a-zA-Z0-9_-]{11})',
        r'(?:https?://)?(?:www\.)?youtube\.com/v/([a-zA-Z0-9_-]{11})'
    ]
    video_id = None
    for pattern in youtube_patterns:
        match = re.search(pattern, url)
        if match:
            video_id = match.group(1)
            break
    if not video_id: return False, "Invalid YouTube URL format."
    if len(video_id) != 11: return False, f"Invalid video ID length: {len(video_id)}."
    if video_id.startswith('--'): return False, f"Malformed video ID: {video_id}."
    if not re.match(r'^[a-zA-Z0-9_-]{11}$', video_id): return False, f"Invalid video ID characters: {video_id}."
    return True, "Valid YouTube URL"

def parse_yt_dlp_error(stderr_output, url):
    if not stderr_output: return "Unknown error occurred during download"
    stderr_lower = stderr_output.lower()
    if "video unavailable" in stderr_lower: return "Video is unavailable (may be private, deleted, or region-locked)"
    if "private video" in stderr_lower: return "Video is private and cannot be accessed"
    if "video has been removed" in stderr_lower: return "Video has been removed or does not exist"
    if "unsupported url" in stderr_lower: return "Unsupported URL format or invalid video ID"
    if "http error 404" in stderr_lower: return "Video not found (HTTP 404 error)"
    if "age-restricted" in stderr_lower: return "Video is age-restricted and requires sign-in"
    if "copyright" in stderr_lower: return "Video is not available due to copyright restrictions"
    video_id_match = re.search(r'(?:v=|/)([a-zA-Z0-9_-]{11})', url)
    video_id = video_id_match.group(1) if video_id_match else "unknown"
    return f"Download failed for video ID {video_id}. Details: {stderr_output[:200]}..."

def download_youtube_video(url, temp_dir):
    is_valid, validation_error = validate_youtube_url(url)
    if not is_valid: raise ValueError(f"Invalid YouTube URL: {validation_error}. URL: {url}")
    session_id = str(uuid.uuid4())
    output_template = os.path.join(temp_dir, f"downloaded_video_{session_id}.%(ext)s")
    command = [
        'yt-dlp', '--verbose', '--no-warnings', '--no-mtime',
        '--socket-timeout', '1800',
        '-f', 'bestvideo[ext=mp4]+bestaudio[ext=mp4]/best[ext=mp4]/best',
        '--merge-output-format', 'mp4',
        '-o', output_template, url
    ]
    try:
        process = subprocess.run(command, check=True, capture_output=True, text=True, timeout=1800)
        potential_files = [f for f in os.listdir(temp_dir) if f.startswith(f"downloaded_video_{session_id}")]
        if not potential_files: raise FileNotFoundError("yt-dlp success but file not found.")
        downloaded_path = os.path.join(temp_dir, potential_files[0])
        video_id_match = re.search(r'(?:v=|/)([a-zA-Z0-9_-]{11})', url)
        original_filename = f"youtube_{video_id_match.group(1)}" if video_id_match else "youtube_video"
        return downloaded_path, original_filename
    except subprocess.CalledProcessError as e:
        specific_error = parse_yt_dlp_error(e.stderr, url)
        raise Exception(f"YouTube download failed: {specific_error}") from e
    except subprocess.TimeoutExpired as e:
        raise Exception("YouTube download timed out.") from e

def get_video_dimensions(video_path):
    try:
        cmd = ['ffprobe', '-v', 'quiet', '-print_format', 'json', '-show_streams', '-select_streams', 'v:0', video_path]
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            data = json.loads(result.stdout)
            if 'streams' in data and len(data['streams']) > 0:
                stream = data['streams'][0]
                return int(stream.get('width', 0)), int(stream.get('height', 0))
        except (subprocess.CalledProcessError, ValueError) as e:
            print(f"Could not get video dimensions for {video_path}: {e}")
            return None, None
    except Exception:
        pass
    return None, None

def process_video_for_layout(input_path, output_path, layout_mode, target_width=1080, target_height=1920):
    """
    Process video based on layout mode:
    - fit: Scale video to fit within target dimensions while maintaining aspect ratio
    - square: Create square video in center with blur background for vertical format
    - fill: Scale video to fill entire target dimensions (may crop)
    """
    video_w, video_h = get_video_dimensions(input_path)
    if not video_w or not video_h:
        raise ValueError(f"Could not determine video dimensions for {input_path}")
    
    if layout_mode.lower() == "square":
        # Create square video with blur background for vertical format
        # Make video smaller/more vertical so captions fit in bottom blur area
        square_size = min(target_height - 600, target_width - 100)  # More space for captions
        
        # Position square higher in canvas to leave more bottom space for captions
        x_offset = (target_width - square_size) // 2
        y_offset = (target_height - square_size) // 2 - 100  # Shift up for caption space
        
        # FFmpeg filter for square layout with blur background:
        # 1. Create blurred background scaled to full canvas
        # 2. Overlay square video in center
        filter_complex = (
            f"[0:v]scale={target_width}:{target_height}:force_original_aspect_ratio=increase,"
            f"crop={target_width}:{target_height},gblur=sigma=20[bg];"
            f"[0:v]scale={square_size}:{square_size}:force_original_aspect_ratio=decrease,"
            f"pad={square_size}:{square_size}:(ow-iw)/2:(oh-ih)/2[sq];"
            f"[bg][sq]overlay={x_offset}:{y_offset}[out]"
        )
        
        cmd = [
            'ffmpeg', '-y', '-i', input_path,
            '-filter_complex', filter_complex,
            '-map', '[out]', '-map', '0:a?',
            '-c:a', 'copy', '-c:v', 'libx264', '-crf', '23', '-preset', 'fast',
            output_path
        ]
        
    elif layout_mode.lower() == "fit":
        # Scale to fit within canvas with blurred background (like OpusClip style)
        filter_complex = (
            f"[0:v]scale={target_width}:{target_height}:force_original_aspect_ratio=increase,"
            f"crop={target_width}:{target_height},gblur=sigma=15[bg];"
            f"[0:v]scale={target_width}:{target_height}:force_original_aspect_ratio=decrease,"
            f"pad={target_width}:{target_height}:(ow-iw)/2:(oh-ih)/2:black[fg];"
            f"[bg][fg]overlay[out]"
        )
        
        cmd = [
            'ffmpeg', '-y', '-i', input_path,
            '-filter_complex', filter_complex,
            '-map', '[out]', '-map', '0:a?',
            '-c:a', 'copy', '-c:v', 'libx264', '-crf', '23', '-preset', 'fast',
            output_path
        ]
        
    elif layout_mode.lower() == "fill":
        # Scale to fill entire canvas (may crop)
        filter_complex = (
            f"[0:v]scale={target_width}:{target_height}:force_original_aspect_ratio=increase,"
            f"crop={target_width}:{target_height}[out]"
        )
        
        cmd = [
            'ffmpeg', '-y', '-i', input_path,
            '-filter_complex', filter_complex,
            '-map', '[out]', '-map', '0:a?',
            '-c:a', 'copy', '-c:v', 'libx264', '-crf', '23', '-preset', 'fast',
            output_path
        ]
        
    else:
        # Default: just copy the video without layout processing
        cmd = ['ffmpeg', '-y', '-i', input_path, '-c', 'copy', output_path]
    
    try:
        print(f"DEBUG: Layout processing command: {' '.join(cmd)}")
        result = subprocess.run(cmd, check=True, capture_output=True, text=True)
        print(f"DEBUG: Layout processing completed successfully")
        if result.stderr:
            print(f"DEBUG: FFmpeg stderr: {result.stderr}")
        return output_path
    except subprocess.CalledProcessError as e:
        error_msg = f"Video layout processing failed: {e.stderr.decode() if e.stderr else str(e)}"
        print(f"DEBUG: Layout processing error: {error_msg}")
        raise Exception(error_msg)

# --- Main Processing Function ---

def run_opus_transcription(
    youtube_url, 
    opus_template, 
    clip_duration, 
    exports_dir, 
    original_filename=None, 
    layout_mode="auto",
    timeframe_start=None,
    timeframe_end=None,
    min_clip_length=30,
    max_clip_length=90,
    target_clip_length=60
):
    """
    This is the main function that will be executed by the background worker.
    It uses the OpusProcessor class to handle the core logic.
    
    Args:
        youtube_url: YouTube URL or video file path
        opus_template: Caption template configuration
        clip_duration: Duration for single clip mode
        exports_dir: Output directory for processed videos
        original_filename: Original filename (optional)
        layout_mode: Video layout mode (fit, fill, square, auto)
        timeframe_start: Start time in seconds for processing timeframe (optional)
        timeframe_end: End time in seconds for processing timeframe (optional)
        min_clip_length: Minimum clip length in seconds (default: 30)
        max_clip_length: Maximum clip length in seconds (default: 90)
        target_clip_length: Target/preferred clip length in seconds (default: 60)
    """

    # Skip Replicate token check for local processing
    # if not os.environ.get("REPLICATE_API_TOKEN"):
    #     raise RuntimeError("REPLICATE_API_TOKEN environment variable not set. The worker cannot process jobs.")

    temp_dir = tempfile.mkdtemp()
    processor = OpusProcessor()  # Create an instance of the processor

    try:
        update_job_progress(5, "Downloading", f"Downloading video from {youtube_url}")
        original_file_path, original_filename = download_youtube_video(youtube_url, temp_dir)
        update_job_progress(15, "Download Complete", "YouTube video downloaded successfully")

        extracted_audio_path = os.path.join(temp_dir, "extracted_audio.wav")
        ass_file_path = os.path.join(temp_dir, "opus_subtitles.ass")

        update_job_progress(20, "Audio Extraction", "Extracting audio from video")
        ffmpeg_extract_command = [
            'ffmpeg', '-y', '-i', original_file_path,
            '-vn', '-acodec', 'pcm_s16le', '-ar', '16000', '-ac', '1',
            extracted_audio_path
        ]
        subprocess.run(ffmpeg_extract_command, check=True, capture_output=True)
        update_job_progress(30, "Audio Extraction Complete", "Audio extracted successfully")

        update_job_progress(35, "Transcription", "Starting local transcription (this may take a moment!)")
        # Load the whisper model. "base" is a good balance of speed and accuracy for CPU.
        # It will be downloaded automatically on the first run.
        model = WhisperModel("base", device="cpu", compute_type="int8")
        
        # Transcribe the audio to get word-level timestamps
        segments, info = model.transcribe(extracted_audio_path, word_timestamps=True)
        
        # Convert the generator to a list of segments that our subtitle generator can use.
        transcription_segments = list(segments)
        
        # Apply timeframe filtering if specified
        if timeframe_start is not None and timeframe_end is not None:
            original_count = len(transcription_segments)
            transcription_segments = [
                seg for seg in transcription_segments
                if seg.end >= timeframe_start and seg.start <= timeframe_end
            ]
            print(f"Timeframe filter applied: {timeframe_start}s - {timeframe_end}s")
            print(f"Filtered to {len(transcription_segments)} segments (from {original_count})")
            update_job_progress(60, "Transcription Complete", f"Whisper transcription finished ({len(transcription_segments)} segments in timeframe)")
        else:
            update_job_progress(60, "Transcription Complete", "Whisper transcription finished")

        # Process video for layout mode if specified
        processed_video_path = original_file_path
        if layout_mode.lower() != "auto":
            update_job_progress(45, "Video Layout Processing", f"Processing video for {layout_mode} layout")
            processed_video_path = os.path.join(temp_dir, f"layout_processed_{layout_mode}.mp4")
            # Use the working OpusProcessor method instead of the broken one
            processor.process_video_for_vertical(original_file_path, processed_video_path, blur_strength=10, layout_mode=layout_mode)
            update_job_progress(55, "Video Layout Complete", f"Video processed for {layout_mode} layout")

        video_w, video_h = get_video_dimensions(processed_video_path)
        # For square and fit modes, use vertical format resolution
        if layout_mode.lower() in ["square", "fit"]:
            play_res_x, play_res_y = 1080, 1920  # Vertical format
        else:
            play_res_x, play_res_y = (video_w, video_h) if (video_w and video_h) else (1920, 1080)

        update_job_progress(65, "Subtitle Generation", "Generating ASS subtitles")
        
        try:
            print(f"DEBUG: Starting ASS content generation...")
            print(f"DEBUG: Template data: {opus_template}")
            print(f"DEBUG: Transcription segments count: {len(transcription_segments)}")
            print(f"DEBUG: Layout mode: {layout_mode}")
            
            # Use the processor to generate the ASS content with layout mode
            # Handle both string and dict template formats
            if isinstance(opus_template, str):
                template_name = opus_template
            else:
                template_name = opus_template.get('name', 'SwipeUp')
            print(f"DEBUG: Template name extracted: {template_name}")
            print(f"DEBUG: About to call generate_karaoke_captions...")
            
            ass_content = processor.generate_karaoke_captions(
                transcription_segments, template_name, layout_mode=layout_mode
            )
            print(f"DEBUG: generate_karaoke_captions completed successfully!")
            print(f"DEBUG: ASS content generated, length: {len(ass_content)} characters")
            
            with open(ass_file_path, "w", encoding="utf-8") as f_ass:
                f_ass.write(ass_content)
            
            print(f"DEBUG: ASS file written to: {ass_file_path}")
            print(f"DEBUG: ASS file exists after write: {os.path.exists(ass_file_path)}")
            print(f"DEBUG: ASS file size: {os.path.getsize(ass_file_path) if os.path.exists(ass_file_path) else 'N/A'} bytes")
            
            update_job_progress(70, "Subtitle Generation Complete", "ASS subtitles generated")

            # Handle both string and dict template formats for filename
            if isinstance(opus_template, str):
                template_name = opus_template
            else:
                template_name = opus_template.get('name', 'Karaoke')
            base_name = f"processed_{original_filename}"
            timestamp = int(time.time())
            final_export_filename = f"{base_name}_opus_{template_name.lower().replace(' ', '_')}_{timestamp}.mp4"
            final_export_path = os.path.join(exports_dir, final_export_filename)
            
            print(f"DEBUG: About to start subtitle burning process")
            print(f"DEBUG: ASS file path: {ass_file_path}")
            print(f"DEBUG: ASS file exists: {os.path.exists(ass_file_path)}")
            print(f"DEBUG: Processed video path: {processed_video_path}")
            print(f"DEBUG: Processed video exists: {os.path.exists(processed_video_path)}")
            print(f"DEBUG: Final export path: {final_export_path}")

            # Ensure exports directory exists
            os.makedirs(exports_dir, exist_ok=True)
            print(f"DEBUG: Exports directory created/verified: {exports_dir}")

            # Copy ASS file to exports directory with simple name to avoid path issues
            simple_ass_name = f"temp_subs_{timestamp}.ass"
            simple_ass_path = os.path.join(exports_dir, simple_ass_name)
            shutil.copy2(ass_file_path, simple_ass_path)
            print(f"DEBUG: Copied ASS to exports: {simple_ass_path}")
            
            # Use absolute paths for FFmpeg command
            abs_final_export_path = os.path.abspath(final_export_path)
            abs_simple_ass_path = os.path.abspath(simple_ass_path)
            
            # Use simple relative path approach for Windows compatibility
            # Change to exports directory and use relative paths
            original_cwd = os.getcwd()
            os.chdir(exports_dir)
            
            ffmpeg_burn_command = [
                'ffmpeg', '-y', 
                '-i', processed_video_path,
                '-vf', f'subtitles={simple_ass_name}',
                '-c:v', 'libx264', '-crf', '23', '-preset', 'fast',
                '-c:a', 'copy',
                abs_final_export_path
            ]
            print(f"DEBUG: FFmpeg command prepared: {' '.join(ffmpeg_burn_command)}")
            update_job_progress(75, "Video Processing", "Burning subtitles into video")
            
        except Exception as setup_error:
            print(f"CRITICAL ERROR in subtitle setup: {setup_error}")
            import traceback
            traceback.print_exc()
            raise
        
        print(f"Starting subtitle burning...")
        try:
            result = subprocess.run(ffmpeg_burn_command, capture_output=True, text=True, check=True)
            print(f"Subtitle burning completed successfully!")
            print(f"FFmpeg output: {result.stdout}")
            
            # Check if the output file was created (with retry for file system delay)
            for attempt in range(3):
                if os.path.exists(abs_final_export_path):
                    print(f"Final video with subtitles created: {abs_final_export_path}")
                    update_job_progress(85, "Video Processing Complete", "Video processed with subtitles")
                    break
                else:
                    print(f"Attempt {attempt + 1}: File not found, waiting...")
                    time.sleep(1)
            else:
                raise FileNotFoundError(f"Expected output file not found after 3 attempts: {abs_final_export_path}")
                
        except subprocess.CalledProcessError as e:
            print(f"Subtitle burning failed: {e}")
            print(f"FFmpeg stderr: {e.stderr}")
            print(f"FFmpeg stdout: {e.stdout}")
            
            # Check if it's a disk space issue
            if "No space left on device" in str(e.stderr):
                print("ERROR: Disk space full! Please free up disk space and try again.")
                raise RuntimeError("Disk space full - cannot complete video processing")
            
            # Fallback: copy video without subtitles
            print("Subtitle burning failed, copying video without subtitles as fallback...")
            fallback_command = [
                'ffmpeg', '-y', '-i', processed_video_path, '-c', 'copy', abs_final_export_path
            ]
            print(f"Fallback command: {' '.join(fallback_command)}")
            
            try:
                subprocess.run(fallback_command, capture_output=True, text=True, check=True)
                fallback_created = os.path.exists(abs_final_export_path)
                print(f"Fallback video created: {fallback_created}")
                update_job_progress(85, "Video Processing Complete", "Video processed (subtitles failed, video only)")
            except Exception as fallback_error:
                print(f"Fallback also failed: {fallback_error}")
                raise
        finally:
            # Restore original working directory
            try:
                if 'original_cwd' in locals():
                    os.chdir(original_cwd)
                    print(f"DEBUG: Restored working directory to: {original_cwd}")
            except:
                pass
            
            # Cleanup temporary ASS file
            try:
                if 'simple_ass_path' in locals() and os.path.exists(simple_ass_path):
                    os.remove(simple_ass_path)
                    print(f"DEBUG: Cleaned up temporary ASS file: {simple_ass_path}")
            except Exception as cleanup_error:
                print(f"DEBUG: Cleanup error (non-critical): {cleanup_error}")

        update_job_progress(95, "Finalizing", "Preparing final clips")
        
        duration_cmd = ['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', final_export_path]
        duration_result = subprocess.run(duration_cmd, capture_output=True, text=True, check=True)
        total_duration = float(duration_result.stdout.strip())

        clips_data = []
        clips_data.append({
            "id": "clip_0", "clipTitle": "Full Video",
            "previewUrl": f"/exports/{final_export_filename}",
            "summary": "Full video with generated captions.",
            "startTime": 0, "endTime": round(total_duration, 2),
            "originalFilename": original_filename
        })

        update_job_progress(100, "Complete", "Processing finished")
        return clips_data

    except Exception as e:
        job = get_current_job()
        if job:
            job.meta['progress'] = {
                'percentage': 100,
                'stage': 'Failed',
                'message': f"An error occurred: {str(e)}"
            }
            job.save_meta()
        import traceback
        traceback.print_exc()
        raise
    finally:
        print(f"Cleaning up temporary directory: {temp_dir}")
        shutil.rmtree(temp_dir, ignore_errors=True)
