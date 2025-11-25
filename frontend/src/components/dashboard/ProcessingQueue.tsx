import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { RefreshCw, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { ProcessingTask } from '@/types';

const statusConfig: {
  [key: string]: { icon: React.ElementType; color: string; label: string; animate?: boolean }
} = {
  pending: { icon: AlertCircle, color: 'yellow', label: 'Pending' },
  processing: { icon: RefreshCw, color: 'blue', label: 'Processing', animate: true },
  completed: { icon: CheckCircle2, color: 'green', label: 'Completed' },
  failed: { icon: XCircle, color: 'red', label: 'Failed' },
  cancelled: { icon: XCircle, color: 'gray', label: 'Cancelled' },
};

const TaskStatus: React.FC<{ task: ProcessingTask; onCancel: (id: string) => void }> = ({ task, onCancel }) => {
  const config = statusConfig[task.status];
  const Icon = config.icon;

  const content = (
    <Badge variant={task.status === 'completed' ? 'default' : 'secondary'} className={`bg-${config.color}-100 text-${config.color}-800`}>
      <Icon className={`mr-2 h-4 w-4 ${config.animate ? 'animate-spin' : ''}`} />
      {config.label}
    </Badge>
  );

  if (task.status === 'failed' && task.error) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2 cursor-pointer">
              {content}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p className="max-w-xs">Error: {task.error}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (task.status === 'pending' || task.status === 'processing') {
    return (
      <div className="flex items-center gap-2">
        {content}
        <Button variant="destructive" size="sm" onClick={() => onCancel(task.id)}>
          Cancel
        </Button>
      </div>
    );
  }

  return content;
};

const TaskItem: React.FC<{ task: ProcessingTask; onCancel: (id: string) => void }> = ({ task, onCancel }) => (
  <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-3 border">
    <div className="flex justify-between items-start">
      <div className="max-w-xs">
        <h3 className="font-medium truncate" title={task.videoUrl}>{task.videoUrl.split('/').pop() || `Task ${task.id.substring(0, 8)}`}</h3>
        <p className="text-sm text-muted-foreground">
          {new Date(task.createdAt).toLocaleString()}
        </p>
      </div>
      <TaskStatus task={task} onCancel={onCancel} />
    </div>
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Template: <span className="font-medium text-foreground">{task.template.name}</span></span>
        <span className="text-muted-foreground font-semibold">{task.progress.toFixed(0)}%</span>
      </div>
      <Progress value={task.progress} className="h-2" />
    </div>
    {task.status === 'completed' && task.resultUrl && (
      <Button variant="link" className="p-0 h-auto" onClick={() => window.open(task.resultUrl, '_blank')}>
        View Final Video
      </Button>
    )}
  </div>
);

interface ProcessingQueueProps {
  queue: ProcessingTask[];
  onCancel: (queueId: string) => void;
  onRefresh: () => Promise<void>;
}

export const ProcessingQueue: React.FC<ProcessingQueueProps> = ({ queue, onCancel, onRefresh }) => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
    } catch (error) {
      console.error('Failed to refresh queue:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [onRefresh]);

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Processing Queue</CardTitle>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {queue.length > 0 ? (
          <div className="space-y-4">
            {queue.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((task) => (
              <TaskItem key={task.id} task={task} onCancel={onCancel} />
            ))}
          </div>
        ) : (
          <div className="text-center py-10">
            <p className="text-muted-foreground">The processing queue is empty.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
