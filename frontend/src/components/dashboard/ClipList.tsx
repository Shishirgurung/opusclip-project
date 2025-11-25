import React from 'react';
import { ClipDisplayItem } from './ClipDisplayItem';
import { TimelineClip, BrandTemplate } from '@/types';

interface ClipListProps {
  clips: TimelineClip[];
  template: BrandTemplate;
  onClipChange: (newClip: TimelineClip) => void;
}

export const ClipList: React.FC<ClipListProps> = ({ clips, template, onClipChange }) => {
  if (!clips || clips.length === 0) {
    return <p className="text-center text-muted-foreground">No clips have been generated yet.</p>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {clips.map((clip) => (
        <ClipDisplayItem
          key={clip.id}
          clip={clip}
          template={template}
          onClipChange={onClipChange}
        />
      ))}
    </div>
  );
};

export default ClipList;
