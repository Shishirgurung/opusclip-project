import { AnimationStyle } from '../types';

// Animation configuration interface
export interface AnimationConfig {
  name: AnimationStyle;
  duration: number;
  delay: number;
  easing: string;
  intensity: number;
}

// Default animation settings
export const DEFAULT_ANIMATION_CONFIG: AnimationConfig = {
  name: 'none',
  duration: 0.6,
  delay: 0,
  easing: 'ease-out',
  intensity: 1
};

// CSS class mappings for each animation
export const ANIMATION_CSS_CLASSES: Record<AnimationStyle, string> = {
  'bounce': 'opus-anim-bounce',
  'pop': 'opus-anim-pop',
  'scale': 'opus-anim-scale',
  'underline': 'opus-anim-underline',
  'slide-left': 'opus-anim-slide-left',
  'slide-up': 'opus-anim-slide-up',
  'box': 'opus-anim-box',
  'fade': 'opus-anim-fade',
  'flash': 'opus-anim-flash',
  'shake': 'opus-anim-shake',
  'none': '',
  'karaoke': 'opus-anim-karaoke'
};

// CSS keyframes definitions
export const CSS_KEYFRAMES = `
@keyframes opus-bounce {
  0% { transform: translateY(0) scale(1); }
  30% { transform: translateY(-20px) scale(1.1); }
  50% { transform: translateY(-10px) scale(1.05); }
  70% { transform: translateY(-5px) scale(1.02); }
  100% { transform: translateY(0) scale(1); }
}

@keyframes opus-pop {
  0% { transform: scale(0.8); opacity: 0.8; }
  50% { transform: scale(1.2); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}

@keyframes opus-scale {
  0% { transform: scale(0.5); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

@keyframes opus-underline {
  0% { 
    border-bottom: 3px solid transparent;
    transform: scaleX(0);
  }
  50% {
    border-bottom: 3px solid #04f827;
    transform: scaleX(0.5);
  }
  100% { 
    border-bottom: 3px solid #04f827;
    transform: scaleX(1);
  }
}

@keyframes opus-slide-left {
  0% { transform: translateX(-100px); opacity: 0; }
  100% { transform: translateX(0); opacity: 1; }
}

@keyframes opus-slide-up {
  0% { transform: translateY(50px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}

@keyframes opus-box {
  0% { 
    border: 2px solid transparent;
    box-shadow: 0 0 0 rgba(4, 248, 39, 0);
  }
  50% {
    border: 2px solid #04f827;
    box-shadow: 0 0 20px rgba(4, 248, 39, 0.5);
  }
  100% { 
    border: 2px solid #04f827;
    box-shadow: 0 0 10px rgba(4, 248, 39, 0.3);
  }
}

@keyframes opus-fade {
  0% { opacity: 0; }
  100% { opacity: 1; }
}

@keyframes opus-anim-karaoke {
  from {
    background-size: 0% 100%;
  }
  to {
    background-size: 100% 100%;
  }
}

@keyframes opus-flash {
  0% { background-color: transparent; }
  25% { background-color: #FFFDO3; }
  50% { background-color: transparent; }
  75% { background-color: #04f827; }
  100% { background-color: transparent; }
}

@keyframes opus-shake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
  20%, 40%, 60%, 80% { transform: translateX(5px); }
}

.opus-anim-bounce {
  animation: opus-bounce var(--animation-duration, 0.6s) var(--animation-easing, ease-out) var(--animation-delay, 0s);
}

.opus-anim-pop {
  animation: opus-pop var(--animation-duration, 0.6s) var(--animation-easing, ease-out) var(--animation-delay, 0s);
}

.opus-anim-scale {
  animation: opus-scale var(--animation-duration, 0.6s) var(--animation-easing, ease-out) var(--animation-delay, 0s);
}

.opus-anim-underline {
  animation: opus-underline var(--animation-duration, 0.6s) var(--animation-easing, ease-out) var(--animation-delay, 0s);
  border-bottom: 3px solid transparent;
  transform-origin: left;
}

.opus-anim-slide-left {
  animation: opus-slide-left var(--animation-duration, 0.6s) var(--animation-easing, ease-out) var(--animation-delay, 0s);
}

.opus-anim-slide-up {
  animation: opus-slide-up var(--animation-duration, 0.6s) var(--animation-easing, ease-out) var(--animation-delay, 0s);
}

.opus-anim-box {
  animation: opus-box var(--animation-duration, 0.6s) var(--animation-easing, ease-out) var(--animation-delay, 0s);
  padding: 5px 10px;
  border-radius: 4px;
}

.opus-anim-fade {
  animation: opus-fade var(--animation-duration, 0.6s) var(--animation-easing, ease-out) var(--animation-delay, 0s);
}

.opus-anim-flash {
  animation: opus-flash var(--animation-duration, 0.6s) var(--animation-easing, ease-out) var(--animation-delay, 0s);
  padding: 2px 4px;
  border-radius: 2px;
}

.opus-anim-shake {
  animation: opus-shake var(--animation-duration, 0.6s) var(--animation-easing, ease-out) var(--animation-delay, 0s);
}
`;

