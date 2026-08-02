// src/logger.ts
import path from 'path'
import winston from 'winston';
import { transports } from 'winston';
import { inspect } from 'util';

// Extend the winston Logger type
declare module 'winston' {
  interface Logger {
    deepDebug(obj: Object): void;
    raw(message: string): void;
  }
}

// Custom log format
const logFormat = winston.format.printf(
  ({ level, message, timestamp, sourceFile, lineNumber,...meta }) => {
    const metaString = Object.keys(meta).length
      ? ` | ${inspect(meta, { depth: null, colors: true })}`
      : '';
    if (process.env.NODE_ENV === 'production') 
      return `[${timestamp}] [${level}] ${message}`;  
    return `[${timestamp}] [${level}] (${sourceFile}:${lineNumber}): ${message}`;
  }
);

const sourceFileFormat = winston.format((info) => {
  const stack = new Error().stack?.split('\n');

  // 1. Identify the line that called the logger
  const callerLine = stack?.find((line) => {
    return (
      !line.includes('node_modules') &&             // Ignore libraries
      !line.includes('logger.ts') &&                // Ignore THIS file
      !line.includes('node:internal') &&            // Ignore Node internals
      (line.includes('/') || line.includes('\\'))   // Must contain a path
    );
  });

  if (callerLine) {
    // 2. Extract path and line number
    // This regex handles both standard paths and (path:line:col) formats
    const match = callerLine.match(/(?:at\s+)?(?:.*\((.*):(\d+):(\d+)\)|(.*):(\d+):(\d+))/);
    
    if (match) {
      // match[1] or match[4] will contain the file path
      const filePath = match[1]! || match[4]!;
      const lineNo = match[2]! || match[5]!;
      
      info.sourceFile = path.basename(filePath);
      info.lineNumber = lineNo;
    }
  }

  return info;
});

// Create a logger
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    sourceFileFormat(),
    logFormat
  ), 
  transports: [
    // Console transport (for dev)
    new transports.Console({
      format: winston.format.combine(
        sourceFileFormat(),
        winston.format.colorize(), // Add color
        logFormat
      ),
    }),
    // File transport (for production)
    new transports.File({
      filename: 'logs/production.log',
      level: 'error', // Only log errors in production
    }),
  ],
});

// In production, remove the console transport
if (process.env.NODE_ENV === 'production') 
  logger.remove(winston.transports.Console);

logger.deepDebug = (obj: Object): void => {
  const formatted = inspect(obj, {
    showHidden: false,
    depth: null,
    colors: true,
  });
  logger.debug(formatted);
};

logger.raw = (message: string) => {
  // eslint-disable-next-line no-console
  console.log(message)
};

export default logger;