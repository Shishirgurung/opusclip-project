import type { NextApiRequest, NextApiResponse } from 'next';
import { spawn } from 'child_process';

interface VideoInfoResponse {
  success: boolean;
  duration?: number;
  title?: string;
  uploader?: string;
  detectedLanguage?: string;
  languageConfidence?: string;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<VideoInfoResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed. Use GET.'
    });
  }

  const { video_id } = req.query;

  if (!video_id || typeof video_id !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'video_id parameter is required'
    });
  }

  try {
    const youtubeUrl = `https://www.youtube.com/watch?v=${video_id}`;

    // Use yt-dlp to get video info without downloading
    const result = await new Promise<VideoInfoResponse>((resolve, reject) => {
      const ytDlpProcess = spawn('yt-dlp', [
        '--dump-json',
        '--no-download',
        youtubeUrl
      ]);

      let stdout = '';
      let stderr = '';

      ytDlpProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      ytDlpProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ytDlpProcess.on('close', (code) => {
        if (code === 0 && stdout) {
          try {
            const videoInfo = JSON.parse(stdout);
            
            // Detect language from video metadata
            // Priority: video language field > manual subtitles > specific auto-captions
            let detectedLanguage = 'auto';
            let languageConfidence = 'low';
            
            // Method 1: Check video language field (HIGHEST PRIORITY - YouTube's own detection)
            if (videoInfo.language && videoInfo.language !== 'auto') {
              detectedLanguage = videoInfo.language;
              languageConfidence = 'high';
              console.log(`✅ Using video language field: ${detectedLanguage}`);
            }
            
            // Method 2: Check manual subtitle languages (only if no language field)
            else if (videoInfo.subtitles && Object.keys(videoInfo.subtitles).length > 0) {
              const subtitleLangs = Object.keys(videoInfo.subtitles);
              detectedLanguage = subtitleLangs[0];
              languageConfidence = 'high';
              console.log(`✅ Using manual subtitles: ${detectedLanguage}`);
            }
            
            // Method 3: Check automatic captions for primary language (only if no language field)
            else if (videoInfo.automatic_captions && Object.keys(videoInfo.automatic_captions).length > 0) {
              const captionLangs = Object.keys(videoInfo.automatic_captions);
              
              // Look for 'hi-orig' (original Hindi) or 'hi' in the captions list
              if (captionLangs.includes('hi-orig')) {
                detectedLanguage = 'hi';
                languageConfidence = 'high';
                console.log(`✅ Using auto-captions (hi-orig): ${detectedLanguage}`);
              } else if (captionLangs.includes('hi')) {
                detectedLanguage = 'hi';
                languageConfidence = 'high';
                console.log(`✅ Using auto-captions (hi): ${detectedLanguage}`);
              } else if (captionLangs.includes('en-orig')) {
                detectedLanguage = 'en';
                languageConfidence = 'high';
                console.log(`✅ Using auto-captions (en-orig): ${detectedLanguage}`);
              } else if (captionLangs.includes('en')) {
                detectedLanguage = 'en';
                languageConfidence = 'high';
                console.log(`✅ Using auto-captions (en): ${detectedLanguage}`);
              } else {
                // Fallback: use first caption language (but lower confidence)
                detectedLanguage = captionLangs[0];
                languageConfidence = 'medium';
                console.log(`⚠️ Using first auto-caption language: ${detectedLanguage}`);
              }
            }
            
            // Method 4: Guess from title/description (basic heuristic)
            if (detectedLanguage === 'auto') {
              const text = `${videoInfo.title} ${videoInfo.description || ''}`;
              
              // Hindi detection (Devanagari script)
              if (/[\u0900-\u097F]/.test(text)) {
                detectedLanguage = 'hi';
                languageConfidence = 'medium';
                console.log('🔍 Detected Hindi from Devanagari script in title/description');
              }
              // Nepali detection (also uses Devanagari)
              else if (/[\u0900-\u097F]/.test(text) && text.toLowerCase().includes('nepal')) {
                detectedLanguage = 'ne';
                languageConfidence = 'low';
                console.log('🔍 Detected Nepali from Devanagari script + "nepal" keyword');
              }
              // Arabic detection
              else if (/[\u0600-\u06FF]/.test(text)) {
                detectedLanguage = 'ar';
                languageConfidence = 'medium';
                console.log('🔍 Detected Arabic from Arabic script');
              }
              // Chinese detection
              else if (/[\u4E00-\u9FFF]/.test(text)) {
                detectedLanguage = 'zh';
                languageConfidence = 'medium';
                console.log('🔍 Detected Chinese from Chinese characters');
              }
              // Japanese detection
              else if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) {
                detectedLanguage = 'ja';
                languageConfidence = 'medium';
                console.log('🔍 Detected Japanese from Hiragana/Katakana');
              }
              // Korean detection
              else if (/[\uAC00-\uD7AF]/.test(text)) {
                detectedLanguage = 'ko';
                languageConfidence = 'medium';
                console.log('🔍 Detected Korean from Hangul');
              }
            }
            
            // Log detection results
            console.log(`🌐 Final detected language: ${detectedLanguage} (confidence: ${languageConfidence})`);
            console.log(`📝 Title: ${videoInfo.title}`);
            console.log(`🎬 Uploader: ${videoInfo.uploader}`);
            console.log(`⏱️ Duration: ${videoInfo.duration}s`);
            
            // Debug: Log what methods were checked
            console.log('Detection methods checked:');
            console.log('  - Video language field:', videoInfo.language || 'none');
            console.log('  - Subtitles:', videoInfo.subtitles ? Object.keys(videoInfo.subtitles) : 'none');
            console.log('  - Auto captions:', videoInfo.automatic_captions ? Object.keys(videoInfo.automatic_captions) : 'none');
            
            resolve({
              success: true,
              duration: videoInfo.duration || 300,
              title: videoInfo.title || 'Unknown',
              uploader: videoInfo.uploader || 'Unknown',
              detectedLanguage: detectedLanguage,
              languageConfidence: languageConfidence
            });
          } catch (parseError) {
            console.error('Failed to parse yt-dlp output:', parseError);
            reject({
              success: false,
              error: 'Failed to parse video info'
            });
          }
        } else {
          console.error('yt-dlp error:', stderr);
          reject({
            success: false,
            error: 'Failed to fetch video info'
          });
        }
      });

      ytDlpProcess.on('error', (error) => {
        console.error('yt-dlp spawn error:', error);
        reject({
          success: false,
          error: 'Failed to start yt-dlp'
        });
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        ytDlpProcess.kill();
        reject({
          success: false,
          error: 'Request timeout'
        });
      }, 30000);
    });

    return res.status(200).json(result);

  } catch (error: any) {
    console.error('Error fetching video info:', error);
    return res.status(500).json({
      success: false,
      error: error.error || 'Internal server error'
    });
  }
}
