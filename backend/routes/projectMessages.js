const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const logger = require('../logger');
const router = express.Router();

// POST /api/project-messages - add message to project (with file_id)
router.post('/', (req, res) => {
  logger.info('PROJECTMESSAGES POST request', {
    operation: 'projectMessages_post',
    endpoint: 'POST /',
    params: req.params,
    bodyKeys: Object.keys(req.body || {})
  });

  const { project_id, file_id } = req.body;
  const message_id = uuidv4();
  
  logger.info('[Project Messages] Adding message:', { project_id, file_id });
  
  if (!project_id || !file_id) {
    logger.error('[Project Messages] Missing required fields');
    return res.status(400).json({ success: false, error: 'Project ID and file ID are required' });
  }
  
  // Get file info to determine message type
  const getFileSql = 'SELECT file_type, filename FROM files WHERE id = ?';
  db.get(getFileSql, [file_id], (err, file) => {
    if (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
    if (!file) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }
    
    const message_type = file.file_type; // 'text', 'photo', 'video', etc.
    const content_ref = file_id;
    
    const sql = 'INSERT INTO project_messages (id, project_id, message_type, content_ref, caption) VALUES (?, ?, ?, ?, ?)';
    db.run(sql, [message_id, project_id, message_type, content_ref, null], function(insertErr) {
      if (insertErr) {
        logger.error('[Project Messages] Insert error:', insertErr.message);
        return res.status(500).json({ success: false, error: insertErr.message });
      }
      logger.info('[Project Messages] Message added successfully:', message_id);
      res.status(201).json({ 
        success: true, 
        data: { 
          id: message_id, 
          project_id, 
          message_type, 
          content_ref,
          file_id
        } 
      });
    });
  });
});

// POST /api/projects/:id/messages - add message to project
router.post('/:id/messages', (req, res) => {
  logger.info('PROJECTMESSAGES POST request', {
    operation: 'projectMessages_post',
    endpoint: 'POST /:id/messages',
    params: req.params,
    bodyKeys: Object.keys(req.body || {})
  });

  const { id } = req.params; // project id
  const { message_type, content_ref, caption } = req.body;
  const message_id = uuidv4();
  
  if (!message_type || !content_ref) {
    return res.status(400).json({ success: false, error: 'Message type and content reference are required' });
  }
  
  const sql = 'INSERT INTO project_messages (id, project_id, message_type, content_ref, caption) VALUES (?, ?, ?, ?, ?)';
  db.run(sql, [message_id, id, message_type, content_ref, caption], function(err) {
    if (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
    res.status(201).json({ 
      success: true, 
      data: { 
        id: message_id, 
        project_id: id, 
        message_type, 
        content_ref, 
        caption 
      } 
    });
  });
});

// GET /api/projects/:id/messages - get messages for project
router.get('/:id/messages', (req, res) => {
  logger.info('PROJECTMESSAGES GET request', {
    operation: 'projectMessages_get',
    endpoint: 'GET /:id/messages',
    params: req.params,
    query: req.query
  });
  const { id } = req.params; // project id
  
  logger.info('[Project Messages] Getting messages for project:', id);
  const sql = 'SELECT * FROM project_messages WHERE project_id = ?';
  db.all(sql, [id], (err, rows) => {
    if (err) {
      logger.error('[Project Messages] Error getting messages:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
    logger.info('[Project Messages] Found messages:', rows.length, rows);
    logger.debug('Operation completed successfully');
    res.json({ success: true, data: rows });
  });
});

// DELETE /api/projects/:id/messages/:message_id - remove message from project
router.delete('/:id/messages/:message_id', (req, res) => {
  logger.info('PROJECTMESSAGES DELETE request', {
    operation: 'projectMessages_delete',
    endpoint: 'DELETE /:id/messages/:message_id',
    params: req.params
  });
  const { id, message_id } = req.params; // project id and message id
  
  const sql = 'DELETE FROM project_messages WHERE id = ? AND project_id = ?';
  db.run(sql, [message_id, id], function(err) {
    if (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ success: false, error: 'Message not found for this project' });
    }
    logger.debug('Operation completed successfully');
    res.json({ success: true, message: 'Message removed from project successfully' });
  });
});

// DELETE /api/projects/:id/messages - remove all messages from project
router.delete('/:id/messages', (req, res) => {
  logger.info('PROJECTMESSAGES DELETE request', {
    operation: 'projectMessages_delete',
    endpoint: 'DELETE /:id/messages',
    params: req.params
  });
  const { id } = req.params; // project id
  
  const sql = 'DELETE FROM project_messages WHERE project_id = ?';
  db.run(sql, [id], function(err) {
    if (err) {
      logger.error('Database operation failed', {
        error: err.message,
        operation: 'db_run'
      });
      return res.status(500).json({ success: false, error: err.message });
    }
    logger.debug('Operation completed successfully');
    res.json({ success: true, message: `Project messages cleared successfully` });
  });
});

module.exports = router;