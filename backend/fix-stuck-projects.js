#!/usr/bin/env node

/**
 * Fix Stuck Projects - Auto-complete projects that should have finished
 * This script checks for running projects and completes them if all jobs are done
 */

const { db } = require('./db-sqlite3');
const { logger } = require('../shared/logger');

async function fixStuckProjects() {
  console.log('🔧 Starting stuck projects fix...');
  
  try {
    // Get all running projects (including those without process runs)
    const getRunningProjectsSql = `
      SELECT p.id as project_id, p.name, pr.id as run_id, pr.stats, pr.status as run_status 
      FROM projects p 
      LEFT JOIN process_runs pr ON p.id = pr.project_id 
      WHERE p.status = 'running'
      ORDER BY pr.created_at DESC
    `;
    
    const runningProjects = await new Promise((resolve, reject) => {
      db.all(getRunningProjectsSql, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
    
    console.log(`📊 Found ${runningProjects.length} running project(s)`);
    
    for (const project of runningProjects) {
      console.log(`\n🔍 Checking project: ${project.name} (${project.project_id})`);
      console.log(`   Run ID: ${project.run_id || 'NO PROCESS RUN'}`);
      console.log(`   Run Status: ${project.run_status || 'N/A'}`);
      
      // If no process run exists, this is likely a stuck project
      if (!project.run_id) {
        console.log(`   🎯 Project has no active process run - force stopping`);
        
        // Update project status to stopped
        const updateProjectSql = 'UPDATE projects SET status = ? WHERE id = ?';
        await new Promise((resolve, reject) => {
          db.run(updateProjectSql, ['stopped', project.project_id], (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        
        console.log(`   ✅ Project fixed: ${project.name} is now stopped (no process run)`);
        continue;
      }
      
      let stats = { total_jobs: 0, completed_jobs: 0, success_count: 0, error_count: 0 };
      if (project.stats) {
        try {
          stats = JSON.parse(project.stats);
        } catch (parseErr) {
          console.log(`   ⚠️  Failed to parse stats: ${parseErr.message}`);
        }
      }
      
      console.log(`   📈 Stats: ${stats.completed_jobs}/${stats.total_jobs} jobs completed`);
      console.log(`   ✅ Success: ${stats.success_count}, ❌ Errors: ${stats.error_count}`);
      
      // Check if project should be completed
      if (stats.total_jobs > 0 && stats.completed_jobs >= stats.total_jobs) {
        console.log(`   🎯 Project should be completed! Auto-fixing...`);
        
        // Update project status to stopped
        const updateProjectSql = 'UPDATE projects SET status = ? WHERE id = ?';
        await new Promise((resolve, reject) => {
          db.run(updateProjectSql, ['stopped', project.project_id], (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        
        // Update process run status to completed
        const updateRunSql = 'UPDATE process_runs SET status = ? WHERE id = ?';
        await new Promise((resolve, reject) => {
          db.run(updateRunSql, ['completed', project.run_id], (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        
        console.log(`   ✅ Project fixed: ${project.name} is now stopped`);
        
        logger.info('Stuck project fixed automatically', {
          operation: 'fix_stuck_project',
          projectId: project.project_id,
          runId: project.run_id,
          projectName: project.name,
          completedJobs: stats.completed_jobs,
          totalJobs: stats.total_jobs
        });
        
      } else if (stats.total_jobs === 0) {
        console.log(`   ⚠️  Project has no jobs - might be initialization issue`);
      } else {
        console.log(`   ⏳ Project still has pending jobs: ${stats.total_jobs - stats.completed_jobs} remaining`);
      }
    }
    
    console.log('\n✅ Stuck projects fix completed!');
    
  } catch (error) {
    console.error('❌ Error fixing stuck projects:', error);
    logger.error('Failed to fix stuck projects', {
      operation: 'fix_stuck_projects',
      error: error.message,
      stack: error.stack
    });
  }
}

// Run if called directly
if (require.main === module) {
  fixStuckProjects().then(() => {
    console.log('🏁 Script finished');
    process.exit(0);
  }).catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
}

module.exports = { fixStuckProjects };