// GSAP animation configurations
export interface GSAPAnimationConfig {
  from: Record<string, any>;
  to: Record<string, any>;
  duration: number;
  ease: string;
  stagger?: number;
}

export const GSAP_ANIMATIONS: Record<AnimationStyle, GSAPAnimationConfig> = {
  'bounce': {
    from: { y: 0, scale: 1 },
    to: { 
      y: -20, 
      scale: 1.1,
      ease: "bounce.out",
      yoyo: true,
      repeat: 1
    },
    duration: 0.6,
    ease: "bounce.out"
  },
  'pop': {
    from: { scale: 0.8, opacity: 0.8 },
    to: { 
      scale: 1.2, 
      opacity: 1,
      yoyo: true,
      repeat: 1
    },
    duration: 0.3,
    ease: "back.out(1.7)"
  },
  'scale': {
    from: { scale: 0.5, opacity: 0 },
    to: { scale: 1, opacity: 1 },
    duration: 0.6,
    ease: "power2.out"
  },
  'underline': {
    from: { 
      borderBottom: "3px solid transparent",
      scaleX: 0,
      transformOrigin: "left"
    },
    to: { 
      borderBottom: "3px solid #04f827",
      scaleX: 1
    },
    duration: 0.6,
    ease: "power2.out"
  },
  'slide-left': {
    from: { x: -100, opacity: 0 },
    to: { x: 0, opacity: 1 },
    duration: 0.6,
    ease: "power2.out"
  },
  'slide-up': {
    from: { y: 50, opacity: 0 },
    to: { y: 0, opacity: 1 },
    duration: 0.6,
    ease: "power2.out"
  },
  'box': {
    from: { 
      border: "2px solid transparent",
      boxShadow: "0 0 0 rgba(4, 248, 39, 0)"
    },
    to: { 
      border: "2px solid #04f827",
      boxShadow: "0 0 20px rgba(4, 248, 39, 0.5)"
    },
    duration: 0.6,
    ease: "power2.out"
  },
  'fade': {
    from: { opacity: 0 },
    to: { opacity: 1 },
    duration: 0.6,
    ease: "power2.out"
  },
  'flash': {
    from: { backgroundColor: "transparent" },
    to: { 
      backgroundColor: "#FFFDO3",
      yoyo: true,
      repeat: 3
    },
    duration: 0.15,
    ease: "power2.inOut"
  },
  'shake': {
    from: { x: 0 },
    to: { 
      x: -5,
      yoyo: true,
      repeat: 5
    },
    duration: 0.1,
    ease: "power2.inOut"
  },
  'none': {
    from: {},
    to: {},
    duration: 0,
    ease: "none"
  },
  'karaoke': {
    from: { backgroundSize: '0% 100%' },
    to: { backgroundSize: '100% 100%' },
    duration: 0.5, // Default duration, can be overridden
    ease: 'linear'
  }
};

