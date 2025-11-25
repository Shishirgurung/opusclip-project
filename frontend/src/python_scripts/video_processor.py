import sys
import traceback
import os
import numpy as np
import subprocess
import argparse
import json
import uuid
import tempfile
import time

try:
    from moviepy.editor import (
        VideoFileClip, AudioFileClip, CompositeVideoClip, 
        TextClip, ImageClip, VideoClip
    )
    import moviepy.video.fx.all as vfx
    from moviepy.audio.AudioClip import AudioArrayClip
    from moviepy.video.io.ffmpeg_tools import ffmpeg_extract_subclip
    import whisper
except ImportError as e_import:
    sys.stderr.write(f"ERROR_IMPORTING_MODULES: {str(e_import)}\n")
    sys.stderr.write("Please ensure all required libraries like moviepy and whisper are installed.\n")
    sys.stderr.flush()
    sys.exit(1)

def str_to_bool(value):
    if isinstance(value, bool):
        return value
    if value.lower() in ('true', 't', 'yes', 'y', '1'):
        return True
    elif value.lower() in ('false', 'f', 'no', 'n', '0'):
        return False
    else:
        raise argparse.ArgumentTypeError('Boolean value expected.')

def process_video(video_url, clip_length_seconds, generate_captions, base_output_dir, style_template):
    # Extract style parameters from the template, providing defaults.
    selected_font = style_template.get('font_name', 'Arial')
    font_size = style_template.get('font_size', 24)
    animation_style = style_template.get('animation_style', 'None')
    amplified_word_color = style_template.get('amplified_word_color', '#FFFF00')
    default_caption_text = style_template.get('defaultCaptionText', None)

    sys.stderr.write(f"DEBUG: process_video function started. Font: {selected_font}, Size: {font_size}\n"); sys.stderr.flush()
    """
    Downloads a video, splits it into clips, and returns metadata for each clip.
    """
    clips_data = []
    public_base_dir = os.path.join(os.getcwd(), 'public', base_output_dir)

    whisper_model = None
    if generate_captions:
        try:
            sys.stderr.write("DEBUG: Loading Whisper model (generate_captions=True)...\n"); sys.stderr.flush()
            whisper_model = whisper.load_model("base") # Using "base" model. Other options: tiny, small, medium, large
            sys.stderr.write("DEBUG: Whisper model loaded successfully.\n"); sys.stderr.flush()
        except Exception as e_whisper_load:
            sys.stderr.write(f"ERROR_LOADING_WHISPER_MODEL: {str(e_whisper_load)}\nTraceback: {traceback.format_exc()}\n")
            # Continue without whisper model, captions will be pending if an error occurs here
            pass
    else:
        sys.stderr.write("DEBUG: Skipping Whisper model loading (generate_captions=False).\n"); sys.stderr.flush()
    session_id = str(uuid.uuid4())
    sys.stderr.write(f"DEBUG: Generated session_id: {session_id}\n")
    original_filename = "video"
    video = None # Initialize video object for the finally block
    # clips_data is already initialized above
    session_output_dir = os.path.join(public_base_dir, session_id) # Corrected path to use public_base_dir
    os.makedirs(session_output_dir, exist_ok=True)

    # Initialize variables for audio processing
    temp_wav_path = None
    extracted_audio_clip = None # This will be the main AudioFileClip from WAV
    main_audio_fps_for_iter = None
    full_audio_array = None # No longer used for primary audio path
    # video is already initialized above

    try:
        # 1. Download video using yt-dlp
        # Forcing a generic name for predictability
        generic_output_filename = f"downloaded_video_{session_id}.%(ext)s"
        downloaded_video_path_template_for_dl = os.path.join(session_output_dir, generic_output_filename)

        command_args = [
            'yt-dlp', '--verbose', '--no-warnings', '--no-mtime',
            '--socket-timeout', '1800',
            '-f', 'bestvideo[ext=mp4]+bestaudio[ext=mp4]/best[ext=mp4]/best',
            '--merge-output-format', 'mp4',
            '-o', downloaded_video_path_template_for_dl, video_url
        ]
        sys.stderr.write(f"DEBUG: yt-dlp command for download: {' '.join(command_args)}\n"); sys.stderr.flush()

        max_retries = 3
        retry_delay_seconds = 3
        download_success = False
        last_error_for_raising = None

        for attempt in range(max_retries):
            sys.stderr.write(f"DEBUG: yt-dlp download attempt {attempt + 1}/{max_retries} for {video_url}\n")
            sys.stderr.flush()
            temp_stdout_file_obj = None
            temp_stderr_file_obj = None
            temp_stdout_name = None
            temp_stderr_name = None
            process = None # Initialize process for potential kill in case of early error
            
            try:
                # Create temporary files for stdout and stderr
                temp_stdout_file_obj = tempfile.NamedTemporaryFile(mode='wb', delete=False)
                temp_stderr_file_obj = tempfile.NamedTemporaryFile(mode='wb', delete=False)
                temp_stdout_name = temp_stdout_file_obj.name
                temp_stderr_name = temp_stderr_file_obj.name
                sys.stderr.write(f"DEBUG: Temp stdout file: {temp_stdout_name}, Temp stderr file: {temp_stderr_name}\n"); sys.stderr.flush()

                process = subprocess.Popen(
                    command_args,
                    stdout=temp_stdout_file_obj,
                    stderr=temp_stderr_file_obj,
                    stdin=subprocess.DEVNULL,
                    text=False  # We are handling binary file objects
                )
                sys.stderr.write(f"DEBUG: subprocess.Popen for yt-dlp created (PID: {process.pid}), output to temp files.\n"); sys.stderr.flush()

                if temp_stdout_file_obj: temp_stdout_file_obj.close()
                if temp_stderr_file_obj: temp_stderr_file_obj.close()

                return_code = None
                stdout_bytes = b""
                stderr_bytes = b""

                try:
                    sys.stderr.write(f"DEBUG: Calling process.wait(timeout=1800) for PID {process.pid}.\n"); sys.stderr.flush()
                    return_code = process.wait(timeout=1800)
                    sys.stderr.write(f"DEBUG: process.wait for yt-dlp (PID: {process.pid}) completed. Return code: {return_code}\n"); sys.stderr.flush()
                except subprocess.TimeoutExpired as e_timeout_wait:
                    sys.stderr.write(f"DEBUG: process.wait for yt-dlp (PID: {process.pid}) timed out. Killing process.\n"); sys.stderr.flush()
                    if process: process.kill()
                    try:
                        return_code = process.wait(timeout=20) 
                        sys.stderr.write(f"DEBUG: process.wait after kill (PID: {process.pid}) completed. Return code: {return_code}\n"); sys.stderr.flush()
                    except subprocess.TimeoutExpired:
                        sys.stderr.write(f"DEBUG: process.wait after kill (PID: {process.pid}) timed out again.\n"); sys.stderr.flush()
                        return_code = -99 # Arbitrary code for timeout after kill
                    except Exception as e_wait_kill_inner:
                        sys.stderr.write(f"DEBUG: Error during process.wait after kill (PID: {process.pid}): {e_wait_kill_inner}\n"); sys.stderr.flush()
                        return_code = -98 # Arbitrary code for error during reaping after kill
                    last_error_for_raising = e_timeout_wait

                sys.stderr.write(f"DEBUG: Reading temp stdout file: {temp_stdout_name}\n"); sys.stderr.flush()
                if temp_stdout_name and os.path.exists(temp_stdout_name):
                    try:
                        with open(temp_stdout_name, 'rb') as f_out:
                            stdout_bytes = f_out.read()
                    except Exception as e_read_stdout:
                        sys.stderr.write(f"DEBUG: Error reading temp stdout file {temp_stdout_name}: {e_read_stdout}\n"); sys.stderr.flush()
                        stdout_bytes = b"[Error reading temp stdout]"
                else:
                    sys.stderr.write(f"DEBUG: Temp stdout file {temp_stdout_name} not found or name is None.\n"); sys.stderr.flush()
                    stdout_bytes = b"[Temp stdout file not found]"
                
                sys.stderr.write(f"DEBUG: Reading temp stderr file: {temp_stderr_name}\n"); sys.stderr.flush()
                if temp_stderr_name and os.path.exists(temp_stderr_name):
                    try:
                        with open(temp_stderr_name, 'rb') as f_err:
                            stderr_bytes = f_err.read()
                    except Exception as e_read_stderr:
                        sys.stderr.write(f"DEBUG: Error reading temp stderr file {temp_stderr_name}: {e_read_stderr}\n"); sys.stderr.flush()
                        stderr_bytes = b"[Error reading temp stderr]"
                else:
                    sys.stderr.write(f"DEBUG: Temp stderr file {temp_stderr_name} not found or name is None.\n"); sys.stderr.flush()
                    stderr_bytes = b"[Temp stderr file not found]"

                if last_error_for_raising and isinstance(last_error_for_raising, subprocess.TimeoutExpired) and return_code is None:
                    sys.stderr.write(f"DEBUG: Timeout occurred but return_code is still None, setting to -99.\n"); sys.stderr.flush()
                    return_code = -99 

                yt_dlp_stdout_immediate = stdout_bytes.decode(errors='replace').strip()
                yt_dlp_stderr_immediate = stderr_bytes.decode(errors='replace').strip()
                sys.stderr.write(f"DEBUG_IMMEDIATE_YT_DLP_OUTPUT (Return Code: {return_code}):\n---YT_STDOUT_START---\n{yt_dlp_stdout_immediate}\n---YT_STDOUT_END---\n---YT_STDERR_START---\n{yt_dlp_stderr_immediate}\n---YT_STDERR_END---\n"); sys.stderr.flush()

                if return_code == 0:
                    potential_files = [f for f in os.listdir(session_output_dir) if f.startswith(f"downloaded_video_{session_id}")]
                    if potential_files:
                        actual_downloaded_filename = potential_files[0]
                        downloaded_video_path = os.path.join(session_output_dir, actual_downloaded_filename)
                        original_filename = actual_downloaded_filename
                        download_success = True
                        sys.stderr.write(f"DEBUG: yt-dlp attempt {attempt + 1} successful, file found: {downloaded_video_path}\n"); sys.stderr.flush()
                        break 
                    else:
                        last_error_for_raising = FileNotFoundError(f"yt-dlp success (code 0) but file not found: downloaded_video_{session_id}.* in {session_output_dir}")
                        sys.stderr.write(f"DEBUG: {str(last_error_for_raising)}\n"); sys.stderr.flush()
                else:
                    if not (last_error_for_raising and isinstance(last_error_for_raising, subprocess.TimeoutExpired)):
                        if return_code is None: 
                            sys.stderr.write(f"DEBUG: CRITICAL - return_code is None but not a TimeoutExpired. Setting to -97.\n"); sys.stderr.flush()
                            return_code = -97
                        last_error_for_raising = subprocess.CalledProcessError(return_code, command_args, output=stdout_bytes, stderr=stderr_bytes)
                    
                    sys.stderr.write(f"DEBUG: yt-dlp attempt {attempt + 1} failed (code {return_code}).\nStdout: '{yt_dlp_stdout_immediate}'\nStderr: '{yt_dlp_stderr_immediate}'\n"); sys.stderr.flush()
                    if "WinError 32" in yt_dlp_stderr_immediate and attempt < max_retries - 1:
                        sys.stderr.write(f"DEBUG: WinError 32 detected. Retrying in {retry_delay_seconds}s...\n"); sys.stderr.flush()
                        time.sleep(retry_delay_seconds)
                        continue 
            except Exception as e_general_retry:
                if process and process.poll() is None:
                    sys.stderr.write(f"DEBUG: General error caught, process (PID: {process.pid}) still running, attempting to kill.\n"); sys.stderr.flush()
                    process.kill()
                    try: process.wait(timeout=5)
                    except: pass
                
                last_error_for_raising = e_general_retry
                tb_str = traceback.format_exc().replace('\n', '\n    ') # Indent traceback for readability
                sys.stderr.write(f"DEBUG: yt-dlp attempt {attempt + 1} general error: {e_general_retry}. Retrying: {attempt < max_retries -1}\nTraceback:\n    {tb_str}\n"); sys.stderr.flush()
                if attempt < max_retries - 1:
                    time.sleep(retry_delay_seconds)
                    continue
            
            finally:
                if temp_stdout_file_obj and not temp_stdout_file_obj.closed:
                    sys.stderr.write(f"DEBUG: Closing temp_stdout_file_obj in finally block.\n"); sys.stderr.flush()
                    temp_stdout_file_obj.close()
                if temp_stderr_file_obj and not temp_stderr_file_obj.closed:
                    sys.stderr.write(f"DEBUG: Closing temp_stderr_file_obj in finally block.\n"); sys.stderr.flush()
                    temp_stderr_file_obj.close()

                if temp_stdout_name and os.path.exists(temp_stdout_name):
                    try:
                        os.remove(temp_stdout_name)
                        sys.stderr.write(f"DEBUG: Removed temp stdout file: {temp_stdout_name}\n"); sys.stderr.flush()
                    except Exception as e_remove_stdout:
                        sys.stderr.write(f"DEBUG: Error removing temp stdout file {temp_stdout_name}: {e_remove_stdout}\n"); sys.stderr.flush()
                if temp_stderr_name and os.path.exists(temp_stderr_name):
                    try:
                        os.remove(temp_stderr_name)
                        sys.stderr.write(f"DEBUG: Removed temp stderr file: {temp_stderr_name}\n"); sys.stderr.flush()
                    except Exception as e_remove_stderr:
                        sys.stderr.write(f"DEBUG: Error removing temp stderr file {temp_stderr_name}: {e_remove_stderr}\n"); sys.stderr.flush()

        if not download_success:
            if last_error_for_raising:
                raise last_error_for_raising
            else:
                raise Exception(f"yt-dlp download failed after {max_retries} attempts for an unknown reason.")

        if not os.path.exists(downloaded_video_path) or os.path.getsize(downloaded_video_path) == 0:
            raise FileNotFoundError(f"Video download failed or file is empty: {downloaded_video_path}")

        sys.stderr.write(f"DEBUG: Video downloaded: {downloaded_video_path}\n")
        sys.stderr.flush()

        video = VideoFileClip(downloaded_video_path, verbose=True)
        sys.stderr.write(f"DEBUG: VideoFileClip loaded. Duration: {video.duration}s. Original filename: {original_filename}\n")
        duration = video.duration
        fps = video.fps # Crucial for main_audio_fps fallback and general info
        has_audio = video.audio is not None
        sys.stderr.write(f"DEBUG: Video has audio: {has_audio}\n")
        sys.stderr.write(f"DEBUG: Video duration: {duration}s, FPS: {fps}\n")
        sys.stderr.flush()

        if video.audio is not None:
            sys.stderr.write(f"DEBUG: Video has an audio track. Attempting FFmpeg WAV extraction for robust processing.\n")
            
            # Determine main_audio_fps, defaulting to video_fps or 44100 if necessary
            # This uses the sanitized video.audio.fps established earlier
            main_audio_fps = getattr(video.audio, 'fps', None)
            if not isinstance(main_audio_fps, int):
                sys.stderr.write(f"WARNING: video.audio.fps for WAV extraction is not a valid integer ({main_audio_fps}). Using video_fps or default.\n")
                main_audio_fps = fps if isinstance(fps, int) else 44100
            sys.stderr.write(f"DEBUG: Target WAV extraction FPS: {main_audio_fps}\n")

            try:
                # Create a temporary WAV file path
                temp_wav_fd, temp_wav_path = tempfile.mkstemp(suffix='.wav', dir=session_output_dir)
                os.close(temp_wav_fd) # Close the file descriptor, FFmpeg will open/write it
                sys.stderr.write(f"DEBUG: Temporary WAV path for FFmpeg extraction: {temp_wav_path}\n")

                # FFmpeg command to extract audio to WAV
                # Using pcm_s16le for standard WAV, -ar for sample rate, -ac for 2 channels (stereo)
                ffmpeg_cmd = [
                    'ffmpeg',
                    '-i', downloaded_video_path,
                    '-vn',  # No video
                    '-acodec', 'pcm_s16le', # Standard WAV codec
                    '-ar', '44100', # Audio sample rate (standardized to 44.1kHz)
                    # '-ac', '2', # Removed to let FFmpeg handle channels (e.g., preserve mono if mono, stereo if stereo)
                    '-y', # Overwrite output file if it exists
                    temp_wav_path
                ]
                sys.stderr.write(f"DEBUG: Executing FFmpeg command: {' '.join(ffmpeg_cmd)}\n")
                
                # Execute FFmpeg command
                process = subprocess.Popen(ffmpeg_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                stdout, stderr = process.communicate(timeout=300) # 5-minute timeout for audio extraction

                if process.returncode == 0:
                    sys.stderr.write(f"DEBUG: FFmpeg WAV extraction successful.\n")
                    # Load the extracted WAV file with MoviePy
                    extracted_audio_clip = AudioFileClip(temp_wav_path) # Let MoviePy detect FPS from WAV header
                    main_audio_fps_for_iter = extracted_audio_clip.fps # Use FPS from the loaded WAV
                    sys.stderr.write(f"DEBUG: Loaded temporary WAV via AudioFileClip. Duration: {extracted_audio_clip.duration}, FPS: {main_audio_fps_for_iter}\n")

                    # full_audio_array is no longer created here.
                    # main_audio_fps_for_iter is already set from extracted_audio_clip.fps.
                    sys.stderr.write(f"DEBUG: Using AudioFileClip directly. FPS: {main_audio_fps_for_iter}. full_audio_array will not be used for this audio path.\n")
                    full_audio_array = None # Explicitly set to None
                else:
                    sys.stderr.write(f"ERROR: FFmpeg WAV extraction failed. Return code: {process.returncode}\n")
                    sys.stderr.write(f"FFmpeg stdout:\n{stdout.decode(errors='ignore')}\n")
                    sys.stderr.write(f"FFmpeg stderr:\n{stderr.decode(errors='ignore')}\n")
                    full_audio_array = None

            except subprocess.TimeoutExpired:
                sys.stderr.write(f"ERROR: FFmpeg WAV extraction timed out.\n")
                if process:
                    process.kill()
                    stdout, stderr = process.communicate()
                    sys.stderr.write(f"FFmpeg stdout (timeout):\n{stdout.decode(errors='ignore')}\n")
                    sys.stderr.write(f"FFmpeg stderr (timeout):\n{stderr.decode(errors='ignore')}\n")
                full_audio_array = None
            except TypeError as e:
                # This is the error we've been trying to avoid
                e_type_str = str(e)
                sys.stderr.write(f"DEBUG: Warning - TypeError during WAV audio processing: {e_type_str}. Will attempt per-clip audio conversion.\n")
                sys.stderr.write("Traceback (WAV processing TypeError):\n")
                traceback.print_exc(file=sys.stderr)
                full_audio_array = None
            except Exception as e:
                e_type_str = str(e)
                sys.stderr.write(f"DEBUG: Warning - An unexpected error occurred during WAV audio processing: {e_type_str}. Will attempt per-clip audio conversion.\n")
                sys.stderr.write("Traceback (WAV processing general error):\n")
                traceback.print_exc(file=sys.stderr)
                full_audio_array = None
            finally:
                # extracted_audio_clip and temp_wav_path will be handled by the main process_video finally block
                sys.stderr.write(f"DEBUG: Inner finally for WAV processing. extracted_audio_clip and temp_wav_path cleanup deferred to outer finally.\n")
        else:
            sys.stderr.write("DEBUG: Video has no audio track (video.audio is None). Skipping WAV extraction.\n")
            full_audio_array = None
            main_audio_fps_for_iter = None


        # The clip processing logic now starts, merged into the main try block.
        if clip_length_seconds <= 0:
            raise ValueError("Clip length must be a positive number.")
        if duration <= 0:
             sys.stderr.write(f"DEBUG: Video duration is {duration}s. No clips will be generated.\n")
             num_clips = 0
        else:
            num_clips = int(duration // clip_length_seconds)
            if duration % clip_length_seconds > 0.1: # Add clip for significant remainder
                num_clips += 1
            if num_clips == 0 and duration > 0.1: # At least one clip for short videos > 0.1s
                num_clips = 1
        
        sys.stderr.write(f"DEBUG: Calculated num_clips: {num_clips}\n")
        sys.stderr.flush()

        for i in range(num_clips):
            start_time = i * clip_length_seconds
            end_time = min(start_time + clip_length_seconds, duration)

            if start_time >= duration - 0.1: # Skip if start is too close to end
                sys.stderr.write(f"DEBUG: Skipping clip {i+1} (start {start_time} >= duration {duration}-0.1)\n")
                continue
            if end_time - start_time < 0.1: # Skip if clip is too short
                sys.stderr.write(f"DEBUG: Skipping clip {i+1} (duration {end_time - start_time} < 0.1s)\n")
                continue

            clip_filename = f"clip_{i+1}.mp4"
            clip_path_absolute = os.path.join(session_output_dir, clip_filename)
            clip_path_relative = os.path.join(base_output_dir, session_id, clip_filename).replace("\\", "/")
            subclip = None
            try:
                sys.stderr.write(f"DEBUG: Processing clip {i+1}/{num_clips}: start={start_time}, end={end_time}\n")
                subclip = video.subclip(start_time, end_time)
                
                assigned_audio_for_clip = None
                current_subclip_has_audio = False

                sys.stderr.write(f"DEBUG: Clip {i+1} - Attempting to derive audio by sub-clipping main AudioFileClip (extracted_audio_clip).\n")
                if extracted_audio_clip is not None:
                    try:
                        audio_clip_duration_for_check = extracted_audio_clip.duration if hasattr(extracted_audio_clip, 'duration') and extracted_audio_clip.duration is not None else duration
                        clamped_start_time = max(0, min(start_time, audio_clip_duration_for_check))
                        clamped_end_time = max(0, min(end_time, audio_clip_duration_for_check))
                        
                        sys.stderr.write(f"DEBUG: Clip {i+1} - Audio subclip times: original_start={start_time:.3f}, original_end={end_time:.3f}, audio_clip_duration_for_check={audio_clip_duration_for_check:.3f}, clamped_start={clamped_start_time:.3f}, clamped_end={clamped_end_time:.3f}\n")

                        temp_segment_audio_path_for_clip = None # Initialize for cleanup in this clip's finally block
                        if clamped_end_time > clamped_start_time:
                            segment_duration = clamped_end_time - clamped_start_time
                            if segment_duration > 0.001: # Ensure duration is meaningful
                                temp_segment_audio_filename = f"temp_audio_segment_clip_{i+1}_{session_id}.wav"
                                temp_segment_audio_path_for_clip = os.path.join(session_output_dir, temp_segment_audio_filename)
                                
                                ffmpeg_command = [
                                    'ffmpeg', '-y', # Overwrite output
                                    '-i', temp_wav_path, # Input is the main temporary WAV
                                    '-ss', str(clamped_start_time), # Start time for the segment
                                    '-t', str(segment_duration), # Duration of the segment
                                    '-c', 'copy', # Copy codec to avoid re-encoding WAV, preserving quality
                                    temp_segment_audio_path_for_clip # Output path for the segment
                                ]
                                sys.stderr.write(f"DEBUG: Clip {i+1} - Executing FFmpeg for audio segment: {' '.join(ffmpeg_command)}\n")
                                try:
                                    process_result = subprocess.run(ffmpeg_command, check=True, capture_output=True, text=True, encoding='utf-8')
                                    sys.stderr.write(f"DEBUG: Clip {i+1} - FFmpeg audio segment created successfully: {temp_segment_audio_path_for_clip}\n")
                                    # Load the new segment as an AudioFileClip
                                    segment_audio_clip = AudioFileClip(temp_segment_audio_path_for_clip)
                                    if not generate_captions:
                                        if default_caption_text:
                                            generated_caption_text = default_caption_text
                                            sys.stderr.write(f"DEBUG: Clip {i+1} - Caption generation is OFF. Using provided default caption text.\n")
                                        else:
                                            generated_caption_text = None # Or consider an empty string if preferred for frontend
                                            sys.stderr.write(f"DEBUG: Clip {i+1} - Caption generation is OFF. No default caption text provided.\n")
                                    else:
                                        generated_caption_text = f"Captions for clip {i+1} (pending - Whisper model issue or transcription error)..."

                                    if segment_audio_clip and hasattr(segment_audio_clip, 'duration') and segment_audio_clip.duration is not None and segment_audio_clip.duration > 0.001:
                                        assigned_audio_for_clip = segment_audio_clip # This will be closed in the clip's finally block
                                        current_subclip_has_audio = True
                                        sys.stderr.write(f"DEBUG: Clip {i+1} - Successfully loaded FFmpeg-created audio segment. Duration: {assigned_audio_for_clip.duration:.3f}, FPS: {getattr(assigned_audio_for_clip, 'fps', 'N/A')}\n")

                                        # Transcribe the audio segment for captions if whisper_model is loaded
                                        if whisper_model:
                                            try:
                                                sys.stderr.write(f"DEBUG: Clip {i+1} - Transcribing audio segment {temp_segment_audio_path_for_clip} with Whisper...\n")
                                                transcription_result_detailed = whisper_model.transcribe(temp_segment_audio_path_for_clip, fp16=False, word_timestamps=True)
                                                generated_caption_text = transcription_result_detailed['text'].strip() # For existing logic and non-karaoke captions

                                                word_level_data = []
                                                if 'segments' in transcription_result_detailed:
                                                    for segment in transcription_result_detailed['segments']:
                                                        if 'words' in segment:
                                                                # Filter out words with very low confidence if needed, or adjust timestamps
                                                                # For now, taking all words as reported
                                                                word_level_data.extend(segment['words'])

                                                    if word_level_data:
                                                        sys.stderr.write(f"DEBUG: Clip {i+1} - Extracted {len(word_level_data)} words with timestamps. First 3: {word_level_data[:3]}\n")
                                                    else:
                                                        sys.stderr.write(f"DEBUG: Clip {i+1} - No word-level data extracted from transcription.\n")
                                                    sys.stderr.write(f"DEBUG: Clip {i+1} - Transcription successful. Text: {generated_caption_text[:100]}...\n")
                                            except Exception as e_transcribe:
                                                sys.stderr.write(f"ERROR: Clip {i+1} - Whisper transcription failed for {temp_segment_audio_path_for_clip}: {e_transcribe}\n{traceback.format_exc()}\n")
                                                generated_caption_text = f"Captions for clip {i+1} (transcription error)..."
                                                word_level_data = [] # Ensure word_level_data is defined in case of error
                                        else:
                                            sys.stderr.write(f"DEBUG: Clip {i+1} - Whisper model not loaded. Skipping transcription.\n")
                                            word_level_data = [] # Ensure word_level_data is defined if model not loaded
                                    else:
                                        sys.stderr.write(f"ERROR: Clip {i+1} - FFmpeg-created audio segment ({temp_segment_audio_path_for_clip}) is invalid or has zero duration after loading.\n")
                                        if segment_audio_clip: segment_audio_clip.close()
                                        # Attempt to clean up the problematic segment file immediately
                                        if os.path.exists(temp_segment_audio_path_for_clip):
                                            try:
                                                os.remove(temp_segment_audio_path_for_clip)
                                                sys.stderr.write(f"DEBUG: Clip {i+1} - Cleaned up invalid segment file: {temp_segment_audio_path_for_clip}\n")
                                            except Exception as e_del_inv_seg:
                                                sys.stderr.write(f"WARNING: Clip {i+1} - Could not delete invalid segment {temp_segment_audio_path_for_clip}: {e_del_inv_seg}\n")
                                except subprocess.CalledProcessError as e_ffmpeg_segment:
                                    sys.stderr.write(f"ERROR: Clip {i+1} - FFmpeg failed to create audio segment. CMD: {' '.join(e_ffmpeg_segment.cmd)}. RC: {e_ffmpeg_segment.returncode}\nStdout: {e_ffmpeg_segment.stdout}\nStderr: {e_ffmpeg_segment.stderr}\n")
                                except Exception as e_load_segment:
                                    sys.stderr.write(f"ERROR: Clip {i+1} - Failed to load FFmpeg-created audio segment {temp_segment_audio_path_for_clip}: {e_load_segment}\n{traceback.format_exc()}\n")
                                finally:
                                    pass # Ensure the try statement on L421 is properly closed
                            # else for 'if segment_duration > 0.001:'
                            else:
                                sys.stderr.write(f"DEBUG: Clip {i+1} - Calculated segment duration ({segment_duration:.3f}s) is too short. No FFmpeg audio segment will be created.\n")
                        # else for 'if clamped_start_time < clamped_end_time:'
                        else:
                            sys.stderr.write(f"DEBUG: Clip {i+1} - Invalid time range for FFmpeg audio segment (clamped_start_time {clamped_start_time} >= clamped_end_time {clamped_end_time}). No segment will be created.\n")
                    except Exception as e_audio_processing:
                        sys.stderr.write(f"ERROR: Clip {i+1} - Error during audio segment processing: {e_audio_processing}\n{traceback.format_exc()}\n")
                        assigned_audio_for_clip = None
                        current_subclip_has_audio = False
                else:
                    sys.stderr.write(f"DEBUG: Clip {i+1} - extracted_audio_clip is not available. No audio will be assigned using this method.\n")

                subclip.audio = assigned_audio_for_clip
                
                if current_subclip_has_audio and subclip.audio:
                    sys.stderr.write(f"DEBUG: Clip {i+1} - Audio has been set. Type: {type(subclip.audio).__name__}, Duration: {subclip.audio.duration:.3f}, FPS: {getattr(subclip.audio, 'fps', 'N/A')}\n")
                else:
                    sys.stderr.write(f"DEBUG: Clip {i+1} - No valid audio source found (WAV-derived). No audio will be used.\n")
                sys.stderr.flush()

                # START: Added caption rendering logic
                final_clip_to_write = subclip # Default to original subclip
                text_clip_for_final_render = None # Initialize for potential cleanup

                # Ensure word_level_data is available in this scope if transcription didn't run or failed
                if 'word_level_data' not in locals():
                    word_level_data = []

                if generated_caption_text and generated_caption_text.strip():
                    sys.stderr.write(f"DEBUG: Clip {i+1} - Rendering caption text: '{generated_caption_text[:50]}...' with font: {selected_font}, size: {font_size}\n")
                    try:
                        # Define presets available in the backend
                        presets = {
                            'standardBottom': {'font': 'Arial', 'size': 24, 'position': 'bottom', 'animation_style': 'None', 'amplified_word_color': '#FFFFFF'},
                            'emphasizedTop': {'font': 'The bold font', 'size': 32, 'position': 'top', 'animation_style': 'Pop', 'amplified_word_color': '#FF0000'},
                            'subtleMiddle': {'font': 'Verdana', 'size': 20, 'position': 'middle', 'animation_style': 'None', 'amplified_word_color': '#FFFFFF'},
                            'Karaoke': {'font': 'Impact', 'size': 48, 'position': 'bottom', 'animation_style': 'Bounce', 'amplified_word_color': '#FFFF00'} # Yellow
                        }

                        # Determine current font, size, and position based on preset or custom values
                        if caption_preset and caption_preset != 'custom' and caption_preset in presets:
                            sys.stderr.write(f"DEBUG: Clip {i+1} - Applying preset: {caption_preset}\n")
                            preset_settings = presets[caption_preset]
                            current_font = preset_settings['font']
                            current_font_size = preset_settings['size']
                            current_caption_position = preset_settings['position']
                            # Get animation and color from preset, allowing for them to be missing in older presets
                            current_animation_style = preset_settings.get('animation_style', 'None') 
                            current_amplified_word_color = preset_settings.get('amplified_word_color', '#FFFFFF')
                        else:
                            sys.stderr.write(f"DEBUG: Clip {i+1} - Using custom/default caption settings. Preset: '{caption_preset}'\n")
                            current_font = selected_font if selected_font else 'Arial' # Default font
                            current_font_size = font_size if font_size is not None else 24 # Default font size
                            current_caption_position = caption_position if caption_position else 'bottom' # Default position
                            current_animation_style = animation_style if animation_style else 'None' # Default animation
                            current_amplified_word_color = amplified_word_color if amplified_word_color else '#FFFFFF' # Default color

                        # Override preset animation/color if specific CLI args were given
                        if animation_style and animation_style != 'None': # Assuming 'None' is the default from CLI if not specified
                            current_animation_style = animation_style
                        if amplified_word_color and amplified_word_color != '#FFFFFF': # Assuming '#FFFFFF' is default from CLI
                            current_amplified_word_color = amplified_word_color

                        sys.stderr.write(f"DEBUG: Clip {i+1} - Determined styles: Font={current_font}, Size={current_font_size}, Pos={current_caption_position}, Anim={current_animation_style}, AmpColor={current_amplified_word_color}\n")

                        # Validate font_size
                        try:
                            current_font_size = int(current_font_size)
                            if current_font_size <= 0:
                                raise ValueError("Font size must be positive")
                        except (ValueError, TypeError):
                            sys.stderr.write(f"WARNING: Clip {i+1} - Invalid font_size value '{current_font_size}', defaulting to 24.\n")
                            current_font_size = 24
                        
                        # Define position and alignment maps for MoviePy
                        position_map = {
                            'top': ('center', 'top'),
                            'middle': ('center', 'center'),
                            'bottom': ('center', 'bottom')
                        }
                        text_align_map = {
                            'top': 'North',
                            'middle': 'Center',
                            'bottom': 'South'
                        }
                        
                        final_moviepy_position = position_map.get(current_caption_position, ('center', 'bottom'))
                        final_moviepy_align = text_align_map.get(current_caption_position, 'South')
                        sys.stderr.write(f"DEBUG: Clip {i+1} - Final Caption settings: Font='{current_font}', Size={current_font_size}, Position='{current_caption_position}' (MoviePy pos: {final_moviepy_position}, align: {final_moviepy_align}) Preset='{caption_preset}' Anim='{current_animation_style}' AmpColor='{current_amplified_word_color}'\n")

                        # Determine text color based on animation style
                        final_text_color = 'white' # Default color
                        if current_animation_style in ['Bounce', 'Pop']:
                            final_text_color = current_amplified_word_color
                            sys.stderr.write(f"DEBUG: Clip {i+1} - Animation style '{current_animation_style}' detected, using amplified_word_color '{current_amplified_word_color}' for text.\n")

                        txt_clip_instance = TextClip(
                            generated_caption_text,
                            fontsize=current_font_size,
                            font=current_font,
                            color=final_text_color, # Use determined color
                            stroke_color='black',
                            stroke_width=1,
                            method='caption',
                            size=(subclip.w * 0.9, None), # Auto height
                            align=final_moviepy_align
                        )

                        if current_animation_style == 'Bounce':
                            sys.stderr.write(f"DEBUG: Clip {i+1} - Applying 'Bounce' animation.\n")
                            
                            margin = 10 # pixels margin from edge for top/bottom
                            # Calculate base y for the top-left of the text clip based on final_moviepy_position[1]
                            if final_moviepy_position[1] == 'top':
                                y_base_for_top_left = margin
                            elif final_moviepy_position[1] == 'center':
                                y_base_for_top_left = (subclip.h - txt_clip_instance.h) / 2
                            elif final_moviepy_position[1] == 'bottom':
                                y_base_for_top_left = subclip.h - txt_clip_instance.h - margin
                            else: # Should be a number if not 'top'/'center'/'bottom' (current logic ensures it's one of these strings)
                                try:
                                    y_base_for_top_left = float(final_moviepy_position[1])
                                except ValueError:
                                    sys.stderr.write(f"WARNING: Clip {i+1} - Unexpected y-position string '{final_moviepy_position[1]}' for bounce, defaulting to bottom alignment.\n")
                                    y_base_for_top_left = subclip.h - txt_clip_instance.h - margin

                            amplitude = current_font_size * 0.10 # Bounce 10% of font size
                            frequency = 2 * np.pi * 1.2 # 1.2 bounces per second (adjust for feel)

                            def position_func(t):
                                y_offset = amplitude * np.sin(frequency * t)
                                # final_moviepy_position[0] is 'center', 'left', 'right'
                                return (final_moviepy_position[0], y_base_for_top_left + y_offset)
                            
                            text_clip_for_final_render = txt_clip_instance.set_position(position_func).set_duration(subclip.duration)
                        
                        elif current_animation_style == 'Pop':
                            sys.stderr.write(f"DEBUG: Clip {i+1} - Applying 'Pop' animation.\n")
                            pop_duration = 0.3  # seconds
                            max_scale = 1.15
                            min_scale = 0.8

                            def pop_scale_factor(t_clip):
                                if t_clip < 0: # Ensure t_clip is not negative if passed unexpectedly
                                    return 1.0
                                if t_clip < pop_duration / 2:
                                    # Scale from min_scale to max_scale
                                    progress = t_clip / (pop_duration / 2)
                                    return min_scale + (max_scale - min_scale) * progress
                                elif t_clip < pop_duration:
                                    # Scale from max_scale to 1.0
                                    progress = (t_clip - (pop_duration / 2)) / (pop_duration / 2)
                                    return max_scale - (max_scale - 1.0) * progress
                                else:
                                    return 1.0

                            # Apply resize effect. The lambda t_clip receives time relative to the start of txt_clip_instance
                            popped_clip = txt_clip_instance.fx(vfx.resize, newsize=pop_scale_factor)
                            text_clip_for_final_render = popped_clip.set_position(final_moviepy_position).set_duration(subclip.duration)
                        elif current_animation_style == 'Underline':
                            sys.stderr.write(f"DEBUG: Clip {i+1} - Applying 'Underline' animation.\n")
                            positioned_text_clip = txt_clip_instance.set_position(final_moviepy_position).set_duration(subclip.duration)

                            underline_height = max(2, int(current_font_size * 0.08)) # 8% of font size, min 2px
                            underline_color_to_use = current_amplified_word_color if current_amplified_word_color != '#FFFFFF' else 'white'
                            gap_after_text = int(underline_height * 0.5) # Small gap
                            underline_width = int(txt_clip_instance.size[0]) # txt_clip_instance.w is based on size[0]

                            underline_base_graphic = ColorClip(
                                size=(underline_width, underline_height),
                                color=underline_color_to_use,
                                duration=subclip.duration
                            )

                            underline_draw_duration = 0.5 # seconds for the underline to draw

                            def underline_mask_frame(t):
                                current_drawn_width = int(min(1.0, t / underline_draw_duration) * underline_width)
                                # Mask frame: 1 channel (grayscale), 255 for visible, 0 for transparent
                                frame = np.zeros((underline_height, underline_width), dtype=np.uint8)
                                if current_drawn_width > 0:
                                    frame[:, :current_drawn_width] = 255
                                return frame

                            animated_mask_for_underline = VideoClip(
                                make_frame=underline_mask_frame,
                                duration=subclip.duration,
                                ismask=True
                            )
                            
                            animated_underline_clip = underline_base_graphic.set_mask(animated_mask_for_underline)

                            # Calculate Y position for the underline
                            margin_y = 10 # Similar to bounce margin
                            text_h = positioned_text_clip.h
                            if final_moviepy_position[1] == 'top':
                                y_text_top_edge = margin_y
                            elif final_moviepy_position[1] == 'center':
                                y_text_top_edge = (subclip.h - text_h) / 2
                            elif final_moviepy_position[1] == 'bottom':
                                y_text_top_edge = subclip.h - text_h - margin_y
                            else: # Numerical position
                                try:
                                    y_text_top_edge = float(final_moviepy_position[1])
                                except ValueError:
                                    sys.stderr.write(f"WARNING: Clip {i+1} - Invalid Y position '{final_moviepy_position[1]}' for underline, defaulting to bottom alignment logic.\n")
                                    y_text_top_edge = subclip.h - text_h - margin_y
                            
                            y_underline_top_edge = y_text_top_edge + text_h + gap_after_text
                            
                            final_positioned_underline = animated_underline_clip.set_position((final_moviepy_position[0], y_underline_top_edge))
                            
                            text_clip_for_final_render = CompositeVideoClip([positioned_text_clip, final_positioned_underline], size=subclip.size)
                            # Duration of CompositeVideoClip is usually the longest of its clips. Both are subclip.duration.

                        else: # 'None' or other animations not yet implemented
                            text_clip_for_final_render = txt_clip_instance.set_position(final_moviepy_position).set_duration(subclip.duration)
                        
                        final_clip_to_write = CompositeVideoClip([subclip, text_clip_for_final_render])
                        sys.stderr.write(f"DEBUG: Clip {i+1} - TextClip created and composited successfully.\n")
                    except Exception as e_textclip:
                        sys.stderr.write(f"ERROR: Clip {i+1} - Failed to create or composite TextClip: {e_textclip}\n{traceback.format_exc()}\n")
                        final_clip_to_write = subclip # Fallback to subclip without text
                else:
                    sys.stderr.write(f"DEBUG: Clip {i+1} - No caption text to render or text is empty.\n")
                # END: Added caption rendering logic

                write_params = {"codec": "libx264", "fps": video.fps, "threads": 2}
                final_subclip_audio_duration = 0.0
                if subclip.audio and hasattr(subclip.audio, 'duration') and subclip.audio.duration is not None:
                    final_subclip_audio_duration = subclip.audio.duration

                if current_subclip_has_audio and subclip.audio and final_subclip_audio_duration > 0.001:
                    write_params["audio_codec"] = "aac" # Using standard AAC encoder
                    # Try to use the sample rate from the original extracted WAV file
                    if extracted_audio_clip and hasattr(extracted_audio_clip, 'fps') and extracted_audio_clip.fps and isinstance(extracted_audio_clip.fps, (int, float)) and extracted_audio_clip.fps > 0:
                        source_wav_sample_rate = int(round(extracted_audio_clip.fps))
                        write_params["audio_fps"] = source_wav_sample_rate
                        # write_params["audio_bitrate"] = "256k" # Letting FFmpeg use default bitrate for AAC
                        sys.stderr.write(f"DEBUG: Clip {i+1} - Using WAV-derived audio. For write_videofile: audio_codec=aac, audio_fps={source_wav_sample_rate} (from WAV, bitrate: FFmpeg default)\n")
                    elif hasattr(subclip.audio, 'fps') and subclip.audio.fps and isinstance(subclip.audio.fps, (int, float)) and subclip.audio.fps > 0:
                        # Fallback to subclip.audio.fps if extracted_audio_clip.fps is not available for some reason
                        current_audio_fps_fallback = int(round(subclip.audio.fps))
                        write_params["audio_fps"] = current_audio_fps_fallback
                        sys.stderr.write(f"DEBUG: Clip {i+1} - Using WAV-derived audio (fallback FPS). For write_videofile: audio_codec=aac, audio_fps={current_audio_fps_fallback} (bitrate: FFmpeg default)\n")
                    else:
                        sys.stderr.write(f"WARNING: Clip {i+1} - WAV-derived audio's FPS is invalid or unavailable ({getattr(extracted_audio_clip, 'fps', 'N/A')}, {getattr(subclip.audio, 'fps', 'N/A')}). Setting audio_codec=aac. FPS/Bitrate will be inferred by MoviePy.\n")
                else:
                    if not current_subclip_has_audio:
                         sys.stderr.write(f"DEBUG: Clip {i+1} - Decided to write video without audio because current_subclip_has_audio is False.\n")
                    elif not subclip.audio:
                         sys.stderr.write(f"DEBUG: Clip {i+1} - Decided to write video without audio because subclip.audio is None.\n")
                    elif not (final_subclip_audio_duration > 0.001):
                         sys.stderr.write(f"DEBUG: Clip {i+1} - Decided to write video without audio because subclip.audio duration is invalid or too short ({final_subclip_audio_duration:.3f}s).\n")
                    write_params["audio"] = False
                
                if video.audio and hasattr(video.audio, 'reader') and video.audio.reader and hasattr(video.audio.reader, 'proc') and video.audio.reader.proc:
                    audio_proc_pid = video.audio.reader.proc.pid if hasattr(video.audio.reader.proc, 'pid') else 'N/A'
                    poll_res = video.audio.reader.proc.poll()
                    sys.stderr.write(f"DEBUG: Clip {i+1}, Main video audio reader (PID {audio_proc_pid}) poll before write: {poll_res}\n")
                sys.stderr.flush()

                final_clip_to_write.write_videofile(clip_path_absolute, **write_params)
                
                clips_data.append({
                    "id": f"{session_id}_clip_{i+1}", "previewUrl": f"/{clip_path_relative}",
                    "summary": f"AI summary for clip {i+1} (pending)...", "captionData": generated_caption_text, # Use the generated or placeholder caption
                    "sourceVideoUrl": video_url, "startTime": round(start_time, 2), "endTime": round(end_time, 2),
                    "originalFilename": original_filename, "error": None, "traceback": None
                })
                
                sys.stderr.write(f"DEBUG: Successfully processed clip {i+1}. Output: {clip_path_absolute}\n")
            except Exception as e_clip:
                error_traceback = traceback.format_exc()
                sys.stderr.write(f"ERROR_PROCESSING_CLIP: Clip {i+1} for {original_filename} failed. Error: {str(e_clip)}\nTraceback: {error_traceback}\n")
                clips_data.append({
                    "id": f"{session_id}_clip_{i+1}", "previewUrl": None,
                    "summary": f"Error processing clip {i+1}: {str(e_clip)}", "captionData": None,
                    "sourceVideoUrl": video_url, "startTime": round(start_time, 2), "endTime": round(end_time, 2),
                    "originalFilename": original_filename, "error": str(e_clip), "traceback": error_traceback
                })
            finally:
                if subclip:
                    # Clean up temporary audio segment file for the current clip (if created by FFmpeg direct method)
                    # temp_segment_audio_path_for_clip is initialized to None before the try block for audio assignment
                    if temp_segment_audio_path_for_clip and os.path.exists(temp_segment_audio_path_for_clip):
                        try:
                            # Ensure the AudioFileClip using this path is closed *before* deleting the file
                            if subclip.audio and isinstance(subclip.audio, AudioFileClip) and subclip.audio.filename == temp_segment_audio_path_for_clip:
                                sys.stderr.write(f"DEBUG: Clip {i+1} - Explicitly closing subclip.audio (segment AudioFileClip) before deleting its source file.\n")
                                subclip.audio.close()
                                # Set subclip.audio to None after closing to prevent double close attempts if it was the same as assigned_audio_for_clip
                                # However, the main subclip.audio.close() call below should handle the assigned_audio_for_clip if it's the same object.
                            os.remove(temp_segment_audio_path_for_clip)
                            sys.stderr.write(f"DEBUG: Clip {i+1} - Successfully deleted temporary audio segment: {temp_segment_audio_path_for_clip}\n")
                        except Exception as e_del_segment:
                            sys.stderr.write(f"WARNING: Clip {i+1} - Could not delete temporary audio segment {temp_segment_audio_path_for_clip}: {e_del_segment}\n")
                    elif temp_segment_audio_path_for_clip: # Path was set but file doesn't exist (e.g., FFmpeg error or already cleaned up)
                        sys.stderr.write(f"DEBUG: Clip {i+1} - Temporary audio segment path was set ({temp_segment_audio_path_for_clip}) but file not found for deletion (likely FFmpeg error or already handled)).\n")

                    try:
                        if subclip.audio: # This is assigned_audio_for_clip (which could be from the FFmpeg segment)
                            sys.stderr.write(f"DEBUG: Clip {i+1}, attempting to close subclip.audio (type: {type(subclip.audio).__name__}, filename: {getattr(subclip.audio, 'filename', 'N/A')})\n")
                            subclip.audio.close()
                            sys.stderr.write(f"DEBUG: Clip {i+1}, subclip.audio closed\n")
                    except Exception as e_sub_audio_close:
                        sys.stderr.write(f"WARNING: Clip {i+1} - Error closing subclip.audio: {str(e_sub_audio_close)}\n")
                    # Cleanup for text_clip_for_final_render
                    if 'text_clip_for_final_render' in locals() and text_clip_for_final_render:
                        try:
                            sys.stderr.write(f"DEBUG: Clip {i+1}, attempting to close text_clip_for_final_render\n")
                            text_clip_for_final_render.close()
                            sys.stderr.write(f"DEBUG: Clip {i+1}, text_clip_for_final_render closed\n")
                        except Exception as e_text_close:
                            sys.stderr.write(f"DEBUG: Error closing text_clip_for_final_render for clip {i+1}: {str(e_text_close)}\n")
                    
                    # Cleanup for subclip and its audio
                    if 'subclip' in locals() and subclip:
                        try:
                            if subclip.audio:
                                sys.stderr.write(f"DEBUG: Clip {i+1}, attempting to close subclip.audio\n")
                                subclip.audio.close()
                                sys.stderr.write(f"DEBUG: Clip {i+1}, subclip.audio closed\n")
                        except Exception as e_sub_audio_close:
                            sys.stderr.write(f"DEBUG: Clip {i+1}, error closing subclip.audio: {str(e_sub_audio_close)}\n")
                        
                        try:
                            sys.stderr.write(f"DEBUG: Clip {i+1}, attempting to close subclip object\n")
                            subclip.close()
                            sys.stderr.write(f"DEBUG: Clip {i+1}, subclip object closed\n")
                        except Exception as e_sub_close:
                            sys.stderr.write(f"DEBUG: Error closing subclip for clip {i+1}: {str(e_sub_close)}\n")
                sys.stderr.flush()

    except Exception as e_global:
        tb_str = traceback.format_exc()
        sys.stderr.write(f"GLOBAL_ERROR in process_video: {str(e_global)}\nTraceback: {tb_str}\n")
        # If no clips_data has been populated (e.g. error during download), add a global error entry.
        if not clips_data:
            clips_data.append({
                "id": f"{session_id}_GLOBAL_ERROR",
                "previewUrl": None,
                "summary": f"A global error occurred: {str(e_global)}",
                "captionData": None,
                "sourceVideoUrl": video_url,
                "startTime": None,
                "endTime": None,
                "originalFilename": original_filename,
                "error": str(e_global),
                "traceback": tb_str
            })
        # If clips_data has partial entries, the global error might explain why it's partial.
        # The frontend should be able to handle this.
    finally:
        if extracted_audio_clip:
            try:
                extracted_audio_clip.close()
                sys.stderr.write("DEBUG: Main extracted_audio_clip closed successfully in outer finally.\n")
            except Exception as e_close_main_audio:
                sys.stderr.write(f"ERROR: Could not close main extracted_audio_clip in outer finally: {str(e_close_main_audio)}\n")
        if temp_wav_path and os.path.exists(temp_wav_path):
            try:
                os.remove(temp_wav_path)
                sys.stderr.write(f"DEBUG: Successfully deleted temporary WAV file in outer finally: {temp_wav_path}\n")
            except Exception as e_del_wav:
                sys.stderr.write(f"WARNING: Could not delete temporary WAV file {temp_wav_path} in outer finally: {e_del_wav}\n")

        if video:
            video.close()
            sys.stderr.write("DEBUG: Main video object closed.\n")
        # Ensure FFmpeg processes are cleaned up if any were started by yt-dlp and not waited on
        # This is more of a general caution; direct subprocess calls are handled above.
        sys.stderr.write("DEBUG: process_video try block finished or an exception occurred. Entering finally.\n")

        # Ensure clips_data is always written to stdout
        sys.stdout.write(json.dumps(clips_data))
        sys.stdout.flush()

        sys.stderr.write("DEBUG: process_video call completed (from finally block).\n")
        sys.stderr.flush()
    # The script will exit implicitly. If sys.exit(1) was called for critical early errors, it won't reach here.
    # If we reached here, it means either success or errors were appended to clips_data for stdout.
    # No explicit return here, output is via stdout. Function effectively returns None.


def main():
    parser = argparse.ArgumentParser(description='Process a video from a URL into clips based on JSON data.')
    parser.add_argument('--json_data', required=True, help='JSON string containing all processing parameters.')
    args = parser.parse_args()

    try:
        data = json.loads(args.json_data)
    except json.JSONDecodeError:
        sys.stderr.write("ERROR: Invalid JSON data provided.\n")
        sys.exit(1)

    # Extract main parameters and the rest as the style template
    video_url = data.pop('videoUrl', None)
    clip_length = data.pop('clipLength', 30)
    generate_captions = data.pop('generateCaptions', True)

    if not video_url:
        sys.stderr.write("ERROR: 'videoUrl' is a required key in the JSON data.\n")
        sys.exit(1)

    # The rest of the 'data' dictionary is our style_template
    style_template = data

    try:
        process_video(
            video_url=video_url,
            clip_length_seconds=clip_length,
            generate_captions=generate_captions,
            base_output_dir='clips',  # Base directory for output
            style_template=style_template
        )
    except Exception as e:
        error_message = {
            "status": "error",
            "message": str(e),
            "traceback": traceback.format_exc()
        }
        sys.stdout.write(json.dumps(error_message) + '\n')
        sys.stdout.flush()
        sys.exit(1)

if __name__ == "__main__":
    main()