const nodemailer = require('nodemailer');
const crypto = require('crypto');

class EmailService {
  constructor() {
    this.transporter = this.createTransporter();
    this.resetTokens = new Map(); // In production, use Redis or database
  }

  createTransporter() {
    // For development, use a test account or configure your SMTP
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER || 'your-email@gmail.com',
        pass: process.env.SMTP_PASS || 'your-app-password'
      }
    });
  }

  /**
   * Generate a secure reset token
   */
  generateResetToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Store reset token with expiration
   */
  storeResetToken(email, token) {
    const expiresAt = Date.now() + (15 * 60 * 1000); // 15 minutes
    this.resetTokens.set(token, {
      email,
      expiresAt,
      used: false
    });

    // Clean up expired tokens
    this.cleanupExpiredTokens();
  }

  /**
   * Validate reset token
   */
  validateResetToken(token) {
    const tokenData = this.resetTokens.get(token);
    if (!tokenData) {
      return { valid: false, message: 'Invalid reset token' };
    }

    if (tokenData.used) {
      return { valid: false, message: 'Token already used' };
    }

    if (Date.now() > tokenData.expiresAt) {
      this.resetTokens.delete(token);
      return { valid: false, message: 'Reset token expired' };
    }

    return { valid: true, email: tokenData.email };
  }

  /**
   * Mark token as used
   */
  markTokenAsUsed(token) {
    const tokenData = this.resetTokens.get(token);
    if (tokenData) {
      tokenData.used = true;
      this.resetTokens.set(token, tokenData);
    }
  }

  /**
   * Clean up expired tokens
   */
  cleanupExpiredTokens() {
    const now = Date.now();
    for (const [token, data] of this.resetTokens.entries()) {
      if (now > data.expiresAt) {
        this.resetTokens.delete(token);
      }
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email, resetToken, resetUrl) {
    const mailOptions = {
      from: process.env.SMTP_FROM || 'noreply@amreports.com',
      to: [email, 'emmanuel.dadey@navigate.uk.com'].join(','),
      subject: 'Password Reset Request - Navigate Reports Hub',
      html: this.getPasswordResetEmailTemplate(resetUrl, resetToken)
    };

    try {
      await this.transporter.sendMail(mailOptions);
      return { success: true, message: 'Password reset email sent' };
    } catch (error) {
      console.error('Error sending password reset email:', error);
      return { success: false, message: 'Failed to send reset email' };
    }
  }

  /**
   * Send account verification email
   */
  async sendVerificationEmail(email, verificationToken, verificationUrl) {
    const mailOptions = {
      from: process.env.SMTP_FROM || 'noreply@amreports.com',
      to: email,
      subject: 'Verify Your Account - Navigate Reports Hub',
      html: this.getVerificationEmailTemplate(verificationUrl, verificationToken)
    };

    try {
      await this.transporter.sendMail(mailOptions);
      return { success: true, message: 'Verification email sent' };
    } catch (error) {
      console.error('Error sending verification email:', error);
      return { success: false, message: 'Failed to send verification email' };
    }
  }

  /**
   * Send security alert email
   */
  async sendSecurityAlert(email, alertType, details) {
    const mailOptions = {
      from: process.env.SMTP_FROM || 'noreply@amreports.com',
      to: email,
      subject: `Security Alert - ${alertType} - Navigate Reports Hub`,
      html: this.getSecurityAlertTemplate(alertType, details)
    };

    try {
      await this.transporter.sendMail(mailOptions);
      return { success: true, message: 'Security alert sent' };
    } catch (error) {
      console.error('Error sending security alert:', error);
      return { success: false, message: 'Failed to send security alert' };
    }
  }

  /**
   * Password reset email template
   */
  getPasswordResetEmailTemplate(resetUrl, token) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Password Reset</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Password Reset Request</h1>
            <p>Navigate Reports Hub</p>
          </div>
          <div class="content">
            <h2>Hello!</h2>
            <p>We received a request to reset your password for your Navigate Reports Hub account.</p>
            
            <div style="text-align: center;">
              <a href="${resetUrl}?token=${token}" class="button">Reset Password</a>
            </div>
            
            <div class="warning">
              <strong>⚠️ Security Notice:</strong>
              <ul>
                <li>This link will expire in 15 minutes</li>
                <li>If you didn't request this reset, please ignore this email</li>
                <li>Never share this link with anyone</li>
              </ul>
            </div>
            
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all; background: #f0f0f0; padding: 10px; border-radius: 5px;">
              ${resetUrl}?token=${token}
            </p>
            
            <p>Best regards,<br>The Navigate Reports Hub Team</p>
          </div>
          <div class="footer">
            <p>This email was sent to you because a password reset was requested for your account.</p>
            <p>If you have any questions, please contact our support team.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Account verification email template
   */
  getVerificationEmailTemplate(verificationUrl, token) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Verify Your Account</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Welcome to Navigate Reports Hub!</h1>
            <p>Please verify your email address</p>
          </div>
          <div class="content">
            <h2>Thank you for registering!</h2>
            <p>To complete your account setup, please verify your email address by clicking the button below:</p>
            
            <div style="text-align: center;">
              <a href="${verificationUrl}?token=${token}" class="button">Verify Email Address</a>
            </div>
            
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all; background: #f0f0f0; padding: 10px; border-radius: 5px;">
              ${verificationUrl}?token=${token}
            </p>
            
            <p>Best regards,<br>The Navigate Reports Hub Team</p>
          </div>
          <div class="footer">
            <p>This email was sent to verify your account registration.</p>
            <p>If you didn't create an account, please ignore this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Security alert email template
   */
  getSecurityAlertTemplate(alertType, details) {
    const alertMessages = {
      'login_attempt': 'A new login attempt was detected on your account.',
      'password_changed': 'Your password was recently changed.',
      'account_locked': 'Your account has been temporarily locked due to multiple failed login attempts.',
      'suspicious_activity': 'Suspicious activity was detected on your account.'
    };

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Security Alert</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .alert { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🚨 Security Alert</h1>
            <p>Navigate Reports Hub</p>
          </div>
          <div class="content">
            <h2>Security Notice</h2>
            <p>${alertMessages[alertType] || 'A security event occurred on your account.'}</p>
            
            <div class="alert">
              <strong>Details:</strong><br>
              ${details}
            </div>
            
            <p>If this activity was not authorized by you, please:</p>
            <ul>
              <li>Change your password immediately</li>
              <li>Enable two-factor authentication</li>
              <li>Contact our support team</li>
            </ul>
            
            <p>Best regards,<br>The Navigate Reports Hub Security Team</p>
          </div>
          <div class="footer">
            <p>This is an automated security alert. Please take action if this activity was not authorized.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

module.exports = EmailService; 