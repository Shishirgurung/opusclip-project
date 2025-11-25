import React from 'react';

// Brand Template Types
/** Supported aspect ratios for video content */
export type AspectRatio = '9:16' | '16:9' | '1:1' | '4:3' | '3:4' | '4:5';

/** Auto layout options for content positioning */
export type AutoLayoutOption = 'center' | 'left' | 'right' | 'top' | 'bottom' | 'fill' | 'fit' | 'split' | 'ScreenShare' | 'Gameplay' | 'Three' | 'Four';

/** Available animation styles for Opus Clip captions */
export type AnimationStyle = 'bounce' | 'pop' | 'scale' | 'underline' | 'slide-left' | 'slide-up' | 'box' | 'fade' | 'flash' | 'shake' | 'none' | 'karaoke';

/** Font case transformation options */
export type FontCase = 'normal' | 'uppercase' | 'lowercase' | 'capitalize';

/** Caption positioning options */
export type CaptionPosition = 'top' | 'middle' | 'bottom';

/** Asset types supported in brand templates */
export type AssetType = 'logo' | 'cta' | 'background' | 'intro' | 'outro' | 'overlay';

export type LogoAsset = {
  url: string;
  type: 'logo';
  position: { x: number; y: number };
  size: { width: number; height: number };
  opacity: number;
};

export type CtaAsset = {
  url: string;
  type: 'cta';
  position: { x: number; y: number };
  size: { width: number; height: number };
  opacity: number;
};

export type BackgroundAsset = {
  url: string;
  type: 'background';
  opacity: number;
  loop?: boolean;
};

export type IntroAsset = {
  url: string;
  type: 'intro';
  duration: number;
};

export type OutroAsset = {
  url: string;
  type: 'outro';
  duration: number;
};

export type OverlayAsset = {
  url: string;
  type: 'overlay';
  position: {
    x: number;
    y: number;
  };
  size: {
    width: number;
    height: number;
  };
  opacity: number;
};

export type Asset = LogoAsset | CtaAsset | BackgroundAsset | IntroAsset | OutroAsset | OverlayAsset;

/** Shadow configuration for text elements */
export interface ShadowSettings {
  /** Shadow color in hex or rgba format */
  shadowColor: string;
  /** Horizontal shadow offset in pixels */
  shadowX: number;
  /** Vertical shadow offset in pixels */
  shadowY: number;
  /** Shadow blur radius in pixels */
  shadowBlur: number;
}

/** Font configuration with optional shadow properties */
export interface FontSettings {
  /** Font family name */
  family: string;
  /** Font size in pixels */
  size: number;
  /** Text color in hex or rgba format */
  color: string;
  /** Text case transformation */
  case: FontCase;
  /** Optional shadow color */
  shadowColor?: string;
  /** Optional horizontal shadow offset */
  shadowX?: number;
  /** Optional vertical shadow offset */
  shadowY?: number;
  /** Optional shadow blur radius */
  shadowBlur?: number;
}

export interface CaptionSettings {
  animationStyle: AnimationStyle;
  font: FontSettings;
  position: CaptionPosition;
  syncMode: 'word' | 'line';
  highlightWords: string[];
  autoHighlight: boolean;
}

export interface OverlaySettings {
  url: string;
  position: {
    x: number;
    y: number;
  };
  size: {
    width: number;
    height: number;
  };
  opacity: number;
}

export interface IntroOutroSettings {
  url: string;
  duration: number;
}

export interface BrandTemplate {
  id: string;
  name: string;
  description?: string;
  aspectRatio: AspectRatio;
  autoLayout: AutoLayoutOption;
  cropAspectRatio?: AspectRatio;
  captionSettings: CaptionSettings;
  overlaySettings: OverlaySettings;
  introOutroSettings: IntroOutroSettings;
  aiEmojis: boolean;
  autoTransitions: boolean;
  defaultLines: number;
  createdAt: string;
  updatedAt: string;
  assets: {
    logo?: LogoAsset;
    cta?: CtaAsset;
    background?: BackgroundAsset;
    intro?: IntroAsset;
    outro?: OutroAsset;
    overlay?: OverlayAsset;
  };
  // Opus-specific properties
  keywordHighlight?: KeywordHighlightSettings;
  fontSettings?: {
    family: string;
    size: number;
    color: string;
    shadowColor: string;
    shadowX: number;
    shadowY: number;
    shadowBlur: number;
  };
  positioning?: {
    default: CaptionPosition;
    allowOverride: boolean;
  };
}

