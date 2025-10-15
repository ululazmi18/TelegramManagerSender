const { Queue, Worker, Job } = require('bullmq');
const { db } = require('./db');
const axios = require('axios');
const IORedis = require('ioredis');
const logger = require('./logger');

// Helper function to check if all jobs are complete and update project status
const checkAndUpdateProjectStatus = async (run_id, project_id) => {
  return new Promise((resolve, reject) => {
    // Force database sync to ensure all transactions are committed
    db.run('PRAGMA synchronous = FULL', (syncErr) => {
      if (syncErr) {
        logger.error('Failed to sync database', {
          operation: 'check_project_status',
          runId: run_id,
          error: syncErr.message
        });
      }
      
      // Get current stats with explicit transaction isolation
      const getStatsSql = 'SELECT stats FROM process_runs WHERE id = ?';
      db.get(getStatsSql, [run_id], (err, row) => {
      if (err) {
        logger.error('Failed to get stats for project status check', {
          operation: 'check_project_status',
          runId: run_id,
          projectId: project_id,
          error: err.message
        });
        return reject(err);
      }
      
      if (!row || !row.stats) {
        return resolve(false);
      }
      
      const stats = JSON.parse(row.stats);
      const totalJobs = stats.total_jobs || 0;
      const completedJobs = stats.completed_jobs || 0;
      
      logger.info('Project status check', {
        operation: 'check_project_status',
        runId: run_id,
        projectId: project_id,
        completedJobs,
        totalJobs,
        stats,
        shouldComplete: totalJobs > 0 && completedJobs >= totalJobs
      });
      
      // Check if all jobs are complete
      if (totalJobs > 0 && completedJobs >= totalJobs) {
        logger.info('All jobs completed, stopping project', {
          operation: 'auto_stop_project',
          runId: run_id,
          projectId: project_id,
          completedJobs,
          totalJobs
        });
        
        // Update project status to stopped
        const updateProjectSql = 'UPDATE projects SET status = ? WHERE id = ?';
        db.run(updateProjectSql, ['stopped', project_id], (projectErr) => {
          if (projectErr) {
            logger.error('Failed to update project status to stopped', {
              operation: 'auto_stop_project',
              runId: run_id,
              projectId: project_id,
              error: projectErr.message
            });
            return reject(projectErr);
          }
          
          // Update process run status to completed
          const updateRunSql = 'UPDATE process_runs SET status = ?, updated_at = datetime("now") WHERE id = ?';
          db.run(updateRunSql, ['completed', run_id], (runErr) => {
            if (runErr) {
              logger.error('Failed to update run status to completed', {
                operation: 'auto_stop_project',
                runId: run_id,
                projectId: project_id,
                error: runErr.message
              });
              return reject(runErr);
            }
            
            logger.info('Project stopped successfully', {
              operation: 'auto_stop_project',
              runId: run_id,
              projectId: project_id,
              event: 'project_auto_stopped'
            });
            resolve(true);
          });
        });
      } else {
        resolve(false);
      }
      });
    });
  });
};

// BullMQ connection configuration (uses ioredis internally)
const redisConnection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
};

logger.info('Initializing Redis connection for BullMQ', {
  operation: 'redis_init',
  config: redisConnection
});

// Create a separate ioredis client for lock management
const redisClient = new IORedis(redisConnection);

redisClient.on('error', (err) => {
  logger.error('Redis client error', {
    operation: 'redis_connection',
    error: err.message,
    stack: err.stack
  });
});

redisClient.on('connect', () => {
  logger.info('Redis client connected for lock management', {
    operation: 'redis_connection',
    event: 'redis_connected'
  });
});

// Create queues for different types of jobs
const sendQueue = new Queue('send message', { connection: redisConnection });

