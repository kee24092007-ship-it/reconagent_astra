import os
import hashlib
import hmac
import io
import json
import re
import secrets
import sqlite3
import time
import base64
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import pypdf
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Response, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from google import genai
from pydantic import BaseModel, EmailStr, Field

load_dotenv()

APP_ENV = os.getenv("APP_ENV", "development").lower()
SESSION_SECRET = os.getenv("SESSION_SECRET")
if not SESSION_SECRET:
    if os.getenv("RENDER") or APP_ENV == "production":
        raise RuntimeError("Set SESSION_SECRET to a long random value in the deployment environment.")
    SESSION_SECRET = "local-development-only-change-me"

DB_FILE = os.getenv("DATABASE_PATH", "reconagent_persistent.db")
Path(DB_FILE).parent.mkdir(parents=True, exist_ok=True)
TOKEN_TTL_SECONDS = 12 * 60 * 60
ALLOWED_ROLES = {"shop_owner", "manager", "auditor"}
bearer_scheme = HTTPBearer(auto_error=False)

app = FastAPI(title="ReconAgent API", version="3.0")
origins = [
    origin.strip()
    for origin in os.getenv(
        "FRONTEND_ORIGINS", "http://localhost:5173,http://localhost:4173"
    ).split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


def connect_db():
    conn = sqlite3.connect(DB_FILE, timeout=20)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Create missing tables without deleting existing user or transaction data."""
    with connect_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS transactions (
                id TEXT PRIMARY KEY, source TEXT, reference TEXT, amount REAL,
                currency TEXT, date TEXT, status TEXT, discrepancy_reason TEXT,
                aje_json TEXT
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                email TEXT PRIMARY KEY, password TEXT, role TEXT, status TEXT
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, actor TEXT,
                action TEXT, sha256 TEXT
            )
        """)
        count = conn.execute("SELECT COUNT(*) FROM transactions").fetchone()[0]
        if count == 0:
            initial_data = [
                ("TXN-9001", "Automated Bank Sync", "UPI/4281920391/MerchantPay", 45000.0, "INR", "2026-10-24", "Exact Match", "", ""),
                ("TXN-9002", "Payment Gateway API", "NEFT*INB0001293*SaaS_Sub", 125000.0, "INR", "2026-10-25", "Amount Mismatch", "Gateway fee deduction of ₹1,250.00 not posted in ledger", json.dumps({"debit_account": "Bank Charges Expense", "debit_amount": 1250.0, "credit_account": "Accounts Receivable", "credit_amount": 1250.0, "fraud_score": 2, "explanation": "Calculated gateway fee variance offset."})),
                ("TXN-9003", "Payment Gateway API", "RZP_PAY_889210", 8900.0, "INR", "2026-10-26", "Missing in Ledger", "Incoming payment received via gateway webhook but invoice record missing", json.dumps({"debit_account": "Clearing Bank Account", "debit_amount": 8900.0, "credit_account": "Unearned Customer Revenue", "credit_amount": 8900.0, "fraud_score": 5, "explanation": "Unallocated incoming webhook payment."})),
                ("TXN-9004", "Automated Bank Sync", "IMPS/P2P/VendorPayout", 75000.0, "INR", "2026-10-26", "Duplicate Suspected", "Identical amount and reference hash detected within 2-hour window", json.dumps({"debit_account": "Suspense / Review Account", "debit_amount": 75000.0, "credit_account": "Primary Operating Bank", "credit_amount": 75000.0, "fraud_score": 82, "explanation": "High duplicate payout threat score."})),
            ]
            conn.executemany("INSERT INTO transactions VALUES (?,?,?,?,?,?,?,?,?)", initial_data)


init_db()


def add_audit_log(actor: str, action: str):
    timestamp = datetime.now(timezone.utc).isoformat()
    digest = hashlib.sha256(f"{timestamp}|{actor}|{action}".encode("utf-8")).hexdigest()
    with connect_db() as conn:
        conn.execute(
            "INSERT INTO audit_logs (timestamp, actor, action, sha256) VALUES (?,?,?,?)",
            (timestamp, actor, action, digest),
        )


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), 310000).hex()
    return f"pbkdf2_sha256:310000:{salt}:{digest}"


def verify_password(password: str, stored: str) -> bool:
    # Upgrade old plaintext credentials safely at successful login.
    if not stored.startswith("pbkdf2_sha256:"):
        return hmac.compare_digest(password, stored)
    try:
        _, iterations, salt, expected = stored.split(":", 3)
        actual = hashlib.pbkdf2_hmac(
            "sha256", password.encode(), bytes.fromhex(salt), int(iterations)
        ).hex()
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