/** Represents a single transcribed word with timing information */
export interface Word {
  word: string;
  start: number;
  end: number;
  confidence?: number;
}

/** Represents a segment of the transcription, containing multiple words */
export interface CaptionSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  words: Word[];
}

export interface TimelineClip {
  id: string;
  asset: {
    type: 'video' | 'audio' | 'image';
    src: string;
  };
  start: number;
  end: number;
  duration: number;
  title: string;
  startTime: number;
  endTime: number;
  videoUrl: string;
  caption?: string; // Keep for simple display
  captionSegments?: CaptionSegment[]; // Add for detailed animation
  captionSettings?: CaptionSettings;
  overlay?: {
    url: string;
    position: {
      x: number;
      y: number;
    };
    size: {
      width: number;
      height: number;
    };
    opacity: number;
  };
}

export type AspectRatioOption = {
  value: AspectRatio;
  label: string;
};

export interface ClipData {
  transcriptionResult?: {
    text: string;
    segments: CaptionSegment[];
  };
  id: string;
  previewUrl: string; // URL to the video clip file or a data URL for local preview
  summary: string;
  captionData: { text: string; style?: React.CSSProperties } | string; // Can be simple text or an object with styling
  sourceVideoUrl: string;
  startTime: number; // in seconds
  endTime: number; // in seconds
}

// Data Transformation Utility Types
/** Utility type for extracting caption text from ClipData.captionData */
export type ExtractCaptionText<T> = T extends string 
  ? T 
  : T extends { text: string; style?: React.CSSProperties } 
    ? T['text'] 
    : never;

/** Utility type for safe caption extraction from ClipData */
export type SafeCaptionExtraction = (captionData: ClipData['captionData']) => string | undefined;

/** Type-safe transformation function signature for converting ClipData to TimelineClip */
export type ClipDataTransformer = (clipData: ClipData) => TimelineClip;

/** Configuration options for clip data transformation */
export interface ClipTransformationConfig {
  /** Whether to include caption data in the transformation */
  includeCaptions?: boolean;
  /** Default caption settings to apply if none exist */
  defaultCaptionSettings?: CaptionSettings;
  /** Whether to preserve overlay settings from the original clip */
  preserveOverlay?: boolean;
  /** Custom URL transformation function */
  urlTransformer?: (previewUrl: string) => string;
}

/** Enhanced transformation function with configuration options */
export type ConfigurableClipDataTransformer = (
  clipData: ClipData, 
  config?: ClipTransformationConfig
) => TimelineClip;

/** Utility function type for extracting caption text from mixed caption data */
export type CaptionExtractor = (
  captionData: { text: string; style?: React.CSSProperties } | string
) => string | undefined;

/** Batch transformation function type for processing multiple clips */
export type BatchClipDataTransformer = (
  clipDataArray: ClipData[], 
  config?: ClipTransformationConfig
) => TimelineClip[];

export interface VideoProcessRequest {
  videoUrl: string;
  template: BrandTemplate;
}

export interface VideoProcessResponse {
  message?: string;
  clips?: ClipData[];
  error?: string;
  details?: string;
  fallbackWarning?: string;
  deprecationNotice?: string;
}

export interface VideoProcessRequestOpus {
  videoUrl: string;
  clipDuration: number;
  template: BrandTemplate;
  outputFormat: string;
  session: string;
  originalFilename: string;
  userId: string;
  layout?: string;
  generateCaptions?: boolean;
  // Timeframe parameters for processing specific video sections
  useTimeframe?: boolean;
  timeframeStart?: number;  // Start time in seconds
  timeframeEnd?: number;    // End time in seconds
  // Clip length preferences
  minClipLength?: number;   // Minimum clip length in seconds
  maxClipLength?: number;   // Maximum clip length in seconds
  targetClipLength?: number; // Target/preferred clip length in seconds
}

