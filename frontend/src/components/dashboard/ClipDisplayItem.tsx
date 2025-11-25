import React, { useState, useRef, useEffect } from 'react';
import { TimelineClip, BrandTemplate } from '@/types';
import { useRouter } from 'next/router';
import AnimatedCaptions from './AnimatedCaptions';

interface ClipDisplayItemProps {
  clip: TimelineClip;
  template: BrandTemplate;
  onClipChange: (newClip: TimelineClip) => void;
}

const ClipDisplayItem: React.FC<ClipDisplayItemProps> = ({ clip, template, onClipChange }) => {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const timeUpdateHandler = () => {
      setCurrentTime(video.currentTime);
    };

    video.addEventListener('timeupdate', timeUpdateHandler);

    return () => {
      video.removeEventListener('timeupdate', timeUpdateHandler);
    };
  }, []);

  const handleEditClick = () => {
    // Navigate to the editor page, passing clip information
    // This could be via query params, or by setting some global state / context
    // For simplicity, let's assume the editor can take a clipId or necessary data via query
    router.push(`/editor?clipId=${clip.id}&videoUrl=${encodeURIComponent(clip.videoUrl)}&startTime=${clip.startTime}&endTime=${clip.endTime}`);
    // Or, if your editor page is dynamic like /editor/[clipId]
    // router.push(`/editor/${clip.id}`); 
    // You'll need to ensure your editor page can fetch/receive clip data based on this.
  };



  return (
    <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden flex flex-col">
      <div className="relative aspect-video bg-black">
        <video ref={videoRef} controls src={clip.videoUrl} className="w-full h-full object-cover" preload="metadata">
          Your browser does not support the video tag.
        </video>
        {clip.captionSegments && template && (
          <AnimatedCaptions 
            segments={clip.captionSegments}
            template={template}
            currentTime={currentTime}
          />
        )}
      </div>
      <div className="p-4 flex-grow flex flex-col justify-between">
        <div>
          <h3 className="text-lg font-semibold text-indigo-400 mb-1">Clip {clip.id}</h3>
          <p className="text-sm text-gray-300 mb-3 leading-relaxed line-clamp-3 hover:line-clamp-none transition-all duration-300">
            Duration: {Math.round((clip.endTime - clip.startTime) * 100) / 100}s
          </p>
          {clip.caption && (
            <p className="text-xs text-gray-400 mb-2 italic">
              "{clip.caption.substring(0, 100)}{clip.caption.length > 100 ? '...' : ''}"
            </p>
          )}
        </div>
        <button
          onClick={handleEditClick}
          className="mt-auto w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-md transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500"
        >
          Edit Clip
        </button>
      </div>
    </div>
  );
};

export { ClipDisplayItem };
export default ClipDisplayItem;
