const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs-extra');
const path = require('path');
const SecurityService = require('./SecurityService');
const EmailService = require('./EmailService');
const SessionService = require('./SessionService');
class AuthService {
  constructor() {
    // Prefer Railway persistent volume if available
    const volumeRoot = process.env.PERSISTENT_STORAGE_PATH || process.env.RAILWAY_VOLUME_PATH || '';
    this.baseDataDir = volumeRoot ? path.join(volumeRoot, 'data') : 'data';
    this.usersFile = path.join(this.baseDataDir, 'users.json');
    this.sessionsFile = path.join(this.baseDataDir, 'sessions.json');
    this.ensureDataDirectory();
    this.initializeDefaultUsers();
    this.securityService = new SecurityService();
    this.emailService = new EmailService();
    this.sessionService = new SessionService();
  }

  ensureDataDirectory() {
    fs.ensureDirSync(this.baseDataDir);
  }

  async initializeDefaultUsers() {
    try {
      const users = await this.getUsers();
      const defaultAdminPassword = process.env.ADMIN_DEFAULT_PASSWORD || 'admin123';
      const defaultUsers = [
        {
          id: 1,
          username: 'admin',
          email: 'admin@amreports.com',
          password: await bcrypt.hash(defaultAdminPassword, 10),
          role: 'admin',
          name: 'System Administrator',
          accountManagerId: null,
          isActive: true,
          createdAt: new Date().toISOString(),
          lastLogin: null
        },
        {
          id: 2,
          username: 'demo',
          email: 'demo@amreports.com',
          password: await bcrypt.hash('demo123', 10),
          role: 'account_manager',
          name: 'Demo Account Manager',
          accountManagerId: 1,
          isActive: process.env.NODE_ENV === 'production' ? false : true,
          createdAt: new Date().toISOString(),
          lastLogin: null
        }
      ];

      if (users.length === 0) {
        await fs.writeJson(this.usersFile, defaultUsers, { spaces: 2 });
        console.log('Default users created');
        return;
      }

      // Ensure admin user always exists and is active. Optionally reset password if ADMIN_FORCE_RESET=1
      const adminIndex = users.findIndex(u => u.username === 'admin');
      const forceReset = (process.env.ADMIN_FORCE_RESET === '1' || process.env.ADMIN_FORCE_RESET === 'true');
      if (adminIndex === -1) {
        users.unshift(defaultUsers[0]);
        await fs.writeJson(this.usersFile, users, { spaces: 2 });
        console.log('Admin user recreated');
      } else {
        let mutated = false;
        if (users[adminIndex].isActive === false) { users[adminIndex].isActive = true; mutated = true; }
        if (forceReset) {
          users[adminIndex].password = await bcrypt.hash(defaultAdminPassword, 10);
          mutated = true;
          console.log('Admin password reset from env default');
        }
        if (mutated) {
          await fs.writeJson(this.usersFile, users, { spaces: 2 });
        }
      }
    } catch (error) {
      console.error('Error initializing default users:', error);
    }
  }

  async getUsers() {
    try {
      return await fs.readJson(this.usersFile);
    } catch (error) {
      return [];
    }
  }

  async getUserById(userId) {
    const users = await this.getUsers();
    return users.find(user => user.id === userId);
  }

  async getUserByUsername(username) {
    const users = await this.getUsers();
    return users.find(user => user.username === username);
  }

  async getUserByEmail(email) {
    const users = await this.getUsers();
    return users.find(user => user.email === email);
  }

