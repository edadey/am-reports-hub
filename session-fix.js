// Quick fix: Replace session methods with in-memory storage
const originalCreateSession = AuthService.prototype.createSession;
const originalGetSessions = AuthService.prototype.getSessions;
const originalValidateSession = AuthService.prototype.validateSession;
const originalRemoveSession = AuthService.prototype.removeSession;

// In-memory session storage
const sessionStore = new Map();

AuthService.prototype.createSession = async function(userId, token) {
  const session = {
    id: Date.now().toString(),
    userId,
    token,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  };
  sessionStore.set(token, session);
  console.log(`Session created for user ${userId}`);
};

AuthService.prototype.getSessions = async function() {
  return Array.from(sessionStore.values());
};

AuthService.prototype.validateSession = async function(token) {
  const session = sessionStore.get(token);
  if (!session) {
    console.log("Session validation: Session not found");
    return { success: false, message: "Session not found" };
  }
  
  if (new Date() > new Date(session.expiresAt)) {
    sessionStore.delete(token);
    console.log("Session validation: Session expired");
    return { success: false, message: "Session expired" };
  }
  
  const tokenVerification = this.verifyToken(token);
  if (!tokenVerification.success) {
    console.log("Session validation: Invalid token");
    sessionStore.delete(token);
    return { success: false, message: "Invalid token" };
  }
  
  console.log("Session validation: Success");
  return { success: true, user: tokenVerification.user };
};

AuthService.prototype.removeSession = async function(token) {
  sessionStore.delete(token);
  console.log(`Session removed for token: ${token.substring(0, 10)}...`);
};
