import React, { useState, useEffect } from 'react';
import Head from 'next/head';

// YouTube Player API types
declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { 
  Sparkles, 
  Youtube, 
  Layout, 
  Palette, 
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  Download,
  Play,
  Zap,
  Target,
  AlertTriangle
} from 'lucide-react';

interface ViralClip {
  filename: string;
  url: string;
  score: number;
  layout: string;
  template: string;
  duration: number;
}

interface ProcessingState {
  status: 'idle' | 'processing' | 'completed' | 'error';
  progress: number;
  stage: string;
  message: string;
  jobId?: string;
}

const ViralClipsPage: React.FC = () => {
  // Form state
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [selectedLayout, setSelectedLayout] = useState('auto');
  const [selectedTemplate, setSelectedTemplate] = useState('TikTokViral');
  const [maxClips, setMaxClips] = useState(10); // High default - backend will decide actual count automatically
  const [minScore, setMinScore] = useState(4.0);
  const [clipLength, setClipLength] = useState<'<30s' | '30s-60s' | '60s-90s' | 'original'>('30s-60s');
  
  // Clip length range (OpusClip style)
  const [minClipLength, setMinClipLength] = useState(30);
  const [maxClipLength, setMaxClipLength] = useState(60);
  const [targetClipLength, setTargetClipLength] = useState(45);
  
  // Processing timeframe
  const [useTimeframe, setUseTimeframe] = useState(false);
  const [timeframeStart, setTimeframeStart] = useState(0);
  const [timeframeEnd, setTimeframeEnd] = useState(300);
  
  // Video preview
  const [videoId, setVideoId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [videoTitle, setVideoTitle] = useState<string>('');
  const [videoDurationSeconds, setVideoDurationSeconds] = useState<number>(300);
  const [isLoadingDuration, setIsLoadingDuration] = useState(false);
  const [videoLanguage, setVideoLanguage] = useState<string>('auto');
  const [translateCaptions, setTranslateCaptions] = useState<boolean>(false);
  const [captionLanguage, setCaptionLanguage] = useState<string>('en');
  const [youtubePlayer, setYoutubePlayer] = useState<any>(null);

  // Processing state
  const [processingState, setProcessingState] = useState<ProcessingState>({
    status: 'idle',
    progress: 0,
    stage: '',
    message: ''
  });

  // Results state
  const [clips, setClips] = useState<ViralClip[]>([]);

  // Helper functions
  const extractYouTubeId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) return match[1];
    }
    return null;
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Fetch video metadata and duration
  const fetchVideoMetadata = async (id: string) => {
    try {
      // Use YouTube oEmbed API for title (no API key needed)
      const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`);
      const data = await response.json();
      
      if (data.title) {
        setVideoTitle(data.title);
      }
      
      // Fetch actual video duration and language from Next.js API
      setIsLoadingDuration(true);
      try {
        const durationResponse = await fetch(`/api/video-info?video_id=${id}`);
        
        if (durationResponse.ok) {
          const durationData = await durationResponse.json();
          if (durationData.success && durationData.duration) {
            const duration = durationData.duration;
            console.log(`✅ Video duration fetched: ${duration}s (${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')})`);
            setVideoDurationSeconds(duration);
            setTimeframeEnd(duration); // Set slider to full video duration
            
            // Auto-detect language from video metadata
            console.log('📊 Full API response:', durationData);
            if (durationData.detectedLanguage && durationData.detectedLanguage !== 'auto') {
              console.log(`🌐 Language detected: ${durationData.detectedLanguage} (confidence: ${durationData.languageConfidence})`);
              setVideoLanguage(durationData.detectedLanguage);
            } else {
              console.warn('⚠️ No language detected, staying on auto');
              console.log('detectedLanguage:', durationData.detectedLanguage);
              console.log('languageConfidence:', durationData.languageConfidence);
            }
          } else {
            console.warn('Failed to fetch video duration, using default 5 minutes');
            setVideoDurationSeconds(300);
            setTimeframeEnd(300);
          }
        } else {
          console.warn('API error fetching video duration, using default 5 minutes');
          setVideoDurationSeconds(300);
          setTimeframeEnd(300);
        }
      } catch (durationError) {
        console.warn('Error fetching video duration:', durationError);
        // Fallback to default if API fails
        setVideoDurationSeconds(300);
        setTimeframeEnd(300);
      } finally {
        setIsLoadingDuration(false);
      }
    } catch (error) {
      console.error('Failed to fetch video metadata:', error);
      setVideoTitle('YouTube Video');
      setVideoDurationSeconds(300);
      setTimeframeEnd(300);
    }
  };

  // Load YouTube iframe API
  useEffect(() => {
    // Load YouTube iframe API script
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }
  }, []);

  // Debug: Log when videoDurationSeconds changes
  useEffect(() => {
    console.log(`📊 videoDurationSeconds changed to: ${videoDurationSeconds}`);
  }, [videoDurationSeconds]);

  // Update clip length parameters when clipLength selection changes
  useEffect(() => {
    if (clipLength === '<30s') {
      setMinClipLength(15);
      setMaxClipLength(30);
      setTargetClipLength(22);
    } else if (clipLength === '30s-60s') {
      setMinClipLength(30);
      setMaxClipLength(60);
      setTargetClipLength(45);
    } else if (clipLength === '60s-90s') {
      setMinClipLength(60);
      setMaxClipLength(90);
      setTargetClipLength(75);
    } else if (clipLength === 'original') {
      setMinClipLength(30);
      setMaxClipLength(300);
      setTargetClipLength(120);
    }
  }, [clipLength]);

  // Update video preview and fetch duration when URL changes
  useEffect(() => {
    const id = extractYouTubeId(youtubeUrl);
    console.log('🔍 URL changed:', youtubeUrl);
    console.log('📹 Extracted video ID:', id);
    if (id) {
      console.log('✅ Valid YouTube URL detected, showing preview');
      setVideoId(id);
      setShowPreview(true);
      fetchVideoMetadata(id);
    } else {
      console.log('❌ Invalid or no YouTube URL');
      setVideoId(null);
      setShowPreview(false);
      setVideoTitle('');
      setYoutubePlayer(null);
    }
  }, [youtubeUrl]);

  // Initialize YouTube player when video ID changes
  useEffect(() => {
    if (videoId && window.YT && window.YT.Player) {
      // Wait a bit for iframe to be ready
      setTimeout(() => {
        try {
          const player = new window.YT.Player('youtube-player-iframe', {
            events: {
              onReady: (event: any) => {
                setYoutubePlayer(event.target);
                // Don't override duration here - we already fetched it from backend
                // The backend yt-dlp method is more reliable than YouTube iframe API
                console.log('YouTube player ready, using backend duration');
              }
            }
          });
        } catch (error) {
          console.error('Error initializing YouTube player:', error);
        }
      }, 1000);
    }
  }, [videoId]);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Layout options
  const layoutOptions = [
    { id: 'fit', name: 'Fit', icon: '📱', desc: 'Fit video with blurred background', stable: true },
    { id: 'square', name: 'Square', icon: '⬜', desc: 'Square format for social media', stable: true },
    { id: 'fill', name: 'Fill', icon: '🖼️', desc: 'Full screen stretch', stable: false },
    { id: 'auto', name: 'Auto AI', icon: '🤖', desc: 'AI face detection & centering', stable: true }
  ];

  // Template options - ALL AVAILABLE TEMPLATES
  const templateOptions = [
    { id: 'TikTokViral', name: 'TikTok Viral', desc: 'Explosive bouncy neon animations', category: 'Social', popular: true },
    { id: 'BeastMode', name: 'Beast Mode', desc: 'Massive drop animations with money theme', category: 'Gaming', popular: true },
    { id: 'Karaoke', name: 'Karaoke', desc: 'Smooth word-by-word highlighting', category: 'Classic', popular: true },
    { id: 'SwipeUp', name: 'SwipeUp', desc: 'Progressive green fill animations', category: 'Viral', popular: true },
    { id: 'Glitch', name: 'Glitch', desc: 'Digital RGB glitch effects', category: 'Tech', popular: false },
    { id: 'ComicPop', name: 'Comic Pop', desc: 'Angled text with pop animations', category: 'Fun', popular: false },
    { id: 'NeonPulse', name: 'Neon Pulse', desc: 'Electric blue pulse effects', category: 'Tech', popular: false },
    { id: 'TypeWriter', name: 'TypeWriter', desc: 'Typewriter reveal effect', category: 'Classic', popular: false },
    { id: 'BubblePop', name: 'Bubble Pop', desc: 'Floating bubble animations', category: 'Fun', popular: false },
    { id: 'BoldPop', name: 'Bold Pop', desc: 'Viral box captions with bounce', category: 'Viral', popular: false },
    { id: 'HighlightSweep', name: 'Highlight Sweep', desc: 'Marker sweep effect', category: 'Education', popular: false },
    { id: 'RageMode', name: 'Rage Mode', desc: 'Intense rage animations', category: 'Gaming', popular: false },
    { id: 'HypeTrain', name: 'Hype Train', desc: 'Rainbow slide momentum', category: 'Gaming', popular: false },
    { id: 'GlitchStreamer', name: 'Glitch Streamer', desc: 'RGB split glitch effects', category: 'Tech', popular: false },
    { id: 'Cinematic', name: 'Cinematic', desc: 'Fade-in drift animations', category: 'Professional', popular: false },
    { id: 'PodcastPro', name: 'Podcast Pro', desc: 'Speaker-aware captions', category: 'Professional', popular: false }
  ];

  // Clip length options
  const clipLengthOptions = [
    { id: '<30s', label: '<30s', desc: 'Short & punchy' },
    { id: '30s-60s', label: '30s~60s', desc: 'Optimal viral length' },
    { id: '60s-90s', label: '60s~90s', desc: 'Extended content' },
    { id: 'original', label: 'Original', desc: 'Full length' }
  ];

  // Language options (100+ languages supported by Whisper + Romanization)
  const languageOptions = [
    { code: 'auto', name: 'Auto Detect', flag: '🌐' },
    
    // English
    { code: 'en', name: 'English', flag: '🇬🇧' },
    
    // South Asian Languages (with Roman script options)
    { code: 'hi', name: 'Hindi (हिंदी)', flag: '🇮🇳' },
    { code: 'hi-Latn', name: 'Hinglish (Roman)', flag: '🇮🇳' },
    { code: 'ne', name: 'Nepali (नेपाली)', flag: '🇳🇵' },
    { code: 'ne-Latn', name: 'Nepali (Roman)', flag: '🇳🇵' },
    { code: 'ur', name: 'Urdu (اردو)', flag: '🇵🇰' },
    { code: 'ur-Latn', name: 'Urdu (Roman)', flag: '🇵🇰' },
    { code: 'bn', name: 'Bengali (বাংলা)', flag: '🇧🇩' },
    { code: 'pa', name: 'Punjabi (ਪੰਜਾਬੀ)', flag: '🇮🇳' },
    { code: 'ta', name: 'Tamil (தமிழ்)', flag: '🇮🇳' },
    { code: 'te', name: 'Telugu (తెలుగు)', flag: '🇮🇳' },
    { code: 'mr', name: 'Marathi (मराठी)', flag: '🇮🇳' },
    { code: 'gu', name: 'Gujarati (ગુજરાતી)', flag: '🇮🇳' },
    { code: 'kn', name: 'Kannada (ಕನ್ನಡ)', flag: '🇮🇳' },
    { code: 'ml', name: 'Malayalam (മലയാളം)', flag: '🇮🇳' },
    { code: 'si', name: 'Sinhala (සිංහල)', flag: '🇱🇰' },
    
    // East Asian Languages (with Roman script options)
    { code: 'ja', name: 'Japanese (日本語)', flag: '🇯🇵' },
    { code: 'ja-Latn', name: 'Japanese (Romaji)', flag: '🇯🇵' },
    { code: 'ko', name: 'Korean (한국어)', flag: '🇰🇷' },
    { code: 'ko-Latn', name: 'Korean (Romanized)', flag: '🇰🇷' },
    { code: 'zh', name: 'Chinese (中文)', flag: '🇨🇳' },
    { code: 'zh-Latn', name: 'Chinese (Pinyin)', flag: '🇨🇳' },
    { code: 'yue', name: 'Cantonese (粵語)', flag: '🇭🇰' },
    
    // Southeast Asian Languages
    { code: 'id', name: 'Indonesian (Bahasa)', flag: '🇮🇩' },
    { code: 'ms', name: 'Malay (Bahasa Melayu)', flag: '🇲🇾' },
    { code: 'th', name: 'Thai (ไทย)', flag: '🇹🇭' },
    { code: 'vi', name: 'Vietnamese (Tiếng Việt)', flag: '🇻🇳' },
    { code: 'tl', name: 'Filipino (Tagalog)', flag: '🇵🇭' },
    { code: 'my', name: 'Burmese (မြန်မာ)', flag: '🇲🇲' },
    { code: 'km', name: 'Khmer (ខ្មែរ)', flag: '🇰🇭' },
    { code: 'lo', name: 'Lao (ລາວ)', flag: '🇱🇦' },
    
    // European Languages
    { code: 'es', name: 'Spanish (Español)', flag: '🇪🇸' },
    { code: 'fr', name: 'French (Français)', flag: '🇫🇷' },
    { code: 'de', name: 'German (Deutsch)', flag: '🇩🇪' },
    { code: 'it', name: 'Italian (Italiano)', flag: '🇮🇹' },
    { code: 'pt', name: 'Portuguese (Português)', flag: '🇵🇹' },
    { code: 'ru', name: 'Russian (Русский)', flag: '🇷🇺' },
    { code: 'ru-Latn', name: 'Russian (Romanized)', flag: '🇷🇺' },
    { code: 'tr', name: 'Turkish (Türkçe)', flag: '🇹🇷' },
    { code: 'nl', name: 'Dutch (Nederlands)', flag: '🇳🇱' },
    { code: 'pl', name: 'Polish (Polski)', flag: '🇵🇱' },
    { code: 'sv', name: 'Swedish (Svenska)', flag: '🇸🇪' },
    { code: 'da', name: 'Danish (Dansk)', flag: '🇩🇰' },
    { code: 'no', name: 'Norwegian (Norsk)', flag: '🇳🇴' },
    { code: 'fi', name: 'Finnish (Suomi)', flag: '🇫🇮' },
    { code: 'uk', name: 'Ukrainian (Українська)', flag: '🇺🇦' },
    { code: 'cs', name: 'Czech (Čeština)', flag: '🇨🇿' },
    { code: 'el', name: 'Greek (Ελληνικά)', flag: '🇬🇷' },
    { code: 'el-Latn', name: 'Greek (Romanized)', flag: '🇬🇷' },
    
    // Middle Eastern Languages
    { code: 'ar', name: 'Arabic (العربية)', flag: '🇸🇦' },
    { code: 'ar-Latn', name: 'Arabic (Romanized)', flag: '🇸🇦' },
    { code: 'he', name: 'Hebrew (עברית)', flag: '🇮🇱' },
    { code: 'fa', name: 'Persian (فارسی)', flag: '🇮🇷' },
    
    // African Languages
    { code: 'sw', name: 'Swahili (Kiswahili)', flag: '🇰🇪' },
    { code: 'zu', name: 'Zulu', flag: '🇿🇦' },
    { code: 'af', name: 'Afrikaans', flag: '🇿🇦' },
    
    // Other Popular Languages
    { code: 'hu', name: 'Hungarian (Magyar)', flag: '🇭🇺' },
    { code: 'ro', name: 'Romanian (Română)', flag: '🇷🇴' },
    { code: 'bg', name: 'Bulgarian (Български)', flag: '🇧🇬' },
    { code: 'hr', name: 'Croatian (Hrvatski)', flag: '🇭🇷' },
    { code: 'sk', name: 'Slovak (Slovenčina)', flag: '🇸🇰' },
    { code: 'lt', name: 'Lithuanian (Lietuvių)', flag: '🇱🇹' },
    { code: 'lv', name: 'Latvian (Latviešu)', flag: '🇱🇻' },
    { code: 'et', name: 'Estonian (Eesti)', flag: '🇪🇪' }
  ];

  // YouTube URL validation
  const isValidYouTubeUrl = (url: string) => {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
    return youtubeRegex.test(url);
  };

  // Poll job status
  const pollJobStatus = async (jobId: string) => {
    const maxPolls = 60; // 5 minutes max
    let pollCount = 0;

    const poll = async () => {
      if (pollCount >= maxPolls) {
        setError('Processing timeout. Please try again.');
        setProcessingState(prev => ({ ...prev, status: 'error' }));
        return;
      }

      try {
        const response = await fetch(`/api/viral-clips-status?jobId=${jobId}`);
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to check status');
        }

        setProcessingState(prev => ({
          ...prev,
          progress: result.progress || 0,
          stage: result.stage || 'Processing',
          message: result.message || 'Processing your video...',
          status: result.status === 'completed' ? 'completed' : 
                  result.status === 'error' ? 'error' : 'processing'
        }));

        if (result.status === 'completed') {
          setClips(result.clips || []);
          setSuccessMessage(`Successfully generated ${result.clips?.length || 0} viral clips!`);
          setProcessingState(prev => ({ ...prev, status: 'completed' }));
          return;
        }

        if (result.status === 'error') {
          setError(result.message || 'Processing failed');
          setProcessingState(prev => ({ ...prev, status: 'error' }));
          return;
        }

        // Continue polling
        pollCount++;
        setTimeout(poll, 5000); // Poll every 5 seconds

      } catch (err) {
        console.error('Polling error:', err);
        if (pollCount < 3) { // Retry up to 3 times
          pollCount++;
          setTimeout(poll, 5000);
        } else {
          setError('Failed to check processing status');
          setProcessingState(prev => ({ ...prev, status: 'error' }));
        }
      }
    };

    poll();
  };

  // Handle form submission
  const handleGenerateClips = async () => {
    if (!isValidYouTubeUrl(youtubeUrl)) {
      setError('Please enter a valid YouTube URL');
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setClips([]);
    
    setProcessingState({
      status: 'processing',
      progress: 0,
      stage: 'Starting',
      message: 'Initializing viral clip generation...'
    });

    try {
      // Clip length parameters are already set by useEffect hook
      // No need to map here - state variables are already correct

      const response = await fetch('/api/generate-viral-clips', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoUrl: youtubeUrl,
          layout: selectedLayout,
          template: selectedTemplate,
          maxClips,
          minScore,
          clipLength,
          minClipLength,
          maxClipLength,
          targetClipLength,
          useTimeframe,
          timeframeStart,
          timeframeEnd,
          videoLanguage,
          translateCaptions,
          captionLanguage
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to start processing');
      }

      if (result.jobId) {
        setProcessingState(prev => ({ ...prev, jobId: result.jobId }));
        await pollJobStatus(result.jobId);
      } else {
        throw new Error('No job ID returned');
      }

    } catch (err) {
      console.error('Error generating clips:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate clips');
      setProcessingState({ status: 'error', progress: 0, stage: 'Error', message: '' });
    }
  };

  // Clear messages after timeout
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 10000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 15000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  return (
    <>
      <Head>
        <title>Viral Clips Generator - AI-Powered Video Clips</title>
        <meta name="description" content="Generate viral video clips with AI face detection, professional layouts, and animated captions" />
      </Head>
      
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        {/* Hero Section */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-pink-500/10"></div>
          <div className="relative px-6 py-12 text-center">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center justify-center gap-3 mb-6">
                <div className="p-4 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl shadow-lg">
                  <Zap className="h-10 w-10 text-white" />
                </div>
                <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
                  Viral Clips AI
                </h1>
              </div>
              <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
                Transform YouTube videos into viral clips with AI ranking. Always get the top clips from any video, ranked by viral potential.
              </p>
            </div>
          </div>
        </div>

        <main className="max-w-6xl mx-auto px-6 pb-12">
          {/* Success Message */}
          {successMessage && (
            <Alert className="mb-6 border-green-200 bg-green-50 dark:bg-green-950">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription className="text-green-800 dark:text-green-200">
                {successMessage}
              </AlertDescription>
            </Alert>
          )}

          {/* Error Message */}
          {error && (
            <Alert className="mb-6 border-red-200 bg-red-50 dark:bg-red-950">
              <XCircle className="h-4 w-4" />
              <AlertDescription className="text-red-800 dark:text-red-200">
                {error}
              </AlertDescription>
            </Alert>
          )}

          {/* Processing Status */}
          {processingState.status === 'processing' && (
            <Card className="mb-8 bg-white/5 backdrop-blur-lg border-white/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <RefreshCw className="h-5 w-5 animate-spin text-blue-500" />
                  {processingState.stage}
                </CardTitle>
                <CardDescription className="text-gray-300">
                  {processingState.message}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Progress value={processingState.progress} className="mb-2" />
                <p className="text-sm text-gray-400">{processingState.progress}% complete</p>
              </CardContent>
            </Card>
          )}

          {/* YouTube URL Input */}
          <Card className="mb-8 bg-white/5 backdrop-blur-lg border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Youtube className="h-6 w-6 text-red-500" />
                YouTube Video URL
              </CardTitle>
              <CardDescription className="text-gray-300">
                Paste any YouTube URL to start creating viral clips
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <input
                  type="url"
                  value={youtubeUrl}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleGenerateClips()}
                />
              </div>
              
              {/* Initial Loading State - Centered Spinner (Ssemble Style) */}
              {showPreview && videoId && isLoadingDuration && (
                <div className="mt-8 mb-8 flex flex-col items-center justify-center py-12 animate-in fade-in duration-300">
                  {/* Large Centered Spinner */}
                  <div className="relative">
                    <svg className="animate-spin h-16 w-16 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                  {/* Loading Text */}
                  <p className="mt-4 text-sm text-gray-300 font-medium">Analyzing video...</p>
                  <p className="mt-1 text-xs text-gray-400">Detecting language and fetching metadata</p>
                </div>
              )}
              
              {/* Language & Caption Settings - Ssemble Style - SHOW AFTER LOADING */}
              {showPreview && videoId && !isLoadingDuration && (
                <div className="mt-6 space-y-4 p-5 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-400/30 rounded-xl animate-in fade-in duration-300">
                  {/* Header */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 bg-blue-500/20 rounded-lg">
                      <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                      </svg>
                    </div>
                    <h3 className="text-sm font-semibold text-white">Language & Captions</h3>
                  </div>

                  {/* Video Language Detection */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                      Video Language
                    </label>
                    <div className="flex items-center gap-3">
                        <select
                          value={videoLanguage}
                          onChange={(e) => setVideoLanguage(e.target.value)}
                          className="flex-1 px-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all hover:bg-white/15"
                        >
                          {languageOptions.map((lang) => (
                            <option key={lang.code} value={lang.code} className="bg-gray-900">
                              {lang.flag} {lang.name}
                            </option>
                          ))}
                        </select>
                        {videoLanguage === 'auto' ? (
                          <span className="text-xs text-blue-400 font-medium bg-blue-500/20 px-3 py-1.5 rounded-lg whitespace-nowrap">
                            ✨ Auto-detect
                          </span>
                        ) : (
                          <span className="text-xs text-green-400 font-medium bg-green-500/20 px-3 py-1.5 rounded-lg whitespace-nowrap">
                            ✅ Detected
                          </span>
                        )}
                      </div>
                    <p className="text-xs text-gray-400 italic">
                      {videoLanguage === 'auto' 
                        ? 'System will automatically detect the language from the video' 
                        : `Detected: ${languageOptions.find(l => l.code === videoLanguage)?.name || videoLanguage}`}
                    </p>
                  </div>

                  {/* Caption Translation Toggle */}
                  <div className="space-y-2 pt-2 border-t border-white/10">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                        Caption Translation
                      </label>
                      <button
                        onClick={() => setTranslateCaptions(!translateCaptions)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-900 ${
                          translateCaptions ? 'bg-purple-600' : 'bg-gray-600'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            translateCaptions ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                    
                    {/* Target Language Dropdown (shown when translation enabled) */}
                    {translateCaptions && (
                      <div className="space-y-2 pt-2">
                        <label className="text-xs font-medium text-gray-400">
                          Translate captions to:
                        </label>
                        <select
                          value={captionLanguage}
                          onChange={(e) => setCaptionLanguage(e.target.value)}
                          className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all hover:bg-white/15"
                        >
                          {languageOptions.filter(lang => lang.code !== 'auto').map((lang) => (
                            <option key={lang.code} value={lang.code} className="bg-gray-900">
                              {lang.flag} {lang.name}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-purple-400 italic flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                          </svg>
                          Captions will be translated to {languageOptions.find(l => l.code === captionLanguage)?.name}
                        </p>
                      </div>
                    )}
                    
                    {!translateCaptions && (
                      <p className="text-xs text-gray-400 italic">
                        Captions will be in the original video language
                      </p>
                    )}
                  </div>
                </div>
              )}
              
              {/* Video Preview - ONLY SHOW AFTER LOADING */}
              {showPreview && videoId && !isLoadingDuration && (
                <div className="mt-6 space-y-4">
                  {/* Video Info */}
                  {videoTitle && (
                    <div className="bg-blue-500/20 border border-blue-400/40 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <Youtube className="h-6 w-6 text-blue-300 mt-1 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-base text-white font-semibold line-clamp-2 mb-2">{videoTitle}</p>
                          <div className="flex items-center gap-4 text-sm text-gray-300">
                            <span className="font-medium">Duration: {formatTime(videoDurationSeconds)}</span>
                            <span className="text-gray-500">•</span>
                            <span className="font-medium">Language: {videoLanguage}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Video Player */}
                  <div className="relative aspect-video rounded-lg overflow-hidden bg-black border border-white/10">
                    <iframe
                      id="youtube-player-iframe"
                      src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1`}
                      title="YouTube video preview"
                      className="absolute inset-0 w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Preferred Clip Length - ONLY SHOW AFTER URL IS PASTED AND LOADED */}
          {showPreview && videoId && !isLoadingDuration && (
          <Card className="mb-8 bg-white/5 backdrop-blur-lg border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Sparkles className="h-6 w-6 text-purple-500" />
                Preferred Clip Length
              </CardTitle>
              <CardDescription className="text-gray-300">
                Choose the length range for generated viral clips
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4">
                <button
                  onClick={() => {
                    setMinClipLength(0);
                    setMaxClipLength(30);
                    setTargetClipLength(15);
                  }}
                  className={`p-4 rounded-lg border-2 text-center transition-all hover:scale-105 ${
                    maxClipLength === 30 && minClipLength === 0
                      ? 'border-purple-500 bg-purple-500/30 shadow-lg shadow-purple-500/40'
                      : 'border-white/20 bg-white/5 hover:border-purple-400/50'
                  }`}
                >
                  <div className="font-bold text-lg text-white">&lt; 30s</div>
                  <div className="text-xs text-gray-400 mt-1">Short clips</div>
                </button>
                <button
                  onClick={() => {
                    setMinClipLength(30);
                    setMaxClipLength(60);
                    setTargetClipLength(45);
                  }}
                  className={`p-4 rounded-lg border-2 text-center transition-all hover:scale-105 ${
                    minClipLength === 30 && maxClipLength === 60
                      ? 'border-purple-500 bg-purple-500/30 shadow-lg shadow-purple-500/40'
                      : 'border-white/20 bg-white/5 hover:border-purple-400/50'
                  }`}
                >
                  <div className="font-bold text-lg text-white">30s-60s</div>
                  <div className="text-xs text-gray-400 mt-1">Standard</div>
                </button>
                <button
                  onClick={() => {
                    setMinClipLength(60);
                    setMaxClipLength(90);
                    setTargetClipLength(75);
                  }}
                  className={`p-4 rounded-lg border-2 text-center transition-all hover:scale-105 ${
                    minClipLength === 60 && maxClipLength === 90
                      ? 'border-purple-500 bg-purple-500/30 shadow-lg shadow-purple-500/40'
                      : 'border-white/20 bg-white/5 hover:border-purple-400/50'
                  }`}
                >
                  <div className="font-bold text-lg text-white">60s-90s</div>
                  <div className="text-xs text-gray-400 mt-1">Long clips</div>
                </button>
                <button
                  onClick={() => {
                    setMinClipLength(0);
                    setMaxClipLength(999);
                    setTargetClipLength(60);
                  }}
                  className={`p-4 rounded-lg border-2 text-center transition-all hover:scale-105 ${
                    maxClipLength === 999
                      ? 'border-purple-500 bg-purple-500/30 shadow-lg shadow-purple-500/40'
                      : 'border-white/20 bg-white/5 hover:border-purple-400/50'
                  }`}
                >
                  <div className="font-bold text-lg text-white">Original</div>
                  <div className="text-xs text-gray-400 mt-1">Full length</div>
                </button>
              </div>
              <div className="mt-3 text-xs text-gray-400 bg-white/5 p-2 rounded">
                💡 Clips will be generated between {minClipLength}s and {maxClipLength}s, targeting {targetClipLength}s
              </div>
            </CardContent>
          </Card>
          )}

          {/* Processing Timeframe - ONLY SHOW AFTER LOADING */}
          {showPreview && videoId && !isLoadingDuration && (
            <Card className="mb-8 bg-white/5 backdrop-blur-lg border-white/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Clock className="h-6 w-6 text-cyan-500" />
                  Processing Timeframe
                </CardTitle>
                <CardDescription className="text-gray-300">
                  Select which portion of the video to analyze
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingDuration ? (
                  <div className="flex items-center justify-center py-8 text-gray-300">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500 mr-3"></div>
                    <span>Fetching video duration...</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Slider with time badges on both sides */}
                    <div className="flex items-center gap-3">
                    {/* Start Time Badge */}
                    <div className="bg-blue-500/30 border-2 border-blue-400/50 px-4 py-2 rounded-lg shadow-lg">
                      <span className="text-white font-mono font-bold text-sm">{formatTime(timeframeStart)}</span>
                    </div>
                    
                    {/* Slider */}
                    <div className="flex-1 px-2">
                      <Slider
                        value={[timeframeStart, timeframeEnd]}
                        onValueChange={([start, end]) => {
                          // Determine which handle moved
                          const startChanged = start !== timeframeStart;
                          const endChanged = end !== timeframeEnd;
                          
                          setTimeframeStart(start);
                          setTimeframeEnd(end);
                          setUseTimeframe(start !== 0 || end !== videoDurationSeconds);
                          
                          // Seek YouTube player to the changed position for preview
                          if (youtubePlayer && youtubePlayer.seekTo) {
                            try {
                              // If end handle moved, seek to end position
                              // Otherwise seek to start position
                              const seekPosition = endChanged ? end : start;
                              youtubePlayer.seekTo(seekPosition, true);
                            } catch (error) {
                              console.error('Error seeking video:', error);
                            }
                          }
                        }}
                        min={0}
                        max={videoDurationSeconds}
                        step={1}
                        className="w-full"
                      />
                    </div>
                    
                    {/* End Time Badge */}
                    <div className="bg-blue-500/30 border-2 border-blue-400/50 px-4 py-2 rounded-lg shadow-lg">
                      <span className="text-white font-mono font-bold text-sm">{formatTime(timeframeEnd)}</span>
                    </div>
                  </div>
                  
                  {/* Optional: Show selected duration */}
                  <div className="text-center text-xs text-gray-400">
                    Selected duration: {formatTime(timeframeEnd - timeframeStart)}
                  </div>
                </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Layout Selection - ONLY SHOW AFTER URL IS PASTED AND LOADED */}
          {showPreview && videoId && !isLoadingDuration && (
          <Card className="mb-8 bg-white/5 backdrop-blur-lg border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Layout className="h-6 w-6 text-green-400" />
                Video Layout
              </CardTitle>
              <CardDescription className="text-gray-300">
                Choose how your video should be formatted
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {layoutOptions.map((layout) => (
                  <button
                    key={layout.id}
                    onClick={() => setSelectedLayout(layout.id)}
                    className={`relative p-4 rounded-xl border-2 transition-all hover:scale-105 ${
                      selectedLayout === layout.id
                        ? 'border-purple-500 bg-purple-500/20 shadow-lg shadow-purple-500/30'
                        : 'border-white/20 bg-white/5 hover:border-purple-500/50'
                    }`}
                  >
                    {!layout.stable && (
                      <div className="absolute -top-2 -right-2">
                        <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs">
                          Beta
                        </Badge>
                      </div>
                    )}
                    {selectedLayout === layout.id && (
                      <div className="absolute -top-2 -left-2">
                        <CheckCircle className="h-5 w-5 text-green-400" />
                      </div>
                    )}
                    <div className="text-center">
                      <div className="text-2xl mb-2">{layout.icon}</div>
                      <div className="font-semibold text-white mb-1">{layout.name}</div>
                      <div className="text-xs text-gray-400">{layout.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
          )}

          {/* Template Selection - ONLY SHOW AFTER URL IS PASTED AND LOADED */}
          {showPreview && videoId && !isLoadingDuration && (
          <Card className="mb-8 bg-white/5 backdrop-blur-lg border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Palette className="h-6 w-6 text-yellow-400" />
                Caption Template
              </CardTitle>
              <CardDescription className="text-gray-300">
                Choose your caption style and animations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templateOptions.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => setSelectedTemplate(template.id)}
                    className={`relative p-6 rounded-xl border-2 transition-all hover:scale-105 text-left ${
                      selectedTemplate === template.id
                        ? 'border-purple-500 bg-purple-500/20 shadow-lg shadow-purple-500/30'
                        : 'border-white/20 bg-white/5 hover:border-purple-500/50'
                    }`}
                  >
                    {template.popular && (
                      <div className="absolute -top-2 -right-2">
                        <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs">
                          Popular
                        </Badge>
                      </div>
                    )}
                    {selectedTemplate === template.id && (
                      <div className="absolute -top-2 -left-2">
                        <CheckCircle className="h-5 w-5 text-green-400" />
                      </div>
                    )}
                    <div>
                      <div className="font-semibold text-white mb-2">{template.name}</div>
                      <div className="text-sm text-gray-400 mb-2">{template.desc}</div>
                      <Badge variant="outline" className="text-xs">
                        {template.category}
                      </Badge>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
          )}

          {/* Generate Button - ONLY SHOW AFTER URL IS PASTED AND LOADED */}
          {showPreview && videoId && !isLoadingDuration && (
          <div className="text-center mb-8">
            <Button
              onClick={handleGenerateClips}
              disabled={!youtubeUrl || processingState.status === 'processing'}
              size="lg"
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-8 py-4 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processingState.status === 'processing' ? (
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5 animate-spin" />
                  Generating Clips...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Generate Viral Clips
                </div>
              )}
            </Button>
          </div>
          )}

          {/* Results */}
          {clips.length > 0 && (
            <Card className="bg-white/5 backdrop-blur-lg border-white/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <CheckCircle className="h-6 w-6 text-green-400" />
                  Generated Clips ({clips.length})
                </CardTitle>
                <CardDescription className="text-gray-300">
                  Your viral clips are ready for download
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {clips.map((clip, index) => (
                    <div key={clip.filename} className="bg-white/5 rounded-xl p-4 border border-white/10">
                      <div className="aspect-video bg-black rounded-lg mb-4 relative overflow-hidden">
                        <video
                          src={clip.url}
                          className="w-full h-full object-cover"
                          controls
                          preload="metadata"
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                            Score: {clip.score.toFixed(1)}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {clip.duration}s
                          </Badge>
                        </div>
                        <div className="text-sm text-gray-400">
                          {clip.layout} • {clip.template}
                        </div>
                        <Button
                          asChild
                          size="sm"
                          className="w-full bg-green-600 hover:bg-green-700"
                        >
                          <a href={clip.url} download={clip.filename}>
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </a>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    </>
  );
};

export default ViralClipsPage;