// ASS tag generation for video export
export interface ASSAnimationTags {
  start: string;
  end: string;
  karaoke?: string;
}

export function generateASSAnimationTags(
  animation: AnimationStyle,
  config: Partial<AnimationConfig> = {}
): ASSAnimationTags {
  const finalConfig = { ...DEFAULT_ANIMATION_CONFIG, ...config };
  const duration = Math.round(finalConfig.duration * 100); // Convert to centiseconds
  const intensity = finalConfig.intensity;

  switch (animation) {
    case 'bounce':
      return {
        start: `{\\t(0,${duration},\\fscx${100 + intensity * 20}\\fscy${100 + intensity * 20})}`,
        end: `{\\t(${duration},${duration * 2},\\fscx100\\fscy100)}`,
        karaoke: `{\\k${duration}}`
      };

    case 'pop':
      return {
        start: `{\\t(0,${duration / 2},\\fscx${80 + intensity * 40}\\fscy${80 + intensity * 40})}`,
        end: `{\\t(${duration / 2},${duration},\\fscx100\\fscy100)}`,
        karaoke: `{\\k${duration}}`
      };

    case 'scale':
      return {
        start: `{\\fscx${50 * intensity}\\fscy${50 * intensity}\\t(0,${duration},\\fscx100\\fscy100)}`,
        end: '',
        karaoke: `{\\k${duration}}`
      };

    case 'underline':
      return {
        start: `{\\bord3\\3c&H27F804&}`,
        end: '',
        karaoke: `{\\k${duration}}`
      };

    case 'slide-left':
      return {
        start: `{\\pos(-100,0)\\t(0,${duration},\\pos(0,0))}`,
        end: '',
        karaoke: `{\\k${duration}}`
      };

    case 'slide-up':
      return {
        start: `{\\pos(0,50)\\t(0,${duration},\\pos(0,0))}`,
        end: '',
        karaoke: `{\\k${duration}}`
      };

    case 'box':
      return {
        start: `{\\bord2\\3c&H27F804&\\4c&H27F804&}`,
        end: '',
        karaoke: `{\\k${duration}}`
      };

    case 'fade':
      return {
        start: `{\\fad(${duration},0)}`,
        end: '',
        karaoke: `{\\k${duration}}`
      };

    case 'flash':
      const flashDuration = duration / 4;
      return {
        start: `{\\t(0,${flashDuration},\\3c&H03FDFF&)\\t(${flashDuration},${flashDuration * 2},\\3c&HFFFFFF&)\\t(${flashDuration * 2},${flashDuration * 3},\\3c&H27F804&)\\t(${flashDuration * 3},${duration},\\3c&HFFFFFF&)}`,
        end: '',
        karaoke: `{\\k${duration}}`
      };

    case 'shake':
      return {
        start: `{\\t(0,${duration / 10},\\pos(-5,0))\\t(${duration / 10},${duration / 5},\\pos(5,0))\\t(${duration / 5},${duration * 3 / 10},\\pos(-5,0))\\t(${duration * 3 / 10},${duration * 2 / 5},\\pos(5,0))\\t(${duration * 2 / 5},${duration / 2},\\pos(0,0))}`,
        end: '',
        karaoke: `{\\k${duration}}`
      };

    case 'none':
    default:
      return {
        start: '',
        end: '',
        karaoke: `{\\k${duration}}`
      };
  }
}

// CSS class generation with custom properties
export function generateCSSAnimation(
  animation: AnimationStyle,
  config: Partial<AnimationConfig> = {}
): { className: string; style: Record<string, string> } {
  const finalConfig = { ...DEFAULT_ANIMATION_CONFIG, ...config };
  
  if (animation === 'none') {
    return { className: '', style: {} };
  }

  const className = ANIMATION_CSS_CLASSES[animation];
  const style = {
    '--animation-duration': `${finalConfig.duration}s`,
    '--animation-delay': `${finalConfig.delay}s`,
    '--animation-easing': finalConfig.easing,
    '--animation-intensity': finalConfig.intensity.toString()
  };

  return { className, style };
}

