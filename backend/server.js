require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const logger = require('./logger');
const { startCleanupScheduler } = require('./cleanup-scheduler');
const sessionRoutes = require('./routes/sessions');
const credentialRoutes = require('./routes/credentials');
const channelRoutes = require('./routes/channels');
const categoryRoutes = require('./routes/categories');
const fileRoutes = require('./routes/files');
const projectRoutes = require('./routes/projects');
const projectTargetsRoutes = require('./routes/projectTargets');
const projectSessionsRoutes = require('./routes/projectSessions');
const projectMessagesRoutes = require('./routes/projectMessages');
const delaysRoutes = require('./routes/delays');
const internalRoutes = require('./routes/internal');
const dashboardRoutes = require('./routes/dashboard');
const TerminalServer = require('./terminal-server');
// Use native sqlite3 for better compatibility
const { db } = require('./db-sqlite3');
const { worker, checkAndUpdateProjectStatus } = require('./queue');

const app = express();
const PORT = process.env.PORT || 3000;

logger.info('Starting Telegram Backend Server', {
  port: PORT,
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'debug'
});

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Add request logging middleware
app.use(logger.logRequest);

// Serve static files from frontend directory
app.use(express.static('../frontend'));

// Serve static files from public directory
app.use(express.static('public'));

// Routes
app.use('/api/sessions', sessionRoutes);
app.use('/api/credentials', credentialRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/projects', projectTargetsRoutes);
app.use('/api/projects', projectSessionsRoutes);
app.use('/api/projects', projectMessagesRoutes);
app.use('/api/projects', delaysRoutes);
// Bulk endpoints
app.use('/api/project-sessions', projectSessionsRoutes);
app.use('/api/project-targets', projectTargetsRoutes);
app.use('/api/project-messages', projectMessagesRoutes);
app.use('/internal', internalRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'telegram-app-backend' });
});

// Database is already initialized in db-sqlite3.js

