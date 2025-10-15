import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

function CleanTerminal() {
  const terminalRef = useRef(null);
  const terminalInstanceRef = useRef(null);
  const websocketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState('Loading...');
  const [sessionString, setSessionString] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isStarted, setIsStarted] = useState(false);
  const isStartedRef = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Cleanup any existing instances
    cleanup();
    
    // Load terminal after a short delay
    const timer = setTimeout(() => {
      loadAndInitTerminal();
    }, 100);

    // Handle window resize for mobile detection
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
      cleanup();
    };
  }, []);

  const cleanup = () => {
    // Close WebSocket
    if (websocketRef.current) {
      websocketRef.current.close();
      websocketRef.current = null;
    }
    
    // Dispose terminal
    if (terminalInstanceRef.current) {
      terminalInstanceRef.current.dispose();
      terminalInstanceRef.current = null;
    }
    
    // Clear terminal container
    if (terminalRef.current) {
      terminalRef.current.innerHTML = '';
    }
  };

  const loadAndInitTerminal = async () => {
    try {
      // Load XTerm.js if not already loaded
      if (!window.Terminal) {
        await loadXTermLibraries();
      }
      
      // Wait a bit for libraries to be ready
      setTimeout(initTerminal, 200);
    } catch (error) {
      console.error('Failed to load terminal:', error);
      setStatus('Failed to load');
    }
  };

  const loadXTermLibraries = () => {
    return new Promise((resolve, reject) => {
      // Load CSS
      if (!document.querySelector('link[href*="xterm.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://cdn.jsdelivr.net/npm/xterm@5.3.0/css/xterm.css';
        document.head.appendChild(link);
      }

      // Load XTerm.js
      const script1 = document.createElement('script');
      script1.src = 'https://cdn.jsdelivr.net/npm/xterm@5.3.0/lib/xterm.js';
      script1.onload = () => {
        // Load Fit Addon
        const script2 = document.createElement('script');
        script2.src = 'https://cdn.jsdelivr.net/npm/xterm-addon-fit@0.8.0/lib/xterm-addon-fit.js';
        script2.onload = resolve;
        script2.onerror = reject;
        document.head.appendChild(script2);
      };
      script1.onerror = reject;
      document.head.appendChild(script1);
    });
  };

  const initTerminal = () => {
    if (!window.Terminal || !window.FitAddon || !terminalRef.current) {
      console.error('Terminal libraries not ready');
      return;
    }

    try {
      // Create single terminal instance
      const terminal = new window.Terminal({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: '"Courier New", Consolas, monospace',
        theme: {
          background: '#000000',
          foreground: '#ffffff',
          cursor: '#ffffff',
          cursorAccent: '#000000',
          selection: 'rgba(255, 255, 255, 0.3)'
        },
        cols: 80,
        rows: 24,
        scrollback: 1000,
        allowTransparency: false
      });

      // Create fit addon
      const fitAddon = new window.FitAddon.FitAddon();
      terminal.loadAddon(fitAddon);

      // Clear container and open terminal
      terminalRef.current.innerHTML = '';
      terminal.open(terminalRef.current);
      
      // Fit terminal to container
      setTimeout(() => {
        fitAddon.fit();
      }, 100);

      // Store terminal instance
      terminalInstanceRef.current = terminal;

      // Connect WebSocket
      connectWebSocket(terminal, fitAddon);

      // Handle window resize
      const handleResize = () => {
        if (fitAddon && terminal) {
          fitAddon.fit();
        }
      };
      window.addEventListener('resize', handleResize);

      setStatus('Connecting...');

    } catch (error) {
      console.error('Failed to initialize terminal:', error);
      setStatus('Failed to initialize');
    }
  };

  const connectWebSocket = (terminal, fitAddon) => {
    const wsUrl = 'ws://localhost:3000/terminal';
    console.log('Connecting to WebSocket:', wsUrl);
    
    const ws = new WebSocket(wsUrl);
    websocketRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      setStatus('Connected');
      
      // Clear terminal and show waiting message
      terminal.clear();
      terminal.writeln('\x1b[32m✅ Terminal Ready\x1b[0m');
      terminal.writeln('\x1b[36m💡 Click "▶ Start" button to begin Telegram login process\x1b[0m');
      terminal.writeln('');

      // Handle terminal input - will be controlled by ref
      terminal.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
          // Check if started using ref (captures current value)
          if (isStartedRef.current) {
            ws.send(JSON.stringify({
              type: 'input',
              data: data
            }));
          }
        }
      });

      // Handle resize
      if (fitAddon) {
        const handleResize = () => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'resize',
              cols: terminal.cols,
              rows: terminal.rows
            }));
          }
        };
        window.addEventListener('resize', handleResize);
      }
    };

    ws.onmessage = (event) => {
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
      if (terminal) {
        terminal.writeln('\r\n\x1b[31m❌ Connection lost\x1b[0m');
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setStatus('Connection Error');
      if (terminal) {
        terminal.writeln('\r\n\x1b[31m❌ Connection error\x1b[0m');
      }
    };
  };

  const handleBackToSessions = () => {
    cleanup();
    navigate('/sessions');
  };

  const handleSaveSession = () => {
    if (sessionString) {
      // Close terminal connections to prevent auth conflicts
      cleanup();
      
      // Navigate to sessions with session string
      navigate('/sessions', {
        state: {
          newSessionString: sessionString,
          autoFill: true,
          fromTerminal: true
        }
      });
    }
  };

  const startLogin = () => {
    if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
      // Update both state and ref
      setIsStarted(true);
      isStartedRef.current = true;
      
      // Clear terminal and start login process
      if (terminalInstanceRef.current) {
        terminalInstanceRef.current.clear();
        terminalInstanceRef.current.writeln('\x1b[32m🚀 Starting Telegram Login Process...\x1b[0m');
        terminalInstanceRef.current.writeln('');
      }
      
      websocketRef.current.send(JSON.stringify({
        type: 'input',
        data: 'python3 python-service/nomor_to_sessionstring.py\r'
      }));
    }
  };

  return (
    <div style={{ 
      height: '100vh', 
      width: '100vw',
      backgroundColor: '#000', 
      display: 'flex', 
      flexDirection: 'column',
      fontFamily: 'monospace',
      overflow: 'hidden',
      position: 'fixed',
      top: 0,
      left: 0,
      zIndex: 9999
    }}>
      {/* Simple Header */}
      <div style={{
        backgroundColor: '#1a1a1a',
        padding: '8px 16px',
        borderBottom: '1px solid #333',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        color: '#fff',
        fontSize: '14px',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span>🔐 Telegram Login</span>
          <span style={{ 
            marginLeft: '15px', 
            fontSize: '12px',
            color: isConnected ? '#0f0' : '#f00'
          }}>
            ● {status}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={startLogin}
            disabled={!isConnected}
            style={{
              backgroundColor: isConnected ? '#0d7377' : '#555',
              color: '#fff',
              border: 'none',
              padding: '4px 12px',
              borderRadius: '3px',
              cursor: isConnected ? 'pointer' : 'not-allowed',
              fontSize: '11px'
            }}
          >
            ▶ Start
          </button>
          <button
            onClick={handleBackToSessions}
            style={{
              backgroundColor: '#dc3545',
              color: '#fff',
              border: 'none',
              padding: '4px 12px',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '11px'
            }}
          >
            ← Back
          </button>
        </div>
      </div>

      {/* Main Content - 50:50 Layout */}
      <div style={{ 
        flex: 1, 
        backgroundColor: '#000',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Terminal Area - 50% */}
        <div 
          ref={terminalRef} 
          style={{ 
            height: '50%',
            width: '100%',
            backgroundColor: '#000',
            padding: '8px',
            boxSizing: 'border-box'
          }}
        />
        
        {/* Instructions Panel - 50% */}
        <div style={{
          height: '50%',
          backgroundColor: '#1a1a1a',
          borderTop: '1px solid #333',
          padding: '12px 16px',
          color: '#ccc',
          fontSize: '12px',
          fontFamily: 'monospace',
          overflowY: 'auto',
          boxSizing: 'border-box'
        }}>
          <div style={{ marginBottom: '8px', color: '#fff', fontWeight: 'bold' }}>
            💡 Instructions:
          </div>
          {/* Mobile-first responsive layout */}
          <div style={{ 
            display: 'flex', 
            flexDirection: isMobile ? 'column' : 'row',
            gap: isMobile ? '8px' : '12px'
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ color: '#4CAF50', marginBottom: '4px', fontSize: '11px', fontWeight: 'bold' }}>
                📱 How to Generate Session String:
              </div>
              <div style={{ paddingLeft: '8px', lineHeight: '1.3', fontSize: '10px' }}>
                <div>1. Click <strong>"▶ Start"</strong> button above</div>
                <div>2. Enter your phone number</div>
                <div>3. Enter verification code from SMS/Telegram</div>
                <div>4. Enter 2FA password if required</div>
                <div style={{ 
                  color: '#FFD700', 
                  fontWeight: 'bold', 
                  marginTop: '4px',
                  fontSize: '11px',
                  backgroundColor: '#2a2a00',
                  padding: '2px 4px',
                  borderRadius: '2px'
                }}>
                  5. 📋 <strong>COPY SESSION STRING!</strong>
                </div>
              </div>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: '#2196F3', marginBottom: '4px', fontSize: '11px', fontWeight: 'bold' }}>
              ⚠️ Important Notes:
            </div>
            <div style={{ paddingLeft: '8px', lineHeight: '1.3', fontSize: '10px' }}>
              <div>• Terminal input is <strong>disabled</strong> until you click Start</div>
              <div>• Follow the prompts after clicking Start button</div>
              <div>• Process is fully automated - no manual commands</div>
              <div>• Session string will appear at the end</div>
            </div>
          </div>
        </div>
        
        {/* Important Session String Notice - Mobile Optimized */}
        <div style={{ 
          marginTop: '8px', 
          padding: '6px 8px', 
          backgroundColor: '#2d4a22', 
          borderLeft: '3px solid #4CAF50',
          borderRadius: '3px',
          fontSize: '10px',
          color: '#fff'
        }}>
          <div style={{ 
            fontWeight: 'bold', 
            marginBottom: '3px', 
            color: '#4CAF50',
            fontSize: '11px'
          }}>
            ⚠️ PENTING - Session String:
          </div>
          <div style={{ lineHeight: '1.3', fontSize: '9px' }}>
            • Setelah login berhasil, <strong>WAJIB COPY session string</strong><br/>
            • Session string untuk <strong>Add Session</strong> di halaman Sessions<br/>
            • Tanpa session string, akun tidak bisa kirim pesan<br/>
            • Session string hanya muncul <strong>SEKALI</strong> - jangan sampai hilang!
          </div>
        </div>
        <div style={{ 
          marginTop: '6px', 
          padding: '4px 6px', 
          backgroundColor: '#2a2a2a', 
          borderRadius: '2px',
          fontSize: '9px',
          color: '#999',
          textAlign: 'center'
        }}>
          💡 Click "▶ Start" button to begin the process
        </div>
      </div>

      {/* Success Modal */}
      {showSuccess && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.9)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 10000
        }}>
          <div style={{
            backgroundColor: '#fff',
            padding: '20px',
            borderRadius: '8px',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#000' }}>🎉 Login Berhasil!</h3>
            
            {/* Important Notice */}
            <div style={{
              backgroundColor: '#fff3cd',
              border: '1px solid #ffeaa7',
              borderRadius: '4px',
              padding: '12px',
              marginBottom: '15px'
            }}>
              <div style={{ color: '#856404', fontWeight: 'bold', marginBottom: '8px' }}>
                ⚠️ PENTING - COPY SESSION STRING INI!
              </div>
              <div style={{ color: '#856404', fontSize: '13px', lineHeight: '1.4' }}>
                • Session string ini <strong>WAJIB di-copy</strong> untuk Add Session<br/>
                • Tanpa session string, akun tidak bisa digunakan<br/>
                • Session string hanya muncul <strong>SEKALI</strong> - jangan sampai hilang!
              </div>
            </div>

            <div style={{ marginBottom: '15px' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#000' }}>
                📋 Session String (COPY INI):
              </div>
              <div style={{
                backgroundColor: '#f8f9fa',
                padding: '12px',
                borderRadius: '4px',
                fontFamily: 'monospace',
                fontSize: '11px',
                wordBreak: 'break-all',
                maxHeight: '120px',
                overflow: 'auto',
                border: '2px solid #28a745',
                position: 'relative'
              }}>
                {sessionString}
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(sessionString);
                    alert('Session string copied to clipboard!');
                  }}
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    backgroundColor: '#28a745',
                    color: '#fff',
                    border: 'none',
                    padding: '4px 8px',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontSize: '10px'
                  }}
                >
                  📋 Copy
                </button>
              </div>
            </div>

            <div style={{ 
              backgroundColor: '#d4edda', 
              border: '1px solid #c3e6cb',
              borderRadius: '4px',
              padding: '10px',
              marginBottom: '15px',
              fontSize: '13px',
              color: '#155724'
            }}>
              <strong>Langkah Selanjutnya:</strong><br/>
              1. Copy session string di atas<br/>
              2. Klik "Continue to Add Session" di bawah<br/>
              3. Enter nama untuk session ini<br/>
              4. Klik Register untuk menyelesaikan!
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={handleSaveSession}
                style={{
                  backgroundColor: '#28a745',
                  color: '#fff',
                  border: 'none',
                  padding: '12px 20px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold'
                }}
              >
                💾 Continue to Add Session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CleanTerminal;