def create_token(email: str, role: str) -> str:
    payload = json.dumps(
        {"sub": email, "role": role, "exp": int(time.time()) + TOKEN_TTL_SECONDS},
        separators=(",", ":"),
    ).encode()
    encoded = base64.urlsafe_b64encode(payload).rstrip(b"=").decode()
    signature = hmac.new(SESSION_SECRET.encode(), encoded.encode(), hashlib.sha256).hexdigest()
    return f"{encoded}.{signature}"


def current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
):
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Please log in to continue.")
    try:
        encoded, signature = credentials.credentials.rsplit(".", 1)
        expected = hmac.new(SESSION_SECRET.encode(), encoded.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected):
            raise ValueError("Invalid token signature")
        payload = json.loads(base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4)))
        if int(payload.get("exp", 0)) < int(time.time()):
            raise ValueError("Token expired")
        if not payload.get("sub") or payload.get("role") not in ALLOWED_ROLES:
            raise ValueError("Invalid token payload")
        return {"email": payload["sub"], "role": payload["role"]}
    except (ValueError, TypeError, KeyError, json.JSONDecodeError):
        raise HTTPException(status_code=401, detail="Session is invalid or expired. Please log in again.")


class AuthPayload(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: str = "shop_owner"


class ChatPayload(BaseModel):
    query: str = Field(min_length=1, max_length=2000)


@app.get("/")
def root():
    return {"status": "ok", "service": "ReconAgent API"}


@app.get("/health")
def health():
    return {"status": "healthy"}


@app.post("/api/auth/register")
def register(payload: AuthPayload):
    email = str(payload.email).strip().lower()
    role = payload.role.strip().lower()
    if role not in ALLOWED_ROLES:
        raise HTTPException(status_code=400, detail="Choose a valid access role.")
    try:
        with connect_db() as conn:
            conn.execute(
                "INSERT INTO users (email, password, role, status) VALUES (?,?,?,?)",
                (email, hash_password(payload.password), role, "APPROVED"),
            )
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="An account with this email already exists.")
    add_audit_log(email, f"Account registered with role {role}")
    return {"email": email, "role": role, "status": "APPROVED", "access_token": create_token(email, role), "token_type": "bearer"}


@app.post("/api/auth/login")
def login(payload: AuthPayload):
    email = str(payload.email).strip().lower()
    with connect_db() as conn:
        row = conn.execute(
            "SELECT email, password, role, status FROM users WHERE email=?", (email,)
        ).fetchone()
        if not row or not verify_password(payload.password, row["password"]):
            raise HTTPException(status_code=401, detail="Invalid email or password.")
        role = str(row["role"]).strip().lower()
        if role not in ALLOWED_ROLES:
            raise HTTPException(status_code=403, detail="This account has an unsupported role.")
        if not str(row["password"]).startswith("pbkdf2_sha256:"):
            conn.execute("UPDATE users SET password=? WHERE email=?", (hash_password(payload.password), email))
        if row["status"] != "APPROVED":
            raise HTTPException(status_code=403, detail="This account is not approved.")
    add_audit_log(email, f"Login as {role}")
    return {"email": email, "role": role, "status": "APPROVED", "access_token": create_token(email, role), "token_type": "bearer"}


@app.get("/api/transactions")
def get_transactions(user=Depends(current_user)):
    with connect_db() as conn:
        rows = conn.execute(
            "SELECT id, source, reference, amount, currency, date, status, discrepancy_reason, aje_json FROM transactions ORDER BY date DESC"
        ).fetchall()
    result = []
    for row in rows:
        result.append({
            "id": row["id"], "source": row["source"], "reference": row["reference"],
            "amount": row["amount"], "currency": row["currency"], "date": row["date"],
            "status": row["status"], "discrepancy_reason": row["discrepancy_reason"],
            "aje": json.loads(row["aje_json"]) if row["aje_json"] else None,
        })
    return result


@app.get("/api/metrics")
def get_metrics(user=Depends(current_user)):
    with connect_db() as conn:
        total_vol = conn.execute("SELECT SUM(amount) FROM transactions").fetchone()[0] or 0.0
        exact = conn.execute("SELECT COUNT(*) FROM transactions WHERE status='Exact Match'").fetchone()[0]
        total_cnt = conn.execute("SELECT COUNT(*) FROM transactions").fetchone()[0] or 1
        total_variance = conn.execute("SELECT SUM(amount) FROM transactions WHERE status!='Exact Match'").fetchone()[0] or 0.0
    return {"total_vol": round(total_vol, 2), "match_rate": round((exact / total_cnt) * 100, 1), "total_variance": round(total_variance, 2), "pending_auditors": 0}