export interface ClipMetadata {
  id: string;
  previewUrl: string | null;
  summary: string;
  captionData: string | null;
  sourceVideoUrl: string;
  startTime: number;
  endTime: number;
  originalFilename: string;
  error: string | null;
  traceback: string | null;
  templateId: string;
  aspectRatio: AspectRatio;
  duration: number;
  resultUrl?: string;
}

export interface PrebuiltAudioItem {
  id: string;
  name: string;
  src: string;
  type: 'audio';
}

// Processing Types
/** Status of general processing tasks */
export type ProcessingTaskStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

/** Detailed status tracking for Opus Clip processing pipeline */
export type OpusProcessingStatus = 'initializing' | 'transcribing' | 'analyzing' | 'generating' | 'rendering' | 'finalizing' | 'completed' | 'failed';

export interface ProcessingTask {
  id: string;
  status: ProcessingTaskStatus;
  progress: number;
  video: File;
  template: BrandTemplate;
  clip: TimelineClip;
  createdAt: Date;
  updatedAt: Date;
  error?: string;
  videoUrl?: string;
  previewUrl?: string;
  resultUrl?: string;
}

// Template Management Types
export interface TemplateStorage {
  saveTemplate(template: BrandTemplate): Promise<string>;
  loadTemplate(id: string): Promise<BrandTemplate | null>;
  deleteTemplate(id: string): Promise<boolean>;
  listTemplates(): Promise<BrandTemplate[]>;
  validateTemplate(template: BrandTemplate): boolean;
}

// File Upload Types
export interface FileUploadConfig {
  maxSize: number;
  allowedTypes: string[];
  onUpload: (file: File) => Promise<string>;
  onError: (error: string) => void;
  onProgress: (progress: number) => void;
}

// Editor Context Types
export interface EditorState {
  currentTemplate: BrandTemplate | null;
  aspectRatio: AspectRatio;
  isProcessing: boolean;
  processingQueue: ClipMetadata[];
  selectedClip: ClipMetadata | null;
}

export interface EditorActions {
  applyTemplate: (template: BrandTemplate) => void;
  updateAspectRatio: (ratio: AspectRatio) => void;
  startProcessing: () => void;
  stopProcessing: () => void;
  updateProcessingQueue: (queue: ClipMetadata[]) => void;
  selectClip: (clip: ClipMetadata) => void;
}

// Opus Clip specific types
/** Keyword highlighting configuration for Opus templates */
export interface KeywordHighlightSettings {
  /** Primary highlight color in hex or rgba format */
  primaryColor: string;
  /** Secondary highlight color in hex or rgba format */
  secondaryColor: string;
  /** Whether keyword highlighting is enabled */
  enabled: boolean;
}

/** Word-level timestamp data from speech recognition */
export interface WordTimestamp {
  /** The recognized word */
  word: string;
  /** Start time in seconds */
  start: number;
  /** End time in seconds */
  end: number;
  /** Optional confidence score (0-1) */
  confidence?: number;
}

/** Opus Clip template configuration */
export interface OpusTemplate {
  /** Unique template identifier */
  id: string;
  /** Template name (must match predefined Opus template names) */
  name: 'Karaoke' | 'Beasty' | 'Mozi' | 'Deep Driver' | 'Popline';
  /** Template description */
  description: string;
  /** Synchronization mode for captions */
  syncMode: 'word' | 'line';
  /** Default number of caption lines */
  defaultLines: number;
  /** Default animation style */
  defaultAnimation: AnimationStyle;
  /** Keyword highlighting settings */
  keywordHighlight: KeywordHighlightSettings;
  /** Font configuration */
  fontSettings: {
    family: string;
    size: number;
    color: string;
    shadowColor: string;
    shadowX: number;
    shadowY: number;
    shadowBlur: number;
  };
  /** Caption positioning configuration */
  positioning: {
    default: CaptionPosition;
    allowOverride: boolean;
  };
  /** Template creation timestamp */
  createdAt: string;
  /** Template last update timestamp */
  updatedAt: string;
}

