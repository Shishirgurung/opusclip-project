# Google Colab Quick Start Guide

## 🚀 **Get Started in 5 Minutes**

---

## **Step 1: Open Google Colab**

1. Go to: https://colab.research.google.com
2. Click **"New notebook"**
3. Or upload the notebook file: `OpusClip_Colab_Testing.ipynb`

---

## **Step 2: Enable GPU**

⚠️ **CRITICAL - Do this FIRST!**

1. Click **Runtime** (top menu)
2. Click **Change runtime type**
3. Set **Hardware accelerator** to **GPU**
4. Click **Save**

✅ You should see "GPU" in the top right corner

---

## **Step 3: Upload Your Files**

Option A: **Upload Folder**
1. Click folder icon on left sidebar
2. Click upload icon
3. Select `python_caption_service` folder
4. Wait for upload to complete

Option B: **Clone from GitHub**
```python
!git clone https://github.com/YOUR_USERNAME/opusclip-project.git
```

---

## **Step 4: Run the Notebook**

Run cells in order:

1. **Cell 1**: Check GPU
   - Should show: ✅ GPU DETECTED!

2. **Cell 2**: Install dependencies
   - Takes ~3-5 minutes first time
   - Shows: ✅ All dependencies installed!

3. **Cell 3**: Setup paths
   - Verifies files are accessible

4. **Cell 4**: Initialize generator
   - Downloads large Whisper model (~1.5GB)
   - Takes ~5-10 minutes first time
   - Shows: ✅ Generator initialized successfully!

5. **Cell 5**: Test with sample video
   - Processes a Nepali video
   - Takes ~3-5 minutes with GPU
   - Generates 5 viral clips with Roman Nepali captions

6. **Cell 6**: Download results
   - Downloads generated clips to your computer

---

## **⏱️ Timeline**

| Step | Time | What's Happening |
|------|------|------------------|
| GPU Check | 10s | Verify GPU is available |
| Install Deps | 3-5m | Download and install packages |
| Setup Paths | 10s | Configure Python paths |
| Initialize | 5-10m | Download Whisper large model |
| **First Video** | 3-5m | Process video with GPU |
| **Next Videos** | 2-3m | Faster (models already loaded) |

**Total first run: ~20-30 minutes**
**Subsequent runs: ~5 minutes per video**

---

## **🎯 Test Scenarios**

### **Scenario 1: Roman Nepali Captions**
```python
video_url = "https://youtu.be/WvYeomOOH3w"
source_language = "ne"
target_language = "ne-Latn"  # Roman Nepali
```

### **Scenario 2: Hinglish Captions**
```python
video_url = "https://youtu.be/HINDI_VIDEO_ID"
source_language = "hi"
target_language = "hi-Latn"  # Hinglish
```

### **Scenario 3: English Captions**
```python
video_url = "https://youtu.be/ENGLISH_VIDEO_ID"
source_language = "en"
target_language = "en"
```

---

## **✅ Success Indicators**

### **GPU is Working:**
```
✅ GPU DETECTED!
   Device: Tesla T4
   VRAM: 16.0GB
```

### **Dependencies Installed:**
```
✅ All dependencies installed!
```

### **Generator Ready:**
```
✅ Whisper large model loaded on CUDA (best quality, ~1550MB)
   Speed boost: ~5-10x faster than CPU
✅ Generator initialized successfully!
   Time taken: 45.3 seconds
```

### **Video Processed:**
```
✅ GENERATION COMPLETE!
Time taken: 4.2 minutes
Generated 5 viral clips with Roman Nepali captions
```

---

## **❌ Troubleshooting**

### **Problem: "No GPU detected"**
```
❌ NO GPU DETECTED!
   Please change runtime type to GPU
```

**Solution:**
1. Runtime → Change runtime type → GPU
2. Click Save
3. Restart notebook (Runtime → Restart runtime)

---

### **Problem: "Out of memory"**
```
CUDA out of memory. Tried to allocate X.XX GiB
```

**Solution:**
1. Reduce `target_clips` from 5 to 3
2. Use shorter videos
3. Runtime → Restart runtime (clear memory)

---

### **Problem: "Module not found"**
```
ModuleNotFoundError: No module named 'complete_viral_clip_generator'
```

**Solution:**
1. Verify files are uploaded to `/content/opusclip-project/`
2. Check Python path setup in Cell 3
3. Make sure folder structure is correct:
   ```
   /content/opusclip-project/
   └── python_caption_service/
       ├── complete_viral_clip_generator.py
       ├── hook_detector.py
       ├── opus_processor.py
       └── ...
   ```

---

### **Problem: "Video download failed"**
```
ERROR: Unable to download video
```

**Solution:**
1. Check if YouTube URL is valid
2. Try a different video
3. Check internet connection
4. Try with a public video (not private/restricted)

---

## **📊 Performance Comparison**

### **With GPU (Google Colab T4):**
- Whisper large: ~3-5 minutes per video ✅
- Sentiment analysis: ~30 seconds
- Total: ~4-6 minutes

### **Without GPU (CPU):**
- Whisper large: ~20-30 minutes per video ❌
- Sentiment analysis: ~5 minutes
- Total: ~30-40 minutes

**GPU is 5-10x faster!**

---

## **💾 Downloading Results**

After processing, download your clips:

```python
from google.colab import files
files.download('/content/opusclip-project/python_caption_service/exports/clips')
```

This will download a ZIP file with all generated clips.

---

## **🔄 Batch Processing**

Process multiple videos in one session:

```python
videos = [
    "https://youtu.be/VIDEO_1",
    "https://youtu.be/VIDEO_2",
    "https://youtu.be/VIDEO_3",
]

for video_url in videos:
    print(f"\nProcessing {video_url}...")
    result = generator.generate_complete_viral_clips(
        video_url=video_url,
        target_clips=5,
        source_language="ne",
        target_language="ne-Latn"
    )
    print(f"✅ Complete!")
```

---

## **📝 Notes**

- **First run takes longer** because it downloads the large Whisper model (~1.5GB)
- **Subsequent runs are faster** because models are cached
- **12-hour session limit** - Colab will disconnect after 12 hours
- **Free GPU** - NVIDIA T4 with 16GB VRAM
- **No credit card required** - Completely free!

---

## **🎓 Learning Resources**

- [Google Colab Documentation](https://colab.research.google.com/notebooks/intro.ipynb)
- [Faster Whisper GitHub](https://github.com/guillaumekln/faster-whisper)
- [PyTorch Documentation](https://pytorch.org/docs/stable/index.html)

---

## **✨ You're All Set!**

Now you have:
- ✅ Large Whisper model (best accuracy)
- ✅ Free GPU (5-10x faster)
- ✅ Roman Nepali transliteration
- ✅ Viral clip generation
- ✅ Google Colab notebook for testing

**Happy testing! 🚀**
