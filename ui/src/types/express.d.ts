import { IncomingHttpHeaders } from 'http';

declare module 'express-serve-static-core' {
  interface Request {
    user?: { id: string; role: string };  
  }

  interface Request {
    headers: IncomingHttpHeaders & {
      authorization?: string;      
    };
  }
}