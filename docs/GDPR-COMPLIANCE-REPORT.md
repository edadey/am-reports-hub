## GDPR Compliance Report – AM Reports Hub (Internal Staff Application)

### Executive Summary
- The application is an internal, staff-only tool. College users only access their own dashboards.
- Reports contain no personal data; they may be retained indefinitely.
- Personal data is limited to staff account managers and college contacts, plus security telemetry.
- With recent changes and documentation, the system aligns with UK GDPR principles for an internal system.

### Scope and Data Inventory
- Personal data in scope: staff names/emails/roles, college contact names/emails/phones (optional), login IP/user agent.
- Reports: non-personal aggregated metrics.

### Lawful Basis
- Staff processing: contract/legitimate interest.
- College contacts: contract/legitimate interest.

### Key Controls Implemented
- Authentication & Access Control
  - JWT-based auth with HTTP-only cookies, `secure` in production.
  - SameSite=Lax cookies; cookie domain not pinned (host-based).
  - Sessions are in-memory with 7-day expiry and server-side cleanup.
  - College-level segregation and role-based access.
  - Admin surfaces protected: `/admin-dashboard`, all `/api/backup/*`, and `railway-backup-dashboard` require admin.
  - Demo user automatically disabled in production.
  - `ADMIN_DEFAULT_PASSWORD` set securely in Railway (2025), and `JWT_SECRET` set to a strong value.

- Security and Logging
  - Insecure debug endpoints removed.
  - Login attempts and security events recorded with IP/user agent.
  - Automated cleanup of logs (`SECURITY_LOG_RETENTION_DAYS`, default 90 days).
  - Brute-force controls: account lockout and IP blocking heuristics.
  - Password reset emails no longer CC any external address.

- Data Minimisation & Purpose Limitation
  - Reports do not include personal data; analytics are aggregated per college/time.
  - Only essential contact data stored for operations.

- Storage Limitation
  - Security logs retained 90 days and automatically purged.
  - Staff and college contact retention defined operationally (see Data Retention Policy).
  - Backups follow same retention principles; avoid restoring expired contacts.

- Integrity & Confidentiality
  - Production environment with secure cookies and CORS.
  - Railway-managed PostgreSQL (or storage) with secure access.
  - Least-privilege access for staff; access restricted to assigned colleges.
  - CORS origin and BASE_URL configured via Railway env vars; Railway public domain used by default.

- Accountability & Documentation
  - Internal Privacy Notice published.
  - Data Retention Policy published.
  - ROPA documented.

### Residual Risks and Recommendations
- Ensure HR processes are in place to disable/delete staff accounts on leavers.
- Review college contact lists periodically and remove stale contacts.
- Confirm DPAs with Railway, email provider, and OpenAI; avoid sending personal data to AI provider.
- Consider basic access audit logs for sensitive actions (create/delete contacts, exports).

### Conclusion
With the technical safeguards, environment hardening, log retention, and internal documentation now in place, AM Reports Hub is compliant with UK GDPR obligations for an internal staff application. Reports may be kept indefinitely as they contain no personal data. Ongoing compliance relies on following the operational retention processes and processor agreements.


