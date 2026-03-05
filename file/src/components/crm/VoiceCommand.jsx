'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Icon } from '@iconify/react/dist/iconify.js';
import { usePathname, useRouter } from 'next/navigation';
import { toast } from 'react-toastify';

const VoiceCommand = () => {
  const [state, setState] = useState('idle'); // idle | listening | processing | confirming | textInput
  const [transcript, setTranscript] = useState('');
  const [pendingAction, setPendingAction] = useState(null);
  const [commandHistory, setCommandHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [speechSupported, setSpeechSupported] = useState(false);

  const recognitionRef = useRef(null);
  const transcriptRef = useRef('');
  const pathname = usePathname();
  const router = useRouter();

  // Check for speech recognition support
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSpeechSupported(!!SR);
  }, []);

  // Keyboard shortcut: Ctrl+Shift+V
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'V') {
        e.preventDefault();
        if (state === 'idle') {
          if (speechSupported) {
            startListening();
          } else {
            setState('textInput');
          }
        } else if (state === 'listening') {
          stopListening();
        }
      }
      if (e.key === 'Escape') {
        if (state === 'confirming') {
          setState('idle');
          setPendingAction(null);
        } else if (state === 'textInput') {
          setState('idle');
          setTextInput('');
        } else if (state === 'listening') {
          stopListening();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state, speechSupported]);

  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setState('listening');
      setTranscript('');
      transcriptRef.current = '';
    };

    recognition.onresult = (event) => {
      let finalText = '';
      for (let i = 0; i < event.results.length; i++) {
        finalText += event.results[i][0].transcript;
      }
      setTranscript(finalText);
      transcriptRef.current = finalText;
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      const finalText = transcriptRef.current.trim();
      if (finalText) {
        processCommand(finalText);
      } else {
        setState('idle');
      }
    };

    recognition.onerror = (event) => {
      recognitionRef.current = null;
      if (event.error === 'no-speech') {
        toast.info('No speech detected. Try again.');
      } else if (event.error !== 'aborted') {
        toast.error(`Speech recognition error: ${event.error}`);
      }
      setState('idle');
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  const processCommand = async (text) => {
    setState('processing');
    setTranscript(text);

    try {
      const res = await fetch('/api/voice/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, context: { currentPage: pathname } }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Voice command failed');
        setState('idle');
        addToHistory(text, 'error', data.error);
        return;
      }

      if (!data.understood) {
        toast.warning(data.confirmMessage || "I didn't understand that command.");
        setState('idle');
        addToHistory(text, 'not_understood', data.confirmMessage);
        return;
      }

      // Query executed immediately (result included)
      if (data.result) {
        if (data.result.navigate) {
          router.push(data.result.navigate);
          toast.success(data.result.message);
        } else if (data.result.success) {
          toast.success(data.result.message);
        } else if (data.result.error) {
          toast.error(data.result.error);
        }
        addToHistory(text, data.result.success ? 'success' : 'error', data.result.message || data.result.error);
        setState('idle');
        return;
      }

      // Mutation requires confirmation
      if (data.requiresConfirmation) {
        setPendingAction(data);
        setState('confirming');
        addToHistory(text, 'pending', data.confirmMessage);
        return;
      }

      setState('idle');
    } catch (err) {
      toast.error('Failed to process voice command');
      setState('idle');
      addToHistory(text, 'error', err.message);
    }
  };

  const confirmAction = async () => {
    if (!pendingAction) return;
    setState('processing');

    try {
      const res = await fetch('/api/voice/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'execute',
          action: pendingAction.action,
          params: pendingAction.params,
        }),
      });

      const data = await res.json();

      if (data.navigate) {
        router.push(data.navigate);
        toast.success(data.message);
      } else if (data.success) {
        toast.success(data.message);
      } else if (data.error) {
        toast.error(data.error);
      }

      setCommandHistory((prev) => {
        const updated = [...prev];
        if (updated.length > 0) {
          updated[0] = { ...updated[0], status: data.success ? 'success' : 'error', result: data.message || data.error };
        }
        return updated;
      });
    } catch (err) {
      toast.error('Failed to execute action');
    }

    setPendingAction(null);
    setState('idle');
  };

  const cancelAction = () => {
    setPendingAction(null);
    setState('idle');
    setCommandHistory((prev) => {
      const updated = [...prev];
      if (updated.length > 0 && updated[0].status === 'pending') {
        updated[0] = { ...updated[0], status: 'cancelled' };
      }
      return updated;
    });
  };

  const addToHistory = (command, status, result) => {
    setCommandHistory((prev) => [
      { command, status, result, timestamp: new Date() },
      ...prev.slice(0, 4),
    ]);
  };

  const handleTextSubmit = (e) => {
    e.preventDefault();
    if (textInput.trim()) {
      const cmd = textInput.trim();
      setTextInput('');
      processCommand(cmd);
    }
  };

  const handleMicClick = () => {
    if (state === 'listening') {
      stopListening();
    } else if (state === 'idle') {
      if (speechSupported) {
        startListening();
      } else {
        setState('textInput');
      }
    }
  };

  const statusColors = {
    success: '#03FF00',
    error: '#dc3545',
    pending: '#ffc107',
    cancelled: '#6c757d',
    not_understood: '#ffc107',
  };

  const panelStyle = {
    position: 'fixed',
    bottom: 92,
    right: 24,
    zIndex: 1001,
    background: '#1e293b',
    borderRadius: 16,
    padding: '20px 24px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    border: '1px solid rgba(3,255,0,0.2)',
  };

  return (
    <>
      {/* Floating mic button */}
      <button
        onClick={handleMicClick}
        className="d-flex align-items-center justify-content-center border-0 rounded-circle shadow-lg"
        title={speechSupported ? 'Voice Command (Ctrl+Shift+V)' : 'Type Command (Ctrl+Shift+V)'}
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          width: 56,
          height: 56,
          zIndex: 1000,
          background: state === 'listening' ? '#dc3545' : '#033457',
          color: '#fff',
          cursor: 'pointer',
          transition: 'background 0.2s ease',
        }}
      >
        {state === 'processing' ? (
          <span className="spinner-border spinner-border-sm" />
        ) : state === 'listening' ? (
          <Icon icon="mdi:microphone" width={28} />
        ) : (
          <Icon icon={speechSupported ? 'mdi:microphone-outline' : 'mdi:keyboard-outline'} width={24} />
        )}
      </button>

      {/* History toggle */}
      {commandHistory.length > 0 && state === 'idle' && (
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="d-flex align-items-center justify-content-center border-0 rounded-circle shadow"
          style={{
            position: 'fixed',
            bottom: 88,
            right: 24,
            width: 36,
            height: 36,
            zIndex: 1000,
            background: '#1a2332',
            color: '#adb5bd',
            cursor: 'pointer',
          }}
          title="Command History"
        >
          <Icon icon="mdi:history" width={18} />
        </button>
      )}

      {/* Listening panel */}
      {state === 'listening' && (
        <div className="d-flex flex-column align-items-center justify-content-center" style={{ ...panelStyle, minWidth: 280 }}>
          <div className="d-flex align-items-center gap-2 mb-2">
            <span
              className="rounded-circle"
              style={{ width: 8, height: 8, background: '#dc3545', display: 'inline-block' }}
            />
            <span className="text-white fw-medium" style={{ fontSize: 14 }}>Listening...</span>
          </div>
          {transcript && (
            <p className="text-secondary-light mb-0 text-center" style={{ fontSize: 13, maxWidth: 240 }}>
              &ldquo;{transcript}&rdquo;
            </p>
          )}
          <button onClick={stopListening} className="btn btn-sm btn-outline-light mt-3" style={{ fontSize: 12 }}>
            Stop
          </button>
        </div>
      )}

      {/* Processing panel */}
      {state === 'processing' && (
        <div className="d-flex flex-column align-items-center" style={{ ...panelStyle, minWidth: 240 }}>
          <div className="spinner-border spinner-border-sm text-primary mb-2" />
          <span className="text-white" style={{ fontSize: 13 }}>Processing...</span>
          {transcript && (
            <p className="text-secondary-light mb-0 mt-1" style={{ fontSize: 12 }}>
              &ldquo;{transcript}&rdquo;
            </p>
          )}
        </div>
      )}

      {/* Confirmation panel */}
      {state === 'confirming' && pendingAction && (
        <div style={{ ...panelStyle, minWidth: 300, maxWidth: 400, borderColor: 'rgba(255,193,7,0.3)' }}>
          <div className="d-flex align-items-center gap-2 mb-3">
            <Icon icon="mdi:alert-circle-outline" className="text-warning" width={20} />
            <span className="text-white fw-semibold" style={{ fontSize: 14 }}>Confirm Action</span>
          </div>
          <p className="text-secondary-light mb-3" style={{ fontSize: 13 }}>
            {pendingAction.confirmMessage}
          </p>
          <div className="d-flex gap-2">
            <button
              onClick={confirmAction}
              className="btn btn-sm flex-fill"
              style={{ background: '#03FF00', color: '#033457', fontWeight: 600 }}
            >
              Confirm
            </button>
            <button onClick={cancelAction} className="btn btn-sm btn-outline-light flex-fill">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Text input panel */}
      {state === 'textInput' && (
        <div style={{ ...panelStyle, minWidth: 320 }}>
          <div className="d-flex align-items-center justify-content-between mb-3">
            <span className="text-white fw-semibold" style={{ fontSize: 14 }}>Voice Command</span>
            <button
              onClick={() => { setState('idle'); setTextInput(''); }}
              className="bg-transparent border-0 text-secondary-light p-0"
            >
              <Icon icon="radix-icons:cross-2" width={16} />
            </button>
          </div>
          <form onSubmit={handleTextSubmit}>
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder='e.g. "search leads for Acme"'
              className="form-control form-control-sm mb-2"
              style={{ background: '#0f172a', border: '1px solid #334155', color: '#fff' }}
              autoFocus
            />
            <button
              type="submit"
              className="btn btn-sm w-100"
              style={{ background: '#03FF00', color: '#033457', fontWeight: 600 }}
              disabled={!textInput.trim()}
            >
              Run Command
            </button>
          </form>
          <p className="text-secondary-light mt-2 mb-0" style={{ fontSize: 11 }}>
            Try: &ldquo;show pipeline summary&rdquo; or &ldquo;move lead John to contacted&rdquo;
          </p>
        </div>
      )}

      {/* Command history */}
      {showHistory && commandHistory.length > 0 && state === 'idle' && (
        <div
          style={{
            position: 'fixed',
            bottom: 130,
            right: 24,
            zIndex: 999,
            background: '#1e293b',
            borderRadius: 12,
            padding: 16,
            minWidth: 300,
            maxWidth: 380,
            maxHeight: 300,
            overflowY: 'auto',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            border: '1px solid #334155',
          }}
        >
          <div className="d-flex align-items-center justify-content-between mb-2">
            <span className="text-white fw-semibold" style={{ fontSize: 13 }}>Recent Commands</span>
            <button onClick={() => setShowHistory(false)} className="bg-transparent border-0 text-secondary-light p-0">
              <Icon icon="radix-icons:cross-2" width={14} />
            </button>
          </div>
          {commandHistory.map((entry, i) => (
            <div key={i} className="py-2" style={{ borderBottom: i < commandHistory.length - 1 ? '1px solid #334155' : 'none' }}>
              <div className="d-flex align-items-center gap-2">
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: statusColors[entry.status] || '#6c757d',
                    flexShrink: 0,
                    display: 'inline-block',
                  }}
                />
                <span className="text-white fw-medium" style={{ fontSize: 12, lineHeight: 1.3 }}>
                  &ldquo;{entry.command}&rdquo;
                </span>
              </div>
              {entry.result && (
                <p className="text-secondary-light mb-0 mt-1 ps-3" style={{ fontSize: 11 }}>
                  {entry.result}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
};

export default VoiceCommand;
