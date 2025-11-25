import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { BrandTemplate, AspectRatio, TimelineClip } from '@/types';
import path from 'path';
import { promises as fs } from 'fs';
import { createWriteStream, readFileSync, existsSync } from 'fs';
import { promisify } from 'util';
import fetch from 'node-fetch';
import os from 'os';
import { spawn } from 'child_process';

// Custom Error for Video Processing
export class VideoProcessingError extends Error {
  public context?: any;
  constructor(message: string, context?: any) {
    super(message);
    this.name = 'VideoProcessingError';
    this.context = context;
  }
}

// Promisify fs functions


// Set the path for the ffmpeg binary
if (process.env.NODE_ENV !== 'test') {
    ffmpeg.setFfmpegPath(ffmpegInstaller.path);
}

// Helper function to download a file
async function downloadFile(url: string, dest: string): Promise<void> {
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Failed to fetch ${url}: ${res.statusText}`);
    }
    const fileStream = createWriteStream(dest);
    return new Promise((resolve, reject) => {
        res.body.pipe(fileStream);
        res.body.on('error', reject);
        fileStream.on('finish', resolve);
    });
}

export async function processVideoAndCreateClips(
    videoUrl: string,
    brandTemplate: BrandTemplate, // This is unused for now but kept for future use
    timestamps: { start: number; end: number }[],
    aspectRatio: AspectRatio, // This is unused for now but kept for future use
    onProgress?: (progress: number) => void
): Promise<TimelineClip[]> {
    const tempDir = path.join(process.cwd(), 'temp', `session-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    const inputFileName = 'input.mp4';
    const inputFilePath = path.join(tempDir, inputFileName);

    try {
        console.log(`Downloading video from ${videoUrl} to ${inputFilePath}`);
        await downloadFile(videoUrl, inputFilePath);
        console.log('Download complete.');

        const clips: TimelineClip[] = [];
        const totalClips = timestamps.length;

        for (let i = 0; i < totalClips; i++) {
            const { start, end } = timestamps[i];
            const outputFileName = `clip-${i}.mp4`;
            const outputFilePath = path.join(tempDir, outputFileName);
            const duration = end - start;

            console.log(`Processing clip ${i + 1}/${totalClips}: start=${start}, duration=${duration}`);

            await new Promise<void>((resolve, reject) => {
                ffmpeg(inputFilePath)
                    .setStartTime(start)
                    .setDuration(duration)
                    .outputOptions('-c:v libx264', '-c:a aac') // Specify codecs
                    .output(outputFilePath)
                    .on('end', () => {
                        console.log(`Clip ${i + 1} processed successfully.`);
                        const clipData = readFileSync(outputFilePath);
                        const clipUrl = `data:video/mp4;base64,${clipData.toString('base64')}`;

                        clips.push({
                            id: `clip-${i}`,
                            asset: {
                                type: 'video',
                                src: clipUrl,
                            },
                            start: 0,
                            end: duration,
                            duration: duration,
                            title: `Clip ${i + 1}`,
                            startTime: start,
                            endTime: end,
                            videoUrl: clipUrl
                        });
                        resolve();
                    })
                    .on('error', (err, stdout, stderr) => {
                        console.error(`Error processing clip ${i + 1}:`, err.message);
                        console.error('ffmpeg stdout:', stdout);
                        console.error('ffmpeg stderr:', stderr);
                        reject(err);
                    })
                    .on('progress', (progress) => {
                        if (onProgress) {
                            // Calculate overall progress
                            const clipProgress = progress.percent / 100;
                            const overallProgress = (i + clipProgress) / totalClips;
                            onProgress(overallProgress);
                        }
                        console.log(`Processing clip ${i + 1}: ${progress.percent?.toFixed(2)}% done`);
                    })
                    .run();
            });
        }

        return clips;
    } catch (error) {
        console.error('An error occurred during video processing:', error);
        throw error; // Re-throw the error to be handled by the API route
    } finally {
        // Cleanup the temp directory
        if (existsSync(tempDir)) {
            try {
                console.log(`Cleaning up temp directory: ${tempDir}`);
                const files = await fs.readdir(tempDir);
                for (const file of files) {
                    await fs.unlink(path.join(tempDir, file));
                }
                await fs.rmdir(tempDir);
                console.log('Cleanup complete.');
            } catch (cleanupError) {
                console.error('Error during temp directory cleanup:', cleanupError);
            }
        }
    }
}

export class VideoProcessorPython {
  private videoUrl: string;
  private template: BrandTemplate;
  private tempDir: string | null = null;

  constructor(videoUrl: string, template: BrandTemplate) {
    this.videoUrl = videoUrl;
    this.template = template;
  }

  private async setupDirectory(): Promise<void> {
    this.tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'video-processing-'));
  }

  private async cleanupDirectory(): Promise<void> {
    if (this.tempDir) {
      await fs.rm(this.tempDir, { recursive: true, force: true });
    }
  }

  private buildPythonArgs(): string[] {
    const args = [
      '--video_url', this.videoUrl,
      '--output_path', path.join(this.tempDir!, 'output.json'),
      // Add other template properties as arguments
      '--aspect_ratio', this.template.aspectRatio,
      '--font_family', this.template.captionSettings.font.family,
      '--font_size', this.template.captionSettings.font.size.toString(),
      '--font_color', this.template.captionSettings.font.color,
      '--animation_style', this.template.captionSettings.animationStyle,
    ];
    // Add more arguments for other template settings as needed
    return args;
  }

  public async process(): Promise<TimelineClip[]> {
    await this.setupDirectory();
    try {
      const pythonScriptPath = path.resolve('./src/python/video_processor.py');
      const args = this.buildPythonArgs();

      const pythonProcess = spawn('python', [pythonScriptPath, ...args]);

      let stdout = '';
      let stderr = '';
      pythonProcess.stdout.on('data', (data) => { stdout += data.toString(); });
      pythonProcess.stderr.on('data', (data) => { stderr += data.toString(); });

      const exitCode = await new Promise<number>((resolve, reject) => {
        pythonProcess.on('close', resolve);
        pythonProcess.on('error', reject);
      });

      if (exitCode !== 0) {
        throw new VideoProcessingError('Python script failed to execute.', { exitCode, stderr, stdout });
      }

      const outputFile = path.join(this.tempDir!, 'output.json');
      const result = await fs.readFile(outputFile, 'utf-8');
      return JSON.parse(result) as TimelineClip[];

    } catch (error) {
      // Re-throw custom error to be caught by the API handler
      if (error instanceof VideoProcessingError) throw error;
      throw new VideoProcessingError('An unexpected error occurred during video processing.', error);
    } finally {
      await this.cleanupDirectory();
    }
  }
}

// The old function is kept for compatibility but should be deprecated.
export async function processVideo(
  videoUrl: string,
  template: BrandTemplate
): Promise<TimelineClip[]> {
  console.warn('DEPRECATED: The processVideo function is deprecated. Use the VideoProcessor class instead.');
  const processor = new VideoProcessorPython(videoUrl, template);
  return processor.process();
}
