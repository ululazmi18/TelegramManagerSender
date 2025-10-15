const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const logger = require('../logger');
const router = express.Router();

// GET /api/sessions - list sessions
router.get('/', (req, res) => {
  logger.info('Fetching all sessions', {
    operation: 'list_sessions',
    endpoint: 'GET /api/sessions'
  });

  const sql = 'SELECT id, name, first_name, last_name, username, tg_id, login_at FROM sessions ORDER BY first_name ASC, last_name ASC';
  db.all(sql, [], (err, rows) => {
    if (err) {
      logger.error('Failed to fetch sessions', {
        operation: 'list_sessions',
        error: err.message,
        sql
      });
      return res.status(500).json({ success: false, error: err.message });
    }
    
    logger.info('Successfully fetched sessions', {
      operation: 'list_sessions',
      count: rows.length
    });
    
    res.json({ success: true, data: rows });
  });
});

// POST /api/sessions - create session (manual add via existing flow)
router.post('/', (req, res) => {
  const { name, session_string } = req.body;
  const id = uuidv4();
  
  logger.info('Creating new session', {
    operation: 'create_session',
    endpoint: 'POST /api/sessions',
    sessionId: id,
    hasName: !!name,
    sessionStringLength: session_string ? session_string.length : 0
  });
  
  if (!session_string) {
    logger.warn('Session creation failed - missing session string', {
      operation: 'create_session',
      sessionId: id,
      error: 'Session string is required'
    });
    return res.status(400).json({ success: false, error: 'Session string is required' });
  }
  const sql = 'INSERT INTO sessions (id, name, session_string, is_active) VALUES (?, ?, ?, 1)';
  db.run(sql, [id, name, session_string], function(err) {
    if (err) {
      logger.error('Failed to create session', {
        operation: 'create_session',
        sessionId: id,
        error: err.message,
        sql
      });
      return res.status(500).json({ success: false, error: err.message });
    }
    
    logger.info('Successfully created session', {
      operation: 'create_session',
      sessionId: id,
      name,
      changes: this.changes
    });
    
    res.status(201).json({ success: true, data: { id, name } });
  });
});

// POST /api/sessions/register_string - register session using session_string directly
router.post('/register_string', async (req, res) => {
  const axios = require('axios');
  const { api_id, api_hash, session_string } = req.body;
  
  logger.info('Starting session registration', {
    operation: 'register_session',
    endpoint: 'POST /api/sessions/register_string',
    apiId: api_id,
    sessionStringLength: session_string ? session_string.length : 0,
    hasApiHash: !!api_hash
  });
  
  if (!api_id || !api_hash || !session_string) {
    logger.warn('Session registration failed - missing required fields', {
      operation: 'register_session',
      hasApiId: !!api_id,
      hasApiHash: !!api_hash,
      hasSessionString: !!session_string,
      error: 'API ID, API Hash, and session string are required'
    });
    return res.status(400).json({ success: false, error: 'API ID, API Hash, and session string are required' });
  }
  
  try {
    logger.debug('Calling Python service for session validation', {
      operation: 'register_session',
      pythonServiceUrl: process.env.PYTHON_SERVICE_URL || 'http://localhost:8000',
      endpoint: '/validate_session'
    });

    // Call python service to validate session string and get user info
    const pyRes = await axios.post(
      `${process.env.PYTHON_SERVICE_URL || 'http://localhost:8000'}/validate_session`,
      { session_string },
      { headers: { 'x-internal-secret': process.env.INTERNAL_SECRET } }
    );

    logger.debug('Python service validation response', {
      operation: 'register_session',
      success: pyRes.data?.success,
      valid: pyRes.data?.valid,
      hasUserInfo: !!pyRes.data?.user_info
    });

    if (!pyRes.data?.success || !pyRes.data?.valid) {
      logger.warn('Session validation failed', {
        operation: 'register_session',
        error: pyRes.data?.error || 'Invalid session string',
        pythonResponse: pyRes.data
      });
      return res.status(400).json({ success: false, error: pyRes.data?.error || 'Invalid session string' });
    }

    const me = pyRes.data.user_info;
    const exported_session_string = session_string; // Use the provided session string

    logger.info('Session validation successful, proceeding with registration', {
      operation: 'register_session',
      userId: me.id,
      username: me.username,
      firstName: me.first_name,
      lastName: me.last_name,
      phoneNumber: me.phone_number
    });

    // Always proceed with registration (no duplicate check)
    const id = uuidv4();
    const name = `${me.first_name || ''} ${me.last_name || ''}`.trim() || me.username || 'Telegram User';
    const currentTime = new Date().toISOString();
    
    logger.debug('Inserting session into database', {
      operation: 'register_session',
      sessionId: id,
      name,
      tgId: me.id
    });

    const sql = `INSERT INTO sessions (id, name, session_string, tg_id, first_name, last_name, username, phone_number, login_at, is_active)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`;
    db.run(sql, [id, name, exported_session_string, me.id || null, me.first_name || null, me.last_name || null, me.username || null, me.phone_number || null, currentTime], function(err) {
      if (err) {
        logger.error('Failed to insert session into database', {
          operation: 'register_session',
          sessionId: id,
          error: err.message,
          sql
        });
        return res.status(500).json({ success: false, error: err.message });
      }
      
      logger.info('Successfully registered session', {
        operation: 'register_session',
        sessionId: id,
        name,
        tgId: me.id,
        changes: this.changes
      });
      
      return res.status(201).json({ success: true, data: { id, first_name: me.first_name, last_name: me.last_name, username: me.username } });
    });
  } catch (e) {
    logger.error('Session registration failed with exception', {
      operation: 'register_session',
      error: e.message,
      stack: e.stack,
      responseData: e.response?.data,
      responseStatus: e.response?.status,
      responseHeaders: e.response?.headers
    });
    
    const msg = e.response?.data?.error || e.response?.data?.detail || e.message;
    return res.status(400).json({ success: false, error: msg });
  }
});


