const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const logger = require('../logger');
const router = express.Router();

// GET /api/categories - get all categories with channel count
router.get('/', (req, res) => {
  logger.info('CATEGORIES GET request', {
    operation: 'categories_get',
    endpoint: 'GET /',
    params: req.params,
    query: req.query
  });
  const sql = `
    SELECT 
      c.id, 
      c.name, 
      COUNT(cc.channel_id) as channel_count
    FROM categories c
    LEFT JOIN category_channels cc ON c.id = cc.category_id
    GROUP BY c.id, c.name
    ORDER BY c.name
  `;
  
  db.all(sql, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
    logger.debug('Operation completed successfully');
    res.json({ success: true, data: rows });
  });
});

// POST /api/categories - create new category
router.post('/', (req, res) => {
  logger.info('CATEGORIES POST request', {
    operation: 'categories_post',
    endpoint: 'POST /',
    params: req.params,
    bodyKeys: Object.keys(req.body || {})
  });

  const { name, channel_ids } = req.body;
  const id = uuidv4();
  
  if (!name) {
    return res.status(400).json({ success: false, error: 'Category name is required' });
  }
  
  // Start transaction
  db.serialize(() => {
    // Insert category
    const categorySql = 'INSERT INTO categories (id, name) VALUES (?, ?)';
    db.run(categorySql, [id, name], function(err) {
      if (err) {
        return res.status(500).json({ success: false, error: err.message });
      }
      
      // If channel_ids provided, add them to category
      if (channel_ids && channel_ids.length > 0) {
        const channelSql = 'INSERT INTO category_channels (id, category_id, channel_id) VALUES (?, ?, ?)';
        let completed = 0;
        let errors = [];
        
        channel_ids.forEach((channelId) => {
          const channelCategoryId = uuidv4();
          db.run(channelSql, [channelCategoryId, id, channelId], function(err) {
            if (err) {
              errors.push({ channel_id: channelId, error: err.message });
            }
            
            completed++;
            if (completed === channel_ids.length) {
              res.status(201).json({ 
                success: true, 
                data: { id, name, channel_count: channel_ids.length - errors.length },
                errors: errors.length > 0 ? errors : undefined
              });
            }
          });
        });
      } else {
        res.status(201).json({ success: true, data: { id, name, channel_count: 0 } });
      }
    });
  });
});

// GET /api/categories/:id - get single category
router.get('/:id', (req, res) => {
  logger.info('CATEGORIES GET request', {
    operation: 'categories_get',
    endpoint: 'GET /:id',
    params: req.params,
    query: req.query
  });
  const { id } = req.params;
  
  const sql = `
    SELECT 
      c.id, 
      c.name, 
      c.created_at,
      COUNT(cc.channel_id) as channel_count
    FROM categories c
    LEFT JOIN category_channels cc ON c.id = cc.category_id
    WHERE c.id = ?
    GROUP BY c.id, c.name, c.created_at
  `;
  
  db.get(sql, [id], (err, row) => {
    if (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
    if (!row) {
      return res.status(404).json({ success: false, error: 'Category not found' });
    }
    logger.debug('Operation completed successfully');
    res.json({ success: true, data: row });
  });
});

// GET /api/categories/:id/channels - get channels in category
router.get('/:id/channels', (req, res) => {
  logger.info('CATEGORIES GET request', {
    operation: 'categories_get',
    endpoint: 'GET /:id/channels',
    params: req.params,
    query: req.query
  });
  const { id } = req.params;
  
  const sql = `
    SELECT c.id, c.username
    FROM channels c
    INNER JOIN category_channels cc ON c.id = cc.channel_id
    WHERE cc.category_id = ?
    ORDER BY c.username
  `;
  
  db.all(sql, [id], (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
    logger.debug('Operation completed successfully');
    res.json({ success: true, data: rows });
  });
});

// PUT /api/categories/:id - update category
router.put('/:id', (req, res) => {
  logger.info('CATEGORIES PUT request', {
    operation: 'categories_put',
    endpoint: 'PUT /:id',
    params: req.params,
    bodyKeys: Object.keys(req.body || {})
  });

  const { id } = req.params;
  const { name, channel_ids } = req.body;
  
  if (!name) {
    return res.status(400).json({ success: false, error: 'Category name is required' });
  }
  
  // Start transaction
  db.serialize(() => {
    // Update category name
    const categorySql = 'UPDATE categories SET name = ? WHERE id = ?';
    db.run(categorySql, [name, id], function(err) {
      if (err) {
        return res.status(500).json({ success: false, error: err.message });
      }
      
      // Remove all existing channel associations
      const deleteSql = 'DELETE FROM category_channels WHERE category_id = ?';
      db.run(deleteSql, [id], function(err) {
        if (err) {
          logger.error('Database operation failed', {
        error: err.message,
        operation: 'db_run'
      });
      return res.status(500).json({ success: false, error: err.message });
        }
        
        // Add new channel associations
        if (channel_ids && channel_ids.length > 0) {
          const channelSql = 'INSERT INTO category_channels (id, category_id, channel_id) VALUES (?, ?, ?)';
          let completed = 0;
          let errors = [];
          
          channel_ids.forEach((channelId) => {
            const channelCategoryId = uuidv4();
            db.run(channelSql, [channelCategoryId, id, channelId], function(err) {
              if (err) {
                errors.push({ channel_id: channelId, error: err.message });
              }
              
              completed++;
              if (completed === channel_ids.length) {
                logger.debug('Operation completed successfully');
    res.json({ success: true, 
                  data: { id, name, channel_count: channel_ids.length - errors.length },
                  errors: errors.length > 0 ? errors : undefined
                });
              }
            });
          });
        } else {
          logger.debug('Operation completed successfully');
    res.json({ success: true, data: { id, name, channel_count: 0 } });
        }
      });
    });
  });
});

// DELETE /api/categories/:id - delete category
router.delete('/:id', (req, res) => {
  logger.info('CATEGORIES DELETE request', {
    operation: 'categories_delete',
    endpoint: 'DELETE /:id',
    params: req.params
  });
  const { id } = req.params;
  
  // Start transaction
  db.serialize(() => {
    // Delete channel associations first
    const deleteChannelsSql = 'DELETE FROM category_channels WHERE category_id = ?';
    db.run(deleteChannelsSql, [id], function(err) {
      if (err) {
        logger.error('Database operation failed', {
        error: err.message,
        operation: 'db_run'
      });
      return res.status(500).json({ success: false, error: err.message });
      }
      
      // Delete category
      const deleteCategorySql = 'DELETE FROM categories WHERE id = ?';
      db.run(deleteCategorySql, [id], function(err) {
        if (err) {
          logger.error('Database operation failed', {
        error: err.message,
        operation: 'db_run'
      });
      return res.status(500).json({ success: false, error: err.message });
        }
        if (this.changes === 0) {
          return res.status(404).json({ success: false, error: 'Category not found' });
        }
        logger.debug('Operation completed successfully');
    res.json({ success: true, message: 'Category deleted successfully' });
      });
    });
  });
});

module.exports = router;
