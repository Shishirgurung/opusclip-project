// Global type declarations for external libraries and window extensions

declare global {
  interface Window {
    gsap?: GSAP;
    // Additional global libraries that might be loaded via CDN
    jQuery?: any;
    $?: any;
    _?: any; // Lodash
    moment?: any;
    Chart?: any;
    dataLayer?: any[]; // Google Analytics
    gtag?: (...args: any[]) => void; // Google Analytics
    fbq?: (...args: any[]) => void; // Facebook Pixel
    // Add more as your project requires
  }
}

// GSAP Type Declarations
interface GSAP {
  timeline: (options?: TimelineOptions) => Timeline;
  set: (target: GSAPTarget, vars: GSAPVars) => GSAP;
  to: (target: GSAPTarget, vars: GSAPToVars) => Timeline;
  from: (target: GSAPTarget, vars: GSAPVars) => Timeline;
  fromTo: (target: GSAPTarget, fromVars: GSAPVars, toVars: GSAPToVars) => Timeline;
  registerPlugin: (...plugins: any[]) => void;
  config: (config: any) => void;
  globalTimeline: Timeline;
  ticker: {
    add: (callback: Function) => void;
    remove: (callback: Function) => void;
    fps: (fps: number) => void;
  };
  // Additional GSAP methods that might be used
  killTweensOf: (target: GSAPTarget) => void;
  getTweensOf: (target: GSAPTarget) => any[];
  isTweening: (target: GSAPTarget) => boolean;
  refresh: () => void;
  utils: {
    toArray: (target: any) => any[];
    selector: (selector: string) => any;
    random: (min: number, max: number, snap?: number) => number;
    clamp: (min: number, max: number, value: number) => number;
    pipe: (...functions: Function[]) => Function;
    unitize: (func: Function, unit?: string) => Function;
  };
}

interface Timeline {
  set: (target: GSAPTarget, vars: GSAPVars, position?: string | number) => Timeline;
  to: (target: GSAPTarget, vars: GSAPToVars, position?: string | number) => Timeline;
  from: (target: GSAPTarget, vars: GSAPVars, position?: string | number) => Timeline;
  fromTo: (target: GSAPTarget, fromVars: GSAPVars, toVars: GSAPToVars, position?: string | number) => Timeline;
  add: (callback: Function | Timeline, position?: string | number) => Timeline;
  call: (callback: Function, params?: any[], scope?: any, position?: string | number) => Timeline;
  delay: (value: number) => Timeline;
  duration: (value?: number) => number | Timeline;
  play: (from?: string | number, suppressEvents?: boolean) => Timeline;
  pause: (atTime?: string | number, suppressEvents?: boolean) => Timeline;
  resume: () => Timeline;
  reverse: (from?: string | number, suppressEvents?: boolean) => Timeline;
  restart: (includeDelay?: boolean, suppressEvents?: boolean) => Timeline;
  seek: (position: string | number, suppressEvents?: boolean) => Timeline;
  time: (value?: number, suppressEvents?: boolean) => number | Timeline;
  totalTime: (value?: number, suppressEvents?: boolean) => number | Timeline;
  progress: (value?: number, suppressEvents?: boolean) => number | Timeline;
  totalProgress: (value?: number, suppressEvents?: boolean) => number | Timeline;
  kill: (vars?: object, target?: GSAPTarget) => Timeline;
  clear: () => Timeline;
  invalidate: () => Timeline;
  isActive: () => boolean;
  repeat: (value?: number) => number | Timeline;
  repeatDelay: (value?: number) => number | Timeline;
  yoyo: (value?: boolean) => boolean | Timeline;
  timeScale: (value?: number) => number | Timeline;
  onComplete: Function | null;
  onStart: Function | null;
  onUpdate: Function | null;
  onRepeat: Function | null;
  onReverseComplete: Function | null;
}

interface TimelineOptions {
  delay?: number;
  repeat?: number;
  repeatDelay?: number;
  yoyo?: boolean;
  ease?: string;
  onComplete?: Function;
  onCompleteParams?: any[];
  onStart?: Function;
  onStartParams?: any[];
  onUpdate?: Function;
  onUpdateParams?: any[];
  onRepeat?: Function;
  onRepeatParams?: any[];
  onReverseComplete?: Function;
  onReverseCompleteParams?: any[];
  paused?: boolean;
  smoothChildTiming?: boolean;
  autoRemoveChildren?: boolean;
}

type GSAPTarget = string | Element | HTMLElement | NodeList | Element[] | HTMLElement[] | any;

