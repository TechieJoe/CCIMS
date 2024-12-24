import 'express-session';

declare module 'express-session' {
  interface SessionData {
    user?: {
      email: string;
      name?: string;
      role?: string;
      _Id?: string;
    };
  }
}
