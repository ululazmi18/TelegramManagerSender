import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

function SimpleTerminal() {
  const terminalRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState('Connecting...');
  const [sessionString, setSessionString] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Load XTerm.js and initialize terminal
    loadTerminal();
  }, []);

  const loadTerminal = () => {
    // Load CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdn.jsdelivr.net/npm/xterm@5.3.0/css/xterm.css';
    document.head.appendChild(link);

    // Load XTerm.js
    const script1 = document.createElement('script');
    script1.src = 'https://cdn.jsdelivr.net/npm/xterm@5.3.0/lib/xterm.js';
    script1.onload = () => {
      // Load Fit Addon
      const script2 = document.createElement('script');
      script2.src = 'https://cdn.jsdelivr.net/npm/xterm-addon-fit@0.8.0/lib/xterm-addon-fit.js';
      script2.onload = initTerminal;
      document.head.appendChild(script2);
    };
    document.head.appendChild(script1);
  };

  const initTerminal = () => {
    if (!window.Terminal || !window.FitAddon) {
      console.error('XTerm.js not loaded');
      return;
    }

    // Create terminal
    const terminal = new window.Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Consolas, monospace',
      theme: {
        background: '#000000',
        foreground: '#ffffff',
        cursor: '#ffffff'
      },
      cols: 80,
      rows: 24
    });

    // Create fit addon
    const fitAddon = new window.FitAddon.FitAddon();
    terminal.loadAddon(fitAddon);

    // Open terminal
    terminal.open(terminalRef.current);
    fitAddon.fit();

    // Connect WebSocket
    connectWebSocket(terminal);

    // Handle window resize
    window.addEventListener('resize', () => {
      fitAddon.fit();
    });
  };

  const connectWebSocket = (terminal) => {
    const wsUrl = 'ws://localhost:3000/terminal';
    console.log('Connecting to:', wsUrl);
    
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      setStatus('Connected');
      
      terminal.writeln('✅ Terminal connected!');
      terminal.writeln('Type "python3 login_dasar.py" to start Telegram login');
      terminal.write('$ ');

      // Handle terminal input
      terminal.onData((data) => {
        console.log('Sending data:', data);
        ws.send(JSON.stringify({
          type: 'input',
          data: data
        }));
      });
    };

    ws.onmessage = (event) => {
      console.log('Received:', event.data);
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'output') {
          terminal.write(message.data);
          
          // Check for session string
          if (message.data.includes('Session String:')) {
            const match = message.data.match(/Session String:\s*([^\r\n]+)/);
            if (match) {
              setSessionString(match[1].trim());
              setTimeout(() => setShowSuccess(true), 1000);
            }
          }
        }
      } catch (e) {
        // Treat as raw data
        terminal.write(event.data);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
      setStatus('Disconnected');
      terminal.writeln('\r\n❌ Connection lost');
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setStatus('Error');
    };
  };

  const handleBackToSessions = () => {
    navigate('/sessions');
  };

  const handleSaveSession = () => {
    if (sessionString) {
      navigate('/sessions', {
        state: {
          newSessionString: sessionString,
          autoFill: true
        }
      });
    }
  };

  return (
    <div style={{ 
      height: '100vh', 
      backgroundColor: '#000', 
      display: 'flex', 
      flexDirection: 'column',
      fontFamily: 'monospace'
    }}>
      {/* Header */}
      <div style={{
        backgroundColor: '#1a1a1a',
        padding: '10px 20px',
        borderBottom: '1px solid #333',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        color: '#fff'
      }}>
        <div>
          🔐 Telegram Login Terminal
          <span style={{ 
            marginLeft: '15px', 
            fontSize: '12px',
            color: isConnected ? '#0f0' : '#f00'
          }}>
            ● {status}
          </span>
        </div>
        <button
          onClick={handleBackToSessions}
          style={{
            backgroundColor: '#ff5555',
            color: '#fff',
            border: 'none',
            padding: '5px 15px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          ← Back to Sessions
        </button>
      </div>

      {/* Terminal */}
      <div style={{ 
        flex: 1, 
        backgroundColor: '#000',
        padding: '10px'
      }}>
        <div 
          ref={terminalRef} 
          style={{ 
            height: '100%',
            width: '100%'
          }}
        />
      </div>

      {/* Success Modal */}
      {showSuccess && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.8)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#fff',
            padding: '20px',
            borderRadius: '8px',
            maxWidth: '500px',
            width: '90%'
          }}>
            <h3>🎉 Session Created Successfully!</h3>
            <p>Your Telegram session string has been generated.</p>
            <div style={{
              backgroundColor: '#f5f5f5',
              padding: '10px',
              borderRadius: '4px',
              fontFamily: 'monospace',
              fontSize: '12px',
              wordBreak: 'break-all',
              maxHeight: '100px',
              overflow: 'auto',
              marginBottom: '15px'
            }}>
              {sessionString}
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowSuccess(false)}
                style={{
                  backgroundColor: '#6c757d',
                  color: '#fff',
                  border: 'none',
                  padding: '8px 15px',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Stay in Terminal
              </button>
              <button
                onClick={handleSaveSession}
                style={{
                  backgroundColor: '#007bff',
                  color: '#fff',
                  border: 'none',
                  padding: '8px 15px',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Save to Sessions
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SimpleTerminal;
