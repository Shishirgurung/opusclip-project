import React, { useMemo } from 'react';
import { CaptionSegment, Word, BrandTemplate } from '@/types';

// It's recommended to move these styles to a global CSS file (e.g., styles/globals.css)
const animationStyles = `
  @keyframes pop {
    0% { transform: scale(1); }
    50% { transform: scale(1.2); }
    100% { transform: scale(1); }
  }
  .animate-pop { animation: pop 0.3s ease-in-out; }

  @keyframes slide-up {
    from { transform: translateY(100%); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
  .animate-slide-up { animation: slide-up 0.3s forwards; }

  .animate-underline::after {
    content: '';
    position: absolute;
    bottom: -2px;
    left: 0;
    width: 100%;
    height: 3px;
    background-color: yellow; /* Or from template */
    animation: underline-draw 0.3s forwards;
  }

  @keyframes underline-draw {
    from { width: 0; }
    to { width: 100%; }
  }
`;

interface AnimatedCaptionsProps {
  segments: CaptionSegment[];
  template: BrandTemplate;
  currentTime: number;
}

const AnimatedCaptions: React.FC<AnimatedCaptionsProps> = ({ segments, template, currentTime }) => {
  const { font, position, animationStyle, syncMode } = template.captionSettings;

  const activeSegment = useMemo(() =>
    segments.find(segment => currentTime >= segment.start && currentTime < segment.end),
    [segments, currentTime]
  );

  if (!activeSegment) {
    return null;
  }

  const containerStyles: React.CSSProperties = {
    position: 'absolute',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '90%',
    textAlign: 'center',
    pointerEvents: 'none', // Prevent captions from blocking video controls
    ...(position === 'top' && { top: '10%' }),
    ...(position === 'middle' && { top: '50%', transform: 'translate(-50%, -50%)' }),
    ...(position === 'bottom' && { bottom: '10%' }),
  };

  const wordStyles: React.CSSProperties = {
    fontFamily: font.family,
    fontSize: `${font.size}px`,
    color: font.color,
    textTransform: font.case === 'normal' ? 'none' : font.case,
    fontWeight: 'bold',
    textShadow: font.shadowColor ? `${font.shadowX}px ${font.shadowY}px ${font.shadowBlur}px ${font.shadowColor}` : 'none',
    display: 'inline-block',
    padding: '0 0.1em',
    whiteSpace: 'pre',
    transition: 'color 0.2s ease-in-out, transform 0.2s ease-in-out',
  };

  const renderContent = () => {
    if (syncMode === 'line' || !activeSegment.words) {
      return <span style={wordStyles}>{activeSegment.text}</span>;
    }

    return activeSegment.words.map((word, index) => {
      const isWordActive = currentTime >= word.start && currentTime < word.end;
      const isWordPast = currentTime >= word.end;

      let dynamicClass = 'caption-word';
      let dynamicStyle: React.CSSProperties = {};

      if (isWordActive) {
        switch (animationStyle) {
          case 'pop': dynamicClass += ' animate-pop'; break;
          case 'slide-up': dynamicClass += ' animate-slide-up'; break;
          case 'underline': dynamicClass += ' animate-underline'; break;
        }
      }
      
      if (animationStyle === 'karaoke' && (isWordActive || isWordPast)) {
        dynamicStyle.color = 'yellow'; // Or use a color from the template
      }

      return (
        <span key={index} style={{ ...wordStyles, ...dynamicStyle }} className={dynamicClass}>
          {word.word}
        </span>
      );
    });
  };

  return (
    <>
      <style>{animationStyles}</style>
      <div style={containerStyles}>
        <div style={{ display: 'inline-block', padding: '0.2em 0.5em', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: '8px' }}>
          {renderContent()}
        </div>
      </div>
    </>
  );
};

export default AnimatedCaptions;
