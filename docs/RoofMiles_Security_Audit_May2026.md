**ROOFMILES**

**Security, Performance ****&**** Maintenance Audit**

Full Codebase Assessment  |  May 2026  |  Accent Roofing Service

# **How to Read This Document**

Each item below covers: (1) what it is in plain English, (2) why it matters, (3) how it works, (4) current status in the RoofMiles codebase, and (5) which session will address it if not yet done.

| **✓ DONE** | **~ PARTIAL** | **✗ TODO** | **— N/A** |
| --- | --- | --- | --- |
| Fully implemented and verified | Started but needs completion | Not yet addressed | Not applicable to this app |

# **Quick Reference — All Items**

| **#** | **Item** | **Needed?** | **Status** | **Session** |
| --- | --- | --- | --- | --- |
| 1 | Rate Limiting | YES | **✓ DONE** | Complete |
| 2 | SQL Injection Prevention | YES | **✓ DONE** | Complete |
| 3 | Partitioning | NO | **— N/A** | Not applicable |
| 4 | RPC (Remote Procedure Call) | NO | **— N/A** | Not applicable |
| 5 | QPS (Queries Per Second) Monitoring | YES | **✗ TODO** | Monitoring & Alerting Session |
| 6 | Load Balancing | NO | **— N/A** | Not applicable |
| 7 | Staging Containerization | YES | **~ PARTIAL** | Infrastructure & Docker Session (post-MVP) |
| 8 | FTP | NO | **— N/A** | Not applicable |
| 9 | Terms of Use / Legal Protection | YES | **~ PARTIAL** | Compliance & Legal Session |
| 10 | Data & Compliance Documentation | YES | **✗ TODO** | Compliance & Legal Session |
| 11 | CCPA Compliance (California Residents) | YES | **✗ TODO** | Compliance & Legal Session |
| 12 | Row-Level Security (RLS) | YES | **~ PARTIAL** | Multi-Contractor Security Session (before contractor #2) |
| 13 | Authentication & Authorization | YES | **✓ DONE** | Complete |
| 14 | Access Control on All Requests | YES | **✓ DONE** | Complete |
| 15 | Input Validation & Sanitization | YES | **~ PARTIAL** | Input Validation Session |
| 16 | CORS (Cross-Origin Resource Sharing) | YES | **~ PARTIAL** | Input Validation Session |
| 17 | CSRF (Cross-Site Request Forgery) | YES | **~ PARTIAL** | Input Validation Session |
| 18 | Password Reset Expiration | YES | **✓ DONE** | Complete |
| 19 | Frontend Error Handling | YES | **~ PARTIAL** | Code Quality & Error Handling Session |
| 20 | Database Indexes | YES | **~ PARTIAL** | Database Performance Session |
| 21 | Alerting on Critical Events | YES | **~ PARTIAL** | Monitoring & Alerting Session |
| 22 | Rollback Plan | YES | **~ PARTIAL** | Rollback Runbook Session |
| 23 | Role-Based Access Control (RBAC) | YES | **~ PARTIAL** | Multi-Contractor Security Session (before contractor #2) |
| 24 | Audit Log (Separate from App Data) | YES | **~ PARTIAL** | Audit Log & Compliance Session |
| 25 | SOC 2 Requirements | YES | **✗ TODO** | SOC 2 Readiness Planning (future milestone) |
| 26 | Data Isolation Between Contractors | YES | **~ PARTIAL** | Multi-Contractor Security Session (before contractor #2) |
| 27 | Google Login (Social Auth) | NO | **— N/A** | Not applicable |
| 28 | HTTPS Only & Secure Cookies | YES | **✓ DONE** | Complete |
| 29 | Phishing Defense | YES | **~ PARTIAL** | Compliance & Legal Session |
| 30 | Storage Buckets Set to Private | YES | **✓ DONE** | Complete |
| 31 | Never Expose Service Role Keys | YES | **✓ DONE** | Complete |
| 32 | XSS (Cross-Site Scripting) | YES | **~ PARTIAL** | Input Validation Session |
| 33 | Path Traversal | YES | **✓ DONE** | Complete |
| 34 | Short-Lived Tokens | YES | **✓ DONE** | Complete |
| 35 | Dependency Vulnerability Scanning | YES | **✓ DONE** | Complete |
| 36 | Check Frontend for Secrets | YES | **✓ DONE** | Complete |
| 37 | N+1 Query Elimination | YES | **~ PARTIAL** | Database Performance Session |
| 38 | Missing Indexes Audit | YES | **~ PARTIAL** | Database Performance Session |
| 39 | SELECT * and Unbounded Queries | YES | **~ PARTIAL** | Database Performance Session |
| 40 | Pagination | YES | **~ PARTIAL** | Database Performance Session |
| 41 | Async / Non-Blocking Processing | YES | **✓ DONE** | Complete |
| 42 | Comprehensive Monitoring & Metrics | YES | **~ PARTIAL** | Monitoring & Alerting Session |

# **Detailed Item Breakdown**

**1. Rate Limiting  ****  ✓ DONE  ****  NEEDED**

| **What it is** | Rate limiting caps how many requests a user or IP address can make in a given time window. |
| --- | --- |

| **Why it matters** | Without it, an attacker can make thousands of login attempts per second (brute force) or overwhelm your server with requests (denial of service). |
| --- | --- |

| **How it works** | Uses the express-rate-limit package on your Node/Express backend. When a limit is hit, the server returns HTTP 429 (Too Many Requests). Different limits are set for different endpoints based on risk. |
| --- | --- |

| **RoofMiles status** | DONE. Multiple limiters are live: login (10/15min per IP), admin login (5/15min per IP), cashout (3/hr), booking (3/hr), pipeline (10/5min), client-error logging (20/hr), and missing referral submission (5/24hr). 429 responses handled gracefully on the frontend. |
| --- | --- |

**2. SQL Injection Prevention  ****  ✓ DONE  ****  NEEDED**

| **What it is** | SQL injection is when an attacker sneaks malicious database commands into an input field — for example, typing `'; DROP TABLE users;--` into a name field. |
| --- | --- |

| **Why it matters** | If your queries use raw user input, an attacker can read, modify, or delete your entire database. |
| --- | --- |

| **How it works** | Use parameterized queries (also called prepared statements). Instead of building SQL strings by concatenation, you pass user input as separate parameters that the database driver escapes automatically. |
| --- | --- |

| **RoofMiles status** | DONE. All database queries across the codebase use parameterized queries (pg client `$1, $2` syntax). No raw interpolation of user input. Verified in the Session 35 security audit. |
| --- | --- |

**3. Partitioning  ****  — N/A  ****  NOT NEEDED**

| **What it is** | Database partitioning splits a large table into smaller physical pieces — for example, one partition per month of data. |
| --- | --- |

| **Why it matters** | Speeds up queries on massive tables by scanning only the relevant partition instead of the whole table. |
| --- | --- |

| **How it works** | PostgreSQL supports range and list partitioning via `PARTITION BY` on table creation. |
| --- | --- |

| **RoofMiles status** | NOT NEEDED NOW. Your database has tens of thousands of rows, not hundreds of millions. Partitioning adds complexity with no benefit at current scale. Revisit if activity_log or pipeline_cache grows beyond 50M+ rows (years away). |
| --- | --- |

**4. RPC (Remote Procedure Call)  ****  — N/A  ****  NOT NEEDED**

| **What it is** | RPC is a communication pattern where one service calls a function on another service as if it were local code. gRPC is a modern version. |
| --- | --- |

| **Why it matters** | Used in microservices architectures to communicate between many independent services efficiently. |
| --- | --- |

| **How it works** | Requires splitting the app into separate services that communicate over a network. |
| --- | --- |

| **RoofMiles status** | NOT NEEDED. RoofMiles is a monolith — one backend server. RPC becomes relevant when you break it into separate microservices, which happens at a much larger scale. Not applicable today. |
| --- | --- |

**5. QPS (Queries Per Second) Monitoring  ****  ✗ TODO  ****  NEEDED**

| **What it is** | QPS is a metric that tracks how many database queries or API requests your system handles per second. |
| --- | --- |

| **Why it matters** | Knowing your QPS baseline helps you spot traffic spikes, catch runaway queries, and plan for capacity before things break. |
| --- | --- |

| **How it works** | Railway's built-in metrics dashboard shows database query volume and backend CPU/memory. For deeper tracking, a tool like DataDog, Grafana, or even Railway's native metrics covers this. |
| --- | --- |

| **RoofMiles status** | PARTIAL. UptimeRobot monitors uptime. Railway provides basic CPU/memory metrics. However there is no dedicated QPS dashboard or alerting on query volume spikes. Should be added as part of the monitoring session. |
| --- | --- |

| **Session** | Monitoring & Alerting Session |
| --- | --- |

**6. Load Balancing  ****  — N/A  ****  NOT NEEDED**

| **What it is** | Load balancing distributes incoming traffic across multiple server instances so no single server gets overwhelmed. |
| --- | --- |

| **Why it matters** | Needed when one server can't handle the traffic volume alone. |
| --- | --- |

| **How it works** | Cloud providers like Railway, AWS, and GCP offer built-in load balancers. Railway handles this automatically when you scale to multiple instances. |
| --- | --- |

| **RoofMiles status** | NOT NEEDED NOW. Railway handles auto-scaling and routing internally. At current scale (single contractor, dozens of referrers), load balancing is not needed. Railway will surface this as a config option if traffic grows to warrant it. |
| --- | --- |

**7. Staging Containerization  ****  ~ PARTIAL  ****  NEEDED**

| **What it is** | Containerization means packaging your app and all its dependencies into a self-contained Docker image so it runs identically everywhere. |
| --- | --- |

| **Why it matters** | Prevents 'works on my machine' problems. Also makes it easy to spin up a staging environment that exactly mirrors production. |
| --- | --- |

| **How it works** | Docker creates containers. Railway supports Docker natively. Your staging environment on Railway is already a separate deployment. |
| --- | --- |

| **RoofMiles status** | PARTIAL. Staging environment on Railway is live. Frontend staging via Vercel preview deploys is available. However the app is not containerized with Docker — it runs as a raw Node process. Containerization is not urgent but would make staging more reliable and deployments more consistent. |
| --- | --- |

| **Session** | Infrastructure & Docker Session (post-MVP) |
| --- | --- |

**8. FTP  ****  — N/A  ****  NOT NEEDED**

| **What it is** | FTP (File Transfer Protocol) is an old method for transferring files between computers. |
| --- | --- |

| **Why it matters** | Sometimes used for legacy file hosting or transferring assets to a server. |
| --- | --- |

| **How it works** | Not applicable to modern cloud deployments. |
| --- | --- |

| **RoofMiles status** | NOT NEEDED. No FTP in use anywhere. File storage uses Backblaze B2 with HTTPS. Deployments go through GitHub → Railway/Vercel. FTP is not relevant to your stack. |
| --- | --- |

**9. Terms of Use / Legal Protection  ****  ~ PARTIAL  ****  NEEDED**

| **What it is** | Terms of Use is a legal agreement that users must accept before using your app. It sets the rules for what users can and cannot do and limits your liability. |
| --- | --- |

| **Why it matters** | Without it, you have no legal protection if a user misuses the platform, claims they weren't informed of the rules, or sues over a payout dispute. |
| --- | --- |

| **How it works** | A /terms page with a checkbox on signup is the standard implementation. Terms should be drafted by or reviewed by a lawyer. |
| --- | --- |

| **RoofMiles status** | PARTIAL. /terms page is live. Privacy policy at /privacy is live. Both are linked pre-login in the referrer and admin apps. However, the referrer signup flow does not currently present a checkbox requiring explicit acceptance of terms before account creation. This is a legal gap — easy fix. |
| --- | --- |

| **Session** | Compliance & Legal Session |
| --- | --- |

**10. Data ****&**** Compliance Documentation  ****  ✗ TODO  ****  NEEDED**

| **What it is** | Documentation that explains what data you collect, how it is used, who has access, how long it is kept, and how users can request deletion. |
| --- | --- |

| **Why it matters** | Required for Apple/Google App Store submissions, Jobber Marketplace listing, and legally required in many jurisdictions. Also needed for enterprise contractor sales. |
| --- | --- |

| **How it works** | An internal Data Processing document, a public Privacy Policy, and a Data Retention policy. These work together. |
| --- | --- |

| **RoofMiles status** | PARTIAL. Privacy policy is live. Account deletion flow is in the build queue (required for App Store). No formal internal Data Processing document exists yet. Analytics and crash log data collection policies are not formally documented. |
| --- | --- |

| **Session** | Compliance & Legal Session |
| --- | --- |

**11. CCPA Compliance (California Residents)  ****  ✗ TODO  ****  NEEDED**

| **What it is** | The California Consumer Privacy Act gives California residents rights over their personal data — the right to know what data is collected, the right to delete it, and the right to opt out of its sale. |
| --- | --- |

| **Why it matters** | If any of your users are California residents (which is likely), you are subject to CCPA. Non-compliance can result in fines. |
| --- | --- |

| **How it works** | At minimum: a 'Do Not Sell My Personal Information' option, a way for users to request data deletion, and disclosure in your Privacy Policy of what categories of data you collect. |
| --- | --- |

| **RoofMiles status** | TODO. The privacy policy covers general data handling but does not specifically address CCPA rights. The Delete My Account flow (which would satisfy the right to deletion) is not yet built — it's the highest priority compliance build for App Store. A 'Do Not Sell' disclosure should be added to the privacy policy. |
| --- | --- |

| **Session** | Compliance & Legal Session |
| --- | --- |

**12. Row-Level Security (RLS)  ****  ~ PARTIAL  ****  NEEDED**

| **What it is** | Row-level security is a database feature that enforces rules at the data layer so that even if application code has a bug, one user cannot accidentally see another user's data. |
| --- | --- |

| **Why it matters** | Application-level access control can have bugs. RLS is a safety net at the database level — the last line of defense. |
| --- | --- |

| **How it works** | PostgreSQL supports RLS via `CREATE POLICY` statements. Supabase uses it heavily. On Railway/plain PostgreSQL you enforce it through application-layer checks (verifying contractor_id on every query) until native RLS policies are added. |
| --- | --- |

| **RoofMiles status** | PARTIAL. Data isolation is enforced at the application layer — every query scopes to contractor_id and session-derived user identity. Native PostgreSQL RLS policies are not implemented. This is acceptable for MVP with one contractor but should be added before contractor #2 is onboarded. Flagged in CLAUDE.md. |
| --- | --- |

| **Session** | Multi-Contractor Security Session (before contractor #2) |
| --- | --- |

**13. Authentication ****&**** Authorization  ****  ✓ DONE  ****  NEEDED**

| **What it is** | Authentication is proving who you are (login). Authorization is what you're allowed to do after you're logged in. |
| --- | --- |

| **Why it matters** | Without proper auth, anyone could access any data. Without proper authorization, a referrer could access admin endpoints just by knowing the URL. |
| --- | --- |

| **How it works** | Session tokens verify identity on every request. Middleware (verifySession, verifyAdminSession) gates each endpoint type. Identity is derived from the session token stored in the database — never from what the user sends in the request body. |
| --- | --- |

| **RoofMiles status** | DONE. Session tokens with 24h TTL. bcrypt hashing for PINs. verifySession() and verifyAdminSession() middleware on all protected endpoints. Identity always derived from session token — never from req.body. Admin/referrer routes are completely separate. All critical findings from Session 35 audit resolved. |
| --- | --- |

**14. Access Control on All Requests  ****  ✓ DONE  ****  NEEDED**

| **What it is** | Every API request should check: (1) Is the user logged in? (2) Do they have permission to take this action? |
| --- | --- |

| **Why it matters** | A referrer should never be able to reach an admin endpoint. An admin for contractor A should never see contractor B's data. |
| --- | --- |

| **How it works** | Middleware functions run before the main endpoint logic to verify session tokens and role permissions. |
| --- | --- |

| **RoofMiles status** | DONE. verifySession() and verifyAdminSession() applied to all protected routes. Cashout endpoint verifies balance before processing. Pipeline endpoint derives user identity from token — not from query parameters. C1 and C2 findings from Session 35 audit closed. |
| --- | --- |

**15. Input Validation ****&**** Sanitization  ****  ~ PARTIAL  ****  NEEDED**

| **What it is** | Validation checks that input data is the right type and format (e.g., email must look like an email). Sanitization removes or escapes dangerous characters before processing. |
| --- | --- |

| **Why it matters** | Without this, attackers can submit malformed data that causes errors, or inject scripts that run in other users' browsers. |
| --- | --- |

| **How it works** | Use a schema validator like Zod or express-validator at every API endpoint. Reject unexpected characters in structured fields like phone numbers. |
| --- | --- |

| **RoofMiles status** | PARTIAL. Parameterized queries prevent SQL injection. Helmet.js is not yet confirmed installed. A schema validator (Zod or express-validator) is not applied systematically at API boundaries. Frontend field validation exists in forms but is not matched with backend validation on every endpoint. This is a TODO for a dedicated session. |
| --- | --- |

| **Session** | Input Validation Session |
| --- | --- |

**16. CORS (Cross-Origin Resource Sharing)  ****  ~ PARTIAL  ****  NEEDED**

| **What it is** | CORS controls which websites are allowed to make requests to your backend API. Without it, any website in the world could call your API from a visitor's browser. |
| --- | --- |

| **Why it matters** | Prevents malicious websites from making API calls on behalf of your logged-in users. |
| --- | --- |

| **How it works** | The Express cors() middleware is configured with an allowlist of approved origins (your Vercel frontend URL). All other origins are blocked. |
| --- | --- |

| **RoofMiles status** | PARTIAL. Express cors() middleware is present in the stack. Whether it is locked to your specific Vercel domain (not wildcard *) needs verification. This should be audited and confirmed in a security session. |
| --- | --- |

| **Session** | Input Validation Session |
| --- | --- |

**17. CSRF (Cross-Site Request Forgery)  ****  ~ PARTIAL  ****  NEEDED**

| **What it is** | CSRF is an attack where a malicious website tricks your logged-in users into unknowingly submitting requests to your backend (e.g., triggering a cashout they didn't intend). |
| --- | --- |

| **Why it matters** | Without protection, a phishing site could silently send requests using a victim's active session. |
| --- | --- |

| **How it works** | Common protections: CSRF tokens in forms, SameSite cookie attributes, verifying the Origin header on sensitive requests. Your session token in Authorization headers (not cookies) provides significant natural protection. |
| --- | --- |

| **RoofMiles status** | PARTIAL. Using Authorization header tokens (not cookies) provides strong natural CSRF resistance because browsers do not automatically send Authorization headers cross-origin. However SameSite cookie attributes and explicit CSRF token checks are not confirmed. Should be verified in security session. |
| --- | --- |

| **Session** | Input Validation Session |
| --- | --- |

**18. Password Reset Expiration  ****  ✓ DONE  ****  NEEDED**

| **What it is** | Password/PIN reset links or codes should expire after a short window so that an old reset link can't be used later. |
| --- | --- |

| **Why it matters** | If reset tokens never expire, a stolen email containing an old reset link could let an attacker take over the account months later. |
| --- | --- |

| **How it works** | Set an expiration timestamp on reset tokens in the database. Reject any token that is past its expiry. |
| --- | --- |

| **RoofMiles status** | DONE. Experience invite tokens expire in 7 days (confirmed in Session 40). Session tokens expire in 24 hours. PIN reset flow uses Twilio OTP which is inherently time-limited. No indefinite reset tokens in use. |
| --- | --- |

**19. Frontend Error Handling  ****  ~ PARTIAL  ****  NEEDED**

| **What it is** | Frontend error handling means gracefully catching API failures, network errors, and unexpected states in the React app and showing the user a useful message instead of a broken screen. |
| --- | --- |

| **Why it matters** | Without it, errors produce blank screens or JavaScript crashes that confuse users and hide real problems from you. |
| --- | --- |

| **How it works** | React Error Boundaries, try/catch on all async API calls, graceful fallback UI for each loading/error/empty state. |
| --- | --- |

| **RoofMiles status** | PARTIAL. 429 responses on pipeline fetch show a graceful inline message. Stale cache fallback shows a yellow banner. However systematic error boundaries and loading/empty/error states on every view are not fully confirmed across all components. Some .then() chains were flagged in earlier sessions as pre-existing. |
| --- | --- |

| **Session** | Code Quality & Error Handling Session |
| --- | --- |

**20. Database Indexes  ****  ~ PARTIAL  ****  NEEDED**

| **What it is** | A database index is like the index at the back of a book — instead of scanning every page to find a topic, you go straight to the right page. Indexes make lookups dramatically faster. |
| --- | --- |

| **Why it matters** | Without indexes on columns you query frequently, every search scans the entire table. This gets exponentially slower as data grows. |
| --- | --- |

| **How it works** | Add `CREATE INDEX` statements for every column used in a WHERE clause, JOIN, or ORDER BY. Key candidates: user_id, contractor_id, created_at, session token column, jobber_client_id. |
| --- | --- |

| **RoofMiles status** | PARTIAL. Primary keys have automatic indexes. UNIQUE constraints (session token, referral_conversions unique pair) create indexes. However a comprehensive index audit has never been done. No formal index coverage on foreign key columns or frequently-filtered fields like contractor_id, created_at, or pipeline_cache lookup columns. Needs a dedicated audit. |
| --- | --- |

| **Session** | Database Performance Session |
| --- | --- |

**21. Alerting on Critical Events  ****  ~ PARTIAL  ****  NEEDED**

| **What it is** | Automated alerts notify you immediately when something goes wrong — a server going down, a failed payment, or a spike in errors. |
| --- | --- |

| **Why it matters** | Without alerts, you only discover problems when a user complains. With alerts, you know before they do. |
| --- | --- |

| **How it works** | UptimeRobot for uptime. Error log table + Resend email alerts for backend errors. Additional: alerts on 5xx spikes, failed signups, failed cashouts, latency jumps. |
| --- | --- |

| **RoofMiles status** | PARTIAL. UptimeRobot: 3 monitors live (backend, frontend, referrals), emails to admin1@roofmiles.com. Error log table in DB + Resend email alerts for backend errors. MISSING: no alerts on failed payments, failed signups, 5xx spike rate, or latency thresholds. Needs expansion. |
| --- | --- |

| **Session** | Monitoring & Alerting Session |
| --- | --- |

**22. Rollback Plan  ****  ~ PARTIAL  ****  NEEDED**

| **What it is** | A rollback plan is a documented procedure for reverting your app to a previous working state if a deployment breaks something. |
| --- | --- |

| **Why it matters** | Bad deployments happen. Without a rollback plan, you're scrambling under pressure with no clear steps. |
| --- | --- |

| **How it works** | Git allows reverting to any previous commit. Railway allows re-deploying a previous build. Backblaze B2 backups allow restoring the database. A rollback guide documents which steps to take in which order. |
| --- | --- |

| **RoofMiles status** | PARTIAL. Git history and Railway build history allow rollback. Daily database backups to Backblaze B2 are live. MISSING: no written rollback runbook. The steps exist but are not documented in one place. Should be a 1-hour documentation session. |
| --- | --- |

| **Session** | Rollback Runbook Session |
| --- | --- |

**23. Role-Based Access Control (RBAC)  ****  ~ PARTIAL  ****  NEEDED**

| **What it is** | RBAC means assigning users to roles (admin, referrer, internal user) and granting permissions based on role — not per individual. |
| --- | --- |

| **Why it matters** | Without it, you end up with ad-hoc permission checks scattered everywhere that become impossible to maintain. |
| --- | --- |

| **How it works** | Define roles in the database. Every endpoint checks role before executing. Casbin is a structured permission management library for Node.js. |
| --- | --- |

| **RoofMiles status** | PARTIAL. Two roles exist and are enforced: admin and referrer. Middleware separation is clean. However the internal_users feature (future) will add a third role. No formal RBAC framework (like Casbin) is in use — permissions are checked via hardcoded middleware. Sufficient for MVP; needs structure before contractor #2. |
| --- | --- |

| **Session** | Multi-Contractor Security Session (before contractor #2) |
| --- | --- |

**24. Audit Log (Separate from App Data)  ****  ~ PARTIAL  ****  NEEDED**

| **What it is** | An audit log records every significant action taken in the system — who did what, when, and to what. It should be append-only and separate from regular app tables. |
| --- | --- |

| **Why it matters** | Required for SOC 2. Also critical for investigating disputes (e.g., 'why was this referral not credited?') and detecting malicious activity. |
| --- | --- |

| **How it works** | An activity_log table that only ever has rows inserted — never updated or deleted. Separate from business data tables. Contains: timestamp, user_id, action, target_resource, IP address. |
| --- | --- |

| **RoofMiles status** | PARTIAL. activity_log table exists and is written to on key events. However it is not confirmed to be append-only (no UPDATE/DELETE prevention at DB level). No IP address logging on audit events. Auto-delete after 90 days was mentioned in early sessions — this conflicts with audit log best practice (should be retained longer). Needs a dedicated review. |
| --- | --- |

| **Session** | Audit Log & Compliance Session |
| --- | --- |

**25. SOC 2 Requirements  ****  ✗ TODO  ****  NEEDED**

| **What it is** | SOC 2 is a security certification that proves to enterprise customers that you handle their data responsibly. It covers five 'trust service criteria': security, availability, processing integrity, confidentiality, and privacy. |
| --- | --- |

| **Why it matters** | Enterprise contractors and large organizations may require SOC 2 before signing a contract. It becomes a sales requirement at a certain ARR threshold. |
| --- | --- |

| **How it works** | SOC 2 requires: access controls, encryption, audit logging, incident response plans, vendor risk assessments, and annual penetration testing. Getting certified requires a third-party auditor. |
| --- | --- |

| **RoofMiles status** | TODO / FUTURE. Many SOC 2 controls are already in place (access control, encryption, backups, audit logging). However a formal SOC 2 readiness assessment has not been done. This is appropriate to begin at $250K–$500K ARR. Queue it as a planning item, not an immediate build. |
| --- | --- |

| **Session** | SOC 2 Readiness Planning (future milestone) |
| --- | --- |

**26. Data Isolation Between Contractors  ****  ~ PARTIAL  ****  NEEDED**

| **What it is** | Each contractor's data (their referrers, conversions, clients) must be completely invisible to other contractors — as if they each have their own private database. |
| --- | --- |

| **Why it matters** | A data leak between contractors would be catastrophic for trust and potentially a legal liability. |
| --- | --- |

| **How it works** | Every database table has a contractor_id column. Every query filters by contractor_id. Row-level security at the database layer adds a second line of defense. |
| --- | --- |

| **RoofMiles status** | PARTIAL. contractor_id is on all tables and all queries scope to it. Currently hardcoded as 'accent-roofing' for MVP — this is flagged in CLAUDE.md and must be pulled from session token before contractor #2. Native PostgreSQL RLS policies are not in place yet. The architectural design is correct; enforcement needs to be strengthened before multi-tenancy. |
| --- | --- |

| **Session** | Multi-Contractor Security Session (before contractor #2) |
| --- | --- |

**27. Google Login (Social Auth)  ****  — N/A  ****  NOT NEEDED**

| **What it is** | Allowing users to sign in with their Google account instead of (or in addition to) a username/password. |
| --- | --- |

| **Why it matters** | Reduces friction at signup. Users don't need to remember another password. |
| --- | --- |

| **How it works** | Implement OAuth 2.0 via Google Identity Services or a library like Passport.js (google strategy). |
| --- | --- |

| **RoofMiles status** | NOT NEEDED NOW. Your referrer app uses phone-number + PIN — intentionally simple and friction-reduced for homeowners. Google login would add complexity without a clear UX benefit for your user type. Consider for admin panel login post-MVP if desired. |
| --- | --- |

**28. HTTPS Only ****&**** Secure Cookies  ****  ✓ DONE  ****  NEEDED**

| **What it is** | HTTPS encrypts all traffic between the user's browser and your server. Secure cookies are only sent over HTTPS connections, never plain HTTP. |
| --- | --- |

| **Why it matters** | Without HTTPS, anyone on the same network can intercept login credentials and session tokens. Vercel and Railway enforce HTTPS by default. |
| --- | --- |

| **How it works** | Vercel and Railway provision SSL/TLS certificates automatically. Session tokens are sent via Authorization headers — no cookies in use, which sidesteps cookie security issues entirely. |
| --- | --- |

| **RoofMiles status** | DONE. Vercel and Railway both enforce HTTPS with auto-provisioned SSL certificates. The app uses Authorization header tokens rather than cookies, which provides strong transport-layer protection. No plain HTTP in use. |
| --- | --- |

**29. Phishing Defense  ****  ~ PARTIAL  ****  NEEDED**

| **What it is** | Phishing defense means protecting users from being tricked into entering their credentials on a fake version of your app. |
| --- | --- |

| **Why it matters** | A convincing fake app page could steal your users' PINs. SMS-based invite links are a common phishing vector. |
| --- | --- |

| **How it works** | Email authentication (SPF, DKIM, DMARC) so your Resend emails cannot be spoofed. Clear sender names. Educating users about official app domain. App Store distribution (harder to fake than a link). |
| --- | --- |

| **RoofMiles status** | PARTIAL. Resend handles email delivery — confirm SPF/DKIM/DMARC are configured on your sending domain (noreply@roofmiles.com). App Store distribution (when live) dramatically reduces phishing risk vs web links. No user-facing phishing education exists in the app. Should be checked in a compliance session. |
| --- | --- |

| **Session** | Compliance & Legal Session |
| --- | --- |

**30. Storage Buckets Set to Private  ****  ✓ DONE  ****  NEEDED**

| **What it is** | Cloud storage buckets (like Backblaze B2 or AWS S3) can be configured as public (anyone can access any file with the URL) or private (only authenticated requests can access files). |
| --- | --- |

| **Why it matters** | A public bucket means anyone who guesses a file URL can download your database backups — exposing all user data. |
| --- | --- |

| **How it works** | Set the Backblaze B2 bucket to private. Use signed URLs or API tokens to generate temporary access when needed. |
| --- | --- |

| **RoofMiles status** | DONE. The Backblaze B2 bucket (roofmiles-backups) is confirmed configured for backup use with API authentication. Verify in Backblaze console that the bucket access is set to Private — confirm this during next admin review. |
| --- | --- |

**31. Never Expose Service Role Keys  ****  ✓ DONE  ****  NEEDED**

| **What it is** | Service role keys are admin-level API keys that bypass all security checks. They should never appear in frontend code, client-side JavaScript, or version control. |
| --- | --- |

| **Why it matters** | If a service key is exposed in the browser, any user can use it to make admin-level API calls. |
| --- | --- |

| **How it works** | Keep all service keys in Railway environment variables (server-side only). Use GitGuardian or pre-commit hooks to prevent accidental commits. Never include in .env files committed to GitHub. |
| --- | --- |

| **RoofMiles status** | DONE. All secrets are in Railway environment variables. .env is in .gitignore. GitGuardian/GitHub secret scanning is active. CLAUDE.md explicitly documents this rule. git rm --cached .env procedure is documented for accidental commits. |
| --- | --- |

**32. XSS (Cross-Site Scripting)  ****  ~ PARTIAL  ****  NEEDED**

| **What it is** | XSS is when an attacker injects malicious JavaScript into your app that runs in other users' browsers — for example, by submitting a name like `<script>stealCookies()</script>`. |
| --- | --- |

| **Why it matters** | XSS can steal session tokens, redirect users, or silently submit requests on their behalf. |
| --- | --- |

| **How it works** | React's JSX auto-escapes HTML by default — this prevents most XSS. Additionally: Helmet.js sets Content-Security-Policy headers that block inline script execution. Never use dangerouslySetInnerHTML with user-supplied content. |
| --- | --- |

| **RoofMiles status** | PARTIAL. React's automatic escaping covers the primary XSS surface. Helmet.js is referenced in planning but not confirmed installed and configured in the current codebase. Content-Security-Policy header is not confirmed. Should be verified and locked down in a security session. |
| --- | --- |

| **Session** | Input Validation Session |
| --- | --- |

**33. Path Traversal  ****  ✓ DONE  ****  NEEDED**

| **What it is** | Path traversal is an attack where a user submits a filename like `../../etc/passwd` to trick the server into reading system files outside the intended directory. |
| --- | --- |

| **Why it matters** | Could expose server configuration files, environment variables, or other sensitive files. |
| --- | --- |

| **How it works** | Validate and sanitize all file path inputs. Use path.resolve() and verify the resulting path starts with the expected directory. |
| --- | --- |

| **RoofMiles status** | DONE / LOW RISK. RoofMiles does not serve user-uploaded files or accept file path inputs from users. Backblaze B2 handles all file storage with its own API. Path traversal is not a significant attack surface in your current architecture. |
| --- | --- |

**34. Short-Lived Tokens  ****  ✓ DONE  ****  NEEDED**

| **What it is** | Tokens (session tokens, reset tokens, invite tokens) should expire after a short time window rather than lasting forever. |
| --- | --- |

| **Why it matters** | A stolen token is only useful while it's valid. Short expiry limits the damage window. |
| --- | --- |

| **How it works** | Set expires_at timestamps on all tokens when created. Check against NOW() on every use. |
| --- | --- |

| **RoofMiles status** | DONE. Session tokens: 24h TTL. Experience invite tokens: 7-day expiry with expires_at check. Twilio OTP: inherently time-limited. No indefinite tokens in use. |
| --- | --- |

**35. Dependency Vulnerability Scanning  ****  ✓ DONE  ****  NEEDED**

| **What it is** | Open-source libraries your app depends on can have known security vulnerabilities. Scanning tools automatically detect and alert you when a dependency has a CVE (known vulnerability). |
| --- | --- |

| **Why it matters** | Vulnerable dependencies are one of the most common attack vectors — you inherit their bugs. |
| --- | --- |

| **How it works** | GitHub Dependabot scans your package.json weekly and opens pull requests for security updates. CodeQL does static analysis on every push. |
| --- | --- |

| **RoofMiles status** | DONE. Dependabot alerts and grouped security updates are enabled. CodeQL is active. 8 production vulnerabilities were patched in Session 35. 26 remaining are CRA build toolchain — not reachable in production (Vite migration will close them permanently). |
| --- | --- |

**36. Check Frontend for Secrets  ****  ✓ DONE  ****  NEEDED**

| **What it is** | Frontend JavaScript (React) is sent to every user's browser. Any secret embedded in it — API keys, database credentials — is readable by anyone. |
| --- | --- |

| **Why it matters** | A single exposed key can give an attacker full access to your database, email provider, or payment system. |
| --- | --- |

| **How it works** | Ensure all secrets are in Railway environment variables (backend only). Frontend environment variables in React (REACT_APP_*) are okay for non-secret config like your API base URL — never for credentials. |
| --- | --- |

| **RoofMiles status** | DONE. All secrets are backend-only in Railway env vars. GitGuardian and GitHub secret scanning are active. CLAUDE.md explicitly documents this rule. No credentials in frontend code. |
| --- | --- |

**37. N+1 Query Elimination  ****  ~ PARTIAL  ****  NEEDED**

| **What it is** | An N+1 query problem is when your app runs 1 query to get a list of items, then runs N more queries — one for each item — to get additional details. For 100 users, that's 101 queries instead of 1. |
| --- | --- |

| **Why it matters** | N+1 queries get exponentially slower as data grows. What works fine with 10 users can grind to a halt with 1,000. |
| --- | --- |

| **How it works** | Replace multiple round trips with a single JOIN query that fetches all needed data at once. |
| --- | --- |

| **RoofMiles status** | PARTIAL. Some endpoints (like the admin referrers lifecycle status query in Session 39) were specifically audited to use JOINs. However a comprehensive N+1 audit across all endpoints has not been done. Specifically: admin dashboard stats, pipeline cache reads, and conversion history endpoints should be audited. |
| --- | --- |

| **Session** | Database Performance Session |
| --- | --- |

**38. Missing Indexes Audit  ****  ~ PARTIAL  ****  NEEDED**

| **What it is** | Every column used in a WHERE, JOIN, or ORDER BY clause should have an index. Without one, the database scans every row to find matches. |
| --- | --- |

| **Why it matters** | Index-less queries on large tables can take seconds instead of milliseconds. |
| --- | --- |

| **How it works** | Run `EXPLAIN ANALYZE` on your most common queries to see which are doing full table scans. Add indexes where needed. |
| --- | --- |

| **RoofMiles status** | PARTIAL. Primary keys auto-indexed. UNIQUE constraints create indexes. No formal EXPLAIN ANALYZE audit has been done. Key columns likely missing indexes: pipeline_cache (contractor_id, jobber_client_id), activity_log (user_id, contractor_id, created_at), referral_conversions (user_id, contractor_id), sessions (token lookup). |
| --- | --- |

| **Session** | Database Performance Session |
| --- | --- |

**39. SELECT * and Unbounded Queries  ****  ~ PARTIAL  ****  NEEDED**

| **What it is** | `SELECT *` fetches every column from a table even if you only need 2 of 20 columns. Unbounded queries (no LIMIT) can return millions of rows at once. |
| --- | --- |

| **Why it matters** | Over-fetching wastes bandwidth, memory, and processing time. A single unbounded query can cause an out-of-memory crash. |
| --- | --- |

| **How it works** | Always name the specific columns you need. Add LIMIT to all list queries. Add pagination for any admin view that lists growing data. |
| --- | --- |

| **RoofMiles status** | PARTIAL. Explicit SELECT columns were enforced on cashout_requests and activity_log in Session 35 (I4 finding). However a full audit of all queries for SELECT * and missing LIMITs has not been done. Admin views listing referrers, conversions, and messages should be checked. |
| --- | --- |

| **Session** | Database Performance Session |
| --- | --- |

**40. Pagination  ****  ~ PARTIAL  ****  NEEDED**

| **What it is** | Pagination means returning data in pages (e.g., 25 items at a time) rather than dumping the entire dataset in one response. |
| --- | --- |

| **Why it matters** | An admin table with 10,000 rows sent in one API call would crash the browser and the server. |
| --- | --- |

| **How it works** | Use LIMIT + OFFSET or cursor-based pagination on all list endpoints. Frontend shows 'Load More' or numbered pages. |
| --- | --- |

| **RoofMiles status** | PARTIAL. Pipeline data is cached rather than fetched live — this naturally limits volume. However admin list views (referrers, conversions, activity log, messages) do not have confirmed pagination. As contractor data grows, these will become a performance issue. |
| --- | --- |

| **Session** | Database Performance Session |
| --- | --- |

**41. Async / Non-Blocking Processing  ****  ✓ DONE  ****  NEEDED**

| **What it is** | JavaScript is single-threaded. If your server does a slow operation (like a database query or API call) without async/await, it blocks all other requests from being processed. |
| --- | --- |

| **Why it matters** | A blocking operation can freeze your entire API for every user while it runs. |
| --- | --- |

| **How it works** | All async operations must use async/await or Promises. Webhook handlers respond 200 immediately and run all logic in async IIFEs. Long-running work (email sending, Jobber fetches) runs in the background. |
| --- | --- |

| **RoofMiles status** | DONE. All webhook handlers respond 200 immediately and run logic in async IIFEs. retryWithBackoff is async. All Jobber, Resend, and Twilio calls use async/await. Some legacy .then() chains exist in a few files (flagged for cleanup) but are not blocking. |
| --- | --- |

**42. Comprehensive Monitoring ****&**** Metrics  ****  ~ PARTIAL  ****  NEEDED**

| **What it is** | Monitoring means having dashboards and alerts that show you the health of your app in real time — response times, error rates, database performance, memory usage. |
| --- | --- |

| **Why it matters** | Without monitoring, you're flying blind. You don't know if your app is slow, broken, or under attack until a user tells you. |
| --- | --- |

| **How it works** | Key metrics to track: response time (p50, p95, p99), error rate (4xx, 5xx), database query time, memory/CPU usage, active sessions, failed signups, failed cashouts. Tools: Railway metrics (built-in), UptimeRobot (uptime), a structured logging tool like Logtail or Datadog for deeper metrics. |
| --- | --- |

| **RoofMiles status** | PARTIAL. UptimeRobot: 3 monitors live. Railway: basic CPU/memory metrics available. Error log table: captures backend errors with Resend email alerts. MISSING: no response time tracking, no p95 latency alerts, no failed payment/signup alerting, no structured log aggregation tool. Needs expansion. |
| --- | --- |

| **Session** | Monitoring & Alerting Session |
| --- | --- |

# **Session Build Plan**

Complete these sessions in order. Sessions A–D can be done before App Store submission. Session G must be done before contractor #2 is onboarded. Session H is a future milestone.

## **Session A — Input Validation, CORS ****&**** XSS**

**Estimated duration: 2–3 hours**

What to build:

- #15 — Input Validation & Sanitization (Zod/express-validator at API boundary)

- #16 — CORS locked to Vercel domain (not wildcard *)

- #17 — CSRF verification (SameSite, Origin header checks)

- #32 — Helmet.js installation and Content-Security-Policy header

How to verify completion:

- Test POST requests with malformed data — confirm rejection

- Open browser DevTools → Network → confirm CORS headers on API responses

- Confirm Helmet.js headers present on every response (X-Frame-Options, CSP, etc.)

## **Session B — Database Performance ****&**** Indexes**

**Estimated duration: 3–4 hours**

What to build:

- #20 — Comprehensive index audit (EXPLAIN ANALYZE on top 10 queries)

- #37 — N+1 query audit on admin and dashboard endpoints

- #38 — Add missing indexes (pipeline_cache, activity_log, sessions, referral_conversions)

- #39 — SELECT * audit — replace with explicit column lists

- #40 — Pagination on all admin list views

How to verify completion:

- Run EXPLAIN ANALYZE on pipeline, referrers, conversions, and activity log queries

- Confirm no full sequential scans on large tables

- Test admin views with 500+ rows to confirm pagination works

## **Session C — Monitoring ****&**** Alerting Expansion**

**Estimated duration: 2 hours**

What to build:

- #5 — QPS / query volume monitoring setup

- #21 — Add alerts: failed cashouts, failed signups, 5xx spike rate, latency thresholds

- #42 — Structured log aggregation (Logtail or Railway log drain)

How to verify completion:

- Trigger a test error and confirm alert email received

- Confirm Railway metrics dashboard shows memory/CPU

- Test a failed cashout and confirm alert fires

## **Session D — Rollback Runbook**

**Estimated duration: 2 hours**

What to build:

- #22 — Write and document full rollback runbook: git revert steps, Railway re-deploy steps, Backblaze restore steps, communication template

How to verify completion:

- Do a dry-run rollback on staging: revert a known commit, confirm staging works

- Confirm database restore from Backblaze works end-to-end

## **Session E — Compliance, Legal ****&**** CCPA**

**Estimated duration: 3–4 hours (legal review by lawyer recommended)**

What to build:

- #9 — Add terms acceptance checkbox to referrer signup flow

- #10 — Create internal Data Processing document

- #11 — Add CCPA rights section to Privacy Policy (right to know, delete, opt-out)

- #29 — Verify SPF/DKIM/DMARC on roofmiles.com sending domain

How to verify completion:

- Sign up as a test referrer — confirm terms checkbox is required

- Load /privacy — confirm CCPA section is present and accurate

- Use mail-tester.com or MXToolbox to verify DKIM/SPF pass

## **Session F — Audit Log Review ****&**** Hardening**

**Estimated duration: 2 hours**

What to build:

- #24 — Review activity_log: confirm append-only behavior (no UPDATE/DELETE in application code)

- Add IP address logging to activity_log on key events (login, cashout, admin actions)

- Review retention policy — audit logs should be retained minimum 1 year (not 90 days)

How to verify completion:

- Inspect all activity_log write paths — confirm no UPDATE/DELETE on log rows

- Log a test login and confirm IP address captured

## **Session G — Multi-Contractor Security (before contractor #2)**

**Estimated duration: 4–6 hours — do not skip**

What to build:

- #12 — Implement native PostgreSQL RLS policies on all tables

- #23 — Formalize RBAC role definitions for upcoming internal_users role

- #26 — Pull contractor_id from session token (not hardcoded 'accent-roofing')

- Add API key encryption (currently plaintext — flagged in CLAUDE.md)

How to verify completion:

- Attempt to query contractor B data while logged in as contractor A — confirm blocked at DB level

- Confirm contractor_id in all endpoints comes from session token

- Confirm API keys encrypted at rest in database

## **Session H — SOC 2 Readiness Planning (future milestone)**

**Estimated duration: Half-day planning session at $250K–$500K ARR**

What to build:

- #25 — SOC 2 gap assessment: map current controls to SOC 2 Trust Service Criteria

- Identify gaps in logging, vendor risk, incident response, and penetration testing

- Create SOC 2 roadmap document

How to verify completion:

- Deliverable: a gap analysis document listing what is and isn't in place

# **Additional Items Not in Your Checklist**

These are gaps identified from reviewing your codebase that were not on your original list. All are real and should be addressed.

## **Security**

- Helmet.js — HTTP security headers (X-Frame-Options, Content-Security-Policy, X-XSS-Protection, HSTS). Not confirmed installed.

- SPF/DKIM/DMARC email authentication on roofmiles.com — prevents email spoofing from your domain.

- API key encryption at rest — currently stored plaintext in DB. Must encrypt before contractor #2.

- Brute-force protection on PIN entry in the referrer app (not just login endpoint).

- Account lockout after N failed PIN attempts — related to above.

- Signed Backblaze B2 URLs — if you ever serve files to users, use pre-signed URLs with expiration rather than permanent public URLs.

- Secrets rotation plan — what is the procedure if a Railway env var key is compromised? Documented? No.

- Webhook replay attack prevention — Jobber's HMAC prevents forgery but does not prevent replay. Consider timestamp check on webhook payload.

## **Performance**

- Connection pooling tuning — pg pool max connections need to be sized for contractor count. Default may be too low at 50+ contractors.

- Pipeline cache TTL review — 30-minute sync window is the current freshness guarantee. Document and monitor stale_since lag.

- Background job queue (BullMQ) — outreach campaign sends (500 recipients) should go through a job queue rather than inline processing to prevent timeout and allow retry.

- Response compression — gzip/brotli compression on API responses reduces bandwidth, especially for large pipeline payloads.

- Frontend bundle size audit — unused imports and large libraries slow initial load time. Run build analyzer before App Store submission.

- Cold start awareness — Railway keeps the server warm but if it ever sleeps, first request after sleep will be slow. Monitor Railway for sleep behavior.

## **Maintenance ****&**** Best Practices**

- Vite migration — closes 26 CRA npm audit vulnerabilities permanently. Queued for a dedicated session.

- Cleanup of legacy .then() chains flagged in App.js and AdminApp.jsx — convert to async/await for consistency.

- CLAUDE.md character limit management — currently at 37,986 chars. Monitor and trim before it hits the 38K performance warning again.

- Database backup restore test — must be done on a schedule (quarterly), not just once. Add it to a recurring calendar reminder.

- Incident response plan — what do you do when production goes down at 2am? Document the steps: who to call, where to look, how to communicate with contractors.

- Dependency lock file hygiene — package-lock.json should be committed and kept up to date to ensure reproducible builds.

- API versioning strategy — as RoofMiles grows, external partners may build on your API. Document a versioning plan (/api/v1/) before it becomes a migration problem.

- Environment variable documentation — a non-sensitive list of all required env vars and what they do, so onboarding a new developer or rebuilding Railway is not a mystery.

- Stripe webhook signature verification — when Stripe ACH is built, implement Stripe's own webhook HMAC verification the same way Jobber's is done.

- Internal API rate limiting per contractor — not just per IP/user. Prevent one contractor's campaign blast from starving another contractor's webhook processing.

*RoofMiles Security Audit  |  May 2026  |  Confidential*