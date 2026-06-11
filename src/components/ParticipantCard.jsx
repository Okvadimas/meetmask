import { useState, useEffect, useRef } from 'react';

export default function ParticipantCard({ name, color, isSpeaking, isMuted, isLocal, audioLevel }) {
  const initial = name ? name.split(' ').map((w) => w[0]).join('') : '?';
  const [showPulse, setShowPulse] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    if (isSpeaking && !isMuted) {
      setShowPulse(true);
    } else {
      setShowPulse(false);
    }
  }, [isSpeaking, isMuted]);

  return (
    <div className="flex flex-col items-center gap-2 animate-fade-in">
      {/* Avatar */}
      <div className="relative">
        <div
          className={`
            w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold
            transition-all duration-300 select-none
            ${showPulse ? 'animate-speaking' : ''}
          `}
          style={{
            backgroundColor: color + '20',
            border: `3px solid ${showPulse ? '#22c55e' : color}`,
            color: color,
            boxShadow: showPulse
              ? `0 0 20px ${color}40, 0 0 40px ${color}20`
              : `0 0 10px ${color}15`,
          }}
        >
          {initial}
        </div>

        {/* Mute indicator */}
        {isMuted && (
          <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-danger rounded-full flex items-center justify-center shadow-md animate-fade-in">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <line x1="1" y1="1" x2="23" y2="23" />
              <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
              <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .5-.05 1-.15 1.47" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </div>
        )}

        {/* Audio level ring */}
        {!isMuted && audioLevel > 0.05 && (
          <div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              border: `2px solid ${color}`,
              opacity: Math.min(audioLevel * 5, 0.8),
              transform: `scale(${1 + audioLevel * 0.4})`,
              transition: 'transform 0.1s ease, opacity 0.1s ease',
            }}
          />
        )}
      </div>

      {/* Name */}
      <div className="text-center">
        <p className="text-sm font-medium text-text-primary truncate max-w-24" style={{ color }}>
          {name}
        </p>
        {isLocal && (
          <p className="text-xs text-text-muted">(You)</p>
        )}
      </div>
    </div>
  );
}
