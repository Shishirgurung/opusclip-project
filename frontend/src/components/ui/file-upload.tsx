import React from 'react';
import { useDropzone, FileRejection, DropEvent } from 'react-dropzone';
import { Upload, X, FileIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AssetType } from '@/types';

// Define a generic asset type that includes a URL.
export type Asset = {
  url: string;
  [key: string]: any;
} | null;

interface FileUploadProps {
  assetType: AssetType;
  asset?: Asset;
  onFileChange: (file: File | null) => void;
  isUploading?: boolean;
  uploadError?: string;
  maxSize?: number;
  className?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  assetType,
  asset,
  onFileChange,
  maxSize = 50 * 1024 * 1024, // 50MB default
  className,
  isUploading = false,
  uploadError = '',
}) => {

  const onDrop = React.useCallback(
    (acceptedFiles: File[], fileRejections: FileRejection[], event: DropEvent) => {
      if (isUploading) return;

      if (fileRejections.length > 0) {
        const rejectionError = fileRejections[0].errors[0];
        console.error(`File upload error for ${assetType}: ${rejectionError.message}`);
        // Here you would typically use a toast to show the error to the user
        return;
      }

      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0];
        onFileChange(file);
      }
    },
    [onFileChange, assetType, isUploading]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.gif'],
      'video/*': ['.mp4', '.mov', '.webm'],
    },
    maxSize,
    multiple: false,
    disabled: isUploading,
  });

  const currentAssetUrl = asset?.url;
  const error = uploadError;

  return (
    <div className={cn('relative group', className)}>
      <div
        {...getRootProps({
          className: cn(
            'border-2 border-dashed rounded-lg p-4 w-full h-32 flex flex-col items-center justify-center text-center transition-colors',
            isDragActive ? 'border-purple-500 bg-purple-50' : 'border-gray-300',
            isUploading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-purple-400',
            error ? 'border-red-500' : ''
          ),
        })}
      >
        <input {...getInputProps()} />
        {isUploading ? (
          <div className="flex flex-col items-center gap-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
            <span>Uploading...</span>
          </div>
        ) : currentAssetUrl ? (
          <div className="flex items-center gap-2 text-sm">
            <FileIcon className="w-6 h-6" />
            <span className="truncate max-w-xs">{currentAssetUrl.split('/').pop()}</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="w-8 h-8 text-gray-400" />
            <p className="text-sm text-gray-500">
              <span className="font-semibold text-purple-600">Click to upload</span> or drag & drop
            </p>
            <p className="text-xs text-gray-400">{assetType.toUpperCase()} (Max {maxSize / 1024 / 1024}MB)</p>
          </div>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {currentAssetUrl && !isUploading && (
        <Button
          variant="destructive"
          size="icon"
          className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation(); // Prevent triggering the dropzone
            onFileChange(null);
          }}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Remove {assetType}</span>
        </Button>
      )}
    </div>
  );
};
