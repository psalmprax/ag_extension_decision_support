import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { playStageChime, playScrubTick, isAudioEnabled, setAudioMuted } from '@/lib/audioHaptics';
import { ADVICE_LINES, AGRO_STAGES, type AgroStageMeta } from './agroStages';
import { AgroScrubberControls } from './AgroScrubberControls';
import { useLanguage } from '@/lib/LanguageContext';
import { ThreeViewport } from '@/components/three/ThreeViewport';
import { useThreeScene, type SceneFactory } from '@/components/three/useThreeScene';
import { prefersReducedMotion } from '@/components/three/webgl';
import type { AgroStoryParams } from '@/components/three/scenes/agroStoryScene';

export { type AgroStageMeta };

export interface AgroEcosystemCanvasScrubberProps {
  /** Scroll or manual progress value (0.0 to 1.0) */
  progress?: number;
  /** Callback when progress value changes (0.0 to 1.0) */
  onProgressChange?: (progress: number) => void;
  /** Callback when stage changes (0: weather, 1: crop greenness, 2: soil, 3: advice) */
  onStageChange?: (stage: number) => void;
  /** Whether to show the play/scrub controls */
  showControls?: boolean;
  /** Optional interactive mode */
  interactive?: boolean;
  /** Whether to play through the season on its own */
  autoPlay?: boolean;
  className?: string;
}


const clamp01 = (value: number) => (Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0);
const loadStory = () => import('@/components/three/scenes/agroStoryScene').then(m => m.createAgroStoryScene as unknown as SceneFactory<AgroStoryParams>);

/**
 * One maize field through the season, in 3D: weather from satellite, crop greenness,
 * soil layers and moisture, and an advisory reaching the farmer by SMS. An illustration,
 * not live data, and labelled as such.
 */
export function AgroEcosystemCanvasScrubber({
  progress: externalProgress,
  onProgressChange,
  onStageChange,
  showControls = true,
  interactive = false,
  autoPlay,
  className = '',
}: AgroEcosystemCanvasScrubberProps) {
  const { t } = useLanguage();
  const [progress, setProgress] = useState(clamp01(externalProgress ?? 0));
  const shouldAutoPlay = (autoPlay !== undefined ? autoPlay : !showControls || interactive) && !prefersReducedMotion();
  const [isPlaying, setIsPlaying] = useState(shouldAutoPlay);
  const [audioMuted, setLocalAudioMuted] = useState(!isAudioEnabled());
  const previousStage = useRef(-1);

  useEffect(() => {
    if (externalProgress !== undefined) setProgress(clamp01(externalProgress));
  }, [externalProgress]);

  const currentStage = Math.min(AGRO_STAGES.length - 1, Math.floor(clamp01(progress) * AGRO_STAGES.length));

  const update = useCallback(
    (next: number) => {
      const value = clamp01(next);
      setProgress(value);
      onProgressChange?.(value);
    },
    [onProgressChange]
  );

  useEffect(() => {
    onStageChange?.(currentStage);
    if (previousStage.current !== -1 && previousStage.current !== currentStage && !isPlaying) playStageChime(currentStage);
    previousStage.current = currentStage;
  }, [currentStage, onStageChange, isPlaying]);

  // Plays through the season in about 25 seconds, then starts again.
  useEffect(() => {
    if (!isPlaying) return undefined;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const delta = (now - last) / 1000;
      last = now;
      setProgress(previous => {
        const next = (previous + delta * 0.04) % 1;
        onProgressChange?.(next);
        return next;
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isPlaying, onProgressChange]);

  const labels = useMemo<AgroStoryParams['labels']>(
    () => ({
      topsoil: t('story_topsoil', { defaultValue: 'Topsoil' }),
      subsoil: t('story_subsoil', { defaultValue: 'Subsoil' }),
      clay: t('story_clay', { defaultValue: 'Clay' }),
      moisture: t('story_moisture', { defaultValue: 'Holds most of the water roots reach' }),
      sms: [t('story_sms_title', { defaultValue: 'SMS to the farmer' }), ...ADVICE_LINES],
    }),
    [t]
  );
  const params = useMemo(() => ({ progress, labels }), [progress, labels]);
  const { containerRef, status } = useThreeScene(loadStory, params);
  const stage = AGRO_STAGES[currentStage];
  const Icon = stage.icon;

  return (
    <div className={`relative w-full h-full min-h-[360px] rounded-lg overflow-hidden border border-white/[0.08] bg-[#0d1a14] select-none ${className}`}>
      <ThreeViewport
        containerRef={containerRef}
        status={status}
        label={`${stage.badge}: ${stage.title}. ${stage.subtitle}.`}
        loadingText={t('story_loading', { defaultValue: 'Loading the field…' })}
        fallback={<p className="text-sm text-[#c5d3cb] max-w-xs">{stage.subtitle}.</p>}
        className="absolute inset-0"
      />
      <div className="absolute top-3 start-3 end-3 flex items-start justify-between gap-2 pointer-events-none">
        <div className="flex items-center gap-3 bg-[#0d1a14]/90 border border-white/[0.1] px-3 py-2 rounded-lg">
          <Icon className="w-4 h-4 text-[#c5d3cb]" aria-hidden="true" />
          <div>
            <div className="text-xs text-white/70">{stage.badge}</div>
            <div className="text-sm font-medium text-white">{stage.title}</div>
          </div>
        </div>
        <div className="hidden sm:block bg-[#0d1a14]/90 border border-white/[0.1] px-3 py-1.5 rounded-md text-xs text-[#c5d3cb]">
          {t('ui_agro_ecosystem_canvas_scrubber_illustration_only', { defaultValue: 'Illustration, not live data' })}
        </div>
      </div>
      {status !== 'ready' && currentStage === 3 && (
        <ul className="absolute end-3 top-20 bg-[#0d1a14]/90 border border-white/[0.1] px-3 py-2 rounded-md text-xs text-[#c5d3cb]" aria-label={labels.sms[0]}>
          {ADVICE_LINES.map(line => <li key={line}>{line}</li>)}
        </ul>
      )}
      {showControls && (
        <AgroScrubberControls
          progress={progress}
          currentStage={currentStage}
          isPlaying={isPlaying}
          audioMuted={audioMuted}
          onTogglePlay={() => setIsPlaying(playing => !playing)}
          onRestart={() => {
            update(0);
            playScrubTick();
          }}
          onToggleAudio={() => {
            const next = !audioMuted;
            setLocalAudioMuted(next);
            setAudioMuted(next);
            if (!next) playStageChime(currentStage);
          }}
          onScrub={value => {
            update(value);
            playScrubTick();
          }}
          onJump={stageId => {
            update(stageId * 0.25 + 0.08);
            playStageChime(stageId);
          }}
        />
      )}
    </div>
  );
}

export default AgroEcosystemCanvasScrubber;
