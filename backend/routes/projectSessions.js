const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const logger = require('../logger');
const router = express.Router();

// POST /api/project-sessions - bulk add sessions to project
router.post('/', (req, res) => {
  logger.info('PROJECTSESSIONS POST request', {
    operation: 'projectSessions_post',
    endpoint: 'POST /',
    params: req.params,
    bodyKeys: Object.keys(req.body || {})
  });

  const { project_id, session_ids, selection_mode } = req.body;
  
  if (!project_id || !session_ids || !Array.isArray(session_ids)) {
    return res.status(400).json({ success: false, error: 'Project ID and session IDs array are required' });
  }
  
  if (session_ids.length === 0) {
    return logger.debug('Operation completed successfully');
    res.json({ success: true, data: [] });
  }
  
  const mode = selection_mode || 'random'; // Default to random
  
  const insertPromises = session_ids.map(session_id => {
    return new Promise((resolve, reject) => {
      const project_session_id = uuidv4();
      const sql = 'INSERT INTO project_sessions (id, project_id, session_id, selection_mode) VALUES (?, ?, ?, ?)';
      db.run(sql, [project_session_id, project_id, session_id, mode], function(err) {
        if (err) reject(err);
        else resolve({ id: project_session_id, project_id, session_id, selection_mode: mode });
      });
    });
  });
  
  Promise.all(insertPromises)
    .then(results => res.status(201).json({ success: true, data: results }))
    .catch(err => res.status(500).json({ success: false, error: err.message }));
});

// POST /api/projects/:id/sessions - add session to project
router.post('/:id/sessions', (req, res) => {
  logger.info('PROJECTSESSIONS POST request', {
    operation: 'projectSessions_post',
    endpoint: 'POST /:id/sessions',
    params: req.params,
    bodyKeys: Object.keys(req.body || {})
  });

  const { id } = req.params; // project id
  const { session_id, selection_mode } = req.body;
  const project_session_id = uuidv4();
  
  if (!session_id) {
    return res.status(400).json({ success: false, error: 'Session ID is required' });
  }
  
  const sql = 'INSERT INTO project_sessions (id, project_id, session_id, selection_mode) VALUES (?, ?, ?, ?)';
  db.run(sql, [project_session_id, id, session_id, selection_mode || 'manual'], function(err) {
    if (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
    res.status(201).json({ 
      success: true, 
      data: { 
        id: project_session_id, 
        project_id: id, 
        session_id, 
        selection_mode: selection_mode || 'manual' 
      } 
    });
  });
});

// GET /api/projects/:id/sessions - get sessions for project
router.get('/:id/sessions', (req, res) => {
  logger.info('PROJECTSESSIONS GET request', {
    operation: 'projectSessions_get',
    endpoint: 'GET /:id/sessions',
    params: req.params,
    query: req.query
  });
  const { id } = req.params; // project id
  
  logger.info('[Project Sessions] Getting sessions for project:', id);
  const sql = 'SELECT * FROM project_sessions WHERE project_id = ?';
  db.all(sql, [id], (err, rows) => {
    if (err) {
      logger.error('[Project Sessions] Error getting sessions:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
    logger.info('[Project Sessions] Found sessions:', rows.length, rows);
    logger.debug('Operation completed successfully');
    res.json({ success: true, data: rows });
  });
});

// DELETE /api/projects/:id/sessions/:session_id - remove session from project
router.delete('/:id/sessions/:session_id', (req, res) => {
  logger.info('PROJECTSESSIONS DELETE request', {
    operation: 'projectSessions_delete',
    endpoint: 'DELETE /:id/sessions/:session_id',
    params: req.params
  });
  const { id, session_id } = req.params; // project id and session id
  
  const sql = 'DELETE FROM project_sessions WHERE session_id = ? AND project_id = ?';
  db.run(sql, [session_id, id], function(err) {
    if (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ success: false, error: 'Session not found for this project' });
    }
    logger.debug('Operation completed successfully');
    res.json({ success: true, message: 'Session removed from project successfully' });
  });
});

// DELETE /api/projects/:id/sessions - remove all sessions from project
router.delete('/:id/sessions', (req, res) => {
  logger.info('PROJECTSESSIONS DELETE request', {
    operation: 'projectSessions_delete',
    endpoint: 'DELETE /:id/sessions',
    params: req.params
  });
  const { id } = req.params; // project id
  
  const sql = 'DELETE FROM project_sessions WHERE project_id = ?';
  db.run(sql, [id], function(err) {
    if (err) {
      logger.error('Database operation failed', {
        error: err.message,
        operation: 'db_run'
      });
      return res.status(500).json({ success: false, error: err.message });
    }
    logger.debug('Operation completed successfully');
    res.json({ success: true, message: `Project sessions cleared successfully` });
  });
});

module.exports = router;