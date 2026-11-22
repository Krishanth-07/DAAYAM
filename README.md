# DAAYAM
DAAYAM is a family financial readiness and emergency-response prototype. It helps families
catalogue important financial assets, designate and verify nominees, calculate a protection
readiness score, and prepare an ordered Financial First Aid Kit after a death or disability
event.
The interface is designed to reduce confusion during difficult moments by separating
day-to-day vault setup from the family emergency flow.
> **Demo software:** OTP generation, emergency verification, nominee verification, and the
> recovery assistant are demonstration workflows. They do not perform real identity,
> certificate, banking, insurance, or government verification and must not be used as legal,
> financial, or medical advice.
## Features
- **Family Dashboard** - view mapped assets, nominee status, readiness, protection score,
  and active auto-debits.
- **Asset Vault** - add bank accounts, loans, insurance policies, and subscriptions or UPI
  mandates.
- **Nominee Management** - add family members, identify relationships, link them to assets,
  and track verification status.
- **Protected Access Model** - keep assets protected until a death or disability event is
  verified for approved family members.
- **Grief Mode** - guide a family through OTP verification, certificate entry, release
  status, and next actions.
- **Financial First Aid Kit** - generate prioritized claim, cancellation, settlement,
  nominee, and auto-debit tasks.
- **Recovery Assistant** - generate deadlines and downloadable claim letters in English,
  Tamil, or Hindi.
- **Audit Trail** - retain recent in-memory or file-backed audit entries for key actions.
- **Optional Role Authentication** - protect management and family operations with role
  names and access keys.
## Application Flow
1. An administrator adds assets and nominees in the **Assets**, **Nominees**, or **Manage**
   screens.
2. Nominees remain pending until an administrator verifies them.
3. The dashboard calculates a protection score from mapped assets, nominee verification,
   asset-to-nominee coverage, and protected access configuration.
4. In **Grief Mode**, the family requests a demo OTP, enters a certificate number and
   issuing authority, and verifies the event.
5. After verification, the application generates a prioritized checklist and recovery
   letters that can be copied, downloaded, printed, or opened in an email client.
## Tech Stack
| Area | Technology |
| --- | --- |
| Frontend | React 19, React Router 6 |
| Build tool | Vite 5 |
| Backend | Node.js 18+, Express 4 |
| Persistence | JSON file or process memory |
| Testing | Node.js built-in test runner |
| Hosting | Local Express server or Vercel |
## Requirements
- Node.js 18 or newer
- npm
## Getting Started
Install dependencies:
```bash
npm install
```
Start the combined Express API and React application:
```bash
npm start
```
Open `http://localhost:3000`.
For frontend development with Vite hot reload, run:
```bash
npm run dev
```
Vite serves on `http://localhost:5173` and proxies API requests to Express on port `3000`,
so run `npm start` and `npm run dev` in separate terminals.
## Available Commands
| Command | Purpose |
| --- | --- |
| `npm start` | Start the production-style Express server |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Create the frontend build in `dist/` |
| `npm run preview` | Preview the Vite build |
| `npm test` | Run domain unit tests |
| `npm run check` | Check `index.js` syntax |
| `npm run verify` | Run syntax checks, tests, and the production build |
## Configuration
DAAYAM can be configured with environment variables:
| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3000` | Express server port |
| `STORAGE_MODE` | `file` locally; `memory` on Vercel/Lambda | Use `file` or `memory` |
| `AUTH_REQUIRED` | `false` | Set to `true` to enforce role and key headers |
| `ADMIN_KEY` | `daayam-admin-demo` | Key for the `admin` role |
| `FAMILY_KEY` | `daayam-family-demo` | Key for the `family` role |
Example local setup:
```bash
PORT=3000 STORAGE_MODE=file npm start
```
Example setup with authentication:
```bash
AUTH_REQUIRED=true \
ADMIN_KEY='replace-with-a-secret' \
FAMILY_KEY='replace-with-a-secret' \
npm start
```
When authentication is enabled, every protected API request must include:
```text
x-daayam-role: admin
x-daayam-key: replace-with-a-secret
```
For family operations, use `x-daayam-role: family` and `FAMILY_KEY`.
> The demo keys are defaults only. In a real deployment, use secure secret storage and
> replace every default before exposing the application.
## Persistence
In `file` mode, state is initialized from `data/store.json`. The file is created on first
use and updated atomically after mutations. This mode is best for local development.
In `memory` mode, state is seed data and exists only for the lifetime of the process.
Serverless environments use memory mode by default because writable local storage is not
reliable between invocations.
The demo seed includes:
- Bank, loan, insurance, and subscription/UPI mandate examples
- One verified nominee
- One pending nominee
- A readiness and asset overview
`data/store.json` is intentionally ignored by Git.
## API Overview
All JSON endpoints are served by Express. In unauthenticated mode, no role headers are
required.
| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Service health check |
| `GET` | `/assets` | Return assets, nominees, guardians, insights, and verification state |
| `POST` | `/add-asset` | Add a financial asset |
| `POST` | `/add-nominee` | Add a nominee |
| `POST` | `/verify-nominee/:id` | Mark a nominee as verified |
| `POST` | `/request-emergency-otp` | Create a demo OTP session |
| `POST` | `/verify-emergency-otp` | Verify a demo OTP |
| `POST` | `/verify-emergency` | Verify certificate details and release protected access |
| `POST` | `/generate-checklist` | Generate the Financial First Aid Kit |
| `POST` | `/recovery-assistant` | Generate tasks and claim letters |
Example health check:
```bash
curl http://localhost:3000/health
```
Example asset request with authentication enabled:
```bash
curl -H 'x-daayam-role: admin' \
     -H 'x-daayam-key: replace-with-a-secret' \
     http://localhost:3000/assets
```
## Project Structure
```text
.
├── api/
│   └── index.js          # Vercel serverless entry point
├── dist/                 # Existing production frontend build
├── lib/
│   └── domain.js         # Readiness, checklist, and recovery business logic
├── public/               # Static assets and theme
├── src/
│   ├── App.jsx           # React routes and application screens
│   └── main.jsx          # React entry point
├── tests/
│   └── domain.test.js    # Domain unit tests
├── index.js              # Express API and local server entry point
├── vite.config.mjs       # Vite build and development proxy configuration
└── vercel.json           # Vercel routing configuration
```
## Testing
Run the complete verification suite:
```bash
npm run verify
```
The domain tests cover known and unknown asset types, identifier masking, readiness
calculation, checklist generation, family-access text, recovery-language fallback, and
multilingual recovery plans.
## Vercel Deployment
The repository includes a Vercel configuration that routes requests through `api/index.js`.
Without a database or external store, Vercel uses memory storage and each cold start begins
from demo data.
Before deployment, configure `ADMIN_KEY` and `FAMILY_KEY` as Vercel environment variables if
authentication is enabled. Set `AUTH_REQUIRED=true` to enforce role checks.
## Security and Privacy Notes
- Raw nominee and certificate identifiers are normalized and recent nominee API responses
  mask their stored identifier numbers.
- Mutations are limited by role when `AUTH_REQUIRED=true`.
- Demo OTPs are generated only in process memory and expire after 10 minutes.
- OTP sessions allow five verification attempts before removal.
- Audit entries retain role, timestamp, and metadata for recent actions.
- Data persistence is local or in-process and is not a substitute for a production database,
  encryption-at-rest system, access-control service, or certificate verification provider.
## License
No license has been added to this repository. Until a license is specified, reuse and
distribution rights are not granted.
