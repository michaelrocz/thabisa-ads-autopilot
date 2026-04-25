// ============================================================
// THABISA ADS AUTOPILOT — LOGGER UTILITY
// ============================================================
const { createLogger, format, transports } = require('winston');
const path = require('path');
const fs = require('fs');

const isVercel = !!process.env.VERCEL;
const logsDir = path.join(__dirname, '..', 'logs');

// Only create log directory on local (Vercel has read-only filesystem)
if (!isVercel) {
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
}

const logTransports = [
  new transports.Console({
    format: format.combine(
      format.colorize(),
      format.printf(({ timestamp, level, message, ...meta }) => {
        const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
        return `[${timestamp}] ${level}: ${message}${metaStr}`;
      })
    )
  })
];

// Add file transports only when running locally
if (!isVercel) {
  logTransports.push(
    new transports.File({ filename: path.join(logsDir, 'error.log'), level: 'error' }),
    new transports.File({ filename: path.join(logsDir, 'combined.log') }),
    new transports.File({ filename: path.join(logsDir, 'actions.log'), level: 'info' })
  );
}

const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.json()
  ),
  transports: logTransports
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