// PUT /api/sessions/:id - update session
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { name, is_active } = req.body;
  
  const sql = 'UPDATE sessions SET name = ?, is_active = ?, updated_at = datetime("now") WHERE id = ?';
  db.run(sql, [name, is_active, id], function(err) {
    if (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }
    res.json({ success: true, data: { id, name, is_active } });
  });
});

// PUT /api/sessions/:id/update_data - update session data using session_string
router.put('/:id/update_data', async (req, res) => {
  const axios = require('axios');
  const { id } = req.params;
  const { api_id, api_hash } = req.body;
  
  try {
    // Get session from database
    const getSessionSql = 'SELECT session_string FROM sessions WHERE id = ?';
    db.get(getSessionSql, [id], async (err, session) => {
      if (err) {
        return res.status(500).json({ success: false, error: err.message });
      }
      if (!session) {
        return res.status(404).json({ success: false, error: 'Session not found' });
      }
      
      try {
        // Call python service to validate session and get updated user info
        const pyRes = await axios.post(
          `${process.env.PYTHON_SERVICE_URL || 'http://localhost:8000'}/validate_session`,
          { session_string: session.session_string },
          { headers: { 'x-internal-secret': process.env.INTERNAL_SECRET } }
        );

        if (!pyRes.data?.success || !pyRes.data?.valid) {
          return res.status(400).json({ success: false, error: pyRes.data?.error || 'Invalid session string' });
        }

        const me = pyRes.data.user_info;
        const exported_session_string = session.session_string; // Keep the original session string

        // Update session in database
        const name = `${me.first_name || ''} ${me.last_name || ''}`.trim() || me.username || 'Telegram User';
        const currentTime = new Date().toISOString();
        const updateSql = `UPDATE sessions SET name = ?, session_string = ?, tg_id = ?, first_name = ?, last_name = ?, username = ?, phone_number = ?, login_at = ?, updated_at = ? WHERE id = ?`;
        db.run(updateSql, [name, exported_session_string, me.id || null, me.first_name || null, me.last_name || null, me.username || null, me.phone_number || null, currentTime, currentTime, id], function(err) {
          if (err) {
            return res.status(500).json({ success: false, error: err.message });
          }
          return res.json({ success: true, data: { id, first_name: me.first_name, last_name: me.last_name, username: me.username } });
        });
      } catch (e) {
        console.error('Error in update_data:', e.message);
        if (e.response) {
          console.error('Response data:', e.response.data);
          console.error('Response status:', e.response.status);
        }
        const msg = e.response?.data?.error || e.response?.data?.detail || e.message;
        return res.status(400).json({ success: false, error: msg });
      }
    });
  } catch (e) {
    console.error('Error in update_data outer:', e.message);
    const msg = e.response?.data?.error || e.response?.data?.detail || e.message;
    return res.status(400).json({ success: false, error: msg });
  }
});


