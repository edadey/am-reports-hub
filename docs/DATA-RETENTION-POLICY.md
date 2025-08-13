## Data Retention Policy (Internal)

### Scope
This policy applies to personal data in AM Reports Hub. Reports contain no personal data and may be retained indefinitely.

### Retention Schedule
- Security/login telemetry: 90 days (automatically cleaned).
- Staff account records: employment duration + up to 6 years.
- College contacts: active relationship; review within 2 years after relationship ends.
- Backups: rotate within 90 days where feasible; ensure expired contacts are not restored.

### Technical Controls
- Automated clean-up of `login-attempts.json` and `security-logs.json` via scheduled task in `app.js` using `SecurityService.cleanupOldData(SECURITY_LOG_RETENTION_DAYS)` with default 90 days.
- Environment variable: `SECURITY_LOG_RETENTION_DAYS` controls retention.

### Operational Controls
- HR manages staff record retention and deletion on leavers.
- Admins review and remove college contacts after contract end.

### Review
This policy will be reviewed annually or upon material changes to processing.


