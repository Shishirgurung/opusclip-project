import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BrandTemplate } from '@/types';

interface LivePreviewPanelProps {
  template: BrandTemplate | null;
}

export const LivePreviewPanel: React.FC<LivePreviewPanelProps> = ({ template }) => {
  return (
    <div className="h-full sticky top-24">
      <Card className="bg-gray-800/50 border-gray-700 h-full min-h-[70vh]">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-white">Live Preview</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center h-full space-y-4 pt-10">
          <div className="w-full max-w-[280px] aspect-[9/16] bg-gray-900 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-600">
            <p className="text-gray-500 text-sm text-center p-4">Select a template to see a live preview</p>
          </div>
          <div className="w-full max-w-[280px] p-4 bg-gray-900 rounded-lg mt-6">
            <p className="text-sm text-gray-300 font-medium">Preview Text</p>
            <p className="text-gray-400 mt-1 text-base">This is AMAZING content! Watch this incredible transformation.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