// Animation Configuration Types
/** Configuration for individual animations */
export interface AnimationConfig {
  /** Animation style name */
  name: AnimationStyle;
  /** Animation duration in seconds */
  duration: number;
  /** Delay before animation starts in seconds */
  delay: number;
  /** CSS easing function or GSAP ease */
  easing: string;
  /** Animation intensity multiplier (0-2) */
  intensity: number;
  /** Optional stagger delay between elements */
  stagger?: number;
}

/** Configuration for chained animations */
export interface AnimationChain {
  /** Array of animations to execute in sequence */
  animations: Array<{
    style: AnimationStyle;
    config?: Partial<AnimationConfig>;
    delay?: number;
  }>;
  /** Whether to loop the animation chain */
  loop?: boolean;
  /** Callback function when chain completes */
  onComplete?: () => void;
}

// Template Validation Types
/** Result of template validation */
export interface TemplateValidationResult {
  /** Whether the template is valid */
  isValid: boolean;
  /** Array of validation errors */
  errors: string[];
  /** Array of validation warnings */
  warnings: string[];
}

/** Result of animation compatibility validation */
export interface AnimationValidationResult {
  /** Whether animations are valid for the template */
  isValid: boolean;
  /** List of supported animation styles */
  supportedAnimations: AnimationStyle[];
  /** List of recommended animation styles */
  recommendedAnimations: AnimationStyle[];
}

// Enhanced API Request/Response Types
/** Extended video process request for Opus Clip functionality */
export interface OpusVideoProcessRequest extends VideoProcessRequest {
  /** Flag to enable Opus processing mode */
  opusMode: true;
  /** Selected animation style */
  selectedAnimation?: AnimationStyle;
  /** Animation configuration */
  animationConfig?: Partial<AnimationConfig>;
  /** Keyword highlighting settings */
  keywordHighlight?: KeywordHighlightSettings;
  /** Custom keywords to highlight */
  customKeywords?: string[];
  /** Caption synchronization mode */
  syncMode?: 'word' | 'line';
  /** Maximum number of caption lines */
  maxLines?: number;
  /** Caption position */
  position?: CaptionPosition;
}

/** Extended video process response for Opus Clip functionality */
export interface OpusVideoProcessResponse extends VideoProcessResponse {
  /** Opus-specific processing data */
  opusData?: {
    /** Template ID that was used */
    templateUsed: string;
    /** Animation style that was applied */
    animationApplied: AnimationStyle;
    /** Keywords that were highlighted */
    keywordsHighlighted: string[];
    /** Synchronization mode used */
    syncMode: 'word' | 'line';
    /** Word-level timestamps */
    wordTimestamps?: WordTimestamp[];
    /** Total processing time in seconds */
    processingTime: number;
  };
  /** Template validation result */
  validationResult?: TemplateValidationResult;
}

// Enhanced Processing Task for Opus
/** Extended processing task with Opus-specific data */
export interface OpusProcessingTask extends ProcessingTask {
  /** Opus template being used */
  opusTemplate?: OpusTemplate;
  /** Animation configuration */
  animationConfig?: AnimationConfig;
  /** Keyword highlighting settings */
  keywordHighlight?: KeywordHighlightSettings;
  /** Detailed Opus processing status */
  processingStatus?: OpusProcessingStatus;
  /** Word-level timestamps */
  wordTimestamps?: WordTimestamp[];
  /** Keywords that were highlighted */
  highlightedKeywords?: string[];
}

