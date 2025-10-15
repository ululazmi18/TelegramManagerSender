const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const logger = require('../logger');
const router = express.Router();

// POST /api/projects/:id/delays - set delay configuration for project
router.post('/:id/delays', (req, res) => {
  logger.info('DELAYS POST request', {
    operation: 'delays_post',
    endpoint: 'POST /:id/delays',
    params: req.params,
    bodyKeys: Object.keys(req.body || {})
  });

  const { id } = req.params; // project id
  const { delay_between_channels_ms, delay_between_sessions_ms, jitter_min_ms, jitter_max_ms } = req.body;
  const delay_id = uuidv4();
  
  const sql = 'INSERT INTO delays (id, project_id, delay_between_channels_ms, delay_between_sessions_ms, jitter_min_ms, jitter_max_ms) VALUES (?, ?, ?, ?, ?, ?)';
  db.run(sql, [delay_id, id, delay_between_channels_ms, delay_between_sessions_ms, jitter_min_ms, jitter_max_ms], function(err) {
    if (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
    res.status(201).json({ 
      success: true, 
      data: { 
        id: delay_id, 
        project_id: id, 
        delay_between_channels_ms, 
        delay_between_sessions_ms, 
        jitter_min_ms, 
        jitter_max_ms 
      } 
    });
  });
});

// GET /api/projects/:id/delays - get delay configuration for project
router.get('/:id/delays', (req, res) => {
  logger.info('DELAYS GET request', {
    operation: 'delays_get',
    endpoint: 'GET /:id/delays',
    params: req.params,
    query: req.query
  });
  const { id } = req.params; // project id
  
  const sql = 'SELECT * FROM delays WHERE project_id = ?';
  db.get(sql, [id], (err, row) => {
    if (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
    if (!row) {
      return logger.debug('Operation completed successfully');
    res.json({ success: true, data: null });
    }
    logger.debug('Operation completed successfully');
    res.json({ success: true, data: row });
  });
});

// PUT /api/projects/:id/delays - update delay configuration for project
router.put('/:id/delays', (req, res) => {
  logger.info('DELAYS PUT request', {
    operation: 'delays_put',
    endpoint: 'PUT /:id/delays',
    params: req.params,
    bodyKeys: Object.keys(req.body || {})
  });

  const { id } = req.params; // project id
  const { delay_between_channels_ms, delay_between_sessions_ms, jitter_min_ms, jitter_max_ms } = req.body;
  
  const sql = 'UPDATE delays SET delay_between_channels_ms = ?, delay_between_sessions_ms = ?, jitter_min_ms = ?, jitter_max_ms = ? WHERE project_id = ?';
  db.run(sql, [delay_between_channels_ms, delay_between_sessions_ms, jitter_min_ms, jitter_max_ms, id], function(err) {
    if (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ success: false, error: 'Delay configuration not found for this project' });
    }
    logger.debug('Operation completed successfully');
    res.json({ success: true, message: 'Delay configuration updated successfully' });
  });
});

module.exports = router;