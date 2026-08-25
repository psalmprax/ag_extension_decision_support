import { spawn } from 'child_process';
import { mkdtemp, readdir, readFile, rm } from 'fs/promises';
import os from 'os';
import path from 'path';

import type { VideoAnalysisOptions } from './types';

const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const DEFAULT_MAX_FRAMES = 6;
const MAX_FRAMES = 12;
const DEFAULT_FRAME_INTERVAL_SECONDS = 2;
const MAX_FRAME_INTERVAL_SECONDS = 60;
const FFMPEG_TIMEOUT_MS = 45_000;

class VideoFrameExtractionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'VideoFrameExtractionError';
    }
}

function normalizeOptions(options?: VideoAnalysisOptions): Required<Pick<VideoAnalysisOptions, 'frameInterval' | 'maxFrames'>> {
    const frameInterval = options?.frameInterval ?? DEFAULT_FRAME_INTERVAL_SECONDS;
    const maxFrames = options?.maxFrames ?? DEFAULT_MAX_FRAMES;

    if (!Number.isFinite(frameInterval) || frameInterval <= 0 || frameInterval > MAX_FRAME_INTERVAL_SECONDS) {
        throw new VideoFrameExtractionError(`frameInterval must be between 0 and ${MAX_FRAME_INTERVAL_SECONDS} seconds`);
    }

    if (!Number.isInteger(maxFrames) || maxFrames <= 0 || maxFrames > MAX_FRAMES) {
        throw new VideoFrameExtractionError(`maxFrames must be an integer between 1 and ${MAX_FRAMES}`);
    }

    return { frameInterval, maxFrames };
}

export async function extractVideoFrames(
    videoData: Buffer,
    options?: VideoAnalysisOptions,
): Promise<Buffer[]> {
    if (!Buffer.isBuffer(videoData) || videoData.length === 0) {
        throw new VideoFrameExtractionError('Video data is required');
    }

    if (videoData.length > MAX_VIDEO_BYTES) {
        throw new VideoFrameExtractionError('Video exceeds the 50 MB size limit');
    }

    const { frameInterval, maxFrames } = normalizeOptions(options);
    const workDir = await mkdtemp(path.join(os.tmpdir(), 'ag-video-'));
    const outputPattern = path.join(workDir, 'frame-%06d.jpg');

    try {
        await runFfmpeg(videoData, outputPattern, frameInterval, maxFrames);

        const frameNames = (await readdir(workDir))
            .filter(name => /^frame-\d{6}\.jpg$/.test(name))
            .sort()
            .slice(0, maxFrames);

        if (frameNames.length === 0) {
            throw new VideoFrameExtractionError('Unable to extract frames from the supplied video');
        }

        return Promise.all(frameNames.map(frameName => readFile(path.join(workDir, frameName))));
    } finally {
        await rm(workDir, { recursive: true, force: true });
    }
}

function runFfmpeg(
    videoData: Buffer,
    outputPattern: string,
    frameInterval: number,
    maxFrames: number,
): Promise<void> {
    return new Promise((resolve, reject) => {
        const process = spawn('ffmpeg', [
            '-hide_banner',
            '-loglevel',
            'error',
            '-i',
            'pipe:0',
            '-vf',
            `fps=1/${frameInterval}`,
            '-frames:v',
            String(maxFrames),
            '-q:v',
            '3',
            '-f',
            'image2',
            outputPattern,
        ], { stdio: ['pipe', 'ignore', 'pipe'] });

        let stderr = '';
        let settled = false;
        const timeout = setTimeout(() => {
            process.kill('SIGKILL');
            finish(new VideoFrameExtractionError('Video frame extraction timed out'));
        }, FFMPEG_TIMEOUT_MS);

        const finish = (error?: Error) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            if (error) {
                reject(error);
            } else {
                resolve();
            }
        };

        process.stderr.on('data', chunk => {
            stderr += chunk.toString();
        });
        process.on('error', error => {
            finish(new VideoFrameExtractionError(`ffmpeg could not start: ${error.message}`));
        });
        process.on('close', code => {
            if (code === 0) {
                finish();
            } else {
                const detail = stderr.trim().split('\n').pop() || 'unknown ffmpeg error';
                finish(new VideoFrameExtractionError(`Video could not be decoded: ${detail}`));
            }
        });

        process.stdin.on('error', error => {
            finish(new VideoFrameExtractionError(`Failed to provide video data to ffmpeg: ${error.message}`));
        });
        process.stdin.end(videoData);
    });
}
