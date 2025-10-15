import React, { useEffect, useRef, useState } from 'react';
import { Container, Button, Alert, Card, Modal } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';

function Terminal() {
  const terminalRef = useRef(null);
  const [terminal, setTerminal] = useState(null);
  const [websocket, setWebsocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState('Connecting...');
  const [sessionData, setSessionData] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    
    // Load xterm.js dependencies
    const loadXterm = async () => {
      try {
        if (window.Terminal && window.FitAddon) {
          if (mounted) {
            initializeTerminal();
          }
          return;
        }

        // Load CSS
        if (!document.querySelector('link[href*="xterm.css"]')) {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = 'https://cdn.jsdelivr.net/npm/xterm@5.3.0/css/xterm.css';
          document.head.appendChild(link);
        }

        // Load xterm.js
        await loadScript('https://cdn.jsdelivr.net/npm/xterm@5.3.0/lib/xterm.js');
        await loadScript('https://cdn.jsdelivr.net/npm/xterm-addon-fit@0.8.0/lib/xterm-addon-fit.js');
        
        if (mounted) {
          initializeTerminal();
        }
      } catch (error) {
        console.error('Failed to load xterm.js:', error);
        setStatus('Failed to load terminal');
        setIsLoading(false);
      }
    };

    const loadScript = (src) => {
      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    };

    loadXterm();

    return () => {
      mounted = false;
      if (websocket) {
        websocket.close();
      }
      if (terminal) {
        terminal.dispose();
      }
    };
  }, []);

  const initializeTerminal = () => {
    if (!window.Terminal || !window.FitAddon) {
      console.error('Terminal libraries not loaded');
      return;
    }

    try {
      const term = new window.Terminal({
        cursorBlink: true,
        cursorStyle: 'block',
        fontSize: 14,
        fontFamily: 'Consolas, "Courier New", monospace',
        theme: {
          background: '#000000',
          foreground: '#ffffff',
          cursor: '#ffffff',
          selection: '#ffffff20',
          black: '#000000',
          red: '#ff5555',
          green: '#50fa7b',
          yellow: '#f1fa8c',
          blue: '#bd93f9',
          magenta: '#ff79c6',
          cyan: '#8be9fd',
          white: '#f8f8f2',
          brightBlack: '#44475a',
          brightRed: '#ff5555',
          brightGreen: '#50fa7b',
          brightYellow: '#f1fa8c',
          brightBlue: '#bd93f9',
          brightMagenta: '#ff79c6',
          brightCyan: '#8be9fd',
          brightWhite: '#ffffff'
        },
        cols: 80,
        rows: 24,
        scrollback: 1000
      });

      // Add fit addon
      const fitAddon = new window.FitAddon.FitAddon();
      term.loadAddon(fitAddon);

      // Open terminal
      if (terminalRef.current) {
        term.open(terminalRef.current);
        setTimeout(() => {
          fitAddon.fit();
        }, 100);
      }

      setTerminal(term);
      setIsLoading(false);

      // Connect WebSocket after terminal is ready
      setTimeout(() => {
        connectWebSocket(term, fitAddon);
      }, 200);

    } catch (error) {
      console.error('Failed to initialize terminal:', error);
      setStatus('Failed to initialize terminal');
      setIsLoading(false);
    }
  };

  const connectWebSocket = (term, fitAddon) => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.hostname}:3000/terminal`;
    
    console.log('Connecting to WebSocket:', wsUrl);
    
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      setStatus('Connected');
      setWebsocket(ws);
      
      // Send welcome message
      term.writeln('\x1b[32m✅ Terminal connected successfully!\x1b[0m');
      term.writeln('\x1b[36mType "python3 login_dasar.py" to start Telegram login\x1b[0m');
      term.writeln('');
      
      // Setup input handler
      term.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'input',
            data: data
          }));
        }
      });
      
      // Setup resize handler
      const handleResize = () => {
        if (fitAddon) {
          fitAddon.fit();
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'resize',
              cols: term.cols,
              rows: term.rows
            }));
          }
        }
      };
      
      window.addEventListener('resize', handleResize);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleMessage(message, term);
      } catch (error) {
        // If not JSON, treat as raw data
        term.write(event.data);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
      setStatus('Disconnected');
      term.writeln('\r\n\x1b[31m❌ Connection lost. Attempting to reconnect...\x1b[0m');
      
      // Auto-reconnect after 3 seconds
      setTimeout(() => {
        if (!isConnected) {
          connectWebSocket(term, fitAddon);
        }
      }, 3000);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setStatus('Connection Error');
      term.writeln('\r\n\x1b[31m❌ Connection error\x1b[0m');
    };
  };

  const handleMessage = (message, term) => {
    switch (message.type) {
      case 'output':
        term.write(message.data);
        
        // Check for session string in output
        const output = message.data;
        if (output.includes('Session String:')) {
          const sessionMatch = output.match(/Session String:\s*([^\r\n]+)/);
          if (sessionMatch) {
            const sessionString = sessionMatch[1].trim();
            setSessionData({ session_string: sessionString });
          }
        }
        
        // Check for user info
        if (output.includes('User(') && sessionData?.session_string) {
          // Parse user info from output
          setTimeout(() => {
            setShowSuccessModal(true);
          }, 1000);
        }
        break;

      case 'exit':
        term.write(`\r\n\x1b[31m[Process exited with code ${message.data.code}]\x1b[0m\r\n`);
        break;

      default:
        console.log('Unknown message type:', message.type);
    }
  };

  const sendCommand = (command) => {
    if (websocket && websocket.readyState === WebSocket.OPEN) {
      websocket.send(JSON.stringify({
        type: 'input',
        data: command + '\r'
      }));
    }
  };

  const runTelegramLogin = () => {
    sendCommand('python3 login_dasar.py');
  };

  const handleBackToSessions = () => {
    navigate('/sessions');
  };

  const handleSaveSession = () => {
    if (sessionData?.session_string) {
      // Navigate back to sessions with session string
      navigate('/sessions', { 
        state: { 
          newSessionString: sessionData.session_string,
          autoFill: true 
        } 
      });
    }
  };

  if (isLoading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh', backgroundColor: '#000' }}>
        <div className="text-center text-white">
          <div className="spinner-border text-light mb-3" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p>Loading Terminal...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      height: '100vh', 
      backgroundColor: '#000', 
      display: 'flex', 
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Simple Header */}
      <div style={{
        backgroundColor: '#1a1a1a',
        padding: '10px 20px',
        borderBottom: '1px solid #333',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ color: '#fff', fontSize: '16px', fontWeight: 'bold' }}>
          🔐 Telegram Login Terminal
          <span style={{ 
            marginLeft: '15px', 
            fontSize: '12px', 
            color: isConnected ? '#50fa7b' : '#ff5555' 
          }}>
            ● {status}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={runTelegramLogin}
            disabled={!isConnected}
            style={{
              backgroundColor: isConnected ? '#50fa7b' : '#666',
              color: '#000',
              border: 'none',
              padding: '5px 15px',
              borderRadius: '4px',
              cursor: isConnected ? 'pointer' : 'not-allowed',
              fontSize: '12px',
              fontWeight: 'bold'
            }}
          >
            📱 Start Login
          </button>
          <button
            onClick={handleBackToSessions}
            style={{
              backgroundColor: '#ff5555',
              color: '#fff',
              border: 'none',
              padding: '5px 15px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 'bold'
            }}
          >
            ← Back to Sessions
          </button>
        </div>
      </div>

      {/* Terminal Container */}
      <div style={{ 
        flex: 1, 
        backgroundColor: '#000',
        padding: '10px',
        overflow: 'hidden'
      }}>
        <div 
          ref={terminalRef} 
          style={{ 
            height: '100%',
            width: '100%',
            backgroundColor: '#000'
          }}
        />
      </div>

      {/* Success Modal */}
      <Modal show={showSuccessModal} onHide={() => setShowSuccessModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>🎉 Session Created Successfully!</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="success" className="mb-3">
            <strong>✅ Login Successful!</strong><br />
            Your Telegram session string has been generated successfully.
          </Alert>
          
          {sessionData?.session_string && (
            <div>
              <h6>Session String:</h6>
              <div 
                className="p-3 bg-light border rounded font-monospace small text-break"
                style={{ maxHeight: '150px', overflowY: 'auto' }}
              >
                {sessionData.session_string}
              </div>
            </div>
          )}
          
          <p className="mt-3 mb-0">
            Click "Save to Sessions" to add this session to your account list.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setShowSuccessModal(false)}>
            Stay in Terminal
          </Button>
          <Button variant="primary" onClick={handleSaveSession}>
            Save to Sessions
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default Terminal;
