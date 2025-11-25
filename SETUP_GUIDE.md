# OpusClip Project - Complete Setup Guide

## Quick Start Commands

Follow these commands in order to get the OpusClip system running:

### 1. Start Redis Server
```bash
# Option A: Using Docker (Recommended)
docker run -d --name opus-redis -p 6379:6379 redis:6-alpine

# Option B: Local Redis installation
redis-server
```

### 2. Backend Setup
```bash
# Navigate to backend directory
cd c:\dev\opusclip-project\python_caption_service

# Create virtual environment
python -m venv venv

# Activate virtual environment (Windows)
venv\Scripts\activate

# Install Python dependencies
pip install -r requirements.txt

# Set environment variables (Windows)
set REPLICATE_API_TOKEN=your_token_here
set FLASK_ENV=development

# Start Flask API server
python app.py
```

### 3. Start Background Worker
```bash
# Open new terminal in python_caption_service directory
cd c:\dev\opusclip-project\python_caption_service

# Activate virtual environment
venv\Scripts\activate

# Start RQ worker
python -m rq worker --url redis://localhost:6379
```

### 4. Frontend Setup
```bash
# Navigate to frontend directory
cd c:\dev\opusclip-project\frontend

# Install Node.js dependencies
npm install

# Create environment file
echo NEXT_PUBLIC_API_URL=http://localhost:5000 > .env.local

# Start Next.js development server
npm run dev
```

### 5. Access Application
Open your browser to: `http://localhost:3000`

## System Architecture

The OpusClip system consists of:

1. **Frontend (Next.js)**: User interface running on port 3000
2. **Backend API (Flask)**: Processing server running on port 5000
3. **Redis Queue**: Job management and progress tracking
4. **Background Worker**: Asynchronous video processing

## Features

### Layout Modes
- **Fit**: Maintains aspect ratio with padding for vertical format
- **Fill**: Crops video to fill vertical format completely  
- **Square**: Creates square format with multiple positioning options

### Caption Templates
- **SwipeUp**: Progressive fill with conditional keyword animations
- **Karaoke**: Instant highlighting with scaling effects
- **BeastMode**: Complex multi-effect animations
- **OpusClipStyle**: Commercial-grade animations

### Processing Pipeline
1. User submits YouTube URL with template and layout selection
2. System downloads video and extracts audio
3. Whisper AI generates word-level transcription
4. Video processor applies layout transformations
5. Caption engine generates ASS subtitles with animations
6. FFmpeg burns captions into final video output

## Testing

### Test Layout Processing
```bash
cd c:\dev\opusclip-project\python_caption_service
python test_layout_processing.py
```

### Test Complete Video Processing
```bash
cd c:\dev\opusclip-project\python_caption_service
python test_complete_video.py --url "https://youtube.com/watch?v=example" --template SwipeUp --layout fit
```

### Test Video Processor
```bash
cd c:\dev\opusclip-project\python_caption_service
python video_processor.py input.mp4 --layout square --output output.mp4
```

## Troubleshooting

### Common Issues

**Redis Connection Failed:**
- Ensure Redis server is running: `redis-server` or Docker container
- Check port 6379 is available
- Verify Redis URL in environment variables

**FFmpeg Not Found:**
- Install FFmpeg and add to system PATH
- Test with: `ffmpeg -version`

**Job Stays in Queue:**
- Ensure RQ worker is running
- Check worker terminal for error messages
- Verify Redis connection

**Frontend Can't Connect:**
- Confirm Flask server is running on port 5000
- Check `NEXT_PUBLIC_API_URL` in `.env.local`
- Verify CORS settings in Flask app

**Video Processing Fails:**
- Check YouTube URL is accessible
- Verify all Python dependencies installed
- Ensure sufficient disk space for temporary files

### Performance Tips

- Use SSD storage for temporary video files
- Allocate sufficient RAM (8GB+ recommended)
- Use `base` Whisper model for faster transcription
- Enable GPU acceleration if available

## Environment Variables

### Backend (.env or system)
```
REPLICATE_API_TOKEN=your_token_here
FLASK_ENV=development
REDIS_URL=redis://localhost:6379
```
### REDIS COMMAND: 
```.\redis-server.exe --port 6380
```
### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost:5000
```

## Development Workflow

1. Make changes to code
2. Test with provided test scripts
3. Verify frontend-backend integration
4. Check real-time progress updates
5. Test complete end-to-end workflow

## Production Deployment

For production deployment:
1. Use production Redis instance
2. Set proper environment variables
3. Configure reverse proxy (nginx)
4. Enable SSL/HTTPS
5. Set up monitoring and logging
6. Configure automatic restarts

## Support

If you encounter issues:
1. Check this setup guide
2. Review error logs in terminals
3. Test individual components
4. Verify all dependencies are installed
5. Check system requirements are met