// DELETE /api/sessions/:id - delete session with smart project handling
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  
  // Check if session exists
  const checkSql = 'SELECT id, first_name, last_name FROM sessions WHERE id = ?';
  db.get(checkSql, [id], (err, session) => {
    if (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    // Find projects using this session
    const findProjectsSql = `
      SELECT ps.project_id, ps.selection_mode, p.name
      FROM project_sessions ps
      JOIN projects p ON ps.project_id = p.id
      WHERE ps.session_id = ?
    `;
    db.all(findProjectsSql, [id], (projErr, projectRefs) => {
      if (projErr) {
        return res.status(500).json({ success: false, error: projErr.message });
      }

      const projectsToDelete = [];
      const projectsToReplace = [];

      // Process each affected project
      const processProjects = () => {
        if (projectRefs.length === 0) {
          deleteSession();
          return;
        }

        let processed = 0;
        projectRefs.forEach(proj => {
          if (proj.selection_mode === 'random') {
            // Random mode: try to replace with another session
            const getOtherSessionsSql = 'SELECT id FROM sessions WHERE id != ? LIMIT 1';
            db.get(getOtherSessionsSql, [id], (sessErr, otherSession) => {
              if (!sessErr && otherSession) {
                // Replace with another session
                const updateSql = 'UPDATE project_sessions SET session_id = ? WHERE project_id = ? AND session_id = ?';
                db.run(updateSql, [otherSession.id, proj.project_id, id], () => {
                  projectsToReplace.push(proj.name);
                });
              } else {
                // No other sessions available, delete project
                projectsToDelete.push(proj.name);
                db.run('DELETE FROM projects WHERE id = ?', [proj.project_id]);
              }
              processed++;
              if (processed === projectRefs.length) {
                setTimeout(deleteSession, 100);
              }
            });
          } else {
            // Manual mode: delete project
            projectsToDelete.push(proj.name);
            db.run('DELETE FROM projects WHERE id = ?', [proj.project_id], () => {
              processed++;
              if (processed === projectRefs.length) {
                setTimeout(deleteSession, 100);
              }
            });
          }
        });
      };

      const deleteSession = () => {
        // Delete from project_sessions
        const deleteProjectSessionsSql = 'DELETE FROM project_sessions WHERE session_id = ?';
        db.run(deleteProjectSessionsSql, [id], (psErr) => {
          if (psErr) {
            console.error('Error deleting project_sessions:', psErr);
          }

          // Delete session
          const deleteSql = 'DELETE FROM sessions WHERE id = ?';
          db.run(deleteSql, [id], function(delErr) {
            if (delErr) {
              return res.status(500).json({ success: false, error: delErr.message });
            }

            const sessionName = `${session.first_name || ''} ${session.last_name || ''}`.trim() || 'Unknown';
            res.json({ 
              success: true,
              message: `Session "${sessionName}" deleted successfully`,
              details: {
                projects_affected: projectRefs.length,
                projects_deleted: projectsToDelete.length,
                projects_replaced: projectsToReplace.length,
                deleted_projects: projectsToDelete,
                replaced_projects: projectsToReplace
              }
            });
          });
        });
      };

      processProjects();
    });
  });
});

// GET /api/sessions/:id/download - get complete session data for download
router.get('/:id/download', (req, res) => {
  const { id } = req.params;
  
  // Get complete session data including session_string
  const sql = `
    SELECT 
      id, name, first_name, last_name, username, phone_number, 
      tg_id, session_string, login_at, created_at, updated_at
    FROM sessions 
    WHERE id = ?
  `;
  
  db.get(sql, [id], (err, session) => {
    if (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
    
    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }
    
    // Create filename: "full_name_id.txt"
    const fullName = [session.first_name, session.last_name].filter(Boolean).join(' ') || 'Unknown';
    const filename = `${fullName}_${session.tg_id || session.id.substring(0, 8)}.txt`;
    
    // Create file content with all session data
    const content = `=== TELEGRAM SESSION DATA ===
Generated: ${new Date().toISOString()}

=== USER INFORMATION ===
Full Name: ${fullName}
First Name: ${session.first_name || 'N/A'}
Last Name: ${session.last_name || 'N/A'}
Username: ${session.username ? '@' + session.username : 'N/A'}
Phone Number: ${session.phone_number || 'N/A'}
Telegram ID: ${session.tg_id || 'N/A'}

=== SESSION INFORMATION ===
Session ID: ${session.id}
Session Name: ${session.name || 'N/A'}
Login Date: ${session.login_at || 'N/A'}
Created Date: ${session.created_at || 'N/A'}
Updated Date: ${session.updated_at || 'N/A'}

=== SESSION STRING ===
${session.session_string || 'N/A'}

=== NOTES ===
- Keep this session string secure and private
- Do not share this file with unauthorized persons
- This session string can be used to access your Telegram account
- If compromised, revoke the session immediately from Telegram settings
`;

    res.json({
      success: true,
      data: {
        filename: filename,
        content: content,
        session: {
          id: session.id,
          full_name: fullName,
          tg_id: session.tg_id
        }
      }
    });
  });
});

module.exports = router;