interface GSAPVars {
  [key: string]: any;
  duration?: number;
  delay?: number;
  ease?: string;
  repeat?: number;
  repeatDelay?: number;
  yoyo?: boolean;
  stagger?: number | object;
  onComplete?: Function;
  onCompleteParams?: any[];
  onStart?: Function;
  onStartParams?: any[];
  onUpdate?: Function;
  onUpdateParams?: any[];
  onRepeat?: Function;
  onRepeatParams?: any[];
  onReverseComplete?: Function;
  onReverseCompleteParams?: any[];
  // Transform properties
  x?: number | string;
  y?: number | string;
  z?: number | string;
  scale?: number;
  scaleX?: number;
  scaleY?: number;
  scaleZ?: number;
  rotation?: number;
  rotationX?: number;
  rotationY?: number;
  rotationZ?: number;
  skewX?: number;
  skewY?: number;
  transformOrigin?: string;
  // CSS properties
  opacity?: number;
  backgroundColor?: string;
  color?: string;
  border?: string;
  borderBottom?: string;
  borderTop?: string;
  borderLeft?: string;
  borderRight?: string;
  boxShadow?: string;
  width?: number | string;
  height?: number | string;
  left?: number | string;
  top?: number | string;
  right?: number | string;
  bottom?: number | string;
  margin?: number | string;
  padding?: number | string;
  fontSize?: number | string;
  lineHeight?: number | string;
  // Position properties
  position?: string;
  // Additional CSS properties for animations
  filter?: string;
  clipPath?: string;
  maskImage?: string;
  textShadow?: string;
  letterSpacing?: number | string;
  wordSpacing?: number | string;
  textDecoration?: string;
  // CSS custom properties (CSS variables)
  '--animation-duration'?: string;
  '--animation-delay'?: string;
  '--animation-easing'?: string;
  '--animation-intensity'?: string;
}

interface GSAPToVars extends GSAPVars {
  // Additional properties specific to .to() animations
}

// CSS Module declarations
declare module '*.module.css' {
  const classes: { [key: string]: string };
  export default classes;
}

declare module '*.module.scss' {
  const classes: { [key: string]: string };
  export default classes;
}

declare module '*.module.sass' {
  const classes: { [key: string]: string };
  export default classes;
}

// Asset declarations
declare module '*.svg' {
  const content: React.FunctionComponent<React.SVGAttributes<SVGElement>>;
  export default content;
}

declare module '*.png' {
  const content: string;
  export default content;
}

declare module '*.jpg' {
  const content: string;
  export default content;
}

declare module '*.jpeg' {
  const content: string;
  export default content;
}

declare module '*.gif' {
  const content: string;
  export default content;
}

declare module '*.webp' {
  const content: string;
  export default content;
}

declare module '*.ico' {
  const content: string;
  export default content;
}

declare module '*.bmp' {
  const content: string;
  export default content;
}

// Video and audio assets
declare module '*.mp4' {
  const content: string;
  export default content;
}

declare module '*.webm' {
  const content: string;
  export default content;
}

declare module '*.ogg' {
  const content: string;
  export default content;
}

declare module '*.mp3' {
  const content: string;
  export default content;
}

declare module '*.wav' {
  const content: string;
  export default content;
}

declare module '*.flac' {
  const content: string;
  export default content;
}

declare module '*.aac' {
  const content: string;
  export default content;
}

// Font declarations
declare module '*.woff' {
  const content: string;
  export default content;
}

declare module '*.woff2' {
  const content: string;
  export default content;
}

declare module '*.eot' {
  const content: string;
  export default content;
}

declare module '*.ttf' {
  const content: string;
  export default content;
}

declare module '*.otf' {
  const content: string;
  export default content;
}

// JSON declarations
declare module '*.json' {
  const content: any;
  export default content;
}

// Text file declarations
declare module '*.txt' {
  const content: string;
  export default content;
}

declare module '*.md' {
  const content: string;
  export default content;
}

// Environment variables
declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production' | 'test';
    NEXT_PUBLIC_APP_URL?: string;
    NEXT_PUBLIC_API_URL?: string;
    NEXT_PUBLIC_SUPABASE_URL?: string;
    NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
    NEXT_PUBLIC_GOOGLE_ANALYTICS_ID?: string;
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?: string;
    DATABASE_URL?: string;
    STRIPE_SECRET_KEY?: string;
    OPENAI_API_KEY?: string;
    WEBHOOK_SECRET?: string;
    // Add more environment variables as needed
  }
}

// Module declaration to make this file a module
export {};
