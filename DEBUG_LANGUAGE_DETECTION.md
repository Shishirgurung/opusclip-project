# Debug: Language Detection Not Working

## 🐛 Issue:
Loading animation shows, but language stays on "Auto Detect" instead of changing to "Hindi"

## 🔍 Debugging Steps:

### **Step 1: Open Browser Console**
Press `F12` or right-click → Inspect → Console tab

### **Step 2: Paste Your Hindi Video URL**
```
https://youtube.com/watch?v=6NKflVS5eLg
```

### **Step 3: Check Console Logs**

You should see these logs in order:

#### **Frontend Logs:**
```
🔍 URL changed: https://youtube.com/watch?v=6NKflVS5eLg
📹 Extracted video ID: 6NKflVS5eLg
✅ Valid YouTube URL detected, showing preview
```

#### **Backend API Logs (in terminal where Next.js is running):**
```
🌐 Final detected language: hi (confidence: high)
📝 Title: Khan Sir on Pakistan...
🎬 Uploader: TKDMP
⏱️ Duration: 389s
Detection methods checked:
  - Video language field: none
  - Subtitles: none
  - Auto captions: ['hi', 'en']  ← Should show Hindi here!
```

#### **Frontend Response Logs:**
```
✅ Video duration fetched: 389s (6:29)
📊 Full API response: {success: true, duration: 389, title: "...", detectedLanguage: "hi", languageConfidence: "high"}
🌐 Language detected: hi (confidence: high)
```

---

## ❌ **If You See This Instead:**

### **Problem 1: API Not Called**
```
🔍 URL changed: https://youtube.com/watch?v=6NKflVS5eLg
📹 Extracted video ID: 6NKflVS5eLg
❌ Invalid or no YouTube URL  ← PROBLEM!
```

**Solution**: URL pattern not matching. Check if URL is exactly:
- `https://youtube.com/watch?v=...` or
- `https://youtu.be/...`

---

### **Problem 2: API Returns "auto"**
```
📊 Full API response: {success: true, duration: 389, detectedLanguage: "auto", ...}
⚠️ No language detected, staying on auto
```

**Solution**: Backend couldn't detect language. Check backend terminal logs:
```
Detection methods checked:
  - Video language field: none
  - Subtitles: none
  - Auto captions: none  ← All methods failed!
```

**Possible causes**:
1. Video has no captions/subtitles
2. `yt-dlp` not installed or not working
3. Video is private/restricted

---

### **Problem 3: API Error**
```
⚠️ API error fetching video duration, using default 5 minutes
```

**Solution**: Backend API crashed. Check terminal for errors:
```
Error: yt-dlp not found
Error: Failed to parse yt-dlp output
Error: Request timeout
```

**Fix**:
```bash
# Install yt-dlp
pip install yt-dlp

# Or on Windows
pip install --upgrade yt-dlp
```

---

### **Problem 4: Language Detected But Not Showing**
```
🌐 Language detected: hi (confidence: high)
# But UI still shows "Auto Detect"
```

**Solution**: React state not updating. Check if:
1. `setVideoLanguage(durationData.detectedLanguage)` is being called
2. `videoLanguage` state is changing
3. Component is re-rendering

**Debug**:
```javascript
// Add this to see state changes
console.log('Current videoLanguage state:', videoLanguage);
```

---

## ✅ **Expected Full Log Sequence:**

### **1. URL Pasted**
```
🔍 URL changed: https://youtube.com/watch?v=6NKflVS5eLg
📹 Extracted video ID: 6NKflVS5eLg
✅ Valid YouTube URL detected, showing preview
```

### **2. API Called (Backend Terminal)**
```
🌐 Final detected language: hi (confidence: high)
📝 Title: Khan Sir on Pakistan: India vs China, Pakistan Ep.1
🎬 Uploader: TKDMP
⏱️ Duration: 389s
Detection methods checked:
  - Video language field: none
  - Subtitles: none
  - Auto captions: ['hi', 'en']
```

### **3. Frontend Receives Response**
```
✅ Video duration fetched: 389s (6:29)
📊 Full API response: {
  success: true,
  duration: 389,
  title: "Khan Sir on Pakistan...",
  uploader: "TKDMP",
  detectedLanguage: "hi",
  languageConfidence: "high"
}
🌐 Language detected: hi (confidence: high)
```

### **4. UI Updates**
```
Dropdown changes from: [🌐 Auto Detect]
                   to: [🇮🇳 Hindi (हिंदी)]
Badge changes from: ✨ Auto-detect
                to: ✅ Detected
```

---

## 🔧 **Quick Fixes:**

### **Fix 1: Restart Dev Server**
```bash
# Stop server (Ctrl+C)
# Start again
npm run dev
```

### **Fix 2: Clear Browser Cache**
```
Ctrl+Shift+R (Windows)
Cmd+Shift+R (Mac)
```

### **Fix 3: Check yt-dlp Installation**
```bash
# Test if yt-dlp works
yt-dlp --version

# Should show: 2024.xx.xx
```

### **Fix 4: Test API Directly**
Open in browser:
```
http://localhost:3000/api/video-info?video_id=6NKflVS5eLg
```

Should return:
```json
{
  "success": true,
  "duration": 389,
  "title": "Khan Sir on Pakistan...",
  "uploader": "TKDMP",
  "detectedLanguage": "hi",
  "languageConfidence": "high"
}
```

---

## 📋 **Checklist:**

- [ ] Browser console open (F12)
- [ ] Dev server running (`npm run dev`)
- [ ] `yt-dlp` installed and working
- [ ] Valid YouTube URL pasted
- [ ] Console shows "✅ Valid YouTube URL detected"
- [ ] Backend logs show "🌐 Final detected language: hi"
- [ ] Frontend logs show "🌐 Language detected: hi"
- [ ] UI shows "🇮🇳 Hindi (हिंदी) ✅ Detected"

---

## 🚨 **Common Issues:**

### **Issue: "detectedLanguage: auto"**
**Cause**: Video has no captions/subtitles, title has no Hindi script
**Fix**: This is normal for some videos. User can manually select language.

### **Issue: "yt-dlp not found"**
**Cause**: `yt-dlp` not installed
**Fix**: 
```bash
pip install yt-dlp
# or
npm install -g yt-dlp
```

### **Issue: "Request timeout"**
**Cause**: Slow internet or YouTube blocking
**Fix**: Try again or use VPN

### **Issue: UI doesn't update**
**Cause**: React state not updating
**Fix**: Hard refresh (Ctrl+Shift+R)

---

## 📞 **Still Not Working?**

Share these logs:
1. Browser console logs (all of them)
2. Backend terminal logs (where Next.js is running)
3. API response (test `/api/video-info` directly)

This will help identify the exact issue!
