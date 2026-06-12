import { VOICE_DEFAULTS } from '../utils/constants';

export default function VoiceControls({
  settings,
  onPitchChange,
  onModulationChange,
  onDistortionChange,
  onReset,
  isOpen,
  isSelfListenEnabled = false,
  onSelfListenToggle,
  selfListenVolume = 0.5,
  onSelfListenVolumeChange,
}) {
  if (!isOpen) return null;

  return (
    <div className="bg-bg-secondary border-t border-border animate-slide-up">
      <div className="max-w-2xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <span className="text-lg">🎭</span>
            Voice Mask Controls
          </h3>
          <button
            onClick={onReset}
            className="text-xs text-text-secondary hover:text-accent transition-colors px-3 py-1 rounded-md hover:bg-bg-tertiary"
          >
            Reset to Default
          </button>
        </div>

        <div className="flex flex-col gap-4">
          {/* Pitch Slider */}
          <div className="flex items-center gap-4">
            <label className="text-xs font-medium text-text-secondary w-24 shrink-0">
              Pitch
              <span className="block text-text-muted text-[10px]">
                {settings.pitch < 1 ? 'Deep' : settings.pitch > 1 ? 'High' : 'Normal'}
              </span>
            </label>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.05"
              value={settings.pitch}
              onChange={(e) => onPitchChange(parseFloat(e.target.value))}
              className="flex-1 h-2 rounded-full appearance-none cursor-pointer accent-accent"
              style={{
                background: `linear-gradient(to right, var(--color-accent) 0%, var(--color-accent) ${((settings.pitch - 0.5) / 1.5) * 100}%, var(--color-bg-tertiary) ${((settings.pitch - 0.5) / 1.5) * 100}%, var(--color-bg-tertiary) 100%)`,
              }}
            />
            <span className="text-xs text-text-muted w-12 text-right font-mono">
              {settings.pitch.toFixed(2)}x
            </span>
          </div>

          {/* Modulation Slider */}
          <div className="flex items-center gap-4">
            <label className="text-xs font-medium text-text-secondary w-24 shrink-0">
              Modulation
              <span className="block text-text-muted text-[10px]">
                {settings.modulation === 0 ? 'Off' : settings.modulation < 30 ? 'Subtle' : settings.modulation < 70 ? 'Medium' : 'Heavy'}
              </span>
            </label>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={settings.modulation}
              onChange={(e) => onModulationChange(parseFloat(e.target.value))}
              className="flex-1 h-2 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, var(--color-accent-secondary) 0%, var(--color-accent-secondary) ${settings.modulation}%, var(--color-bg-tertiary) ${settings.modulation}%, var(--color-bg-tertiary) 100%)`,
              }}
            />
            <span className="text-xs text-text-muted w-12 text-right font-mono">
              {settings.modulation}
            </span>
          </div>

          {/* Distortion Slider */}
          <div className="flex items-center gap-4">
            <label className="text-xs font-medium text-text-secondary w-24 shrink-0">
              Distortion
              <span className="block text-text-muted text-[10px]">
                {settings.distortion === 0 ? 'Off' : settings.distortion < 30 ? 'Light' : settings.distortion < 70 ? 'Gritty' : 'Extreme'}
              </span>
            </label>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={settings.distortion}
              onChange={(e) => onDistortionChange(parseFloat(e.target.value))}
              className="flex-1 h-2 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, var(--color-warning) 0%, var(--color-warning) ${settings.distortion}%, var(--color-bg-tertiary) ${settings.distortion}%, var(--color-bg-tertiary) 100%)`,
              }}
            />
            <span className="text-xs text-text-muted w-12 text-right font-mono">
              {settings.distortion}
            </span>
          </div>
        </div>

        {/* Visual indicator */}
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5 items-end h-4">
              {[...Array(12)].map((_, i) => (
                <div
                  key={i}
                  className="w-1 bg-accent rounded-full"
                  style={{
                    height: `${4 + Math.random() * 12 * (settings.pitch + settings.modulation / 100)}px`,
                    opacity: 0.3 + (settings.distortion / 100) * 0.7,
                    animationDelay: `${i * 0.1}s`,
                  }}
                />
              ))}
            </div>
            <span className="text-[10px] text-text-muted">
              {settings.pitch === VOICE_DEFAULTS.pitch && settings.modulation === VOICE_DEFAULTS.modulation && settings.distortion === VOICE_DEFAULTS.distortion
                ? 'No effects applied'
                : 'Voice mask active'}
            </span>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-border/40 my-4" />

        {/* Self-Listen Controls */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-text-primary">Dengarkan Diri Sendiri (Self-Listen)</span>
              <span className="text-[10px] text-text-muted">Dengarkan suara bermasker Anda sendiri secara langsung</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isSelfListenEnabled}
                onChange={(e) => onSelfListenToggle(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-bg-tertiary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-accent"></div>
            </label>
          </div>

          {isSelfListenEnabled && (
            <div className="flex items-center gap-4 animate-fade-in">
              <label className="text-xs font-medium text-text-secondary w-24 shrink-0">
                Volume Suara
                <span className="block text-text-muted text-[10px]">
                  {selfListenVolume === 0 ? 'Mute' : selfListenVolume < 0.3 ? 'Pelan' : selfListenVolume < 0.7 ? 'Sedang' : 'Keras'}
                </span>
              </label>
              <input
                type="range"
                min="0"
                max="1.0"
                step="0.05"
                value={selfListenVolume}
                onChange={(e) => onSelfListenVolumeChange(parseFloat(e.target.value))}
                className="flex-1 h-2 rounded-full appearance-none cursor-pointer accent-accent"
                style={{
                  background: `linear-gradient(to right, var(--color-accent) 0%, var(--color-accent) ${selfListenVolume * 100}%, var(--color-bg-tertiary) ${selfListenVolume * 100}%, var(--color-bg-tertiary) 100%)`,
                }}
              />
              <span className="text-xs text-text-muted w-12 text-right font-mono">
                {Math.round(selfListenVolume * 100)}%
              </span>
            </div>
          )}

          {isSelfListenEnabled && (
            <div className="text-[11px] text-warning bg-warning/5 border border-warning/10 rounded-md p-2.5 flex items-start gap-2">
              <span className="mt-0.5">⚠️</span>
              <span><strong>Penting:</strong> Gunakan headphone atau earphone untuk menghindari suara mendengung/feedback melengking dari speaker Anda.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
