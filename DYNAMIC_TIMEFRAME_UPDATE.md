# Dynamic Video Duration & Timeframe Slider

## What Was Fixed

The timeframe slider was hardcoded to 5 minutes (300 seconds). Now it **dynamically adjusts** to the actual video length.

## How It Works Now

### 1. **User Enters YouTube URL**
```
User pastes: https://www.youtube.com/watch?v=abc123
```

### 2. **Frontend Extracts Video ID**
```typescript
const id = extractYouTubeId(url); // "abc123"
```

### 3. **Frontend Calls Backend API**
```typescript
GET /api/video-info?video_id=abc123
```

### 4. **Backend Uses yt-dlp to Fetch Metadata**
```python
yt-dlp --dump-json --no-download https://www.youtube.com/watch?v=abc123
```

Returns:
```json
{
  "duration": 1847,  // 30 minutes 47 seconds
  "title": "Amazing Tutorial Video",
  "uploader": "Tech Channel",
  "view_count": 150000
}
```

### 5. **Frontend Updates Slider**
```typescript
setVideoDuration(1847);      // Slider max = 30:47
setTimeframeEnd(1847);       // Default to full video
```

### 6. **User Drags Slider**
- Can select any portion: 0:00 to 30:47
- Or just first 5 minutes: 0:00 to 5:00
- Or middle section: 10:00 to 20:00
- **Completely flexible!**

## Changes Made

### Frontend (`VideoInputForm.tsx`)

#### Added State for Loading
```typescript
const [isLoadingDuration, setIsLoadingDuration] = useState(false);
```

#### Added Fetch Function
```typescript
const fetchVideoDuration = async (videoId: string) => {
  setIsLoadingDuration(true);
  try {
    const response = await fetch(`${flaskUrl}/api/video-info?video_id=${videoId}`);
    const data = await response.json();
    const duration = data.duration || 300;
    setVideoDuration(duration);
    setTimeframeEnd(duration); // Set to full video
  } catch (error) {
    // Fallback to 5 minutes if API fails
    setVideoDuration(300);
    setTimeframeEnd(300);
  } finally {
    setIsLoadingDuration(false);
  }
};
```

#### Updated useEffect
```typescript
useEffect(() => {
  if (validateYouTubeUrl(youtubeUrl)) {
    const id = extractYouTubeId(youtubeUrl);
    if (id) {
      fetchVideoDuration(id); // Fetch actual duration
    }
  } else {
    // Reset to defaults when URL cleared
    setVideoDuration(300);
    setTimeframeEnd(300);
  }
}, [youtubeUrl]);
```

#### Enhanced UI
- Loading spinner while fetching duration
- Shows "Selected: X:XX" and "Total: Y:YY"
- Helpful tooltip about dragging slider

### Backend (`app.py`)

#### New API Endpoint
```python
@app.route("/api/video-info", methods=["GET"])
def get_video_info():
    """Get video information using yt-dlp"""
    video_id = request.args.get('video_id')
    
    # Use yt-dlp to get metadata without downloading
    cmd = ['yt-dlp', '--dump-json', '--no-download', youtube_url]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    
    video_info = json.loads(result.stdout)
    
    return jsonify({
        "duration": video_info.get('duration', 300),
        "title": video_info.get('title', 'Unknown'),
        "uploader": video_info.get('uploader', 'Unknown'),
        "view_count": video_info.get('view_count', 0),
    })
```

## User Experience

### Before ❌
- Slider always 0:00 to 5:00
- Can't process videos longer than 5 minutes
- No way to know actual video length

### After ✅
- Slider adjusts to actual video length (could be 3 min, 10 min, 30 min, etc.)
- Can select ANY portion of the video
- Shows total video duration
- Loading indicator while fetching
- Graceful fallback if API fails

## Example Scenarios

### Short Video (3 minutes)
```
Video Duration: 3:00
Slider Range: 0:00 to 3:00
Default Selection: Full video (0:00 to 3:00)
```

### Medium Video (15 minutes)
```
Video Duration: 15:00
Slider Range: 0:00 to 15:00
User can select: 
  - First 5 minutes: 0:00 to 5:00
  - Middle section: 5:00 to 10:00
  - Last 5 minutes: 10:00 to 15:00
```

### Long Video (45 minutes)
```
Video Duration: 45:00
Slider Range: 0:00 to 45:00
User can select:
  - First 10 minutes: 0:00 to 10:00
  - Specific segment: 20:00 to 30:00
  - Full video: 0:00 to 45:00
```

## Testing

### 1. Test Short Video
```
URL: https://www.youtube.com/watch?v=dQw4w9WgXcQ (3:32)
Expected: Slider max = 3:32
```

### 2. Test Medium Video
```
URL: https://www.youtube.com/watch?v=jNQXAC9IVRw (10:00)
Expected: Slider max = 10:00
```

### 3. Test Long Video
```
URL: https://www.youtube.com/watch?v=9bZkp7q19f0 (1:33:38)
Expected: Slider max = 1:33:38
```

### 4. Test Error Handling
```
- Invalid URL → Resets to 5:00 default
- Network error → Falls back to 5:00
- yt-dlp fails → Falls back to 5:00
```

## Benefits

1. **Flexibility** - Process any length video
2. **Efficiency** - Only process the part you need
3. **User-Friendly** - Visual feedback with time display
4. **Robust** - Graceful fallback if API fails
5. **Fast** - yt-dlp metadata fetch is very quick (~1-2 seconds)

## Technical Notes

- **yt-dlp** is already installed (used for video downloading)
- **No extra dependencies** needed
- **Timeout protection** - 30 second timeout prevents hanging
- **Error handling** - Falls back to 5 minutes if anything fails
- **Caching** - Could add caching in future to avoid repeated API calls

## Files Modified

### Frontend
- `frontend/src/components/dashboard/VideoInputForm.tsx`
  - Added `fetchVideoDuration()` function
  - Added loading state
  - Enhanced UI with duration display
  - Updated useEffect to fetch duration

### Backend
- `python_caption_service/app.py`
  - Added `/api/video-info` endpoint
  - Uses yt-dlp to fetch metadata
  - Returns duration and other video info
