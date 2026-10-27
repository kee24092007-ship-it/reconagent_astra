# ReconAgent - Enterprise Financial Reconciliation System

An AI-Assisted Cross-System Transaction Reconciliation System featuring:
- **Dual Authentication Portals** (Ops Admin & Compliance Auditor with Admin Approval Queue)
- **Recon-Guard AI Engine** (Google Gemini API AJE generation & local rule fallback)
- **Persistent SQLite Database** (All transactions, auditors, and audit logs persist permanently)
- **Indian Rupee (₹ - INR) Standardization**
- **Cryptographic SHA-256 Audit Ledger**

---

## 🚀 How to Run locally

### 1. Start Backend API (FastAPI)
```bash
cd backend
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Mac/Linux:
source venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
*Backend runs at:* `http://localhost:8000`

### 2. Start Frontend UI (React + Tailwind + Vite)
```bash
cd frontend
npm install
npm run dev
```
*Frontend runs at:* `http://localhost:5173`

---

## 🔐 API Keys Setup
1. Open `frontend/.env` and `backend/.env`.
2. Replace `"YOUR_GEMINI_API_KEY_HERE"` with your actual Google Gemini API key.
