import { PassportSerializer } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';

@Injectable()
export class SessionSerializer extends PassportSerializer {
  serializeUser(user: any, done: Function) {
    done(null, user._id); // Store user ID in the session
  }

  deserializeUser(userId: string, done: Function) {
    done(null, { userId }); // Retrieve user ID from the session
  }
}
