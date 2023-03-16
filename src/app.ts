import express, { NextFunction, Request, Response } from 'express';
import dotenv from 'dotenv';
import { router } from './routes/api.js';
import { createAdmin, isAdmin } from './lib/Users.js';

dotenv.config();

declare global {
  namespace Express {
    interface User {
      username: string;
      id?: number;
      admin: Boolean;
    }
  }
}

const app = express();

app.use(express.json());

app.use(router);

const port = 3000;

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});

function notFoundHandler(req:Request, res:Response, next:NextFunction) {
  console.warn('Not found', req.originalUrl);
  res.status(404).json({ error: 'Not found' });
}

function errorHandler(err: Error , req: Request, res:Response, next: NextFunction) { 
  console.error(err);

  if (err instanceof SyntaxError && res.statusCode === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Invalid json' });
  }

  return res.status(500).json({ error: 'Internal server error' });
}
app.use(notFoundHandler);
app.use(errorHandler);
