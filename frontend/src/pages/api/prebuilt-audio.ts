import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs/promises';
import path from 'path';
import { PrebuiltAudioItem } from '@/types';

const PREBUILT_AUDIO_DIR = path.join(process.cwd(), 'public', 'prebuilt-audio');
const ALLOWED_EXTENSIONS = ['.mp3', '.wav', '.ogg', '.aac', '.m4a'];

async function getPrebuiltAudio(): Promise<PrebuiltAudioItem[]> {
  try {
    // Check if the directory exists
    await fs.access(PREBUILT_AUDIO_DIR);

    const filenames = await fs.readdir(PREBUILT_AUDIO_DIR);
    
    const audioFiles = filenames
      .filter(filename => ALLOWED_EXTENSIONS.includes(path.extname(filename).toLowerCase()))
      .map(filename => {
        const nameWithoutExtension = path.basename(filename, path.extname(filename));
        return {
          id: `prebuilt_${nameWithoutExtension.replace(/\s+/g, '_').toLowerCase()}`,
          name: nameWithoutExtension.replace(/_/g, ' '),
          src: `/prebuilt-audio/${filename}`,
          type: 'audio' as 'audio',
        };
      });

    return audioFiles;
  } catch (error: any) {
    // If the directory doesn't exist (ENOENT), return an empty array gracefully.
    if (error.code === 'ENOENT') {
      console.warn(`Prebuilt audio directory not found: ${PREBUILT_AUDIO_DIR}`);
      return [];
    }
    // For other errors, re-throw to be caught by the handler.
    console.error('Error reading prebuilt audio directory:', error);
    throw new Error('Failed to load prebuilt audio files.');
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PrebuiltAudioItem[] | { error: string }>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const audioFiles = await getPrebuiltAudio();
    return res.status(200).json(audioFiles);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'An internal server error occurred.' });
  }
}
