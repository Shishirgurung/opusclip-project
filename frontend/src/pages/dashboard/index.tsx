import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import VideoInputForm from '@/components/dashboard/VideoInputForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  ClipData, 
  VideoProcessRequestOpus, 
  BrandTemplate,
  OpusProcessingStatus,
  TimelineClip 
} from '@/types';
import { validateOpusTemplate } from '@/lib/opus-templates';
import { 
  Video, 
  Sparkles, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Download,
  RefreshCw,
  AlertTriangle,
  Zap,
  Target,
  Palette,
  Youtube,
  Layout
} from 'lucide-react';

const ClipList = dynamic(() => import('@/components/dashboard/ClipList').then(mod => mod.ClipList), { ssr: false });

interface ProcessingState {
  status: 'idle' | 'processing' | 'completed' | 'error';
  progress: number;
  stage: string;
  message: string;
  startTime?: number;
}

// Data transformation function to convert ClipData to TimelineClip
const transformClipDataToTimelineClip = (clipData: ClipData): TimelineClip => {
  const captionText = clipData.transcriptionResult?.text || '';

  return {
    id: clipData.id,
    asset: {
      type: 'video',
      src: clipData.previewUrl,
    },
    start: 0,
    end: clipData.endTime - clipData.startTime,
    duration: clipData.endTime - clipData.startTime,
    title: `Clip ${clipData.id}`,
    startTime: clipData.startTime,
    endTime: clipData.endTime,
    videoUrl: clipData.previewUrl,
    caption: captionText,
    captionSegments: clipData.transcriptionResult?.segments || [],
    captionSettings: undefined, // This can be populated later if needed
    overlay: undefined
  };
};