// Enhanced Clip Metadata for Opus
/** Extended clip metadata with Opus-specific data */
export interface OpusClipMetadata extends ClipMetadata {
  /** Opus-specific clip data */
  opusData?: {
    /** Template ID used for processing */
    templateId: string;
    /** Animation style applied */
    animationUsed: AnimationStyle;
    /** Keywords highlighted in the clip */
    keywordsHighlighted: string[];
    /** Synchronization mode used */
    syncMode: 'word' | 'line';
    /** Word-level timestamps */
    wordTimestamps?: WordTimestamp[];
    /** Font settings applied */
    fontSettings?: {
      family: string;
      size: number;
      color: string;
      shadowColor: string;
      shadowX: number;
      shadowY: number;
      shadowBlur: number;
    };
    /** Positioning settings applied */
    positioning?: {
      default: CaptionPosition;
      allowOverride: boolean;
    };
  };
}

// Enhanced Editor State for Opus
/** Extended editor state with Opus Clip functionality */
export interface OpusEditorState extends EditorState {
  /** Currently selected Opus template */
  selectedOpusTemplate?: OpusTemplate;
  /** Currently selected animation style */
  selectedAnimation?: AnimationStyle;
  /** Animation configuration */
  animationConfig?: AnimationConfig;
  /** Keyword highlighting settings */
  keywordHighlight?: KeywordHighlightSettings;
  /** Custom keywords for highlighting */
  customKeywords?: string[];
  /** Current Opus processing status */
  opusProcessingStatus?: OpusProcessingStatus;
  /** Word-level timestamps from processing */
  wordTimestamps?: WordTimestamp[];
}

// Enhanced Editor Actions for Opus
/** Extended editor actions with Opus Clip functionality */
export interface OpusEditorActions extends EditorActions {
  /** Select an Opus template */
  selectOpusTemplate: (template: OpusTemplate) => void;
  /** Select an animation style */
  selectAnimation: (animation: AnimationStyle) => void;
  /** Update animation configuration */
  updateAnimationConfig: (config: Partial<AnimationConfig>) => void;
  /** Update keyword highlighting settings */
  updateKeywordHighlight: (settings: KeywordHighlightSettings) => void;
  /** Add a custom keyword for highlighting */
  addCustomKeyword: (keyword: string) => void;
  /** Remove a custom keyword */
  removeCustomKeyword: (keyword: string) => void;
  /** Generate an Opus clip from video file */
  generateOpusClip: (videoFile: File, template: OpusTemplate) => Promise<void>;
  /** Validate an Opus template */
  validateOpusTemplate: (template: BrandTemplate) => TemplateValidationResult;
}

/** Base editor context type */
export type EditorContextType = {
  state: EditorState;
  actions: EditorActions;
};

/** Extended editor context type for Opus functionality */
export type OpusEditorContextType = {
  state: OpusEditorState;
  actions: OpusEditorActions;
};

