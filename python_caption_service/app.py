import os
import traceback
import json
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
import logging
from rq import Queue
from redis import Redis
import uuid
import time
from processing import run_opus_transcription
from queue_manager import enqueue_processing_job, get_job_status
from opus_processor import (
    OPUS_TEMPLATES,
    OPUS_ANIMATION_STYLES,
    DEFAULT_HIGHLIGHT_COLORS,
)

# --- Flask App Setup ---
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

@app.errorhandler(BrokenPipeError)
def handle_broken_pipe_error(e):
    """
    Gracefully handles BrokenPipeError, which occurs when a client (like a browser)
    disconnects before the server can send a full response. This is common with
    frontend polling mechanisms and is not a critical server error.
    """
    # Log the error for debugging purposes, but at a 'warning' level.
    app.logger.warning(f"Caught BrokenPipeError: {e}. Client likely disconnected while polling.")
    # Return an empty response, as the client is no longer listening.
    return '', 204

EXPORTS_DIR = os.path.join(app.root_path, "exports")
os.makedirs(EXPORTS_DIR, exist_ok=True)


# --- API Endpoints ---


@app.route("/health", methods=["GET"])
def health_check():
    return 'OK', 200

@app.route("/api/transcribe_opus", methods=["POST"])
def create_job_endpoint():
    """
    Receives a request from the frontend, creates a background job for video
    processing, and immediately returns a job ID.
    """

    # Debug logging
    print("=== DEBUG: Received request ===")
    print(f"Content-Type: {request.content_type}")
    print(f"Form data keys: {list(request.form.keys())}")
    print(f"Form data: {dict(request.form)}")

    # The frontend now sends form data, not JSON
    job_id = request.form.get("job_id")
    youtube_url = request.form.get("youtube_url")
    video_url = request.form.get("video_url")
    opus_template_str = request.form.get("opus_template")
    clip_duration_str = request.form.get("clip_duration")
    original_filename = request.form.get("original_filename")
    layout = request.form.get("layout", "fit")  # Default to 'fit' if not provided
    
    # Timeframe parameters
    timeframe_start_str = request.form.get("timeframe_start")
    timeframe_end_str = request.form.get("timeframe_end")
    
    # Clip length preferences
    min_clip_length_str = request.form.get("min_clip_length")
    max_clip_length_str = request.form.get("max_clip_length")
    target_clip_length_str = request.form.get("target_clip_length")

    print(f"Parsed values - job_id: {job_id}, youtube_url: {youtube_url}, video_url: {video_url}")
    print(f"opus_template_str: {opus_template_str}")
    print(f"Timeframe: {timeframe_start_str}-{timeframe_end_str}, Clip lengths: min={min_clip_length_str}, max={max_clip_length_str}, target={target_clip_length_str}")

    if not job_id:
        return jsonify({"error": "job_id is required"}), 400
    if not youtube_url and not video_url:
        return jsonify({"error": "youtube_url or video_url is required"}), 400
    if not opus_template_str:
        return jsonify({"error": "opus_template is required"}), 400

    try:
        opus_template = json.loads(opus_template_str)
        clip_duration = int(clip_duration_str) if clip_duration_str else 30
        
        # Parse timeframe parameters
        timeframe_start = int(timeframe_start_str) if timeframe_start_str else None
        timeframe_end = int(timeframe_end_str) if timeframe_end_str else None
        
        # Parse clip length preferences
        min_clip_length = int(min_clip_length_str) if min_clip_length_str else 30
        max_clip_length = int(max_clip_length_str) if max_clip_length_str else 90
        target_clip_length = int(target_clip_length_str) if target_clip_length_str else 60
    except (json.JSONDecodeError, ValueError) as e:
        return jsonify({"error": f"Invalid template or duration: {e}"}), 400

    try:
        # Enqueue the job. The worker will pick this up.
        # If a job_id is provided, use it. Otherwise, RQ will generate a new one.
        job = enqueue_processing_job(
            run_opus_transcription,
            job_id=job_id,  # Pass the existing job_id
            youtube_url=youtube_url or video_url, # Use whichever is provided
            opus_template=opus_template,
            clip_duration=clip_duration,
            exports_dir=EXPORTS_DIR,
            original_filename=original_filename,
            layout=layout,  # Pass the layout parameter
            timeframe_start=timeframe_start,  # Pass timeframe parameters
            timeframe_end=timeframe_end,
            min_clip_length=min_clip_length,  # Pass clip length preferences
            max_clip_length=max_clip_length,
            target_clip_length=target_clip_length
        )
        print(f"Task enqueued for existing Job ID: {job.id}")
        # Return a success response
        return jsonify({"message": "Job enqueued successfully", "job_id": job.id}), 200
    except Exception as e:
        print("Error creating job:")
        traceback.print_exc()
        return jsonify({"error": "Failed to create job", "details": str(e)}), 500


