const WebSocket = require('ws');
const pty = require('node-pty');
const path = require('path');

class TerminalServer {
  constructor(server) {
    this.wss = new WebSocket.Server({ 
      server,
      path: '/terminal'
    });
    
    this.terminals = new Map();
    this.setupWebSocketServer();
  }

  setupWebSocketServer() {
    this.wss.on('connection', (ws, req) => {
      console.log('🔌 New terminal connection');
      
      // Create unique terminal session
      const terminalId = this.generateTerminalId();
      
      // Determine shell and working directory
      const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';
      const cwd = path.resolve(__dirname, '../');
      
      // Create PTY process
      const ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-color',
        cols: 80,
        rows: 24,
        cwd: cwd,
        env: {
          ...process.env,
          PYTHONPATH: path.join(cwd, 'venv/lib/python3.12/site-packages'),
          PATH: `${path.join(cwd, 'venv/bin')}:${process.env.PATH}`
        }
      });

      // Store terminal session
      this.terminals.set(terminalId, {
        ptyProcess,
        ws,
        createdAt: new Date(),
        userAgent: req.headers['user-agent'] || 'Unknown',
        remoteAddress: req.connection.remoteAddress || req.socket.remoteAddress || 'Unknown'
      });

      // Send terminal ID to client
      ws.send(JSON.stringify({
        type: 'terminal_id',
        data: terminalId
      }));

      // Handle PTY output
      ptyProcess.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'output',
            data: data
          }));
        }
      });

      // Handle PTY exit
      ptyProcess.onExit((code, signal) => {
        console.log(`📤 Terminal ${terminalId} exited with code ${code}`);
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'exit',
            data: { code, signal }
          }));
        }
        this.terminals.delete(terminalId);
      });

      // Handle WebSocket messages (input from client)
      ws.on('message', (message) => {
        try {
          const msg = JSON.parse(message);
          
          switch (msg.type) {
            case 'input':
              ptyProcess.write(msg.data);
              break;
              
            case 'resize':
              ptyProcess.resize(msg.cols, msg.rows);
              break;
              
            case 'run_script':
              // Special command to run Python script
              const scriptPath = msg.script || 'login_dasar.py';
              const command = `source venv/bin/activate && python3 ${scriptPath}\n`;
              ptyProcess.write(command);
              break;
              
            case 'clear':
              ptyProcess.write('\x1b[2J\x1b[H'); // Clear screen
              break;
              
            default:
              console.log('Unknown message type:', msg.type);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      });

      // Handle WebSocket close
      ws.on('close', () => {
        console.log(`🔌 Terminal ${terminalId} disconnected`);
        if (this.terminals.has(terminalId)) {
          const terminal = this.terminals.get(terminalId);
          terminal.ptyProcess.kill();
          this.terminals.delete(terminalId);
        }
      });

      // Handle WebSocket error
      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });

      // No welcome messages - keep terminal clean
    });
  }

  generateTerminalId() {
    return 'term_' + Math.random().toString(36).substr(2, 9);
  }

  // Get active terminals count
  getActiveTerminalsCount() {
    return this.terminals.size;
  }

  // Kill all terminals
  killAllTerminals() {
    for (const [terminalId, terminal] of this.terminals) {
      terminal.ptyProcess.kill();
      if (terminal.ws.readyState === WebSocket.OPEN) {
        terminal.ws.close();
      }
    }
    this.terminals.clear();
  }

  // Get terminal info
  getTerminalInfo() {
    const info = [];
    for (const [terminalId, terminal] of this.terminals) {
      info.push({
        id: terminalId,
        createdAt: terminal.createdAt,
        isConnected: terminal.ws.readyState === WebSocket.OPEN,
        uptime: Math.floor((Date.now() - terminal.createdAt.getTime()) / 1000),
        userAgent: terminal.userAgent || 'Unknown',
        remoteAddress: terminal.remoteAddress || 'Unknown'
      });
    }
    return info;
  }

  // Get active terminals statistics
  getStats() {
    const activeCount = Array.from(this.terminals.values())
      .filter(terminal => terminal.ws.readyState === WebSocket.OPEN).length;
    
    return {
      total: this.terminals.size,
      active: activeCount,
      inactive: this.terminals.size - activeCount,
      uptime: process.uptime(),
      memory: process.memoryUsage()
    };
  }
}

module.exports = TerminalServer;
