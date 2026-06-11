import { useState } from 'react';
import { REACTIONS, KEYBOARD_SHORTCUTS } from '../utils/constants';

export default function ControlBar({
  isMuted,
  onToggleMute,
  isScreenSharing,
  onToggleScreenShare,
  onToggleChat,
  isChatOpen,
  onToggleVoice,
  isVoiceOpen,
  onReaction,
  onLeave,
}) {
  const [showReactions, setShowReactions] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  return (
    <div className="bg-bg-secondary border-t border-border px-4 py-3 relative">
      <div className="flex items-center justify-center gap-2">
        {/* Mute */}
        <button
          onClick={onToggleMute}
          data-tooltip={`${isMuted ? 'Unmute' : 'Mute'} (${KEYBOARD_SHORTCUTS.MUTE.toUpperCase()})`}
          className={`
            w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200
            ${isMuted
              ? 'bg-danger hover:bg-danger-hover text-white'
              : 'bg-bg-tertiary hover:bg-border-light text-text-primary'
            }
          `}
        >
          {isMuted ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="1" y1="1" x2="23" y2="23" />
              <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
              <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .5-.05 1-.15 1.47" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          )}
        </button>

        {/* Screen Share */}
        <button
          onClick={onToggleScreenShare}
          data-tooltip={`${isScreenSharing ? 'Stop sharing' : 'Share screen'} (${KEYBOARD_SHORTCUTS.SCREEN_SHARE.toUpperCase()})`}
          className={`
            w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200
            ${isScreenSharing
              ? 'bg-accent hover:bg-accent-hover text-white'
              : 'bg-bg-tertiary hover:bg-border-light text-text-primary'
            }
          `}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
        </button>

        {/* Reactions */}
        <div className="relative">
          <button
            onClick={() => setShowReactions(!showReactions)}
            data-tooltip="Reactions"
            className="w-12 h-12 rounded-full flex items-center justify-center bg-bg-tertiary hover:bg-border-light text-text-primary transition-all duration-200"
          >
            <span className="text-xl">😀</span>
          </button>
          {showReactions && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-bg-surface border border-border rounded-xl px-2 py-1.5 flex gap-1 animate-slide-up shadow-lg">
              {REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    onReaction(emoji);
                    setShowReactions(false);
                  }}
                  className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-bg-tertiary transition-colors text-lg hover:scale-125 transform duration-150"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Chat */}
        <button
          onClick={onToggleChat}
          data-tooltip={`Chat (${KEYBOARD_SHORTCUTS.CHAT.toUpperCase()})`}
          className={`
            w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200
            ${isChatOpen
              ? 'bg-accent hover:bg-accent-hover text-white'
              : 'bg-bg-tertiary hover:bg-border-light text-text-primary'
            }
          `}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>

        {/* Voice Controls */}
        <button
          onClick={onToggleVoice}
          data-tooltip={`Voice Mask (${KEYBOARD_SHORTCUTS.VOICE.toUpperCase()})`}
          className={`
            w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200
            ${isVoiceOpen
              ? 'bg-accent-secondary hover:bg-accent text-white'
              : 'bg-bg-tertiary hover:bg-border-light text-text-primary'
            }
          `}
        >
          <span className="text-xl">🎭</span>
        </button>

        {/* Divider */}
        <div className="w-px h-8 bg-border mx-1" />

        {/* Leave */}
        <div className="relative">
          <button
            onClick={() => setShowLeaveConfirm(!showLeaveConfirm)}
            data-tooltip="Leave room"
            className="w-12 h-12 rounded-full flex items-center justify-center bg-danger/20 hover:bg-danger text-danger hover:text-white transition-all duration-200"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
          {showLeaveConfirm && (
            <div className="absolute bottom-full right-0 mb-2 bg-bg-surface border border-border rounded-xl p-4 animate-slide-up shadow-lg w-56">
              <p className="text-sm text-text-primary mb-3">Leave this room?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowLeaveConfirm(false)}
                  className="flex-1 px-3 py-2 text-xs bg-bg-tertiary hover:bg-border-light text-text-primary rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={onLeave}
                  className="flex-1 px-3 py-2 text-xs bg-danger hover:bg-danger-hover text-white rounded-lg transition-colors"
                >
                  Leave
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
