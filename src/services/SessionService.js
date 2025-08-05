class SessionService {
  constructor() {
    this.sessions = new Map();
    this.cleanupInterval = setInterval(() => this.cleanupExpiredSessions(), 60000); // Clean up every minute
  }

  createSession(userId, token) {
    const session = {
      id: Date.now().toString(),
      userId,
      token,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
    };
    
    this.sessions.set(token, session);
    console.log(`Session created for user ${userId}`);
    return session;
  }

  getSession(token) {
    const session = this.sessions.get(token);
    if (!session) {
      return null;
    }
    
    // Check if session is expired
    if (new Date() > new Date(session.expiresAt)) {
      this.sessions.delete(token);
      return null;
    }
    
    return session;
  }

  removeSession(token) {
    this.sessions.delete(token);
    console.log(`Session removed for token: ${token.substring(0, 10)}...`);
  }

  cleanupExpiredSessions() {
    const now = new Date();
    let cleanedCount = 0;
    
    for (const [token, session] of this.sessions.entries()) {
      if (new Date(session.expiresAt) < now) {
        this.sessions.delete(token);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} expired sessions`);
    }
  }

  getAllSessions() {
    return Array.from(this.sessions.values());
  }

  getSessionCount() {
    return this.sessions.size;
  }
}

module.exports = SessionService;