// Ensure worker is running and track job completion
worker.on('completed', async (job) => {
  logger.info('Job completed successfully', {
    jobId: job.id,
    jobData: job.data,
    event: 'job_completed'
  });
  
  // Increment completed_jobs counter
  const { run_id, project_id } = job.data;
  if (run_id && project_id) {
    // Get current stats first
    const getStatsSql = 'SELECT stats FROM process_runs WHERE id = ?';
    db.get(getStatsSql, [run_id], (getErr, row) => {
      if (getErr) {
        logger.error('Failed to get current stats for job completion', {
          error: getErr.message,
          runId: run_id,
          projectId: project_id,
          jobId: job.id
        });
        return;
      }
      
      let stats = {};
      if (row && row.stats) {
        try {
          stats = JSON.parse(row.stats);
        } catch (parseErr) {
          logger.error('Failed to parse stats JSON for job completion', {
            error: parseErr.message,
            runId: run_id,
            rawStats: row.stats,
            jobId: job.id
          });
          stats = {};
        }
      }
      
      // Increment completed_jobs
      stats.completed_jobs = (stats.completed_jobs || 0) + 1;
      stats.success_count = (stats.success_count || 0) + 1;
      
      logger.info('Job completion stats updated', {
        runId: run_id,
        projectId: project_id,
        completedJobs: stats.completed_jobs,
        totalJobs: stats.total_jobs || 0,
        successCount: stats.success_count,
        jobId: job.id
      });
      
      // Update stats back to database with timeout and fallback
      const updateSql = 'UPDATE process_runs SET stats = ? WHERE id = ?';
      
      // Set up database operation timeout
      let dbOperationCompleted = false;
      let timeoutId = null;
      
      // Fallback mechanism - force auto-completion check after 5 seconds regardless of DB status
      const fallbackTimeoutId = setTimeout(async () => {
        if (!dbOperationCompleted) {
          logger.warn('Database operation timeout, forcing auto-completion check', {
            runId: run_id,
            projectId: project_id,
            jobId: job.id,
            timeoutSeconds: 5
          });
          await checkAndUpdateProjectStatus(run_id, project_id);
        }
      }, 5000);
      
      db.run(updateSql, [JSON.stringify(stats), run_id], async function(err) {
        dbOperationCompleted = true;
        clearTimeout(fallbackTimeoutId);
        
        if (err) {
          logger.error('Failed to update completed_jobs stats', {
            error: err.message,
            runId: run_id,
            projectId: project_id,
            jobId: job.id
          });
          
          // Even if DB update fails, still try auto-completion
          logger.info('Attempting auto-completion despite DB error', {
            runId: run_id,
            projectId: project_id,
            jobId: job.id
          });
          setTimeout(async () => {
            await checkAndUpdateProjectStatus(run_id, project_id);
          }, 1000);
          
        } else {
          logger.debug('Successfully updated completed_jobs stats', {
            runId: run_id,
            projectId: project_id,
            jobId: job.id,
            changes: this.changes
          });
          
          // Immediate auto-completion check since DB update succeeded
          logger.info('Database update successful, scheduling auto-completion', {
            runId: run_id,
            projectId: project_id,
            jobId: job.id,
            changes: this.changes
          });
          
          // Use immediate verification instead of setTimeout to avoid race conditions
          setImmediate(() => {
            const verifySql = 'SELECT stats FROM process_runs WHERE id = ?';
            db.get(verifySql, [run_id], async (verifyErr, verifyRow) => {
              if (verifyErr) {
                logger.error('Failed to verify database update', {
                  runId: run_id,
                  error: verifyErr.message
                });
                return;
              }
              
              if (verifyRow && verifyRow.stats) {
                try {
                  const verifyStats = JSON.parse(verifyRow.stats);
                  logger.info('Database verification result', {
                    runId: run_id,
                    verifiedCompletedJobs: verifyStats.completed_jobs,
                    verifiedTotalJobs: verifyStats.total_jobs,
                    shouldComplete: verifyStats.completed_jobs >= verifyStats.total_jobs
                  });
                  
                  // Proceed with auto-completion
                  await checkAndUpdateProjectStatus(run_id, project_id);
                  
                } catch (parseErr) {
                  logger.error('Failed to parse verified stats', {
                    runId: run_id,
                    error: parseErr.message,
                    rawStats: verifyRow.stats
                  });
                }
              } else {
                logger.error('Database verification failed - no stats found', {
                  runId: run_id
                });
              }
            });
          }); // No delay, immediate execution
        }
      });
    });
  }
});

