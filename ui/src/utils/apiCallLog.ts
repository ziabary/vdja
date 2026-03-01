import * as fs from 'fs';
import morgan from 'morgan'
import type { Express, Response } from "express";

import configManager from './configManager';

export default function setupAPICallLogger(app: Express) {
  // Initialize log streams
  let accessLogStream: fs.WriteStream = process.stdout as unknown as fs.WriteStream;
  let errorLogStream: fs.WriteStream = process.stderr as unknown as fs.WriteStream;

  // Set up access log
  if (configManager.active().log.accessPath) {
    const logPath = configManager.active().log.accessPath!;
    accessLogStream = fs.createWriteStream(logPath, { flags: 'a' });
    accessLogStream.on('error', (err) => {
      console.error('Error writing to access log file:', err);
    });
  }

  // Set up error log
  if (configManager.active().log.errorsPath) {
    const logPath =configManager.active().log.errorsPath!;
    errorLogStream = fs.createWriteStream(logPath, { flags: 'a' });
    errorLogStream.on('error', (err) => {
      console.error('Error writing to error log file:', err);
    });
  }

  // Log 2xx responses to access log
  app.use(
    morgan('short', {
      skip: (_, res: Response) => res.statusCode >= 200 && res.statusCode < 300,
      stream: accessLogStream
    })
  );

  // Log non-2xx responses to error log
  app.use(
    morgan('combined', {
      skip: (_, res: Response) => res.statusCode < 200 || res.statusCode >= 300,
      stream: errorLogStream
    })
  );

  app.use(
    morgan('APICall=====> :remote-addr - :method :url ', {
      skip: (_, res: Response) =>!configManager.active().log.showAPICalls && !res.req.originalUrl.startsWith('/api'),
      stream: process.stdout,
      immediate: true
    })
  );
}