import { useEffect, useRef } from 'react';

export default function ScreenShare({ stream, sharerName, isLocal, onStopSharing }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  if (!stream) return null;

  return (
    <div className="relative bg-black rounded-xl overflow-hidden animate-fade-in border border-border">
      {/* Sharer indicator */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2 bg-bg-primary/80 backdrop-blur-sm px-3 py-1.5 rounded-lg">
        <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
        <span className="text-xs text-text-primary font-medium">
          {isLocal ? 'You are sharing your screen' : `${sharerName} is sharing`}
        </span>
      </div>

      {/* Stop button for local share */}
      {isLocal && (
        <button
          onClick={onStopSharing}
          className="absolute top-3 right-3 z-10 bg-danger hover:bg-danger-hover text-white text-xs px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="6" width="12" height="12" rx="1" />
          </svg>
          Stop Sharing
        </button>
      )}

      {/* Video element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className="w-full h-full object-contain max-h-[60vh]"
      />
    </div>
  );
}
