// Updated session methods for in-memory storage
async createSession(userId, token) {
  try {
    this.sessionService.createSession(userId, token);
  } catch (error) {
    console.error("Error creating session:", error);
  }
}

async getSessions() {
  try {
    return this.sessionService.getAllSessions();
  } catch (error) {
    console.error("Error getting sessions:", error);
    return [];
  }
}

async validateSession(token) {
  try {
    const session = this.sessionService.getSession(token);
    
    if (!session) {
      console.log("Session validation: Session not found");
      return { success: false, message: "Session not found" };
    }

    // Verify JWT token
    const tokenVerification = this.verifyToken(token);
    if (!tokenVerification.success) {
      console.log("Session validation: Invalid token");
      this.sessionService.removeSession(token);
      return { success: false, message: "Invalid token" };
    }

    console.log("Session validation: Success");
    return { success: true, user: tokenVerification.user };
  } catch (error) {
    console.error("Session validation error:", error);
    return { success: false, message: "Session validation failed" };
  }
}

async removeSession(token) {
  try {
    this.sessionService.removeSession(token);
  } catch (error) {
    console.error("Error removing session:", error);
  }
}