  async authenticateUser(username, password, ipAddress, userAgent) {
    try {
      const user = await this.getUserByUsername(username);
      
      if (!user || !user.isActive) {
        await this.securityService.trackLoginAttempt(username, false, ipAddress, userAgent);
        return { success: false, message: 'Invalid credentials' };
      }

      // Bypass IP/account lock for admin to avoid lockouts in emergencies
      if (username !== 'admin') {
        // Check if IP is blocked
        const isIPBlocked = await this.securityService.shouldBlockIP(ipAddress);
        if (isIPBlocked) {
          await this.securityService.trackLoginAttempt(username, false, ipAddress, userAgent);
          return { success: false, message: 'Too many failed attempts from this IP. Please try again later.' };
        }
        // Check if account is locked
        const isAccountLocked = await this.securityService.shouldLockAccount(username, ipAddress);
        if (isAccountLocked) {
          await this.securityService.trackLoginAttempt(username, false, ipAddress, userAgent);
          return { success: false, message: 'Account temporarily locked due to multiple failed attempts. Please try again in 15 minutes.' };
        }
      }

      let isValidPassword = await bcrypt.compare(password, user.password);
      
      // Fallback: allow admin to use default password and auto-heal stored hash
      if (!isValidPassword && username === 'admin') {
        const fallbackPwd = process.env.ADMIN_DEFAULT_PASSWORD || 'admin123';
        if (password === fallbackPwd) {
          try {
            const users = await this.getUsers();
            const adminIdx = users.findIndex(u => u.username === 'admin');
            if (adminIdx !== -1) {
              users[adminIdx].password = await bcrypt.hash(fallbackPwd, 10);
              users[adminIdx].isActive = true;
              await fs.writeJson(this.usersFile, users, { spaces: 2 });
              isValidPassword = true;
              console.log('Admin password auto-healed from fallback');
            }
          } catch (e) {
            console.error('Failed to auto-heal admin password:', e);
          }
        }
      }

      if (!isValidPassword) {
        await this.securityService.trackLoginAttempt(username, false, ipAddress, userAgent);
        return { success: false, message: 'Invalid credentials' };
      }

      // Track successful login
      await this.securityService.trackLoginAttempt(username, true, ipAddress, userAgent);

      // Check for suspicious activity
      const suspiciousActivity = await this.securityService.detectSuspiciousActivity(username, ipAddress, userAgent);
      if (suspiciousActivity.suspicious) {
        await this.emailService.sendSecurityAlert(user.email, 'suspicious_activity', suspiciousActivity.details);
      }

      // Update last login
      await this.updateLastLogin(user.id);

      // Generate JWT token
      const token = this.generateToken(user);

      // Store session
      await this.createSession(user.id, token);

      return {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          name: user.name,
          accountManagerId: user.accountManagerId
        },
        token
      };
    } catch (error) {
      console.error('Authentication error:', error);
      return { success: false, message: 'Authentication failed' };
    }
  }

  async updateLastLogin(userId) {
    try {
      const users = await this.getUsers();
      const userIndex = users.findIndex(user => user.id === userId);
      
      if (userIndex !== -1) {
        users[userIndex].lastLogin = new Date().toISOString();
        await fs.writeJson(this.usersFile, users, { spaces: 2 });
      }
    } catch (error) {
      console.error('Error updating last login:', error);
    }
  }

  generateToken(user) {
    const payload = {
      userId: user.id,
      username: user.username,
      role: user.role,
      accountManagerId: user.accountManagerId
    };

    const secret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
    const options = {
      expiresIn: '24h',
      issuer: 'am-reports',
      audience: 'am-reports-users'
    };

    return jwt.sign(payload, secret, options);
  }

  verifyToken(token) {
    try {
      const secret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
      const decoded = jwt.verify(token, secret, {
        issuer: 'am-reports',
        audience: 'am-reports-users'
      });
      return { success: true, user: decoded };
    } catch (error) {
      return { success: false, message: 'Invalid token' };
    }
  }

  async createSession(userId, token) {
    try {
      this.sessionService.createSession(userId, token);
    } catch (error) {
      console.error('Error creating session:', error);
    }
  }

  async getSessions() {
    try {
      return this.sessionService.getAllSessions();
    } catch (error) {
      console.error('Error getting sessions:', error);
      return [];
    }
  }

  async validateSession(token) {
    try {
      // Verify JWT first so a valid token can recreate an in-memory session if needed
      const tokenVerification = this.verifyToken(token);
      if (!tokenVerification.success) {
        console.log('Session validation: Invalid token');
        this.sessionService.removeSession(token);
        return { success: false, message: 'Invalid token' };
      }

      // Try to get an existing session
      let session = this.sessionService.getSession(token);
      if (!session) {
        console.log('Session validation: No session in memory, recreating from valid token');
        try {
          this.sessionService.createSession(tokenVerification.user.userId, token);
        } catch (e) {
          console.warn('Session recreation failed, proceeding with stateless auth:', e?.message || e);
        }
      }

      console.log('Session validation: Success');
      return { success: true, user: tokenVerification.user };
    } catch (error) {
      console.error('Session validation error:', error);
      return { success: false, message: 'Session validation failed' };
    }
  }

  async removeSession(token) {
    try {
      this.sessionService.removeSession(token);
    } catch (error) {
      console.error('Error removing session:', error);
    }
  }

  async logout(token) {
    await this.removeSession(token);
    return { success: true, message: 'Logged out successfully' };
  }

  async createUser(userData) {
    try {
      const users = await this.getUsers();
      
      // Check if username or email already exists
      const existingUser = users.find(u => 
        u.username === userData.username || u.email === userData.email
      );
      
      if (existingUser) {
        return { success: false, message: 'Username or email already exists' };
      }

      // Validate password strength
      const passwordValidation = this.securityService.validatePasswordStrength(userData.password);
      if (!passwordValidation.valid) {
        return { 
          success: false, 
          message: 'Password does not meet security requirements',
          suggestions: passwordValidation.suggestions
        };
      }

      const newUser = {
        id: Date.now(),
        username: userData.username,
        email: userData.email,
        password: await bcrypt.hash(userData.password, 10),
        role: userData.role || 'user',
        name: userData.name,
        accountManagerId: userData.accountManagerId || null,
        isActive: true,
        emailVerified: false,
        createdAt: new Date().toISOString(),
        lastLogin: null
      };

      users.push(newUser);
      await fs.writeJson(this.usersFile, users, { spaces: 2 });

      // Send verification email
      const verificationToken = this.emailService.generateResetToken();
      this.emailService.storeResetToken(userData.email, verificationToken);
      
      const verificationUrl = `${process.env.BASE_URL || ''}/verify-email.html`;
      await this.emailService.sendVerificationEmail(userData.email, verificationToken, verificationUrl);

      return {
        success: true,
        user: {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email,
          role: newUser.role,
          name: newUser.name,
          accountManagerId: newUser.accountManagerId
        }
      };
    } catch (error) {
      console.error('Error creating user:', error);
      return { success: false, message: 'Failed to create user' };
    }
  }

  async updateUser(userId, updates) {
    try {
      const users = await this.getUsers();
      const userIndex = users.findIndex(user => user.id === userId);
      
      if (userIndex === -1) {
        return { success: false, message: 'User not found' };
      }

      // Update allowed fields
      const allowedUpdates = ['name', 'email', 'role', 'accountManagerId', 'isActive'];
      allowedUpdates.forEach(field => {
        if (updates[field] !== undefined) {
          users[userIndex][field] = updates[field];
        }
      });

      // Handle password update separately
      if (updates.password) {
        users[userIndex].password = await bcrypt.hash(updates.password, 10);
      }

      await fs.writeJson(this.usersFile, users, { spaces: 2 });

      return {
        success: true,
        user: {
          id: users[userIndex].id,
          username: users[userIndex].username,
          email: users[userIndex].email,
          role: users[userIndex].role,
          name: users[userIndex].name,
          accountManagerId: users[userIndex].accountManagerId
        }
      };
    } catch (error) {
      console.error('Error updating user:', error);
      return { success: false, message: 'Failed to update user' };
    }
  }

  async deleteUser(userId) {
    try {
      const users = await this.getUsers();
      const filteredUsers = users.filter(user => user.id !== userId);
      await fs.writeJson(this.usersFile, filteredUsers, { spaces: 2 });
      return { success: true, message: 'User deleted successfully' };
    } catch (error) {
      console.error('Error deleting user:', error);
      return { success: false, message: 'Failed to delete user' };
    }
  }

  // Middleware for protecting routes
  requireAuth() {
    return async (req, res, next) => {
      try {
        const token = req.headers.authorization?.replace('Bearer ', '') || 
                     req.cookies?.token || 
                      req.query.token;

        console.log('🔐 Auth middleware - Token present:', !!token);
        console.log('🔐 Auth middleware - Token source:', req.headers.authorization ? 'header' : req.cookies?.token ? 'cookie' : req.query.token ? 'query' : 'none');

        if (!token) {
          console.log('❌ Auth middleware - No token found');
          // Avoid server-side redirects to prevent loops; let client handle navigation
          return res.status(401).json({ error: 'Authentication required', redirect: '/login' });
        }

        const sessionValidation = await this.validateSession(token);
        console.log('🔐 Auth middleware - Session validation result:', sessionValidation.success);
        
        if (!sessionValidation.success) {
          console.log('❌ Auth middleware - Session validation failed:', sessionValidation.message);
          // Do not clear cookie or redirect here to avoid loops
          return res.status(401).json({ error: sessionValidation.message || 'Authentication required', redirect: '/login' });
        }

        console.log('✅ Auth middleware - Authentication successful for user:', sessionValidation.user?.username);
        req.user = sessionValidation.user;
        next();
      } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(500).json({ error: 'Authentication error' });
      }
    };
  }

  // Middleware for role-based access control
  requireRole(roles) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userRole = req.user.role;
      const allowedRoles = Array.isArray(roles) ? roles : [roles];

      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      next();
    };
  }

  /**
   * Forgot password functionality
   */
  async forgotPassword(email) {
    try {
      const user = await this.getUserByEmail(email);
      
      if (!user) {
        // Don't reveal if email exists or not for security
        return { success: true, message: 'If the email exists, a reset link has been sent.' };
      }

      // Generate reset token
      const resetToken = this.emailService.generateResetToken();
      this.emailService.storeResetToken(email, resetToken);
      
      // Send reset email
      const resetUrl = `${process.env.BASE_URL || ''}/reset-password.html`;
      const emailResult = await this.emailService.sendPasswordResetEmail(email, resetToken, resetUrl);
      
      if (emailResult.success) {
        return { success: true, message: 'Password reset email sent successfully.' };
      } else {
        return { success: false, message: 'Failed to send reset email. Please try again.' };
      }
    } catch (error) {
      console.error('Forgot password error:', error);
      return { success: false, message: 'Failed to process password reset request.' };
    }
  }

  /**
   * Reset password functionality
   */
  async resetPassword(token, newPassword) {
    try {
      // Validate reset token
      const tokenValidation = this.emailService.validateResetToken(token);
      if (!tokenValidation.valid) {
        return { success: false, message: tokenValidation.message };
      }

      // Validate password strength
      const passwordValidation = this.securityService.validatePasswordStrength(newPassword);
      if (!passwordValidation.valid) {
        return { 
          success: false, 
          message: 'Password does not meet security requirements',
          suggestions: passwordValidation.suggestions
        };
      }

      // Get user by email
      const user = await this.getUserByEmail(tokenValidation.email);
      if (!user) {
        return { success: false, message: 'User not found' };
      }

      // Update password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      const users = await this.getUsers();
      const userIndex = users.findIndex(u => u.id === user.id);
      
      if (userIndex !== -1) {
        users[userIndex].password = hashedPassword;
        await fs.writeJson(this.usersFile, users, { spaces: 2 });
        
        // Mark token as used
        this.emailService.markTokenAsUsed(token);
        
        // Send security alert
        await this.emailService.sendSecurityAlert(user.email, 'password_changed', 
          'Your password was changed via password reset link.');
        
        // Log security event
        await this.securityService.logSecurityEvent('password_reset', {
          userId: user.id,
          username: user.username,
          email: user.email
        });
        
        return { success: true, message: 'Password reset successfully.' };
      } else {
        return { success: false, message: 'Failed to update password.' };
      }
    } catch (error) {
      console.error('Reset password error:', error);
      return { success: false, message: 'Failed to reset password.' };
    }
  }

  /**
   * Verify email functionality
   */
  async verifyEmail(token) {
    try {
      // Validate verification token
      const tokenValidation = this.emailService.validateResetToken(token);
      if (!tokenValidation.valid) {
        return { success: false, message: tokenValidation.message };
      }

      // Get user by email
      const user = await this.getUserByEmail(tokenValidation.email);
      if (!user) {
        return { success: false, message: 'User not found' };
      }

      // Update email verification status
      const users = await this.getUsers();
      const userIndex = users.findIndex(u => u.id === user.id);
      
      if (userIndex !== -1) {
        users[userIndex].emailVerified = true;
        await fs.writeJson(this.usersFile, users, { spaces: 2 });
        
        // Mark token as used
        this.emailService.markTokenAsUsed(token);
        
        return { success: true, message: 'Email verified successfully.' };
      } else {
        return { success: false, message: 'Failed to verify email.' };
      }
    } catch (error) {
      console.error('Verify email error:', error);
      return { success: false, message: 'Failed to verify email.' };
    }
  }

  /**
   * Get user security logs
   */
  async getUserSecurityLogs(userId, hours = 24) {
    try {
      const user = await this.getUserById(userId);
      if (!user) {
        return { success: false, message: 'User not found' };
      }

      const loginAttempts = await this.securityService.getUserLoginAttempts(user.username, hours);
      const securityLogs = await this.securityService.getUserSecurityLogs(user.username, hours);
      
      return {
        success: true,
        data: {
          loginAttempts,
          securityLogs,
          lastLogin: user.lastLogin
        }
      };
    } catch (error) {
      console.error('Error getting user security logs:', error);
      return { success: false, message: 'Failed to get security logs' };
    }
  }
}

module.exports = AuthService; 