#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// List of route files to update
const routeFiles = [
  'routes/credentials.js',
  'routes/files.js', 
  'routes/categories.js',
  'routes/channels.js',
  'routes/projectTargets.js',
  'routes/projectSessions.js',
  'routes/projectMessages.js',
  'routes/delays.js',
  'routes/internal.js',
  'routes/dashboard.js'
];

// Template for adding logger import
const addLoggerImport = (content) => {
  if (content.includes("const logger = require('../logger');")) {
    return content;
  }
  
  const lines = content.split('\n');
  let insertIndex = -1;
  
  // Find where to insert logger import (after other requires)
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("const router = express.Router();")) {
      insertIndex = i;
      break;
    }
  }
  
  if (insertIndex > -1) {
    lines.splice(insertIndex, 0, "const logger = require('../logger');");
    return lines.join('\n');
  }
  
  return content;
};

// Add logging to route handlers
const addRouteLogging = (content, filename) => {
  const routeName = path.basename(filename, '.js');
  
  // Replace console.log with logger calls
  content = content.replace(/console\.log\(/g, 'logger.info(');
  content = content.replace(/console\.error\(/g, 'logger.error(');
  content = content.replace(/console\.warn\(/g, 'logger.warn(');
  content = content.replace(/console\.debug\(/g, 'logger.debug(');
  
  // Add operation logging to route handlers
  const routePatterns = [
    // GET routes
    {
      pattern: /router\.get\('([^']+)',\s*\(req,\s*res\)\s*=>\s*{/g,
      replacement: (match, route) => {
        return `router.get('${route}', (req, res) => {
  logger.info('${routeName.toUpperCase()} GET request', {
    operation: '${routeName}_get',
    endpoint: 'GET ${route}',
    params: req.params,
    query: req.query
  });
{`;
      }
    },
    // POST routes
    {
      pattern: /router\.post\('([^']+)',\s*\(req,\s*res\)\s*=>\s*{/g,
      replacement: (match, route) => {
        return `router.post('${route}', (req, res) => {
  logger.info('${routeName.toUpperCase()} POST request', {
    operation: '${routeName}_post',
    endpoint: 'POST ${route}',
    params: req.params,
    bodyKeys: Object.keys(req.body || {})
  });
{`;
      }
    },
    // PUT routes
    {
      pattern: /router\.put\('([^']+)',\s*\(req,\s*res\)\s*=>\s*{/g,
      replacement: (match, route) => {
        return `router.put('${route}', (req, res) => {
  logger.info('${routeName.toUpperCase()} PUT request', {
    operation: '${routeName}_put',
    endpoint: 'PUT ${route}',
    params: req.params,
    bodyKeys: Object.keys(req.body || {})
  });
{`;
      }
    },
    // DELETE routes
    {
      pattern: /router\.delete\('([^']+)',\s*\(req,\s*res\)\s*=>\s*{/g,
      replacement: (match, route) => {
        return `router.delete('${route}', (req, res) => {
  logger.info('${routeName.toUpperCase()} DELETE request', {
    operation: '${routeName}_delete',
    endpoint: 'DELETE ${route}',
    params: req.params
  });
{`;
      }
    }
  ];
  
  routePatterns.forEach(({ pattern, replacement }) => {
    content = content.replace(pattern, replacement);
  });
  
  return content;
};

// Add error logging to database operations
const addDatabaseLogging = (content) => {
  // Add error logging to db.run callbacks
  content = content.replace(
    /db\.run\([^,]+,\s*[^,]*,\s*function\(err\)\s*{[\s\S]*?if\s*\(err\)\s*{[\s\S]*?return res\.status\(500\)\.json\(\{\s*success:\s*false,\s*error:\s*err\.message\s*\}\);/g,
    (match) => {
      return match.replace(
        /return res\.status\(500\)\.json\(\{\s*success:\s*false,\s*error:\s*err\.message\s*\}\);/,
        `logger.error('Database operation failed', {
        error: err.message,
        operation: 'db_run'
      });
      return res.status(500).json({ success: false, error: err.message });`
      );
    }
  );
  
  // Add success logging
  content = content.replace(
    /res\.json\(\{\s*success:\s*true/g,
    `logger.debug('Operation completed successfully');
    res.json({ success: true`
  );
  
  return content;
};

// Process each route file
routeFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${file}`);
    return;
  }
  
  console.log(`📝 Processing: ${file}`);
  
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Add logger import
    content = addLoggerImport(content);
    
    // Add route logging
    content = addRouteLogging(content, file);
    
    // Add database logging
    content = addDatabaseLogging(content);
    
    // Write back to file
    fs.writeFileSync(filePath, content);
    
    console.log(`✅ Updated: ${file}`);
    
  } catch (error) {
    console.error(`❌ Error processing ${file}:`, error.message);
  }
});

console.log('\n🎉 Logging update completed!');
console.log('\n📋 Next steps:');
console.log('1. Review the updated files');
console.log('2. Test the routes');
console.log('3. Check log files in backend/logs/');
console.log('4. Restart the backend server');
