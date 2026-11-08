import { execFileSync, spawnSync } from 'child_process';
import { mkdtemp, readFile, rm } from 'fs/promises';
import os from 'os';
import path from 'path';
import { extractVideoFrames } from '../services/aiProvider/videoFrameService';
import { BaseAIProvider } from '../services/aiProvider/types';

const hasFfmpeg = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0;

class TestVisionProvider extends BaseAIProvider {
    readonly provider = 'openai' as const;
    readonly capabilities = ['vision'];
    readonly analyzeImage = jest.fn().mockResolvedValue({
        analysis: '{"observations":["yellow leaves"]}', model: 'test',
    });
}

(hasFfmpeg ? describe : describe.skip)('real video frame extraction', () => {
    it('decodes an ordinary MP4 and returns real JPEG frames', async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), 'video-test-'));
        const file = path.join(dir, 'sample.mp4');
        try {
            execFileSync('ffmpeg', ['-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=640x480:rate=15:duration=4',
                '-c:v', 'mpeg4', '-q:v', '3', '-y', file]);
            const video = await readFile(file);
            expect(video.length).toBeGreaterThan(64 * 1024);
            const frames = await extractVideoFrames(video, { maxFrames: 2, frameInterval: 1 });
            expect(frames).toHaveLength(2);
            expect(frames.every(frame => frame[0] === 0xff && frame[1] === 0xd8)).toBe(true);
            const provider = new TestVisionProvider();
            const result = await provider.analyzeVideo(video, 'Describe observed features', { maxFrames: 2, frameInterval: 1 });
            expect(result.framesAnalyzed).toBe(2);
            expect(provider.analyzeImage).toHaveBeenCalledTimes(2);
            expect(result.analysis).toContain('Frame 2: {"observations":["yellow leaves"]}');
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it.each([
        ['mov', 'mpeg4'],
        ['webm', 'libvpx'],
    ])('decodes an ordinary %s video', async (extension, codec) => {
        const dir = await mkdtemp(path.join(os.tmpdir(), 'video-test-'));
        const file = path.join(dir, `sample.${extension}`);
        try {
            execFileSync('ffmpeg', ['-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=128x128:rate=5:duration=2',
                '-c:v', codec, '-y', file]);
            const frames = await extractVideoFrames(await readFile(file), { maxFrames: 1, frameInterval: 1 });
            expect(frames).toHaveLength(1);
            expect(frames[0].subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it('rejects invalid video rather than returning an analysis', async () => {
        await expect(extractVideoFrames(Buffer.from("ffconcat version 1.0\nfile '/etc/passwd'\n")))
            .rejects.toThrow('Unsupported video format');
    });
});
