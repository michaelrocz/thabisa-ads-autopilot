// ============================================================
// THABISA ADS AUTOPILOT — LOGGER UTILITY
// ============================================================
const { createLogger, format, transports } = require('winston');
const path = require('path');
const fs = require('fs');

const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.json()
  ),
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
          return `[${timestamp}] ${level}: ${message}${metaStr}`;
        })
      )
    }),
    new transports.File({ filename: path.join(logsDir, 'error.log'), level: 'error' }),
    new transports.File({ filename: path.join(logsDir, 'combined.log') }),
    new transports.File({ filename: path.join(logsDir, 'actions.log'), level: 'info' }),
  ]
});

// Action logger — structured log for every autopilot decision
logger.logAction = (action) => {
  logger.info('AUTOPILOT_ACTION', {
    timestamp: new Date().toISOString(),
    platform: action.platform,
    object_id: action.objectId,
    object_name: action.objectName || '',
    action: action.action,
    reason: action.reason,
    old_value: action.oldValue ?? null,
    new_value: action.newValue ?? null,
    dry_run: process.env.DRY_RUN !== 'false',
    confidence: action.confidence || 'HIGH',
  });
};

module.exports = logger;