// Job Management Types for Asynchronous Processing
/** Job status enumeration for tracking processing state */
export enum JobStatus {
  QUEUED = 'QUEUED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

/** Processing stage information for detailed progress tracking */
export interface ProcessingStage {
  /** Current stage name */
  name: string;
  /** Stage description */
  description: string;
  /** Stage completion percentage (0-100) */
  progress: number;
  /** Estimated time remaining in seconds */
  estimatedTimeRemaining?: number;
}

/** Core job interface for asynchronous video processing */
export interface Job {
  /** Unique job identifier */
  id: string;
  /** Current job status */
  status: JobStatus;
  /** Overall progress percentage (0-100) */
  progress: number;
  /** Current processing stage */
  stage: string;
  /** Status message or current operation description */
  message: string;
  /** Job creation timestamp */
  startTime: string;
  /** Job completion timestamp (null if not completed) */
  endTime: string | null;
  /** User ID who created the job */
  userId: string;
  /** Original video processing request data */
  requestData: VideoProcessRequestOpus;
  /** Processing result data (available when status is COMPLETED) */
  result: ClipMetadata[] | null;
  /** Error information (available when status is FAILED) */
  error: {
    /** Error message */
    message: string;
    /** Detailed error information */
    details?: string;
    /** Error stack trace */
    traceback?: string;
  } | null;
  /** Detailed processing stages */
  stages?: ProcessingStage[];
  /** Job metadata */
  metadata?: {
    /** Original filename */
    originalFilename: string;
    /** Video duration in seconds */
    videoDuration?: number;
    /** Estimated processing time in seconds */
    estimatedProcessingTime?: number;
    /** Actual processing time in seconds */
    actualProcessingTime?: number;
  };
}

/** Request interface for creating a new job */
export interface JobCreateRequest {
  /** Video processing request data */
  requestData: VideoProcessRequestOpus;
  /** Optional job priority (1-10, higher is more priority) */
  priority?: number;
  /** Optional job expiration time in hours */
  expirationHours?: number;
}

/** Response interface for job creation */
export interface JobCreateResponse {
  /** Created job ID */
  jobId: string;
  /** Job status (should be QUEUED) */
  status: JobStatus;
  /** Success message */
  message: string;
  /** Estimated processing time in seconds */
  estimatedProcessingTime?: number;
  /** Job creation timestamp */
  createdAt: string;
}

/** Response interface for job status queries */
export interface JobStatusResponse {
  /** Job information */
  job: Job;
  /** Whether the job is still active */
  isActive: boolean;
  /** Next recommended polling interval in milliseconds */
  nextPollInterval?: number;
}

/** Response interface for job polling with additional metadata */
export interface JobPollingResponse extends JobStatusResponse {
  /** Whether polling should continue */
  shouldContinuePolling: boolean;
  /** Recommended polling interval in milliseconds */
  pollInterval: number;
  /** Server timestamp for synchronization */
  serverTime: string;
  /** Queue position (if job is QUEUED) */
  queuePosition?: number;
  /** Estimated wait time in seconds (if job is QUEUED) */
  estimatedWaitTime?: number;
}

/** Job list response for user's jobs */
export interface JobListResponse {
  /** Array of user's jobs */
  jobs: Job[];
  /** Total number of jobs */
  total: number;
  /** Current page number */
  page: number;
  /** Number of jobs per page */
  limit: number;
  /** Whether there are more pages */
  hasMore: boolean;
}

/** Job statistics for dashboard display */
export interface JobStatistics {
  /** Total jobs created by user */
  totalJobs: number;
  /** Jobs currently in queue */
  queuedJobs: number;
  /** Jobs currently processing */
  processingJobs: number;
  /** Successfully completed jobs */
  completedJobs: number;
  /** Failed jobs */
  failedJobs: number;
  /** Average processing time in seconds */
  averageProcessingTime: number;
  /** Total processing time in seconds */
  totalProcessingTime: number;
}

/** Job error types for better error handling */
export enum JobErrorType {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  PROCESSING_ERROR = 'PROCESSING_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  RESOURCE_ERROR = 'RESOURCE_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

/** Enhanced job error interface */
export interface JobError {
  /** Error type */
  type: JobErrorType;
  /** Error message */
  message: string;
  /** Detailed error information */
  details?: string;
  /** Error code for programmatic handling */
  code?: string;
  /** Error stack trace */
  traceback?: string;
  /** Timestamp when error occurred */
  timestamp: string;
  /** Whether the job can be retried */
  retryable: boolean;
}

/** Job retry configuration */
export interface JobRetryConfig {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Delay between retries in seconds */
  retryDelay: number;
  /** Whether to use exponential backoff */
  exponentialBackoff: boolean;
  /** Maximum retry delay in seconds */
  maxRetryDelay: number;
}

/** Extended job interface with retry support */
export interface RetryableJob extends Job {
  /** Retry configuration */
  retryConfig?: JobRetryConfig;
  /** Current retry attempt */
  retryAttempt: number;
  /** Previous error attempts */
  previousErrors?: JobError[];
  /** Whether the job can be retried */
  canRetry: boolean;
}

/** Job queue information */
export interface JobQueueInfo {
  /** Current queue length */
  queueLength: number;
  /** Average processing time in seconds */
  averageProcessingTime: number;
  /** Estimated wait time for new jobs in seconds */
  estimatedWaitTime: number;
  /** Number of active workers */
  activeWorkers: number;
  /** Queue health status */
  healthStatus: 'healthy' | 'degraded' | 'unhealthy';
}
