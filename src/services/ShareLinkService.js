const fs = require('fs-extra');
const path = require('path');
const jwt = require('jsonwebtoken');

class ShareLinkService {
  constructor(options = {}) {
    this.dataDir = options.dataDir || 'data';
    this.sharesFile = options.sharesFile || path.join(this.dataDir, 'share-links.json');
    this.ensureDataStore();
    this.normalizeExistingSharesSync();
  }

  ensureDataStore() {
    fs.ensureDirSync(this.dataDir);
    if (!fs.existsSync(this.sharesFile)) {
      fs.writeJsonSync(this.sharesFile, { shares: [] }, { spaces: 2 });
    }
  }

  normalizeExistingSharesSync() {
    try {
      const data = fs.readJsonSync(this.sharesFile);
      if (!data || !Array.isArray(data.shares)) return;
      let mutated = false;
      const normalized = data.shares.map(share => {
        const updated = { ...share };
        if (!updated.revoked) {
          if (updated.live !== true) {
            updated.live = true;
            mutated = true;
          }
          if (updated.expiresAt !== null && updated.expiresAt !== undefined) {
            updated.expiresAt = null;
            mutated = true;
          }
        }
        return updated;
      });
      if (mutated) {
        fs.writeJsonSync(this.sharesFile, { shares: normalized }, { spaces: 2 });
      }
    } catch (_) {}
  }

  async readShares() {
    try {
      return await fs.readJson(this.sharesFile);
    } catch (error) {
      return { shares: [] };
    }
  }

  async writeShares(data) {
    await fs.writeJson(this.sharesFile, data, { spaces: 2 });
  }

  generateShareToken(payload, expiresIn = '7d') {
    const secret = process.env.JWT_SHARE_SECRET || process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
    const tokenPayload = {
      type: 'share',
      scope: payload.scope || 'reports',
      collegeId: payload.collegeId,
      permissions: payload.permissions || { view: true, download: true, edit: false },
      shareId: payload.shareId,
    };
    const options = {
      issuer: 'am-reports',
      audience: 'am-reports-shares'
    };
    if (expiresIn) options.expiresIn = expiresIn;
    return jwt.sign(tokenPayload, secret, options);
  }

  verifyShareToken(token) {
    const secret = process.env.JWT_SHARE_SECRET || process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
    try {
      const decoded = jwt.verify(token, secret, { issuer: 'am-reports', audience: 'am-reports-shares' });
      return { valid: true, payload: decoded };
    } catch (error) {
      if (error && error.name === 'TokenExpiredError') {
        try {
          const decoded = jwt.verify(token, secret, { issuer: 'am-reports', audience: 'am-reports-shares', ignoreExpiration: true });
          return { valid: true, payload: decoded, expired: true };
        } catch (_) {}
      }
      return { valid: false, message: 'Invalid or expired share token' };
    }
  }

  async createShareLink({ collegeId, reportId = null, expiresInHours = 168, allowDownload = true, createdByUser = null, live = true }) {
    const shares = await this.readShares();
    
    // Create deterministic shareId for permanent college links
    const shareId = `college-${collegeId}-permanent`;
      
    // Check if permanent link already exists for this college
    const existingShare = shares.shares.find(s => s.shareId === shareId && !s.revoked);
    if (existingShare) {
      // Ensure record reflects permanence
      let mutated = false;
      if (existingShare.live !== true) { existingShare.live = true; mutated = true; }
      if (existingShare.expiresAt !== null) { existingShare.expiresAt = null; mutated = true; }
      if (mutated) {
        const idx = shares.shares.findIndex(s => s.shareId === shareId);
        if (idx !== -1) shares.shares[idx] = existingShare;
        await this.writeShares(shares);
      }
      // Reuse existing permanent link with a non-expiring token
      const token = this.generateShareToken({
        shareId: existingShare.shareId,
        collegeId: existingShare.collegeId,
        scope: existingShare.scope,
        permissions: existingShare.permissions
      }, undefined);
      
      const baseUrl = process.env.BASE_URL || '';
      const url = `${baseUrl}/shared-reports.html?collegeId=${encodeURIComponent(collegeId)}&token=${encodeURIComponent(token)}`;
      return { 
        token, 
        url, 
        shareId: existingShare.shareId, 
        expiresAt: null, 
        permissions: existingShare.permissions,
        reused: true 
      };
    }
    
    const record = {
      shareId,
      collegeId,
      scope: 'reports',
      permissions: { view: true, download: !!allowDownload, edit: false },
      createdByUser,
      createdAt: new Date().toISOString(),
      revoked: false,
      live: true,
      expiresAt: null
    };
    const token = this.generateShareToken({
      shareId,
      collegeId,
      scope: record.scope,
      permissions: record.permissions
    }, undefined);
    shares.shares.push({ ...record, tokenHash: this.maskToken(token) });
    await this.writeShares(shares);
    const baseUrl = process.env.BASE_URL || '';
    const url = `${baseUrl}/shared-reports.html?collegeId=${encodeURIComponent(collegeId)}&token=${encodeURIComponent(token)}`;
    return { token, url, shareId, expiresAt: null, permissions: record.permissions };
  }

  maskToken(token) {
    if (!token) return null;
    // Do not store raw token; store a short mask for audit only
    return `${token.slice(0, 6)}...${token.slice(-6)}`;
  }

  async revokeShare(shareId) {
    const data = await this.readShares();
    const idx = data.shares.findIndex(s => s.shareId === shareId);
    if (idx !== -1) {
      data.shares[idx].revoked = true;
      data.shares[idx].revokedAt = new Date().toISOString();
      await this.writeShares(data);
      return { success: true };
    }
    return { success: false, message: 'Share not found' };
  }

  async isRevoked(shareId) {
    const data = await this.readShares();
    const rec = data.shares.find(s => s.shareId === shareId);
    return !!(rec && rec.revoked);
  }
}

module.exports = ShareLinkService;


