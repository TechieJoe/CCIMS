import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomBytes } from 'crypto';
import { User } from 'src/utils/schemas/user';
import { encodedPwd } from 'src/utils/bcrypt';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    private mailerService: MailerService,
  ) {}

  async handlePasswordReset(email: string, token?: string, newPassword?: string): Promise<void | string> {
    if (token) {
      // Reset password logic
      const user = await this.userModel.findOne({ resetToken: token });
      if (!user || user.resetTokenExpiry.getTime() < Date.now()) {
        throw new NotFoundException('Invalid or expired token');
      }

      const hashedPassword = encodedPwd(newPassword);
      user.password = hashedPassword;
      user.resetToken = null; // Clear the reset token
      user.resetTokenExpiry = null; // Clear the expiry
      await user.save();
      return 'Password has been reset';
    } else {
      // Request password reset logic
      const user = await this.userModel.findOne({ email });
      if (!user) throw new NotFoundException('User not found');

      const token = randomBytes(32).toString('hex');
      user.resetToken = token; // Ensure your User model has a `resetToken` field
      const expiryDuration = 60 * 60 * 1000;  // 1 hour in milliseconds
      user.resetTokenExpiry = new Date(Date.now() + expiryDuration);  // Assigning a Date object
      await user.save();

      await this.sendResetEmail(email, token);
      return 'Reset email sent';
    }
  }

  private async sendResetEmail(email: string, token: string): Promise<void> {
    const resetUrl = `http://farm-app/reset-password?token=${token}`;
    await this.mailerService.sendMail({
      to: email,
      subject: 'Password Reset',
      template: './reset', // Specify your template path
      context: {
        resetUrl,
      },
    });
  }
}
