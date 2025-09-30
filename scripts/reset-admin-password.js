#!/usr/bin/env node
const fs = require('fs-extra');
const path = require('path');
const bcrypt = require('bcryptjs');

(async () => {
  try {
    const newPassword = process.argv[2];
    if (!newPassword) {
      console.error('Usage: node scripts/reset-admin-password.js <NEW_PASSWORD>');
      process.exit(1);
    }

    const usersFile = path.join(__dirname, '..', 'data', 'users.json');
    const exists = await fs.pathExists(usersFile);
    if (!exists) {
      console.error(`users.json not found at ${usersFile}. Start the app once so it initializes default users, then re-run this script.`);
      process.exit(1);
    }

    const users = await fs.readJson(usersFile).catch(() => null);
    if (!Array.isArray(users)) {
      console.error('users.json is not in the expected format (array). Aborting.');
      process.exit(1);
    }

    const adminIdx = users.findIndex(u => u && (u.username === 'admin' || u.email === 'admin@amreports.com'));
    if (adminIdx === -1) {
      console.error('Admin user not found in users.json. Aborting.');
      process.exit(1);
    }

    const hash = await bcrypt.hash(newPassword, 10);
    users[adminIdx].password = hash;
    users[adminIdx].isActive = true;
    users[adminIdx].lastLogin = users[adminIdx].lastLogin || null;

    await fs.writeJson(usersFile, users, { spaces: 2 });
    console.log('✅ Admin password reset successfully.');
  } catch (err) {
    console.error('Failed to reset admin password:', err.message);
    process.exit(1);
  }
})();