const DashboardPage: React.FC = () => {
  const [clips, setClips] = useState<TimelineClip[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [processingState, setProcessingState] = useState<ProcessingState>({
    status: 'idle',
    progress: 0,
    stage: '',
    message: ''
  });
  const [brandTemplate, setBrandTemplate] = useState<BrandTemplate | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  
  // Progressive reveal state
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [showFeatures, setShowFeatures] = useState(false);
  const [videoAnalyzed, setVideoAnalyzed] = useState(false);
  const [videoInfo, setVideoInfo] = useState<any>(null);
  
  // Form selections
  const [selectedDuration, setSelectedDuration] = useState<number>(30);
  const [selectedLayout, setSelectedLayout] = useState<string>('auto');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('OpusClipStyle');

  // Make the fetchClips function reusable
  const fetchClips = async () => {
    console.log('--- Starting fetchClips ---');
    setIsLoading(true);
    try {
      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL}/api/clips`;
      console.log('Fetching clips from:', apiUrl);

      const response = await fetch(apiUrl);
      console.log('API response status:', response.status);

      if (!response.ok) {
        throw new Error(`Failed to fetch clips. Status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Received data from API:', data);

      const fetchedClips: TimelineClip[] = data.clips.map((clip: any) => ({
        id: clip.filename,
        asset: { type: 'video', src: `${process.env.NEXT_PUBLIC_API_URL}${clip.url}` },
        start: 0,
        end: 30, // Placeholder duration
        duration: 30, // Placeholder duration
        title: clip.filename,
        videoUrl: `${process.env.NEXT_PUBLIC_API_URL}${clip.url}`,
      }));
      
      console.log('Transformed clips for state:', fetchedClips);
      setClips(fetchedClips);
      console.log('--- fetchClips finished successfully ---');

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      console.error('--- Error in fetchClips ---', errorMessage);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClips();
  }, []);

  // Handle clip changes
  const handleClipChange = (newClip: TimelineClip) => {
    setClips(prevClips => prevClips.map(clip => clip.id === newClip.id ? newClip : clip));
  };

  // Clear messages after timeout
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 10000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Validate Opus template data
  const validateOpusData = (data: VideoProcessRequestOpus): string[] => {
    const errors: string[] = [];
    
    if (!data.template) {
      errors.push('Template is required');
      return errors;
    }

    if (!validateOpusTemplate(data.template)) {
      errors.push('Invalid template configuration');
    }

    if (!data.videoUrl || !data.videoUrl.match(/^https?:\/\/.+/)) {
      errors.push('Valid video URL is required');
    }

    if (data.clipDuration < 5 || data.clipDuration > 300) {
      errors.push('Clip duration must be between 5 and 300 seconds');
    }

    // Validate template-specific requirements
    const captionSettings = data.template.captionSettings;
    if (captionSettings) {
      if (!captionSettings.font?.family) {
        errors.push('Font family is required');
      }
      
      if (!captionSettings.font?.size || captionSettings.font.size < 12 || captionSettings.font.size > 120) {
        errors.push('Font size must be between 12 and 120');
      }
      
      if (!captionSettings.animationStyle) {
        errors.push('Animation style is required');
      }
    }

    return errors;
  };

  // Job polling logic for real-time progress updates
  const pollJobStatus = (jobId: string) => {
    let polling = true;
    const pollInterval = 2000; // 2 seconds

    const poll = async () => {
      if (!polling) return;

      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/jobs/${jobId}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch job status: ${response.status}`);
        }

        const result = await response.json();
        const job = result.job;

        // Update processing state with real data from job
        setProcessingState(prev => ({
          ...prev,
          progress: job.progress || 0,
          stage: job.stage || 'Processing',
          message: job.message || 'Processing your video...',
          status: job.status === 'COMPLETED' ? 'completed' : 
                  job.status === 'FAILED' ? 'error' : 'processing'
        }));

        // Handle job completion
        if (job.status === 'COMPLETED') {
          polling = false;

          // Reset the processing state to idle to hide the progress UI
          setProcessingState({
            status: 'idle',
            progress: 0,
            stage: '',
            message: ''
          });

          setSuccessMessage(
            `Successfully generated ${job.result?.length || 1} clip${job.result?.length !== 1 ? 's' : ''}!`
          );
          
          // Fetch the updated list of clips from the server
          fetchClips();
          
          setIsLoading(false);
          fetchClips(); // Refresh the clips list
        
          return;
        }

        // Handle job failure
        if (job.status === 'FAILED') {
          polling = false;
          
          const errorMessage = job.error?.message || 'Failed to process video';
          setError(errorMessage);
          setProcessingState(prev => ({
            ...prev,
            status: 'error',
            message: errorMessage
          }));
          setIsLoading(false);
          setClips([]);
          return;
        }

        // Continue polling if job is still processing or queued
        if (job.status === 'PROCESSING' || job.status === 'QUEUED') {
          setTimeout(poll, pollInterval);
        }

      } catch (err: any) {
        console.error('Error polling job status:', err);
        
        // Retry polling on network errors, but stop on persistent failures
        if (polling) {
          setTimeout(poll, pollInterval * 2); // Longer delay on error
        }
      }
    };

    // Start polling
    poll();

    // Return cleanup function
    return () => {
      polling = false;
    };
  };

  const handleFormSubmit = async (data: VideoProcessRequestOpus & { layout: string }) => {
    // Validate Opus-specific data
    const errors = validateOpusData(data);
    setValidationErrors(errors);
    
    if (errors.length > 0) {
      setError('Please fix the validation errors before submitting');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);
    setClips([]); // Clear previous clips
    setBrandTemplate(data.template);
    
    // Initialize processing state
    setProcessingState({
      status: 'processing',
      progress: 0,
      stage: 'Starting',
      message: 'Initializing Opus Clip generation...',
      startTime: Date.now()
    });

    console.log('Submitting Opus Clip request:', data);

    try {
      // Step 1: Create a job for asynchronous processing
      const jobResponse = await fetch('/api/jobs/trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!jobResponse.ok) {
        const errorData = await jobResponse.json();
        throw new Error(errorData.error || `Job creation failed: ${jobResponse.status}`);
      }

      const jobResult = await jobResponse.json();
      console.log('Job created:', jobResult);
      
      // Step 2: Start polling for job status
      const cleanup = pollJobStatus(jobResult.jobId);
      
      // Store cleanup function for potential cancellation
      // Note: In a real implementation, you might want to store this in a ref
      // to allow users to cancel the job

    } catch (err: any) {
      console.error('Error submitting Opus request:', err);
      
      setProcessingState({
        status: 'error',
        progress: 0,
        stage: 'Error',
        message: err.message || 'Failed to create processing job'
      });
      
      setError(err.message || 'Failed to create processing job. Please try again.');
      setClips([]); // Clear clips on error
      setIsLoading(false);
    }
  };

  const handleRetry = () => {
    setError(null);
    setProcessingState({
      status: 'idle',
      progress: 0,
      stage: '',
      message: ''
    });
    setValidationErrors([]);
  };

  const getProcessingIcon = () => {
    switch (processingState.status) {
      case 'processing':
        return <RefreshCw className="h-5 w-5 animate-spin text-blue-500" />;
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  const getElapsedTime = () => {
    if (!processingState.startTime) return '';
    const elapsed = Math.floor((Date.now() - processingState.startTime) / 1000);
    return `${elapsed}s`;
  };

  // YouTube URL validation
  const isValidYouTubeUrl = (url: string) => {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
    return youtubeRegex.test(url);
  };

  // Handle YouTube URL analysis
  const handleAnalyzeVideo = async () => {
    if (!isValidYouTubeUrl(youtubeUrl)) {
      setError('Please enter a valid YouTube URL');
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      // Simulate video analysis - in real implementation, call backend API
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Extract video ID for thumbnail
      const videoId = extractVideoId(youtubeUrl);
      
      setVideoInfo({
        title: 'Sample Video Title - How to Create Viral Content',
        duration: 180, // 3 minutes
        thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
      });
      
      setVideoAnalyzed(true);
      setShowFeatures(true);
      setSuccessMessage('Video analyzed successfully! Configure your clip settings below.');
    } catch (err) {
      setError('Failed to analyze video. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Extract YouTube video ID from URL
  const extractVideoId = (url: string) => {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : 'dQw4w9WgXcQ'; // fallback to Rick Roll ID
  };

  // Generate clips with automatic trimming logic
  const handleGenerateClips = async () => {
    if (!videoAnalyzed || !youtubeUrl) {
      setError('Please analyze a video first');
      return;
    }

    setIsLoading(true);
    setError(null);
    setProcessingState({
      status: 'processing',
      progress: 0,
      stage: 'Downloading video...',
      message: 'Starting clip generation process',
      startTime: Date.now()
    });

    try {
      // Call the actual backend API for clip generation
      const formData = new FormData();
      formData.append('job_id', `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
      formData.append('youtube_url', youtubeUrl);
      formData.append('opus_template', JSON.stringify({
        name: selectedTemplate,
        displayName: selectedTemplate,
        description: '',
        category: 'General',
        wordsPerLine: 3,
        positions: ['bottom_center'],
        animationStyle: 'bounce',
        syncMode: 'word',
        fontFamily: 'Arial',
        fontSize: 48,
        fontColor: '#FFFFFF',
        shadowColor: '#000000',
        shadowX: 2,
        shadowY: 2,
        shadowBlur: 3,
        position: 'bottom',
        keywordHighlight: {
          primaryColor: '#04f827FF',
          secondaryColor: '#FFFDO3FF',
          enabled: true
        }
      }));
      formData.append('clip_duration', selectedDuration.toString());
      formData.append('layout', selectedLayout);

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/transcribe_opus`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.job_id) {
        // Start polling for job status
        await pollJobStatus(result.job_id);
      } else {
        throw new Error('No job ID returned from server');
      }
      
    } catch (err) {
      console.error('Error generating clips:', err);
      setError('Failed to generate clips. Please try again.');
      setProcessingState({
        status: 'error',
        progress: 0,
        stage: 'Error',
        message: 'Clip generation failed'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Opus Clip Generator - Create Viral Video Clips</title>
        <meta name="description" content="Generate viral-style video clips with professional Opus templates, AI captions, and dynamic animations" />
        <meta name="keywords" content="opus clip, viral videos, ai captions, video editing, social media clips" />
      </Head>
      
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        {/* Hero Section */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-pink-500/10"></div>
          <div className="relative px-6 py-12 text-center">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center justify-center gap-3 mb-6">
                <div className="p-4 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl shadow-lg">
                  <Sparkles className="h-10 w-10 text-white" />
                </div>
                <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
                  Opus Clip Studio
                </h1>
              </div>
              <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
                Transform any YouTube video into viral clips with AI-powered captions and professional templates
              </p>
            </div>
          </div>
        </div>

        <main className="max-w-6xl mx-auto px-6 pb-12">
          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <Alert className="mb-6 border-red-200 bg-red-50 dark:bg-red-950">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="font-medium mb-2">Please fix the following issues:</div>
                <ul className="list-disc list-inside space-y-1">
                  {validationErrors.map((error, index) => (
                    <li key={index} className="text-sm">{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

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
                <div className="flex items-center justify-between">
                  <span>{error}</span>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleRetry}
                    className="ml-4"
                  >
                    Retry
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* YouTube URL Input - Always Visible */}
          <div className="mb-8">
            <div className="bg-white/5 backdrop-blur-lg rounded-3xl p-8 border border-white/10 shadow-2xl">
              <div className="text-center mb-6">
                <Youtube className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-white mb-2">Start with your YouTube video</h2>
                <p className="text-gray-400">Paste any YouTube URL to begin creating viral clips</p>
              </div>
              
              <div className="max-w-2xl mx-auto">
                <div className="relative">
                  <input
                    type="url"
                    value={youtubeUrl}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="w-full px-6 py-4 bg-white/10 border border-white/20 rounded-2xl text-white placeholder-gray-400 text-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAnalyzeVideo()}
                  />
                  <Button 
                    onClick={handleAnalyzeVideo}
                    disabled={!youtubeUrl || isLoading}
                    className="absolute right-2 top-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-6 py-2 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <div className="flex items-center gap-2">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Analyzing...
                      </div>
                    ) : (
                      'Analyze Video'
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Video Info Display - Show after analysis */}
          {videoAnalyzed && videoInfo && (
            <div className="mb-8 animate-in slide-in-from-bottom-4 duration-500">
              <div className="bg-white/5 backdrop-blur-lg rounded-3xl p-6 border border-white/10 shadow-2xl">
                <div className="flex items-center gap-4 mb-6">
                  <img 
                    src={videoInfo.thumbnail} 
                    alt="Video thumbnail"
                    className="w-24 h-14 rounded-lg object-cover"
                  />
                  <div>
                    <h3 className="text-lg font-semibold text-white">{videoInfo.title}</h3>
                    <p className="text-gray-400">Duration: {Math.floor(videoInfo.duration / 60)}:{(videoInfo.duration % 60).toString().padStart(2, '0')}</p>
                  </div>
                  <div className="ml-auto">
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Analyzed
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Progressive Feature Reveal - Show after URL analysis */}
          {showFeatures && (
            <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-700">
              {/* Clip Duration Selection */}
              <div className="bg-white/5 backdrop-blur-lg rounded-3xl p-8 border border-white/10 shadow-2xl">
                <div className="flex items-center gap-3 mb-6">
                  <Clock className="h-6 w-6 text-blue-400" />
                  <h3 className="text-xl font-bold text-white">Choose Clip Length</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { duration: 30, label: '30 seconds', desc: 'Perfect for TikTok & Instagram Reels', popular: true },
                    { duration: 45, label: '45 seconds', desc: 'Ideal for YouTube Shorts', popular: false },
                    { duration: 60, label: '60 seconds', desc: 'Maximum engagement length', popular: true }
                  ].map((option) => (
                    <button
                      key={option.duration}
                      onClick={() => setSelectedDuration(option.duration)}
                      className={`relative p-6 rounded-2xl border-2 transition-all hover:scale-105 ${
                        selectedDuration === option.duration
                          ? 'border-purple-500 bg-purple-500/20 shadow-lg shadow-purple-500/30'
                          : option.popular 
                          ? 'border-purple-500/50 bg-purple-500/5 shadow-lg shadow-purple-500/10' 
                          : 'border-white/20 bg-white/5 hover:border-white/30'
                      }`}
                    >
                      {option.popular && (
                        <div className="absolute -top-2 -right-2">
                          <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs px-2 py-1">
                            Popular
                          </Badge>
                        </div>
                      )}
                      {selectedDuration === option.duration && (
                        <div className="absolute -top-2 -left-2">
                          <CheckCircle className="h-5 w-5 text-green-400" />
                        </div>
                      )}
                      <div className="text-center">
                        <div className="text-2xl font-bold text-white mb-2">{option.label}</div>
                        <div className="text-sm text-gray-400">{option.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Layout Options */}
              <div className="bg-white/5 backdrop-blur-lg rounded-3xl p-8 border border-white/10 shadow-2xl">
                <div className="flex items-center gap-3 mb-6">
                  <Layout className="h-6 w-6 text-green-400" />
                  <h3 className="text-xl font-bold text-white">Video Layout</h3>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { id: 'fit', name: 'Fit', icon: '📱', desc: 'Fit entire video within frame' },
                    { id: 'fill', name: 'Fill', icon: '🖼️', desc: 'Fill frame, may crop video' },
                    { id: 'square', name: 'Square', icon: '⬜', desc: 'Square format with blur background' },
                    { id: 'auto', name: 'Auto', icon: '🤖', desc: 'AI detects best content' }
                  ].map((layout) => (
                    <button
                      key={layout.id}
                      onClick={() => setSelectedLayout(layout.id)}
                      className={`p-6 rounded-2xl border-2 transition-all hover:scale-105 group ${
                        selectedLayout === layout.id
                          ? 'border-purple-500 bg-purple-500/20 shadow-lg shadow-purple-500/30'
                          : 'border-white/20 bg-white/5 hover:border-purple-500 hover:bg-purple-500/10'
                      }`}
                    >
                      {selectedLayout === layout.id && (
                        <div className="absolute -top-2 -left-2">
                          <CheckCircle className="h-5 w-5 text-green-400" />
                        </div>
                      )}
                      <div className="text-center">
                        <div className="text-3xl mb-3 group-hover:scale-110 transition-transform">{layout.icon}</div>
                        <div className="font-semibold text-white mb-1">{layout.name}</div>
                        <div className="text-xs text-gray-400">{layout.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Caption Templates */}
              <div className="bg-white/5 backdrop-blur-lg rounded-3xl p-8 border border-white/10 shadow-2xl">
                <div className="flex items-center gap-3 mb-6">
                  <Sparkles className="h-6 w-6 text-yellow-400" />
                  <h3 className="text-xl font-bold text-white">Choose Caption Style</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[
                    {
                      id: 'OpusClipStyle',
                      name: 'OpusClip Pro',
                      description: 'Commercial-grade animations',
                      style: 'bounce',
                      color: '#00FFFF',
                      font: 'Arial Black',
                      popular: true,
                      category: 'Professional'
                    },
                    {
                      id: 'SwipeUp',
                      name: 'SwipeUp',
                      description: 'Progressive fill with conditional animations',
                      style: 'swipe',
                      color: '#00FF00',
                      font: 'Arial Black',
                      popular: true,
                      category: 'Viral'
                    },
                    {
                      id: 'Karaoke',
                      name: 'Karaoke',
                      description: 'Instant highlighting with scaling effects',
                      style: 'karaoke',
                      color: '#00FF00',
                      font: 'Arial Black',
                      popular: true,
                      category: 'Classic'
                    },
                    {
                      id: 'BeastMode',
                      name: 'Beast Mode',
                      description: 'Complex multi-effect animations',
                      style: 'beast',
                      color: '#00FF00',
                      font: 'Impact',
                      popular: true,
                      category: 'Gaming'
                    },
                    {
                      id: 'TikTokViral',
                      name: 'TikTok Viral',
                      description: 'Bouncy animations with neon colors',
                      style: 'bounce',
                      color: '#FF00FF',
                      font: 'Bangers',
                      popular: true,
                      category: 'Social'
                    },
                    {
                      id: 'PodcastPro',
                      name: 'Podcast Pro',
                      description: 'Clean, professional podcast style',
                      style: 'speaker',
                      color: '#FFFFFF',
                      font: 'Open Sans',
                      popular: false,
                      category: 'Professional'
                    },
                    {
                      id: 'GamerRage',
                      name: 'Gamer Rage',
                      description: 'Explosive gaming reactions',
                      style: 'rage',
                      color: '#00FFFF',
                      font: 'Bebas Neue',
                      popular: false,
                      category: 'Gaming'
                    },
                    {
                      id: 'MinimalChic',
                      name: 'Minimal Chic',
                      description: 'Clean, modern aesthetic',
                      style: 'minimal',
                      color: '#FFFFFF',
                      font: 'Helvetica Neue',
                      popular: false,
                      category: 'Lifestyle'
                    },
                    {
                      id: 'RetroWave',
                      name: 'Retro Wave',
                      description: '80s synthwave aesthetic',
                      style: 'retro',
                      color: '#FF00FF',
                      font: 'Orbitron',
                      popular: false,
                      category: 'Retro'
                    },
                    {
                      id: 'NewsBreaking',
                      name: 'News Breaking',
                      description: 'Urgent news ticker style',
                      style: 'news',
                      color: '#FFFFFF',
                      font: 'Arial',
                      popular: false,
                      category: 'News'
                    },
                    {
                      id: 'ComedyGold',
                      name: 'Comedy Gold',
                      description: 'Playful comedy animations',
                      style: 'comedy',
                      color: '#00FFFF',
                      font: 'Comic Sans MS',
                      popular: false,
                      category: 'Comedy'
                    },
                    {
                      id: 'TechReview',
                      name: 'Tech Review',
                      description: 'Modern tech channel style',
                      style: 'tech',
                      color: '#00FFFF',
                      font: 'Roboto',
                      popular: false,
                      category: 'Tech'
                    },
                    {
                      id: 'Glitch',
                      name: 'Glitch',
                      description: 'Digital glitch effects',
                      style: 'glitch',
                      color: '#FFFFFF',
                      font: 'Impact',
                      popular: true,
                      category: 'Tech'
                    },
                    {
                      id: 'Cinematic',
                      name: 'Cinematic',
                      description: 'Movie-style captions',
                      style: 'cinematic',
                      color: '#FFFFFF',
                      font: 'Lato Bold',
                      popular: false,
                      category: 'Professional'
                    },
                    {
                      id: 'ComicPop',
                      name: 'Comic Pop',
                      description: 'Comic book style effects',
                      style: 'comic',
                      color: '#00FFFF',
                      font: 'Komika Axis',
                      popular: false,
                      category: 'Comedy'
                    },
                    {
                      id: 'NeonPulse',
                      name: 'Neon Pulse',
                      description: 'Pulsing neon effects',
                      style: 'neon',
                      color: '#808000',
                      font: 'Orbitron',
                      popular: true,
                      category: 'Tech'
                    },
                    {
                      id: 'NeonSign',
                      name: 'Neon Sign',
                      description: 'Neon sign style',
                      style: 'neon-sign',
                      color: '#FF00FF',
                      font: 'Vegas',
                      popular: false,
                      category: 'Retro'
                    },
                    {
                      id: 'TypeWriter',
                      name: 'TypeWriter',
                      description: 'Typewriter style',
                      style: 'typewriter',
                      color: '#FFFFFF',
                      font: 'Consolas',
                      popular: false,
                      category: 'Retro'
                    },
                    {
                      id: 'BubblePop',
                      name: 'Bubble Pop',
                      description: 'Floating bubble effects',
                      style: 'bubble',
                      color: '#E6E6FA',
                      font: 'Comfortaa',
                      popular: true,
                      category: 'Social'
                    },
                    {
                      id: 'BoldPop',
                      name: 'Bold Pop',
                      description: 'Bold text with pop animation',
                      style: 'bold-pop',
                      color: '#FFFFFF',
                      font: 'Poppins',
                      popular: false,
                      category: 'Social'
                    },
                    {
                      id: 'BounceBox',
                      name: 'Bounce Box',
                      description: 'Bouncing box captions',
                      style: 'bounce-box',
                      color: '#FFFFFF',
                      font: 'Montserrat',
                      popular: false,
                      category: 'Social'
                    },
                    {
                      id: 'HighlightSweep',
                      name: 'Highlight Sweep',
                      description: 'Marker highlighter effect',
                      style: 'highlight',
                      color: '#000000',
                      font: 'Inter',
                      popular: false,
                      category: 'Professional'
                    },
                    {
                      id: 'CodeFlow',
                      name: 'Code Flow',
                      description: 'Programming syntax highlighting',
                      style: 'code',
                      color: '#FFFFFF',
                      font: 'Consolas',
                      popular: false,
                      category: 'Tech'
                    },
                    {
                      id: 'RageMode',
                      name: 'Rage Mode',
                      description: 'Intense rage reactions',
                      style: 'rage',
                      color: '#FFFFFF',
                      font: 'Impact',
                      popular: true,
                      category: 'Gaming'
                    },
                    {
                      id: 'HypeTrain',
                      name: 'Hype Train',
                      description: 'High-energy momentum effects',
                      style: 'hype',
                      color: '#FFFFFF',
                      font: 'Arial Black',
                      popular: true,
                      category: 'Gaming'
                    },
                    {
                      id: 'GlitchStreamer',
                      name: 'Glitch Streamer',
                      description: 'RGB glitch streaming effects',
                      style: 'rgb-glitch',
                      color: '#FFFFFF',
                      font: 'Courier New',
                      popular: false,
                      category: 'Gaming'
                    }
                  ].map((template) => (
                    <div
                      key={template.id}
                      onClick={() => setSelectedTemplate(template.id)}
                      className={`relative p-6 rounded-2xl border-2 cursor-pointer transition-all hover:scale-105 group ${
                        selectedTemplate === template.id
                          ? 'border-purple-500 bg-purple-500/20 shadow-lg shadow-purple-500/30'
                          : template.popular 
                          ? 'border-purple-500/50 bg-purple-500/5 shadow-lg shadow-purple-500/10' 
                          : 'border-white/20 bg-white/5 hover:border-white/30'
                      }`}
                    >
                      {template.popular && (
                        <div className="absolute -top-2 -right-2">
                          <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs px-2 py-1">
                            Popular
                          </Badge>
                        </div>
                      )}
                      
                      {selectedTemplate === template.id && (
                        <div className="absolute -top-2 -left-2">
                          <CheckCircle className="h-5 w-5 text-green-400" />
                        </div>
                      )}
                      
                      <div className="text-center">
                        <div 
                          className="text-2xl font-bold mb-2 transition-all group-hover:scale-110"
                          style={{ 
                            color: template.color,
                            fontFamily: template.font === 'Custom' ? 'inherit' : template.font
                          }}
                        >
                          {template.name}
                        </div>
                        <div className="text-sm text-gray-400 mb-4">{template.description}</div>
                        
                        {/* Style Preview */}
                        <div className="bg-black/30 rounded-lg p-3 mb-3">
                          <div 
                            className={`text-sm font-medium transition-all ${
                              template.style === 'bounce' ? 'animate-bounce' :
                              template.style === 'pop' ? 'animate-pulse' :
                              template.style === 'scale' ? 'hover:scale-110' :
                              ''
                            }`}
                            style={{ 
                              color: template.color,
                              fontFamily: template.font === 'Custom' ? 'inherit' : template.font,
                              textDecoration: template.style === 'underline' ? 'underline' : 'none'
                            }}
                          >
                            Sample Text
                          </div>
                        </div>
                        
                        <div className="text-xs text-gray-500">
                          Font: {template.font} • Style: {template.style} • {template.category}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Generate Button */}
              <div className="text-center">
                <Button 
                  onClick={handleGenerateClips}
                  disabled={!videoAnalyzed || isLoading}
                  size="lg"
                  className="bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500 hover:from-purple-600 hover:via-pink-600 hover:to-purple-600 text-white px-12 py-4 rounded-2xl text-lg font-bold shadow-2xl shadow-purple-500/25 hover:shadow-purple-500/40 transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  <Sparkles className="h-5 w-5 mr-2" />
                  {isLoading ? 'Generating...' : 'Generate Viral Clips'}
                </Button>
                
                {videoAnalyzed && (
                  <div className="mt-4 text-sm text-gray-400">
                    Will create ~{Math.floor(videoInfo?.duration / selectedDuration)} clips of {selectedDuration}s each using {selectedTemplate} style
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Processing Status */}
          {processingState.status === 'processing' && (
            <Card className="mt-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {getProcessingIcon()}
                  Processing Status
                  {processingState.startTime && (
                    <Badge variant="outline" className="ml-auto">
                      {getElapsedTime()}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {selectedTemplate && (
                    <span>Using <strong>{selectedTemplate.name}</strong> template</span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{processingState.stage}</span>
                    <span className="text-gray-500">{processingState.progress}%</span>
                  </div>
                  <Progress value={processingState.progress} className="w-full" />
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {processingState.message}
                  </p>
                  
                  {processingState.status === 'processing' && (
                    <div className="text-xs text-gray-500 space-y-1">
                      <div>• Applying {selectedTemplate?.captionSettings?.animationStyle} animation</div>
                      <div>• Using {selectedTemplate?.captionSettings?.syncMode} synchronization</div>
                      <div>• Processing with {selectedTemplate?.name} template</div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Generated Clips */}
          {clips.length > 0 && (
            <section className="mt-10">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-semibold text-gray-200 mb-2">Generated Opus Clips</h2>
                  <p className="text-sm text-gray-400">
                    {clips.length} clip{clips.length !== 1 ? 's' : ''} generated
                    {selectedTemplate && ` using ${selectedTemplate.name} template`}
                  </p>
                </div>
                {clips.length > 0 && (
                  <Button variant="outline" className="flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    Download All
                  </Button>
                )}
              </div>
              <ClipList 
                clips={clips} 
                template={selectedTemplate || {} as BrandTemplate} 
                onClipChange={handleClipChange} 
              />
            </section>
          )}

          {/* Template Info */}
          {selectedTemplate && clips.length === 0 && !isLoading && (
            <Card className="mt-8 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
                  <Sparkles className="h-5 w-5" />
                  Ready to Generate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm text-blue-700 dark:text-blue-300">
                  <div><strong>Template:</strong> {selectedTemplate.name}</div>
                  <div><strong>Sync Mode:</strong> {selectedTemplate.captionSettings?.syncMode === 'word' ? 'Word-by-word' : 'Line-by-line'}</div>
                  <div><strong>Animation:</strong> {selectedTemplate.captionSettings?.animationStyle}</div>
                  <div><strong>Position:</strong> {selectedTemplate.captionSettings?.position}</div>
                  <div><strong>Max Lines:</strong> {selectedTemplate.defaultLines}</div>
                </div>
              </CardContent>
            </Card>
          )}
        </main>

        {/* Footer */}
        <footer className="mt-20 border-t border-gray-800 bg-gray-900/50">
          <div className="max-w-7xl mx-auto p-8 text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Sparkles className="h-5 w-5 text-blue-400" />
              <span className="text-lg font-semibold">Opus Clip Generator</span>
            </div>
            <p className="text-gray-500 text-sm">
              &copy; {new Date().getFullYear()} Opus Clip Generator. Create viral content with AI-powered templates.
            </p>
          </div>
        </footer>
      </div>
    </>
  );
};

export default DashboardPage;