@app.route("/api/jobs/<job_id>", methods=["GET"])
def get_job_status_endpoint(job_id):
    """Endpoint for the frontend to poll for job status."""
    status = get_job_status(job_id)
    return jsonify({"job": status})


@app.route("/api/clips", methods=["GET"])
def list_clips():
    """Scans the exports directory and returns a list of available video clips."""
    try:
        files = os.listdir(EXPORTS_DIR)
        video_files = sorted([f for f in files if f.endswith('.mp4')], reverse=True)
        clips = [{'filename': f, 'url': f'/exports/{f}'} for f in video_files]
        return jsonify({"clips": clips})
    except Exception as e:
        app.logger.error(f"Error listing clips: {e}")
        traceback.print_exc()
        return jsonify({"error": "Failed to list clips", "details": str(e)}), 500


# --- Helper & Static Endpoints ---



@app.route("/exports/<path:filename>", methods=["GET"])
def download_exported_file(filename):
    """Serves the processed video files from the exports directory."""
    try:
        return send_from_directory(EXPORTS_DIR, filename, as_attachment=False)
    except FileNotFoundError:
        return jsonify({"error": "File not found."}), 404


@app.route("/api/video-info", methods=["GET"])
def get_video_info():
    """Get video information (duration, title, etc.) using yt-dlp"""
    video_id = request.args.get('video_id')
    
    if not video_id:
        return jsonify({"error": "video_id parameter is required"}), 400
    
    try:
        import subprocess
        import json as json_lib
        
        # Use yt-dlp to get video info without downloading
        youtube_url = f"https://www.youtube.com/watch?v={video_id}"
        
        cmd = [
            'yt-dlp',
            '--dump-json',
            '--no-download',
            youtube_url
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        
        if result.returncode == 0:
            video_info = json_lib.loads(result.stdout)
            
            return jsonify({
                "duration": video_info.get('duration', 300),  # in seconds
                "title": video_info.get('title', 'Unknown'),
                "uploader": video_info.get('uploader', 'Unknown'),
                "view_count": video_info.get('view_count', 0),
                "upload_date": video_info.get('upload_date', ''),
            })
        else:
            app.logger.error(f"yt-dlp error: {result.stderr}")
            return jsonify({"error": "Failed to fetch video info", "details": result.stderr}), 500
            
    except subprocess.TimeoutExpired:
        return jsonify({"error": "Request timeout while fetching video info"}), 504
    except Exception as e:
        app.logger.error(f"Error fetching video info: {e}")
        traceback.print_exc()
        return jsonify({"error": "Failed to fetch video info", "details": str(e)}), 500


@app.route("/opus_templates", methods=["GET"])
def get_opus_templates():
    """Get available Opus Clip templates"""
    # Convert templates to frontend-friendly format
    template_list = []
    for template_name, template_data in OPUS_TEMPLATES.items():
        template_info = {
            'name': template_name,
            'display_name': template_data.get('name', template_name),
            'description': template_data.get('description', 'Custom caption style'),
            'category': template_data.get('category', 'General'),
            'words_per_line': template_data.get('words_per_line', 3),
            'positions': template_data.get('positions', ['bottom_center'])
        }
        template_list.append(template_info)
    
    return jsonify(
        {
            "templates": template_list,
            "animation_styles": list(OPUS_ANIMATION_STYLES.keys()),
            "default_highlight_colors": DEFAULT_HIGHLIGHT_COLORS,
        }
    )


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
