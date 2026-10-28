# ReconAgent

AI-assisted cross-system transaction reconciliation demo built with React, Vite, Tailwind CSS, FastAPI, SQLite, and Google Gemini.

## Run locally

### Backend (terminal 1)

From the repository root:

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
# Edit .env and set SESSION_SECRET to a long random value.
uvicorn app.main:app --reload --port 5000
```

API health: http://localhost:5000/health  
API documentation: http://localhost:5000/docs

### Frontend (terminal 2)

```powershell
cd frontend
npm install
Copy-Item .env.example .env.local
npm run dev
```

Open http://localhost:5173. The frontend .env.local should contain:

```env
VITE_API_BASE_URL=http://localhost:5000
```

Restart Vite after changing environment variables.

## Deployment

### Backend on Render

This repository includes render.yaml. In Render, create a Blueprint from this repository and review the service settings before applying. The configuration uses:
- Build: pip install -r requirements.txt
- Start: uvicorn app.main:app --host 0.0.0.0 --port $PORT
- A persistent disk mounted at /var/data for the SQLite file.

Set these environment variables in Render:
- SESSION_SECRET: generate a long random secret; never commit it.
- GEMINI_API_KEY: optional; set it only in the backend service.
- FRONTEND_ORIGINS: replace the example value with the exact deployed Vercel origin, e.g. https://your-project.vercel.app (no trailing slash).
- APP_ENV=production
- DATABASE_PATH=/var/data/reconagent_persistent.db

### Frontend on Vercel

Import the same repository in Vercel and set the Root Directory to frontend. Use the Vite framework preset, build command npm run build, and output directory dist. Add this environment variable, using your actual Render service URL:

```env
VITE_API_BASE_URL=https://YOUR-RENDER-SERVICE.onrender.com
```

Redeploy after changing environment variables. Update Render's FRONTEND_ORIGINS with the exact Vercel deployment origin and redeploy the backend.

## Important security and data notes

- The API requires a signed bearer token for transaction, metrics, audit-log, export, chat, and PDF upload endpoints.
- Registration accepts the demo roles shop_owner, manager, and auditor. Public self-registration is not suitable for a production financial system; add administrator approval and role-specific authorization before handling real financial data.
- Passwords are stored as salted PBKDF2 hashes. Existing plaintext passwords are upgraded on a successful login.
- User records are no longer dropped during startup. Back up your database before deployment or schema changes.
- PDF extraction does not prove reconciliation. Extracted transactions are marked Pending Review; files with no detectable amount are rejected instead of receiving a fabricated amount.
- The included sample transactions are demo data. Do not upload real bank statements or use this demo for live financial decisions without a security review, data isolation, robust tests, and appropriate compliance controls.
- SQLite persistence on Render depends on the configured persistent disk. Keep DATABASE_PATH aligned with the disk mount path.
