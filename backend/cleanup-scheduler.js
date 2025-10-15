const cron = require('node-cron');
const { db } = require('./db');
const logger = require('./logger');

// Import checkAndUpdateProjectStatus function
let checkAndUpdateProjectStatus;
try {
  const queueModule = require('./queue');
  checkAndUpdateProjectStatus = queueModule.checkAndUpdateProjectStatus;
} catch (err) {
  logger.error('Failed to import checkAndUpdateProjectStatus', { error: err.message });
}

// Background cleanup scheduler to handle stuck projects
const startCleanupScheduler = () => {
  // Check for stuck projects every 2 minutes
  cron.schedule('*/2 * * * *', async () => {
    try {
      logger.info('Running background cleanup scheduler', {
        operation: 'cleanup_scheduler',
        timestamp: new Date().toISOString()
      });
      
      // Find stuck projects (running for more than 5 minutes with completed jobs)
      const stuckRunsQuery = `
        SELECT pr.id, pr.project_id, pr.stats, pr.created_at,
               datetime(pr.created_at, '+5 minutes') as timeout_threshold,
               datetime('now') as current_time
        FROM process_runs pr
        JOIN projects p ON pr.project_id = p.id
        WHERE pr.status = 'running' 
        AND p.status = 'running'
        AND datetime(pr.created_at, '+5 minutes') < datetime('now')
      `;
      
      db.all(stuckRunsQuery, [], async (err, rows) => {
        if (err) {
          logger.error('Failed to query stuck projects', {
            operation: 'cleanup_scheduler',
            error: err.message
          });
          return;
        }
        
        if (rows.length === 0) {
          logger.debug('No stuck projects found', {
            operation: 'cleanup_scheduler'
          });
          return;
        }
        
        logger.info(`Found ${rows.length} potentially stuck projects`, {
          operation: 'cleanup_scheduler',
          stuckCount: rows.length
        });
        
        for (const run of rows) {
          try {
            const stats = JSON.parse(run.stats || '{}');
            const completedJobs = stats.completed_jobs || 0;
            const totalJobs = stats.total_jobs || 0;
            
            logger.info('Analyzing stuck project', {
              operation: 'cleanup_scheduler',
              runId: run.id,
              projectId: run.project_id,
              completedJobs,
              totalJobs,
              createdAt: run.created_at,
              stuckMinutes: Math.round((new Date() - new Date(run.created_at)) / (1000 * 60))
            });
            
            // Auto-complete if all jobs are done
            if (totalJobs > 0 && completedJobs >= totalJobs) {
              logger.warn('Auto-completing stuck project with completed jobs', {
                operation: 'cleanup_scheduler',
                runId: run.id,
                projectId: run.project_id,
                completedJobs,
                totalJobs,
                action: 'force_completion'
              });
              
              await checkAndUpdateProjectStatus(run.id, run.project_id);
              
            } else if (totalJobs > 0 && completedJobs === 0) {
              // Project might be stuck in processing - log for investigation
              logger.warn('Found project stuck in processing (no completed jobs)', {
                operation: 'cleanup_scheduler',
                runId: run.id,
                projectId: run.project_id,
                completedJobs,
                totalJobs,
                action: 'investigation_needed'
              });
              
            } else {
              // Partial completion - might still be processing
              logger.info('Project partially completed, monitoring', {
                operation: 'cleanup_scheduler',
                runId: run.id,
                projectId: run.project_id,
                completedJobs,
                totalJobs,
                action: 'monitoring'
              });
            }
            
          } catch (parseErr) {
            logger.error('Failed to parse stats for stuck project', {
              operation: 'cleanup_scheduler',
              runId: run.id,
              projectId: run.project_id,
              error: parseErr.message,
              rawStats: run.stats
            });
          }
        }
      });
      
    } catch (error) {
      logger.error('Cleanup scheduler error', {
        operation: 'cleanup_scheduler',
        error: error.message
      });
    }
  });
  
  // Health check - log running projects every 10 minutes
  cron.schedule('*/10 * * * *', async () => {
    try {
      const healthQuery = `
        SELECT COUNT(*) as running_projects,
               COUNT(CASE WHEN pr.status = 'running' THEN 1 END) as running_runs
        FROM projects p
        LEFT JOIN process_runs pr ON p.id = pr.project_id
        WHERE p.status = 'running'
      `;
      
      db.get(healthQuery, [], (err, row) => {
        if (!err && row) {
          logger.info('System health check', {
            operation: 'health_check',
            runningProjects: row.running_projects,
            runningRuns: row.running_runs,
            timestamp: new Date().toISOString()
          });
        }
      });
      
    } catch (error) {
      logger.error('Health check error', {
        operation: 'health_check',
        error: error.message
      });
    }
  });
  
  logger.info('Background cleanup scheduler started', {
    operation: 'cleanup_scheduler',
    schedules: [
      'Stuck project cleanup: every 2 minutes',
      'Health check: every 10 minutes'
    ]
  });
};

module.exports = { startCleanupScheduler };