// Initialize the worker to process jobs
const worker = new Worker('send message', async (job) => {
  const { session_string, chat_id, type, file_path, caption, reply_to_message_id, run_id } = job.data;
  
  logger.info('Worker processing job', {
    operation: 'process_job',
    jobId: job.id,
    chatId: chat_id,
    runId: run_id,
    type,
    hasFile: !!file_path,
    hasCaption: !!caption,
    hasReplyTo: !!reply_to_message_id
  });
  
  // Acquire lock for the session to prevent concurrent usage
  const lockKey = `session_lock:${job.data.session_id}`;
  const lockValue = `worker_${process.pid}_${Date.now()}`;
  const lockTimeout = 300000; // 5 minutes
  
  // Try to acquire the lock
  const lockAcquired = await redisClient.set(
    lockKey, 
    lockValue, 
    'PX', lockTimeout,
    'NX'
  );
  
  if (!lockAcquired) {
    logger.warn('Session lock acquisition failed', {
      operation: 'process_job',
      jobId: job.id,
      sessionId: job.data.session_id,
      lockKey,
      error: 'Session is locked by another process'
    });
    throw new Error(`Session ${job.data.session_id} is locked by another process`);
  }
  
  logger.debug('Session lock acquired successfully', {
    operation: 'process_job',
    jobId: job.id,
    sessionId: job.data.session_id,
    lockKey,
    lockValue
  });
  
  try {
    // Call the Python service to send the message
    const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';
    logger.debug('Calling Python service to send message', {
      operation: 'send_message',
      jobId: job.id,
      pythonServiceUrl: PYTHON_SERVICE_URL,
      endpoint: '/send_message',
      chatId: chat_id,
      type
    });
    const response = await axios.post(`${PYTHON_SERVICE_URL}/send_message`, {
      session_string,
      chat_id,
      message_type: type,
      file_path,
      caption,
      reply_to_message_id
    }, {
      headers: {
        'x-internal-secret': process.env.INTERNAL_SECRET
      }
    });
    
    // Update the session's last_used_at
    const updateSessionSql = 'UPDATE sessions SET last_used_at = datetime("now") WHERE session_string = ?';
    await new Promise((resolve, reject) => {
      db.run(updateSessionSql, [session_string], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    // Update the process run stats (success count only, completed will be tracked by events)
    // Use manual stats update for consistency
    const getStatsSql = 'SELECT stats FROM process_runs WHERE id = ?';
    const currentStats = await new Promise((resolve, reject) => {
      db.get(getStatsSql, [run_id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    let stats = {};
    if (currentStats && currentStats.stats) {
      try {
        stats = JSON.parse(currentStats.stats);
      } catch (parseErr) {
        logger.error('Failed to parse stats JSON in worker', {
          operation: 'update_worker_stats',
          jobId: job.id,
          runId: run_id,
          error: parseErr.message,
          rawStats: currentStats.stats
        });
        stats = {};
      }
    }
    
    // Increment success_count
    stats.success_count = (stats.success_count || 0) + 1;
    
    const updateStatsSql = 'UPDATE process_runs SET stats = ? WHERE id = ?';
    await new Promise((resolve, reject) => {
      db.run(updateStatsSql, [JSON.stringify(stats)], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    // Log success
    const logSql = 'INSERT INTO logs (run_id, level, message) VALUES (?, ?, ?)';
    await new Promise((resolve, reject) => {
      db.run(logSql, [run_id, 'info', `Message sent successfully to ${chat_id}`], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    logger.info('Worker job completed successfully', {
      operation: 'process_job',
      jobId: job.id,
      runId: run_id,
      chatId: chat_id,
      event: 'job_completed'
    });
    
    // CRITICAL: Direct completion tracking - increment completed_jobs immediately
    try {
      await incrementCompletedJobs(run_id, job.id, true);
    } catch (incErr) {
      logger.error('incrementCompletedJobs failed', {
        operation: 'increment_completed_jobs',
        runId: run_id,
        jobId: job.id,
        error: incErr.message,
        stack: incErr.stack
      });
    }
    
    return response.data;
  } catch (error) {
    // Update the process run stats for failure (error count only)
    // Use manual stats update for consistency
    try {
      const getStatsSql = 'SELECT stats FROM process_runs WHERE id = ?';
      const currentStats = await new Promise((resolve, reject) => {
        db.get(getStatsSql, [run_id], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
      
      let stats = {};
      if (currentStats && currentStats.stats) {
        try {
          stats = JSON.parse(currentStats.stats);
        } catch (parseErr) {
          logger.error('Failed to parse stats JSON in worker error handling', {
          operation: 'update_worker_error_stats',
          jobId: job.id,
          runId: run_id,
          error: parseErr.message,
          rawStats: currentStats.stats
        });
          stats = {};
        }
      }
      
      // Increment error_count
      stats.error_count = (stats.error_count || 0) + 1;
      
      const updateStatsSql = 'UPDATE process_runs SET stats = ? WHERE id = ?';
      await new Promise((resolve, reject) => {
        db.run(updateStatsSql, [JSON.stringify(stats)], (err) => {
          if (err) {
            logger.error('Failed to update error stats in worker', {
              operation: 'update_worker_error_stats',
              jobId: job.id,
              runId: run_id,
              error: err.message
            });
          } else {
            logger.debug('Successfully updated error stats in worker', {
              operation: 'update_worker_error_stats',
              jobId: job.id,
              runId: run_id
            });
          }
          resolve();
        });
      });
    } catch (statsError) {
      logger.error('Failed to update error stats', {
        operation: 'update_worker_error_stats',
        jobId: job.id,
        runId: run_id,
        error: statsError.message,
        stack: statsError.stack
      });
    }
    
    // Log error
    const logSql = 'INSERT INTO logs (run_id, level, message) VALUES (?, ?, ?)';
    await new Promise((resolve, reject) => {
      db.run(logSql, [run_id, 'error', `Failed to send message to ${chat_id}: ${error.message}`], (err) => {
        if (err) {
          logger.error('Failed to log error to database', {
            operation: 'log_error',
            jobId: job.id,
            runId: run_id,
            error: err.message
          });
        }
        resolve();
      });
    });
    
    // CRITICAL: Track failed jobs as completed too (after all retries)
    await incrementCompletedJobs(run_id, job.id, false);
    
    throw error; // This will trigger retries
  } finally {
    // Release the lock
    const currentLockValue = await redisClient.get(lockKey);
    if (currentLockValue === lockValue) {
      await redisClient.del(lockKey);
    }
  }
}, { 
  connection: redisConnection,
  concurrency: 5  // Process up to 5 jobs concurrently
});

// Function to add a send message job to the queue
const addSendMessageJob = async (run_id, project_id, target_channel_id, session_id, message_ref, options = {}) => {
  // Get message details
  const messageSql = 'SELECT message_type, content_ref, caption FROM project_messages WHERE id = ?';
  const message = await new Promise((resolve, reject) => {
    db.get(messageSql, [message_ref], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
  
  // Get caption from text file if caption_message_id is provided
  let caption = message.caption;
  if (options.caption_message_id) {
    const captionMessageSql = 'SELECT content_ref FROM project_messages WHERE id = ?';
    const captionMessage = await new Promise((resolve, reject) => {
      db.get(captionMessageSql, [options.caption_message_id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    // Read text file content for caption
    if (captionMessage && captionMessage.content_ref) {
      const fs = require('fs');
      const path = require('path');
      const captionFileSql = 'SELECT path FROM files WHERE id = ?';
      const captionFile = await new Promise((resolve, reject) => {
        db.get(captionFileSql, [captionMessage.content_ref], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
      
      if (captionFile && captionFile.path) {
        try {
          caption = fs.readFileSync(captionFile.path, 'utf8');
        } catch (err) {
          console.error('Error reading caption file:', err);
        }
      }
    }
  }
  
  // Get file details if this is a media message
  let file_path = null;
  if (message.message_type !== 'text') {
    const fileSql = 'SELECT path FROM files WHERE id = ?';
    const file = await new Promise((resolve, reject) => {
      db.get(fileSql, [message.content_ref], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    file_path = file.path;
  } else {
    // For text messages, read the content from file
    const fileSql = 'SELECT path FROM files WHERE id = ?';
    const file = await new Promise((resolve, reject) => {
      db.get(fileSql, [message.content_ref], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    if (file && file.path) {
      const fs = require('fs');
      try {
        // Read text content and store in caption field for text messages
        caption = fs.readFileSync(file.path, 'utf8');
      } catch (err) {
        console.error('Error reading text file:', err);
      }
    }
  }
  
  // Get channel details - use username as chat_id
  const channelSql = 'SELECT username FROM channels WHERE id = ?';
  const channel = await new Promise((resolve, reject) => {
    db.get(channelSql, [target_channel_id], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
  
  if (!channel) {
    throw new Error(`Channel not found for target_channel_id: ${target_channel_id}`);
  }
  
  if (!channel.username) {
    throw new Error(`Channel ${channel.id} has no username. Please update the channel with a valid username (e.g., @channel_name) to send messages.`);
  }
  
  // Use username as chat_id
  const chat_id = channel.username;
  
  // Get session details
  const sessionSql = 'SELECT session_string FROM sessions WHERE id = ?';
  const session = await new Promise((resolve, reject) => {
    db.get(sessionSql, [session_id], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
  
  if (!session || !session.session_string) {
    throw new Error(`Session not found or has no session_string for session_id: ${session_id}`);
  }
  
  // Get delay configuration
  const delaySql = 'SELECT delay_between_channels_ms FROM delays WHERE project_id = ?';
  const delay = await new Promise((resolve, reject) => {
    db.get(delaySql, [project_id], (err, row) => {
      if (err) resolve({ delay_between_channels_ms: 30000 }); // Default to 30 seconds
      else resolve(row || { delay_between_channels_ms: 30000 });
    });
  });
  
  // Add job to queue with delay
  const jobData = {
    run_id,
    project_id,
    session_id,  // Include session_id for locking
    session_string: session.session_string,
    chat_id: chat_id,  // Use username as chat_id
    type: message.message_type,
    file_path,
    caption: caption,  // Use the caption we prepared (from text file or original)
    ...options
  };
  
  console.log(`[Queue] Adding job for channel ${chat_id}, message type: ${message.message_type}`);
  
  // Use job_index from options to create sequential delays
  logger.info('Calculating job delay', {
    operation: 'addSendMessageJob',
    options_job_index: options.job_index,
    delay_between_channels_ms: delay.delay_between_channels_ms,
    delay_object: delay
  });
  
  let jobDelay = options.job_index 
    ? delay.delay_between_channels_ms * options.job_index 
    : delay.delay_between_channels_ms;
  
  // Ensure jobDelay is a valid number
  if (!isFinite(jobDelay) || isNaN(jobDelay)) {
    logger.warn('Invalid job delay detected, using default', {
      operation: 'addSendMessageJob',
      invalidDelay: jobDelay,
      delay_object: delay,
      options_job_index: options.job_index
    });
    jobDelay = 30000; // Default 30 seconds
  }
    
  logger.info('Job delay calculated', {
    operation: 'addSendMessageJob',
    jobDelay: jobDelay,
    isNaN: isNaN(jobDelay),
    isFinite: isFinite(jobDelay)
  });
  
  const job = await sendQueue.add('send message', jobData, {
    delay: jobDelay,  // Sequential delay based on job index
    attempts: 3,  // Retry up to 3 times
    backoff: {
      type: 'exponential',
      delay: 2000  // Start with 2s, then 4s, then 8s between retries
    }
  });
  
  return job;
};

// Cleanup jobs for a specific project
const cleanupProjectJobs = async (projectId) => {
  try {
    logger.info('Starting job cleanup for project', {
      operation: 'cleanup_project_jobs',
      projectId,
      event: 'cleanup_started'
    });
    
    // Get all waiting and active jobs
    const waitingJobs = await sendQueue.getWaiting();
    const activeJobs = await sendQueue.getActive();
    
    // Remove jobs that belong to this project
    const allJobs = [...waitingJobs, ...activeJobs];
    let removedCount = 0;
    
    for (const job of allJobs) {
      if (job.data && job.data.project_id === projectId) {
        try {
          await job.remove();
          removedCount++;
          logger.debug('Removed job from queue', {
            operation: 'cleanup_project_jobs',
            projectId,
            jobId: job.id
          });
        } catch (err) {
          logger.error('Failed to remove job from queue', {
            operation: 'cleanup_project_jobs',
            projectId,
            jobId: job.id,
            error: err.message
          });
        }
      }
    }
    
    logger.info('Job cleanup completed', {
      operation: 'cleanup_project_jobs',
      projectId,
      removedCount,
      event: 'cleanup_completed'
    });
    return removedCount;
  } catch (error) {
    logger.error('Job cleanup failed', {
      operation: 'cleanup_project_jobs',
      projectId,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
};

// CRITICAL FUNCTION: Increment completed jobs and auto-complete project
const incrementCompletedJobs = async (run_id, job_id, isSuccess) => {
  try {
    logger.info('Incrementing completed jobs counter', {
      operation: 'increment_completed_jobs',
      runId: run_id,
      jobId: job_id,
      isSuccess
    });

    // Get current process run with project_id
    const getRunSql = 'SELECT stats, project_id FROM process_runs WHERE id = ?';
    const processRun = await new Promise((resolve, reject) => {
      db.get(getRunSql, [run_id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!processRun) {
      logger.error('Process run not found for completion tracking', {
        operation: 'increment_completed_jobs',
        runId: run_id,
        jobId: job_id
      });
      return;
    }

    // Parse current stats
    let stats = { total_jobs: 0, completed_jobs: 0, success_count: 0, error_count: 0 };
    if (processRun.stats) {
      try {
        stats = JSON.parse(processRun.stats);
      } catch (parseErr) {
        logger.error('Failed to parse stats JSON', {
          operation: 'increment_completed_jobs',
          runId: run_id,
          error: parseErr.message,
          rawStats: processRun.stats
        });
      }
    }

    // Increment counters
    stats.completed_jobs = (stats.completed_jobs || 0) + 1;
    if (isSuccess) {
      stats.success_count = (stats.success_count || 0) + 1;
    } else {
      stats.error_count = (stats.error_count || 0) + 1;
    }

    logger.info('Job completion stats updated', {
      operation: 'increment_completed_jobs',
      runId: run_id,
      jobId: job_id,
      completedJobs: stats.completed_jobs,
      totalJobs: stats.total_jobs,
      successCount: stats.success_count,
      errorCount: stats.error_count,
      shouldComplete: stats.completed_jobs >= stats.total_jobs
    });

    // Update stats in database
    const updateStatsSql = 'UPDATE process_runs SET stats = ? WHERE id = ?';
    await new Promise((resolve, reject) => {
      db.run(updateStatsSql, [JSON.stringify(stats), run_id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    logger.info('Job completion stats updated', {
      operation: 'increment_completed_jobs',
      runId: run_id,
      projectId: processRun.project_id,
      jobId: job_id,
      completedJobs: stats.completed_jobs,
      totalJobs: stats.total_jobs,
      successCount: stats.success_count,
      errorCount: stats.error_count
    });

    // IMMEDIATE AUTO-COMPLETION: Check if all jobs are done
    // Handle edge case where totalJobs might be 0 or undefined
    const shouldAutoComplete = (stats.total_jobs > 0 && stats.completed_jobs >= stats.total_jobs) ||
                              (stats.total_jobs === 0 && stats.completed_jobs > 0);
    
    if (shouldAutoComplete) {
      logger.info('🎯 ALL JOBS COMPLETED - Triggering immediate project completion', {
        operation: 'auto_complete_project',
        runId: run_id,
        projectId: processRun.project_id,
        completedJobs: stats.completed_jobs,
        totalJobs: stats.total_jobs,
        successCount: stats.success_count,
        errorCount: stats.error_count
      });

      // Update project status to stopped
      const updateProjectSql = 'UPDATE projects SET status = ? WHERE id = ?';
      await new Promise((resolve, reject) => {
        db.run(updateProjectSql, ['stopped', processRun.project_id], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Update process run status to completed
      const updateRunSql = 'UPDATE process_runs SET status = ? WHERE id = ?';
      await new Promise((resolve, reject) => {
        db.run(updateRunSql, ['completed', run_id], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      logger.info('✅ PROJECT AUTO-COMPLETED SUCCESSFULLY', {
        operation: 'auto_complete_project',
        runId: run_id,
        projectId: processRun.project_id,
        event: 'project_auto_completed'
      });
    }

  } catch (error) {
    logger.error('Failed to increment completed jobs', {
      operation: 'increment_completed_jobs',
      runId: run_id,
      jobId: job_id,
      error: error.message,
      stack: error.stack
    });
  }
};

module.exports = {
  sendQueue,
  worker,
  addSendMessageJob,
  redisClient,
  checkAndUpdateProjectStatus,
  cleanupProjectJobs
};