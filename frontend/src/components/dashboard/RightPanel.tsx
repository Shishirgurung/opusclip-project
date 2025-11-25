import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProcessingTask } from '@/types';
import { useTemplate } from '@/hooks/use-template';
import { BrandTemplatePanel } from './BrandTemplatePanel';
import { TemplateLibrary } from './TemplateLibrary';
import { ProcessingQueue } from './ProcessingQueue';

interface RightPanelProps {
  processingQueue: ProcessingTask[];
  onCancelProcessing: (queueId: string) => void;
  onRefreshQueue: () => Promise<void>;
}

export const RightPanel: React.FC<RightPanelProps> = ({
  processingQueue,
  onCancelProcessing,
  onRefreshQueue,
}) => {
  const { currentTemplate } = useTemplate();

  return (
    <div className="h-full flex flex-col">
      <Tabs defaultValue="template" className="flex-grow flex flex-col">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="template">Template</TabsTrigger>
          <TabsTrigger value="library">Library</TabsTrigger>
          <TabsTrigger value="queue">Queue</TabsTrigger>
        </TabsList>

        <TabsContent value="template" className="flex-grow overflow-y-auto p-1">
          {currentTemplate ? (
            <BrandTemplatePanel />
          ) : (
            <div className="p-4 text-center text-gray-500">Select or create a template from the library.</div>
          )}
        </TabsContent>

        <TabsContent value="library" className="flex-grow overflow-y-auto p-1">
          <TemplateLibrary />
        </TabsContent>

        <TabsContent value="queue" className="flex-grow overflow-y-auto p-1">
          <ProcessingQueue
            queue={processingQueue}
            onCancel={onCancelProcessing}
            onRefresh={onRefreshQueue}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};
