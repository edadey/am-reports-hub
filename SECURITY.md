# Security Documentation

## 🔒 Security Overview

This document outlines the security measures implemented in the AM Reports Centre application and provides guidelines for maintaining security.

## 🛡️ Security Features

### 1. Data Protection

#### Sensitive Data Exclusion
- All data files containing sensitive information are excluded from Git via `.gitignore`
- Data files excluded:
  - `data/colleges.json` - College information
  - `data/accountManagers.json` - Account manager data
  - `data/users.json` - User accounts
  - `data/previous-reports.json` - Previous report data
  - `data/templates.json` - Saved templates

#### Environment Variables
- Configuration stored in `.env` files (not committed to repository)
- Sensitive configuration includes:
  - Database credentials
  - API keys
  - Session secrets
  - JWT secrets

### 2. File Upload Security

#### File Type Validation
- Only Excel (.xlsx, .xls) and CSV files are accepted
- File type validation on both client and server side
- MIME type checking to prevent file type spoofing

#### File Size Limits
- Maximum file size: 10MB
- Configurable via environment variables
- Prevents denial of service attacks

#### Path Traversal Protection
- Secure file handling prevents directory traversal attacks
- Files stored in designated uploads directory
- Automatic cleanup of temporary files

### 3. Input Validation

#### Server-Side Validation
- All user inputs validated on server side
- SQL injection prevention (when using databases)
- XSS protection through proper output encoding

#### Data Sanitization
- HTML entity encoding for user-generated content
- Special character handling in file names
- JSON data validation before processing

### 4. Access Control

#### Account Manager Assignment
- Colleges assigned to specific account managers
- Data isolation between different account managers
- Role-based access control structure

#### Session Management
- Secure session handling
- Session timeout configuration
- CSRF protection (when implementing authentication)

## 🔧 Security Configuration

### Environment Variables

Create a `.env` file with secure values:

```env
# Generate strong random secrets
SESSION_SECRET=your-very-long-random-secret-key
JWT_SECRET=another-very-long-random-secret-key

# File upload limits
UPLOAD_MAX_SIZE=10485760
ALLOWED_FILE_TYPES=.xlsx,.xls,.csv

# CORS configuration
CORS_ORIGIN=http://localhost:3000
CORS_CREDENTIALS=true
```

### Generating Secure Secrets

Use strong random secrets:

```bash
# Generate session secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Generate JWT secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## 🚨 Security Best Practices

### 1. Development

#### Code Security
- Never commit sensitive data to repository
- Use environment variables for configuration
- Validate all user inputs
- Implement proper error handling
- Keep dependencies updated

#### Testing
- Test file upload security
- Validate input sanitization
- Check for common vulnerabilities
- Use security scanning tools

### 2. Deployment

#### Server Security
- Use HTTPS in production
- Configure proper CORS settings
- Set up firewall rules
- Regular security updates
- Monitor access logs

#### Data Protection
- Encrypt sensitive data at rest
- Implement backup security
- Regular security audits
- Access logging and monitoring

### 3. User Management

#### Authentication (Future Implementation)
- Implement strong password policies
- Multi-factor authentication
- Account lockout policies
- Session management
- Password reset procedures

#### Authorization
- Role-based access control
- Principle of least privilege
- Regular access reviews
- Audit trail maintenance

## 🔍 Security Monitoring

### Logging
- All file uploads logged
- Error logging with security context
- Access attempt logging
- Data modification logging

### Monitoring
- File upload monitoring
- Error rate monitoring
- Performance monitoring
- Security event monitoring

## 🚨 Incident Response

### Security Incidents
1. **Immediate Response**
   - Isolate affected systems
   - Preserve evidence
   - Notify stakeholders

2. **Investigation**
   - Analyze logs
   - Identify root cause
   - Assess impact

3. **Recovery**
   - Implement fixes
   - Restore from backups
   - Verify security

4. **Post-Incident**
   - Document lessons learned
   - Update security measures
   - Review procedures

### Contact Information
- Security Team: security@company.com
- Emergency Contact: +1-XXX-XXX-XXXX
- Incident Response: incident@company.com

## 📋 Security Checklist

### Pre-Deployment
- [ ] Environment variables configured
- [ ] Sensitive data excluded from repository
- [ ] File upload security implemented
- [ ] Input validation in place
- [ ] Error handling configured
- [ ] Logging enabled
- [ ] CORS settings configured
- [ ] Dependencies updated

### Post-Deployment
- [ ] HTTPS enabled
- [ ] Firewall configured
- [ ] Monitoring enabled
- [ ] Backup procedures tested
- [ ] Security audit completed
- [ ] Documentation updated

## 🔄 Security Updates

### Regular Maintenance
- Monthly dependency updates
- Quarterly security reviews
- Annual penetration testing
- Continuous monitoring

### Update Procedures
1. Test updates in development
2. Schedule maintenance window
3. Apply updates
4. Verify functionality
5. Monitor for issues

## 📚 Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Express.js Security](https://expressjs.com/en/advanced/best-practices-security.html)
- [File Upload Security](https://owasp.org/www-community/vulnerabilities/Unrestricted_File_Upload)

## 📞 Security Support

For security-related questions or incidents:
- Email: security@company.com
- Phone: +1-XXX-XXX-XXXX
- Emergency: +1-XXX-XXX-XXXX

---

**Remember**: Security is an ongoing process. Regular reviews and updates are essential to maintaining a secure application. 