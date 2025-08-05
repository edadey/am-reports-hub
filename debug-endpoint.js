// Add debug endpoint to check session state
app.get("/api/debug/session-state", async (req, res) => {
  try {
    const token = req.cookies.token || req.headers.authorization?.replace("Bearer ", "");
    const sessions = await authService.getSessions();
    const jwtSecret = process.env.JWT_SECRET ? "SET" : "NOT_SET";
    
    res.json({
      token: token ? token.substring(0, 20) + "..." : "NO_TOKEN",
      sessionCount: sessions.length,
      jwtSecret: jwtSecret,
      sessions: sessions.map(s => ({
        id: s.id,
        userId: s.userId,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt
      }))
    });
  } catch (error) {
    res.json({ error: error.message });
  }
});
