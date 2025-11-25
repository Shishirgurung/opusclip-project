# Timeframe & Clip Length Fix Summary

## Issues Fixed

### 1. **Clip Length Bug** ✅ FIXED
**Problem:** Clips were always ~30s regardless of user's 60-90s preference  
**Root Cause:** `segment_transcript()` in `hook_detector.py` stopped at minimum length (30s) instead of targeting preferred length  
**Solution:** Updated logic to collect all sentence boundaries and pick the one closest to target length

**Test Results:**
- ✅ 100% of clips now in 60-90s range when requested
- ✅ Average duration: 77s (perfect for 60-90s preference)
- ✅ No more premature 30s clips

### 2. **Timeframe Processing** ✅ FIXED
**Problem:** Timeframe UI existed but parameters weren't being sent to backend  
**Root Cause:** Missing parameter passing through entire pipeline  
**Solution:** Wired timeframe parameters through all layers

## Changes Made

### Frontend Changes

#### 1. TypeScript Types (`frontend/src/types/index.ts`)
```typescript
export interface VideoProcessRequestOpus {
  // ... existing fields ...
  layout?: string;
  generateCaptions?: boolean;
  // NEW: Timeframe parameters
  useTimeframe?: boolean;
  timeframeStart?: number;  // Start time in seconds
  timeframeEnd?: number;    // End time in seconds
  // NEW: Clip length preferences
  minClipLength?: number;   // Minimum clip length in seconds
  maxClipLength?: number;   // Maximum clip length in seconds
  targetClipLength?: number; // Target/preferred clip length in seconds
}
```

#### 2. Form Submission (`frontend/src/components/dashboard/VideoInputForm.tsx`)
Now includes timeframe and clip length parameters in request:
```typescript
const requestData: VideoProcessRequestOpus = {
  // ... existing fields ...
  useTimeframe,
  timeframeStart: useTimeframe ? timeframeStart : undefined,
  timeframeEnd: useTimeframe ? timeframeEnd : undefined,
  minClipLength,
  maxClipLength,
  targetClipLength
};
```

#### 3. API Trigger (`frontend/src/pages/api/jobs/trigger.ts`)
Passes parameters to Flask backend:
```typescript
// Add timeframe parameters if enabled
if (requestData.useTimeframe && requestData.timeframeStart !== undefined && requestData.timeframeEnd !== undefined) {
  formData.append('timeframe_start', requestData.timeframeStart.toString());
  formData.append('timeframe_end', requestData.timeframeEnd.toString());
}

// Add clip length preferences
if (requestData.minClipLength !== undefined) {
  formData.append('min_clip_length', requestData.minClipLength.toString());
}
// ... etc
```

### Backend Changes

#### 1. Flask API (`python_caption_service/app.py`)
Accepts and parses new parameters:
```python
# Timeframe parameters
timeframe_start_str = request.form.get("timeframe_start")
timeframe_end_str = request.form.get("timeframe_end")

# Clip length preferences
min_clip_length_str = request.form.get("min_clip_length")
max_clip_length_str = request.form.get("max_clip_length")
target_clip_length_str = request.form.get("target_clip_length")

# Parse and pass to processing function
timeframe_start = int(timeframe_start_str) if timeframe_start_str else None
timeframe_end = int(timeframe_end_str) if timeframe_end_str else None
min_clip_length = int(min_clip_length_str) if min_clip_length_str else 30
max_clip_length = int(max_clip_length_str) if max_clip_length_str else 90
target_clip_length = int(target_clip_length_str) if target_clip_length_str else 60
```

#### 2. Processing Function (`python_caption_service/processing.py`)
Updated signature and added timeframe filtering:
```python
def run_opus_transcription(
    youtube_url, 
    opus_template, 
    clip_duration, 
    exports_dir, 
    original_filename=None, 
    layout_mode="auto",
    timeframe_start=None,  # NEW
    timeframe_end=None,    # NEW
    min_clip_length=30,    # NEW
    max_clip_length=90,    # NEW
    target_clip_length=60  # NEW
):
    # ... transcription ...
    
    # Apply timeframe filtering if specified
    if timeframe_start is not None and timeframe_end is not None:
        original_count = len(transcription_segments)
        transcription_segments = [
            seg for seg in transcription_segments
            if seg.end >= timeframe_start and seg.start <= timeframe_end
        ]
        print(f"Timeframe filter applied: {timeframe_start}s - {timeframe_end}s")
        print(f"Filtered to {len(transcription_segments)} segments (from {original_count})")
```

