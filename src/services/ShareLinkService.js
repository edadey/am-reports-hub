const fs = require('fs-extra');
const path = require('path');
const jwt = require('jsonwebtoken');

class ShareLinkService {
  constructor(options = {}) {
    this.dataDir = options.dataDir || 'data';
    this.sharesFile = options.sharesFile || path.join(this.dataDir, 'share-links.json');
    this.ensureDataStore();
  }

  ensureDataStore() {
    fs.ensureDirSync(this.dataDir);
    if (!fs.existsSync(this.sharesFile)) {
      fs.writeJsonSync(this.sharesFile, { shares: [] }, { spaces: 2 });
    }
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
      expiresIn,
      issuer: 'am-reports',
      audience: 'am-reports-shares'
    };
    return jwt.sign(tokenPayload, secret, options);
  }

  verifyShareToken(token) {
    try {
      const secret = process.env.JWT_SHARE_SECRET || process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
      const decoded = jwt.verify(token, secret, { issuer: 'am-reports', audience: 'am-reports-shares' });
      return { valid: true, payload: decoded };
    } catch (error) {
      return { valid: false, message: 'Invalid or expired share token' };
    }
  }

  async createShareLink({ collegeId, reportId = null, expiresInHours = 168, allowDownload = true, createdByUser = null, live = false }) {
    const shares = await this.readShares();
    
    // Create deterministic shareId for permanent college links
    const shareId = `college-${collegeId}-permanent`;
      
    // Check if permanent link already exists for this college
    const existingShare = shares.shares.find(s => s.shareId === shareId && !s.revoked);
    if (existingShare) {
      // Reuse existing permanent link
      const token = this.generateShareToken({
        shareId: existingShare.shareId,
        collegeId: existingShare.collegeId,
        scope: existingShare.scope,
        permissions: existingShare.permissions
      }, live ? undefined : `${expiresInHours}h`);
      
      const baseUrl = process.env.BASE_URL || '';
      const url = `${baseUrl}/shared-reports.html?collegeId=${encodeURIComponent(collegeId)}&token=${encodeURIComponent(token)}`;
      return { 
        token, 
        url, 
        shareId: existingShare.shareId, 
        expiresAt: existingShare.expiresAt, 
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
      live: !!live,
      expiresAt: live ? null : new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString()
    };
    const token = this.generateShareToken({
      shareId,
      collegeId,
      scope: record.scope,
      permissions: record.permissions
    }, live ? undefined : `${expiresInHours}h`);
    shares.shares.push({ ...record, tokenHash: this.maskToken(token) });
    await this.writeShares(shares);
    const baseUrl = process.env.BASE_URL || '';
    const url = `${baseUrl}/shared-reports.html?collegeId=${encodeURIComponent(collegeId)}&token=${encodeURIComponent(token)}`;
    return { token, url, shareId, expiresAt: record.expiresAt, permissions: record.permissions };
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


