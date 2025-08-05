const fs = require("fs");

// Read the current AuthService
let content = fs.readFileSync("src/services/AuthService.js", "utf8");

// Add SessionService import
content = content.replace(
  "const EmailService = require(./EmailService);",
  "const EmailService = require(./EmailService);
const SessionService = require(./SessionService);"
);

// Add SessionService initialization
content = content.replace(
  "this.emailService = new EmailService();",
  "this.emailService = new EmailService();
    this.sessionService = new SessionService();"
);

// Replace createSession method
content = content.replace(
  /async createSession\(userId, token\) \{[\s\S]*?\}/,
  `async createSession(userId, token) {
    try {
      this.sessionService.createSession(userId, token);
    } catch (error) {
      console.error("Error creating session:", error);
    }
  }`
);

// Replace getSessions method
content = content.replace(
  /async getSessions\(\) \{[\s\S]*?\}/,
  `async getSessions() {
    try {
      return this.sessionService.getAllSessions();
    } catch (error) {
      console.error("Error getting sessions:", error);
      return [];
    }
  }`
);

// Replace validateSession method
content = content.replace(
  /async validateSession\(token\) \{[\s\S]*?\}/,
  `async validateSession(token) {
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
  }`
);

// Replace removeSession method
content = content.replace(
  /async removeSession\(token\) \{[\s\S]*?\}/,
  `async removeSession(token) {
    try {
      this.sessionService.removeSession(token);
    } catch (error) {
      console.error("Error removing session:", error);
    }
  }`
);

// Write the updated content
fs.writeFileSync("src/services/AuthService.js", content);
console.log("AuthService updated successfully!");
