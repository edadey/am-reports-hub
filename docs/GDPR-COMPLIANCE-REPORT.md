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
  - SameSite=Lax cookies; cookie is host-based (no pinned domain) and set for 24 hours.
  - JWT tokens expire after 24 hours; sessions are in-memory with a 7-day expiry and continuous server-side cleanup.
  - College-level segregation and role-based access.
  - Admin surfaces protected: `/admin-dashboard`, all `/api/backup/*`, `railway-backup-dashboard`, and `/internal-docs` require admin.
  - Demo user automatically disabled in production.
  - Environment secrets: `ADMIN_DEFAULT_PASSWORD` and `JWT_SECRET` must be set to strong values in production (fallbacks only exist for local development).

- Security and Logging
  - Insecure debug endpoints removed.
  - Login attempts and security events recorded with IP/user agent.
  - Automated cleanup of logs (`SECURITY_LOG_RETENTION_DAYS`, default 90 days).
  - Brute-force controls: account lockout and IP blocking heuristics.
  - Suspicious activity detection with optional email alerts on unusual patterns (e.g. many IPs in short window).
  - Debug endpoints are admin-only in production; non-authenticated debug routes are disabled.
  - Runtime security checks in production warn if the admin password matches defaults or if `JWT_SECRET`/`CORS_ORIGIN` are weak/missing.
  - Password reset emails no longer CC any external address.

- Data Minimisation & Purpose Limitation
  - Reports do not include personal data; analytics are aggregated per college/time.
  - Only essential contact data stored for operations.

- Storage Limitation
  - Security logs retained 90 days and automatically purged.
  - Staff and college contact retention defined operationally (see Data Retention Policy).
  - Backups follow retention principles; avoid restoring expired contacts.
  - Shared report links use signed JWTs with expiries by default; tokens are not stored in full (only masked for audit).

- Integrity & Confidentiality
  - Production environment with secure, HTTP-only cookies (SameSite=Lax; Secure in production) and restricted CORS.
  - Railway-managed PostgreSQL (where enabled) or server-side storage with restricted access.
  - Least-privilege access for staff; access restricted to assigned colleges.
  - CORS origin and `BASE_URL` configured via Railway env vars; Railway public domain used by default in production.

- Accountability & Documentation
  - Internal Privacy Notice published.
  - Data Retention Policy published.
  - ROPA documented.

### Residual Risks and Recommendations
- Ensure HR processes are in place to disable/delete staff accounts on leavers.
- Review college contact lists periodically and remove stale contacts.
- Confirm DPAs with Railway, email provider, and OpenAI; avoid sending personal data to AI provider.
- Consider basic access audit logs for sensitive actions (create/delete contacts, exports).
 - Enforce secure environment configuration: set strong values for `ADMIN_DEFAULT_PASSWORD`, `JWT_SECRET`, and `CORS_ORIGIN` in production.
 - Keep CORS restricted to the known production origin; avoid wildcards.
 - Keep debug routes restricted to admin in production and avoid adding new unauthenticated debug endpoints.

### Conclusion
With the technical safeguards, environment hardening, log retention, and internal documentation now in place, AM Reports Hub meets UK GDPR obligations for an internal staff application. Reports may be kept indefinitely as they contain no personal data. Ongoing compliance relies on following the operational retention processes, maintaining secure environment configuration, and keeping processor agreements in place.


