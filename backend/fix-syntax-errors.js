#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// List of route files to fix
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

// Fix syntax errors caused by the automatic script
const fixSyntaxErrors = (content) => {
  // Fix the pattern where router.method('path', (req, res) => { logger.info(...); { should be router.method('path', (req, res) => { logger.info(...);
  content = content.replace(
    /(router\.\w+\('[^']*',\s*\(req,\s*res\)\s*=>\s*{\s*logger\.\w+\([^}]+\}\);)\s*{/g,
    '$1'
  );
  
  // Fix any standalone { that might be left
  content = content.replace(/^\s*{\s*$/gm, '');
  
  // Fix any double }} at the end of functions
  content = content.replace(/}\s*}\s*}\s*;/g, '});');
  
  return content;
};

// Process each route file
routeFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${file}`);
    return;
  }
  
  console.log(`🔧 Fixing syntax errors in: ${file}`);
  
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Fix syntax errors
    content = fixSyntaxErrors(content);
    
    // Write back to file
    fs.writeFileSync(filePath, content);
    
    // Test syntax
    const { execSync } = require('child_process');
    try {
      execSync(`node -c "${filePath}"`, { stdio: 'pipe' });
      console.log(`✅ Fixed: ${file}`);
    } catch (syntaxError) {
      console.log(`❌ Still has syntax errors: ${file}`);
      console.log(syntaxError.toString());
    }
    
  } catch (error) {
    console.error(`❌ Error processing ${file}:`, error.message);
  }
});

console.log('\n🎉 Syntax fix completed!');
