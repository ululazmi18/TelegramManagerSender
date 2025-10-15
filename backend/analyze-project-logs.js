#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Script untuk menganalisis log project completion issues
const analyzeProjectLogs = (projectId) => {
  const logFile = path.join(__dirname, 'logs/combined.log');
  
  if (!fs.existsSync(logFile)) {
    console.error('❌ Log file not found:', logFile);
    return;
  }
  
  console.log(`🔍 Analyzing logs for project: ${projectId}`);
  console.log('='.repeat(80));
  
  const logContent = fs.readFileSync(logFile, 'utf8');
  const logLines = logContent.split('\n');
  
  // Find all events related to this project
  const projectEvents = [];
  
  logLines.forEach((line, index) => {
    if (line.includes(projectId)) {
      try {
        const logEntry = JSON.parse(line);
        projectEvents.push({
          lineNumber: index + 1,
          timestamp: logEntry.timestamp,
          level: logEntry.level,
          message: logEntry.message,
          operation: logEntry.operation,
          runId: logEntry.runId,
          jobId: logEntry.jobId,
          completedJobs: logEntry.completedJobs,
          totalJobs: logEntry.totalJobs,
          shouldComplete: logEntry.shouldComplete,
          rawData: logEntry
        });
      } catch (e) {
        // Skip non-JSON lines
      }
    }
  });
  
  if (projectEvents.length === 0) {
    console.log('❌ No events found for this project');
    return;
  }
  
  console.log(`📊 Found ${projectEvents.length} events for this project\n`);
  
  // Group by run_id
  const runGroups = {};
  projectEvents.forEach(event => {
    const runId = event.runId || 'unknown';
    if (!runGroups[runId]) {
      runGroups[runId] = [];
    }
    runGroups[runId].push(event);
  });
  
  // Analyze each run
  Object.keys(runGroups).forEach(runId => {
    console.log(`\n🔄 RUN ID: ${runId}`);
    console.log('-'.repeat(60));
    
    const events = runGroups[runId];
    
    // Check for key events
    const jobProcessing = events.filter(e => e.operation === 'process_job');
    const jobCompleted = events.filter(e => e.message?.includes('Job completed'));
    const statsUpdated = events.filter(e => e.message?.includes('Successfully updated'));
    const statusChecks = events.filter(e => e.operation === 'check_project_status');
    const manualChecks = events.filter(e => e.operation === 'manual_completion_check');
    
    console.log(`📋 Event Summary:`);
    console.log(`  • Job Processing: ${jobProcessing.length}`);
    console.log(`  • Job Completed: ${jobCompleted.length}`);
    console.log(`  • Stats Updated: ${statsUpdated.length}`);
    console.log(`  • Auto Status Checks: ${statusChecks.length}`);
    console.log(`  • Manual Checks: ${manualChecks.length}`);
    
    // Timeline analysis
    console.log(`\n⏰ Timeline:`);
    events.forEach(event => {
      const time = event.timestamp ? event.timestamp.split(' ')[1] : 'unknown';
      const level = event.level?.toUpperCase() || 'INFO';
      const operation = event.operation || 'general';
      const message = event.message || '';
      
      let statusInfo = '';
      if (event.completedJobs !== undefined && event.totalJobs !== undefined) {
        statusInfo = ` [${event.completedJobs}/${event.totalJobs}]`;
      }
      
      console.log(`  ${time} [${level}] ${operation}: ${message}${statusInfo}`);
    });
    
    // Race condition detection
    if (jobCompleted.length > 0 && statusChecks.length > 0) {
      const lastJobCompleted = jobCompleted[jobCompleted.length - 1];
      const firstStatusCheck = statusChecks[0];
      
      if (lastJobCompleted && firstStatusCheck) {
        const jobTime = new Date(lastJobCompleted.timestamp);
        const checkTime = new Date(firstStatusCheck.timestamp);
        const timeDiff = checkTime - jobTime;
        
        console.log(`\n⚠️  Race Condition Analysis:`);
        console.log(`  • Job Completed: ${lastJobCompleted.timestamp}`);
        console.log(`  • Status Check: ${firstStatusCheck.timestamp}`);
        console.log(`  • Time Difference: ${timeDiff}ms`);
        
        if (timeDiff < 50) {
          console.log(`  🚨 POTENTIAL RACE CONDITION! (< 50ms difference)`);
        } else {
          console.log(`  ✅ Timing looks OK (>= 50ms difference)`);
        }
        
        if (firstStatusCheck.completedJobs === 0 && firstStatusCheck.totalJobs > 0) {
          console.log(`  🚨 STATUS CHECK READ OLD DATA! (0/${firstStatusCheck.totalJobs})`);
        }
      }
    }
    
    // Final status
    const lastEvent = events[events.length - 1];
    if (lastEvent) {
      console.log(`\n📊 Final Status:`);
      if (lastEvent.shouldComplete !== undefined) {
        console.log(`  • Should Complete: ${lastEvent.shouldComplete ? '✅ YES' : '❌ NO'}`);
      }
      if (lastEvent.completedJobs !== undefined) {
        console.log(`  • Jobs: ${lastEvent.completedJobs}/${lastEvent.totalJobs}`);
      }
    }
  });
  
  console.log('\n' + '='.repeat(80));
  console.log('🎯 RECOMMENDATIONS:');
  
  // Check for common issues
  let hasRaceCondition = false;
  let hasIncompleteJobs = false;
  
  Object.values(runGroups).forEach(events => {
    const statusChecks = events.filter(e => e.operation === 'check_project_status');
    statusChecks.forEach(check => {
      if (check.completedJobs === 0 && check.totalJobs > 0) {
        hasRaceCondition = true;
      }
      if (check.completedJobs < check.totalJobs) {
        hasIncompleteJobs = true;
      }
    });
  });
  
  if (hasRaceCondition) {
    console.log('🚨 RACE CONDITION DETECTED!');
    console.log('   • Increase setTimeout delay in server.js');
    console.log('   • Current: 100ms, try 200ms or 500ms');
  }
  
  if (hasIncompleteJobs) {
    console.log('⚠️  INCOMPLETE JOBS DETECTED!');
    console.log('   • Check job processing logs');
    console.log('   • Verify Python service is running');
    console.log('   • Check Redis queue status');
  }
  
  const latestRun = Object.keys(runGroups).sort().pop();
  if (latestRun && latestRun !== 'unknown') {
    console.log(`\n💡 Project management commands for latest run (${latestRun}):`);
    console.log(`   • Stop project: curl -X POST http://localhost:3000/api/projects/${projectId}/stop`);
    console.log(`   • View logs: curl http://localhost:3000/api/projects/${projectId}/logs`);
  }
  
  console.log('\n📋 To check current database status:');
  console.log(`   sqlite3 db/telegram_app.db "SELECT id, status, stats FROM process_runs WHERE project_id = '${projectId}' ORDER BY created_at DESC LIMIT 3;"`);
};

// Command line usage
const projectId = process.argv[2];
if (!projectId) {
  console.log('Usage: node analyze-project-logs.js <project_id>');
  console.log('Example: node analyze-project-logs.js 69c12c35-4136-4a2a-8379-9d482e1960fb');
  process.exit(1);
}

analyzeProjectLogs(projectId);
