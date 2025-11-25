# Quick Startup Guide

This guide ensures the Flask backend and Next.js frontend start in the correct order to avoid connection errors.

## Prerequisites Checklist

- [ ] Node.js v18+ installed
- [ ] Python 3.8+ installed
- [ ] FFmpeg installed and in PATH
- [ ] Git repository cloned

## Step-by-Step Startup

### 1. Environment Setup (One-time)

```bash
# Copy environment variables
cp .env.example .env.local
```

**Windows PowerShell:**
```powershell
copy .env.example .env.local
```

### 2. Terminal 1 - Flask Backend Setup

```bash
# Navigate to backend directory
cd python_caption_service

# Create virtual environment (first time only)
python -m venv venv

# Activate virtual environment
# macOS/Linux:
source venv/bin/activate
# Windows PowerShell:
venv\Scripts\Activate.ps1
# Windows CMD:
venv\Scripts\activate.bat

# Install dependencies (first time or when requirements.txt changes)
# Note: This uses the backend-specific requirements.txt file in python_caption_service/
# If you're not in the python_caption_service directory, use the full path:
pip install -r requirements.txt
# Or from project root: pip install -r python_caption_service/requirements.txt

# Verify critical dependencies are installed correctly
yt-dlp --version
python -c "import whisper; print('Whisper installed successfully')"
ffmpeg -version

# Start Flask backend
python app.py
```

**Expected Output:**
```
 * Running on http://127.0.0.1:5000
 * Debug mode: on
```

**Expected Dependency Verification Output:**
```bash
# yt-dlp --version
2024.1.0 or higher

# python -c "import whisper; print('Whisper installed successfully')"
Whisper installed successfully

# ffmpeg -version
ffmpeg version 4.4.0 or higher
```

**Important:** The `requirements.txt` file in the `python_caption_service/` directory contains backend-specific dependencies including yt-dlp, whisper, and better-profanity. This is different from any root-level requirements file that may exist in the project. Always use the backend-specific requirements file (`python_caption_service/requirements.txt`) for Flask backend setup, not any root-level requirements file.

### 3. Terminal 2 - Next.js Frontend Setup

```bash
# Navigate to project root (open new terminal)
cd ..

# Install npm dependencies (first time or when package.json changes)
npm install

# Start Next.js frontend
npm run dev
```

**Expected Output:**
```
ready - started server on 0.0.0.0:3000, url: http://localhost:3000
```

## Verification Steps

### ✅ Backend Running (Port 5000)
- [ ] Terminal 1 shows "Running on http://127.0.0.1:5000"
- [ ] Visit http://localhost:5000 in browser (should show Flask response)
- [ ] No error messages in Terminal 1

### ✅ Frontend Running (Port 3000)
- [ ] Terminal 2 shows "ready - started server on 0.0.0.0:3000"
- [ ] Visit http://localhost:3000 in browser (should show dashboard)
- [ ] No "fetch failed" or connection errors

### ✅ Services Connected
- [ ] Dashboard loads without "Backend service unavailable" message
- [ ] Template selection works
- [ ] No `ECONNREFUSED ::1:5000` errors in browser console

## Common Issues & Solutions

### ❌ "connect ECONNREFUSED ::1:5000"

**Cause:** Flask backend not running or IPv6 connection issue

**Solutions:**
1. **Start Flask first:** Ensure Terminal 1 (Flask) is running before Terminal 2 (Next.js)
2. **Check Flask status:** Look for "Running on http://127.0.0.1:5000" message
3. **IPv6/IPv4 fix:** Edit `.env.local` and change:
   ```env
   FLASK_BASE_URL="http://127.0.0.1:5000"
   ```
   Instead of `localhost`, use `127.0.0.1` to force IPv4

### ❌ Virtual Environment Not Activated

**Symptoms:** `ModuleNotFoundError` when running `python app.py`

**Solution:**
```bash
cd python_caption_service
# Reactivate virtual environment
source venv/bin/activate  # macOS/Linux
venv\Scripts\Activate.ps1  # Windows PowerShell
```

### ❌ Missing Dependencies

**Symptoms:** Import errors or module not found

**Solution:**
```bash
# In python_caption_service with venv activated
pip install -r requirements.txt

# Verify installation of critical backend dependencies
yt-dlp --version
python -c "import whisper; print('Whisper installed successfully')"
python -c "import better_profanity; print('Better-profanity installed successfully')"

# For frontend
npm install
```

**Note:** The backend uses a separate `requirements.txt` file located in `python_caption_service/requirements.txt` that includes all necessary dependencies for YouTube downloading, audio transcription, and content filtering. If installing from the project root directory, use: `pip install -r python_caption_service/requirements.txt`

### ❌ Port Already in Use

**Symptoms:** "Address already in use" or "EADDRINUSE"

**Solutions:**
- **Port 5000:** Kill existing Flask process or change port in `app.py`
- **Port 3000:** Kill existing Next.js process or use `npm run dev -- -p 3001`