// GSAP animation execution
export function executeGSAPAnimation(
  element: HTMLElement | string,
  animation: AnimationStyle,
  config: Partial<AnimationConfig> = {},
  onComplete?: () => void
): any {
  if (typeof window === 'undefined' || !window.gsap) {
    console.warn('GSAP not available, falling back to CSS animations');
    return null;
  }

  const finalConfig = { ...DEFAULT_ANIMATION_CONFIG, ...config };
  const gsapConfig = GSAP_ANIMATIONS[animation];
  
  if (animation === 'none' || !gsapConfig) {
    onComplete?.();
    return null;
  }

  const timeline = window.gsap.timeline({
    onComplete
  });

  // Set initial state
  timeline.set(element, gsapConfig.from);

  // Animate to final state
  timeline.to(element, {
    ...gsapConfig.to,
    duration: finalConfig.duration,
    ease: gsapConfig.ease,
    delay: finalConfig.delay
  });

  return timeline;
}

// Animation chaining support
export interface AnimationChain {
  animations: Array<{
    style: AnimationStyle;
    config?: Partial<AnimationConfig>;
    delay?: number;
  }>;
  loop?: boolean;
  onComplete?: () => void;
}

export function executeAnimationChain(
  element: HTMLElement | string,
  chain: AnimationChain
): any {
  if (typeof window === 'undefined' || !window.gsap) {
    console.warn('GSAP not available for animation chaining');
    return null;
  }

  const timeline = window.gsap.timeline({
    repeat: chain.loop ? -1 : 0,
    onComplete: chain.onComplete
  });

  chain.animations.forEach((anim, index) => {
    const gsapConfig = GSAP_ANIMATIONS[anim.style];
    if (!gsapConfig || anim.style === 'none') return;

    const config = { ...DEFAULT_ANIMATION_CONFIG, ...anim.config };
    
    if (index === 0) {
      timeline.set(element, gsapConfig.from);
    }

    timeline.to(element, {
      ...gsapConfig.to,
      duration: config.duration,
      ease: gsapConfig.ease
    }, anim.delay ? `+=${anim.delay}` : undefined);
  });

  return timeline;
}

// Utility functions
export function getAnimationDuration(animation: AnimationStyle): number {
  const gsapConfig = GSAP_ANIMATIONS[animation];
  return gsapConfig?.duration || 0;
}

export function isAnimationAvailable(animation: AnimationStyle): boolean {
  return animation in GSAP_ANIMATIONS && animation !== 'none';
}

export function getAllAnimationStyles(): AnimationStyle[] {
  return Object.keys(GSAP_ANIMATIONS) as AnimationStyle[];
}

export function getAnimationDescription(animation: AnimationStyle): string {
  const descriptions: Record<AnimationStyle, string> = {
    'bounce': 'Bouncy elastic effect with scale transformation',
    'pop': 'Quick scale pop with back easing',
    'scale': 'Smooth scale-in from small to normal size',
    'underline': 'Animated underline drawing effect',
    'slide-left': 'Slide in from the left side',
    'slide-up': 'Slide up from bottom',
    'box': 'Animated border box with glow effect',
    'fade': 'Simple fade-in opacity transition',
    'flash': 'Quick color flash highlighting',
    'shake': 'Shakes horizontally',
    'none': 'No animation',
    'karaoke': 'Color fills in from left to right, karaoke-style'
  };
  
  return descriptions[animation] || 'Unknown animation';
}

// Export CSS for injection
export function injectAnimationCSS(): void {
  if (typeof document === 'undefined') return;
  
  const existingStyle = document.getElementById('opus-animations');
  if (existingStyle) return;

  const style = document.createElement('style');
  style.id = 'opus-animations';
  style.textContent = CSS_KEYFRAMES;
  document.head.appendChild(style);
}

// Initialize animations on import
if (typeof window !== 'undefined') {
  injectAnimationCSS();
}