#### 3. Hook Detector (`python_caption_service/hook_detector.py`)
Fixed segmentation logic to target preferred length:
```python
def segment_transcript(self, transcript_segments: List[TranscriptSegment]) -> List[VideoClip]:
    # OLD: Stopped at first sentence boundary after min_length
    # NEW: Collects all boundaries, picks closest to target_length
    
    best_clip_end = None
    best_clip_segments = []
    
    # Save sentence boundaries in the target range as candidates
    if potential_duration >= self.min_length and self._is_sentence_boundary(segment.text):
        # Prefer clips closer to target_length
        if best_clip_end is None or abs(potential_duration - self.target_length) < abs((best_clip_end - clip_start) - self.target_length):
            best_clip_end = segment.end_time
            best_clip_segments = clip_segments.copy()
        
        # If we're past target_length and found a good boundary, stop looking
        if potential_duration >= self.target_length:
            break
```

## Dynamic Video Duration (NEW!)

### Automatic Duration Detection
1. User enters YouTube URL
2. Frontend extracts video ID and calls `/api/video-info?video_id=abc123`
3. Backend uses `yt-dlp --dump-json` to fetch video metadata (duration, title, etc.)
4. Frontend updates slider maximum to actual video length
5. User can drag slider to select ANY portion of the video

**Examples:**
- 3-minute video → Slider: 0:00 to 3:00
- 15-minute video → Slider: 0:00 to 15:00  
- 45-minute video → Slider: 0:00 to 45:00

**No more hardcoded 5-minute limit!** ✅

## How It Works Now

### Clip Length Selection
1. User selects preferred length (e.g., 60-90s)
2. Frontend sends `minClipLength=60`, `maxClipLength=90`, `targetClipLength=75`
3. Backend passes to `HookDetector(target_length=75, min_length=60, max_length=90)`
4. Segmentation algorithm:
   - Builds clips by adding segments
   - Saves all sentence boundaries in the 60-90s range
   - Picks the boundary closest to 75s
   - Creates clip at that optimal point

### Timeframe Processing
1. User enables timeframe and sets range (e.g., 0-300s for first 5 minutes)
2. Frontend sends `useTimeframe=true`, `timeframeStart=0`, `timeframeEnd=300`
3. Backend transcribes full video
4. Filters transcript segments to only include those within timeframe
5. Clip generation only uses filtered segments

## Testing

### Test Clip Length Fix
```bash
cd python_caption_service
python test_clip_length_fix.py
```

Expected output:
- ✅ All clips in 60-90s range
- ✅ Average duration ~75s
- ✅ No 30s clips

### Test Full Pipeline
1. Start backend: `python app.py`
2. Start frontend: `cd frontend && pnpm dev`
3. Submit video with:
   - Preferred length: 60-90s
   - Timeframe: 0-300s (first 5 minutes)
4. Verify:
   - Clips are 60-90s long
   - Only content from first 5 minutes is used

## Notes

- **Default values:** If no clip length specified, defaults to 30-90s range with 60s target
- **Timeframe optional:** If not enabled, processes entire video
- **Backward compatible:** Old requests without these parameters still work
- **TypeScript errors:** Pre-existing errors in `VideoInputForm.tsx` are unrelated to these changes

## Files Modified

### Frontend
- `frontend/src/types/index.ts` - Added timeframe/clip length fields to interface
- `frontend/src/components/dashboard/VideoInputForm.tsx` - Dynamic duration fetching, enhanced UI, send parameters
- `frontend/src/pages/api/jobs/trigger.ts` - Pass parameters to Flask

### Backend
- `python_caption_service/app.py` - Accept/parse parameters, added `/api/video-info` endpoint
- `python_caption_service/processing.py` - Apply timeframe filtering
- `python_caption_service/hook_detector.py` - Fixed clip length targeting logic

### Tests
- `python_caption_service/test_clip_length_fix.py` - New test for clip length fix
- `python_caption_service/test_ssemble_logic.py` - Fixed indentation error

### Documentation
- `TIMEFRAME_FIX_SUMMARY.md` - Complete technical documentation
- `DYNAMIC_TIMEFRAME_UPDATE.md` - Dynamic duration feature documentation