**Find and kill process:**
```bash
# Find process using port
lsof -i :5000  # macOS/Linux
netstat -ano | findstr :5000  # Windows

# Kill process
kill -9 <PID>  # macOS/Linux
taskkill /PID <PID> /F  # Windows
```

### ❌ "yt-dlp command not found" or YouTube Download Failures

**Symptoms:** 
- `FileNotFoundError: [Errno 2] No such file or directory: 'yt-dlp'`
- `subprocess returned non-zero exit status 1`
- YouTube download errors in Flask terminal

**Solutions:**
1. **Verify yt-dlp installation:**
   ```bash
   # In python_caption_service with venv activated
   yt-dlp --version
   ```
   
2. **If yt-dlp not found, reinstall dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Test yt-dlp with a known working video:**
   ```bash
   yt-dlp --extract-flat "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
   ```

4. **Windows-specific PATH issues:**
   - Ensure yt-dlp is installed in the same virtual environment as other dependencies
   - Verify virtual environment is activated before running Flask
   - yt-dlp should be installed via the requirements.txt file, not separately
   - Check if yt-dlp is accessible from the virtual environment: `where yt-dlp` (Windows) or `which yt-dlp` (macOS/Linux)
   - If yt-dlp is not found, reinstall all dependencies: `pip install -r requirements.txt`

### ❌ Invalid YouTube URL Format

**Symptoms:** 
- "Invalid YouTube URL" errors
- Download failures with specific video IDs

**Valid YouTube URL formats:**
- `https://www.youtube.com/watch?v=VIDEO_ID`
- `https://youtu.be/VIDEO_ID`
- `https://m.youtube.com/watch?v=VIDEO_ID`

**Invalid examples to avoid:**
- URLs with malformed video IDs (e.g., starting with `--` or containing unusual characters)
- Video IDs that are not exactly 11 characters
- Private, deleted, or region-locked videos

**Video ID requirements:**
- Exactly 11 characters long
- Alphanumeric characters plus hyphens (-) and underscores (_)
- No leading special characters (like `--`)

**Test with a known working URL:**
```bash
# This should work for testing
https://www.youtube.com/watch?v=dQw4w9WgXcQ
```

### ❌ FFmpeg Not Found

**Symptoms:** FFmpeg-related errors in Flask terminal

**Solutions:**
- **macOS:** `brew install ffmpeg`
- **Windows:** Download from https://ffmpeg.org and add to PATH
- **Linux:** `sudo apt install ffmpeg` or `sudo yum install ffmpeg`

### ❌ Python/Node Version Issues

**Check versions:**
```bash
python --version  # Should be 3.8+
node --version    # Should be 18+
npm --version
```

## Quick Restart Commands

**Restart Flask Backend:**
```bash
# In Terminal 1
Ctrl+C  # Stop Flask
python app.py  # Restart Flask
```

**Restart Next.js Frontend:**
```bash
# In Terminal 2
Ctrl+C  # Stop Next.js
npm run dev  # Restart Next.js
```

## Development Workflow

1. **Daily startup:** Run Flask first (Terminal 1), then Next.js (Terminal 2)
2. **Code changes:** Next.js auto-reloads; Flask needs manual restart
3. **New dependencies:** Restart both services after installing
4. **Debugging:** Check both terminal outputs for error messages

## Success Indicators

When everything works correctly:
- ✅ Two terminals running simultaneously
- ✅ Flask shows "Running on http://127.0.0.1:5000"
- ✅ Next.js shows "ready - started server on 0.0.0.0:3000"
- ✅ Dashboard loads at http://localhost:3000
- ✅ No connection errors in browser console
- ✅ Template processing works end-to-end

## Timeout Configuration for Video Processing

### Understanding Processing Times
Opus Clip video processing can take 5-20+ minutes depending on:
- Video length and resolution
- YouTube download speed
- Hardware performance (CPU for Whisper transcription)
- FFmpeg encoding complexity

### Configuring Timeouts
1. **Set processing timeout** in `.env.local`:
   ```
   OPUS_PROCESS_TIMEOUT_MS=900000  # 15 minutes (adjust as needed)
   ```

2. **For longer videos** (>10 minutes), consider increasing to 1800000 (30 minutes)

3. **For slower hardware**, increase timeout accordingly

### Troubleshooting Timeout Issues
- **Error: "Processing exceeded X minutes"** → Increase `OPUS_PROCESS_TIMEOUT_MS`
- **Error: "fetch failed"** → Check if Flask backend is running and responsive
- **Long processing times** → Monitor Flask backend logs for progress

### Production Considerations
When deploying to hosting providers:
- Vercel: Default function timeout is 10s (Hobby) or 60s (Pro) - consider async processing
- Other platforms: Check serverless function timeout limits
- Consider implementing background job processing for production use

Reference the implementation in `src/pages/api/process-video.ts` and environment configuration in `.env.example` for technical details.

---

**Need Help?** Check the full [README.md](./README.md) for detailed documentation or troubleshooting section.