worker.on('failed', async (job, err) => {
  logger.error('Job failed', {
    jobId: job.id,
    error: err.message,
    stack: err.stack,
    attemptsMade: job.attemptsMade,
    maxAttempts: job.opts.attempts,
    jobData: job.data,
    event: 'job_failed'
  });
  
  // Also increment completed_jobs on final failure (after all retries exhausted)
  if (job.attemptsMade >= job.opts.attempts) {
    logger.warn('Job exhausted all retries, marking as completed', {
      jobId: job.id,
      attemptsMade: job.attemptsMade,
      maxAttempts: job.opts.attempts,
      finalError: err.message
    });
    
    const { run_id, project_id } = job.data;
    if (run_id && project_id) {
      // Get current stats first (same as success case)
      const getStatsSql = 'SELECT stats FROM process_runs WHERE id = ?';
      db.get(getStatsSql, [run_id], (getErr, row) => {
        if (getErr) {
          logger.error('Failed to get current stats on job failure', {
            error: getErr.message,
            runId: run_id,
            projectId: project_id,
            jobId: job.id
          });
          return;
        }
        
        let stats = {};
        if (row && row.stats) {
          try {
            stats = JSON.parse(row.stats);
          } catch (parseErr) {
            logger.error('Failed to parse stats JSON on job failure', {
              error: parseErr.message,
              runId: run_id,
              rawStats: row.stats,
              jobId: job.id
            });
            stats = {};
          }
        }
        
        // Increment completed_jobs and error_count
        stats.completed_jobs = (stats.completed_jobs || 0) + 1;
        stats.error_count = (stats.error_count || 0) + 1;
        
        logger.info('Job failure stats updated', {
          runId: run_id,
          projectId: project_id,
          completedJobs: stats.completed_jobs,
          totalJobs: stats.total_jobs || 0,
          errorCount: stats.error_count,
          jobId: job.id
        });
        
        // Update stats back to database with timeout and fallback
        const updateSql = 'UPDATE process_runs SET stats = ? WHERE id = ?';
        
        // Set up database operation timeout for failed jobs
        let dbOperationCompleted = false;
        
        // Fallback mechanism - force auto-completion check after 5 seconds regardless of DB status
        const fallbackTimeoutId = setTimeout(async () => {
          if (!dbOperationCompleted) {
            logger.warn('Database operation timeout on job failure, forcing auto-completion check', {
              runId: run_id,
              projectId: project_id,
              jobId: job.id,
              timeoutSeconds: 5
            });
            await checkAndUpdateProjectStatus(run_id, project_id);
          }
        }, 5000);
        
        db.run(updateSql, [JSON.stringify(stats), run_id], async function(updateErr) {
          dbOperationCompleted = true;
          clearTimeout(fallbackTimeoutId);
          
          if (updateErr) {
            logger.error('Failed to update completed_jobs stats on failure', {
              error: updateErr.message,
              runId: run_id,
              projectId: project_id,
              jobId: job.id
            });
            
            // Even if DB update fails, still try auto-completion
            logger.info('Attempting auto-completion despite DB error on job failure', {
              runId: run_id,
              projectId: project_id,
              jobId: job.id
            });
            setTimeout(async () => {
              await checkAndUpdateProjectStatus(run_id, project_id);
            }, 1000);
            
          } else {
            logger.debug('Successfully updated failure stats', {
              runId: run_id,
              projectId: project_id,
              jobId: job.id,
              changes: this.changes
            });
            
            // Immediate auto-completion check since DB update succeeded
            logger.info('Failure stats update successful, scheduling auto-completion', {
              runId: run_id,
              projectId: project_id,
              jobId: job.id,
              changes: this.changes
            });
            
            setImmediate(async () => {
              await checkAndUpdateProjectStatus(run_id, project_id);
            }); // No delay, immediate execution
          }
        });
      });
    }
  }
});

// Start cleanup scheduler
startCleanupScheduler();

// Start server with WebSocket support
const server = app.listen(PORT, () => {
  logger.info('Server started successfully', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    features: [
      'BullMQ Worker with timeout protection',
      'Database operation fallback mechanism', 
      'Background cleanup scheduler',
      'Auto-completion for stuck projects'
    ],
    webTerminalUrl: `http://localhost:${PORT}/terminal.html`,
    event: 'server_started'
  });
});

// Initialize Terminal Server
const terminalServer = new TerminalServer(server);
logger.info('WebSocket Terminal Server initialized', {
  event: 'websocket_initialized'
});

// Terminal monitoring endpoints
app.get('/api/terminal/stats', (req, res) => {
  try {
    const stats = terminalServer.getStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/terminal/sessions', (req, res) => {
  try {
    const sessions = terminalServer.getTerminalInfo();
    res.json({
      success: true,
      data: sessions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// FALLBACK MECHANISM: Periodic check for stuck projects
const { fixStuckProjects } = require('./fix-stuck-projects');

// Check for stuck projects every 30 seconds
setInterval(async () => {
  try {
    await fixStuckProjects();
  } catch (error) {
    logger.error('Periodic stuck projects check failed', {
      operation: 'periodic_stuck_check',
      error: error.message
    });
  }
}, 30000); // 30 seconds

logger.info('Periodic stuck projects checker started', {
  operation: 'startup',
  interval: '30 seconds'
});

module.exports = app;