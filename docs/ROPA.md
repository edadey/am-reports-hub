## Record of Processing Activities (ROPA) - AM Reports Hub

### Controller
- Company operating AM Reports Hub (internal use only).

### Processing Activities
1. Authentication and access control (staff and college contacts)
   - Categories: staff IDs, names, emails; college contact names, emails, phones (optional).
   - Purpose: secure access to college dashboards and admin features.
   - Lawful basis: contract/legitimate interests.
   - Retention: staff employment duration + up to 6 years; contacts during relationship, review at 2 years after end.

2. Security monitoring
   - Data: IP address, user agent, timestamps, event type.
   - Purpose: detect abuse, investigate incidents.
   - Retention: 90 days (automated).

3. Reporting and analytics (non-personal)
   - Data: aggregated, anonymised metrics per college/time period.
   - Purpose: performance benchmarking and historical trends.
   - Retention: indefinite (no personal data).

### Processors
- Hosting: Railway (cloud hosting).
- Database: Railway PostgreSQL (if configured) or internal storage.
- Email: transactional mail provider (if configured).
- AI provider: OpenAI (analysis of non-personal report data only).

### International Transfers
- Covered by providers' DPAs and SCCs/IDTA as applicable.

### Security Measures
- Access control with college-level segregation, strong secrets, HTTPS, log retention.