@app.post("/api/ocr-scan")
async def scan_receipt(file: UploadFile = File(...), user=Depends(current_user)):
    filename = file.filename or "upload.pdf"
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=415, detail="Please upload a PDF statement.")
    file_bytes = await file.read(10 * 1024 * 1024 + 1)
    if len(file_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="PDF must be 10 MB or smaller.")
    if not file_bytes:
        raise HTTPException(status_code=400, detail="The uploaded PDF is empty.")
    try:
        reader = pypdf.PdfReader(io.BytesIO(file_bytes))
        full_text = "\n".join(page.extract_text() or "" for page in reader.pages)
    except Exception:
        raise HTTPException(status_code=400, detail="The PDF could not be read.")
    sent_match = re.search(r"Sent\s*₹?\s*([\d,]+\.\d{2})", full_text, re.IGNORECASE)
    amount_match = sent_match or re.search(r"₹\s*([\d,]+\.\d{2})", full_text)
    if not amount_match:
        raise HTTPException(status_code=422, detail="No reliable amount was found. Please review the PDF manually; no transaction was added.")
    extracted_amount = float(amount_match.group(1).replace(",", ""))
    if extracted_amount <= 0:
        raise HTTPException(status_code=422, detail="The extracted amount is invalid. No transaction was added.")
    tx_id = f"OCR-{secrets.token_hex(3).upper()}"
    date_str = datetime.now().strftime("%Y-%m-%d")
    description = f"Statement amount extracted ({filename})"
    # Extraction is not reconciliation: keep it pending for human review.
    with connect_db() as conn:
        conn.execute(
            "INSERT INTO transactions VALUES (?,?,?,?,?,?,?,?,?)",
            (tx_id, "PDF Statement", description, extracted_amount, "INR", date_str, "Pending Review", "Extracted amount requires manual verification", None),
        )
    add_audit_log(user["email"], f"Uploaded PDF for review: {filename}")
    return {"id": tx_id, "source": "PDF Statement", "reference": description, "amount": extracted_amount, "currency": "INR", "date": date_str, "status": "Pending Review", "discrepancy_reason": "Extracted amount requires manual verification", "aje": None}


@app.get("/api/audit-logs")
def get_audit_logs(user=Depends(current_user)):
    with connect_db() as conn:
        rows = conn.execute("SELECT id, timestamp, actor, action, sha256 FROM audit_logs ORDER BY id DESC LIMIT 50").fetchall()
    return [{"id": row["id"], "timestamp": row["timestamp"], "actor": row["actor"], "action": row["action"], "sha256": row["sha256"]} for row in rows]


@app.post("/api/chat/query")
def chat_query(payload: ChatPayload, user=Depends(current_user)):
    api_key = os.getenv("GEMINI_API_KEY")
    with connect_db() as conn:
        tx_count, total_vol = conn.execute("SELECT COUNT(*), SUM(amount) FROM transactions").fetchone()
    context_summary = f"Total Transactions: {tx_count}, Total Volume: ₹{total_vol or 0}."
    if api_key:
        try:
            client = genai.Client(api_key=api_key)
            prompt = f"You are a financial reconciliation assistant. Ledger summary: {context_summary}. Answer clearly in INR. User question: {payload.query}"
            response = client.models.generate_content(model="gemini-2.5-flash", contents=prompt)
            return {"answer": response.text or "I could not generate an answer. Please try again."}
        except Exception:
            pass
    return {"answer": f"Offline mode: I received your question. Ledger summary: {context_summary}"}


@app.get("/api/export/dossier")
def export_dossier(user=Depends(current_user)):
    with connect_db() as conn:
        logs = conn.execute("SELECT timestamp, actor, action, sha256 FROM audit_logs ORDER BY id").fetchall()
    content = "RECONAGENT AUDIT DOSSIER\n"
    content += f"Generated At: {datetime.now(timezone.utc).isoformat()}\n"
    content += "========================================================\n\n"
    for row in logs:
        content += f"[{row['timestamp']}] ACTOR: {row['actor']} | ACTION: {row['action']} | SHA256: {row['sha256']}\n"
    return Response(content=content, media_type="text/plain", headers={"Content-Disposition": "attachment; filename=ReconAgent_Audit_Dossier.txt"})
