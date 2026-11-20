import React from 'react';
import { Pause, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { AGRO_STAGES } from './agroStages';
import { useLanguage } from '@/lib/LanguageContext';

interface AgroScrubberControlsProps {
  progress: number;
  currentStage: number;
  isPlaying: boolean;
  audioMuted: boolean;
  onTogglePlay: () => void;
  onRestart: () => void;
  onToggleAudio: () => void;
  onScrub: (value: number) => void;
  onJump: (stage: number) => void;
}

const SMALL_BUTTON = 'h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-md bg-white/[0.06] hover:bg-white/[0.12] text-white';

/** Play, restart, sound, the timeline slider and one button per step. */
export function AgroScrubberControls({
  progress, currentStage, isPlaying, audioMuted, onTogglePlay, onRestart, onToggleAudio, onScrub, onJump,
}: AgroScrubberControlsProps) {
  const { t } = useLanguage();
  return (
    <div
      role="group"
      aria-label={t('ui_agro_ecosystem_canvas_scrubber_scrub_timeline', { defaultValue: 'Through the season' })}
      className="absolute bottom-3 start-3 end-3 bg-[#0d1a14]/85 border border-white/[0.1] px-3 py-2 rounded-lg flex flex-col gap-2 z-20"
    >
      <div className="flex items-center gap-1.5">
        <button type="button" onClick={onTogglePlay} aria-label={isPlaying ? t('scrubber_pause', { defaultValue: 'Pause' }) : t('scrubber_play', { defaultValue: 'Play' })} className={SMALL_BUTTON}>
          {isPlaying ? <Pause className="w-3.5 h-3.5" aria-hidden="true" /> : <Play className="w-3.5 h-3.5" aria-hidden="true" />}
        </button>
        <button type="button" onClick={onRestart} aria-label={t('scrubber_restart', { defaultValue: 'Back to the start' })} className={SMALL_BUTTON}>
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onToggleAudio}
          aria-pressed={!audioMuted}
          aria-label={audioMuted ? t('scrubber_sound_on', { defaultValue: 'Turn sound on' }) : t('scrubber_sound_off', { defaultValue: 'Turn sound off' })}
          className={SMALL_BUTTON}
        >
          {audioMuted ? <VolumeX className="w-3.5 h-3.5" aria-hidden="true" /> : <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />}
        </button>
        <div className="grid grid-cols-4 gap-1 flex-1 ms-1">
          {AGRO_STAGES.map(s => (
            <button
              key={s.id}
              type="button"
              aria-label={`Jump to ${s.title}`}
              aria-pressed={currentStage === s.id}
              onClick={() => onJump(s.id)}
              className={`text-xs h-8 px-1 rounded-md text-center truncate ${
                currentStage === s.id ? 'bg-emerald-400/[0.18] text-emerald-50 font-medium' : 'text-white/70 hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              {s.short}
            </button>
          ))}
        </div>
      </div>
      <input
        type="range"
        min="0"
        max="1"
        step="0.001"
        aria-label={t('scrubber_timeline', { defaultValue: 'Season timeline' })}
        value={progress}
        onChange={e => onScrub(parseFloat(e.target.value))}
        className="w-full h-1 rounded-lg appearance-none cursor-pointer accent-emerald-500 bg-white/[0.12]"
      />
    </div>
  );
}
