import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  AlertTriangle,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  Lock,
  UserCheck,
  RefreshCw,
  Layers,
  Terminal,
  HelpCircle,
  ChevronRight,
  LogOut,
  ArrowRight,
  FileCheck,
  Eye,
  Trash2,
  Cpu,
  UploadCloud,
  MessageSquare,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [authRole, setAuthRole] = useState("admin");
  const [authTab, setAuthTab] = useState("signin");

  // Auth Form State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgName, setOrgName] = useState("Acme FinTech");
  const [erpTarget, setErpTarget] = useState("Tally Prime");
  const [firmName, setFirmName] = useState("Deloitte & Touche");
  const [passcode, setPasscode] = useState("");
  const [authMsg, setAuthMsg] = useState(null);

  // Dashboard Data State
  const [transactions, setTransactions] = useState([]);
  const [auditors, setAuditors] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [metrics, setMetrics] = useState({
    total_vol: 0,
    match_rate: 0,
    total_variance: 0,
    pending_auditors: 0,
  });
  const [selectedTxIds, setSelectedTxIds] = useState([]);

  // Filter & Search
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");

  // UI Tabs & Modals
  const [activeTab, setActiveTab] = useState("exceptions"); // exceptions | ocr | auditors | audit_logs
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [helpTab, setHelpTab] = useState("quickstart");
  const [inspectTx, setInspectTx] = useState(null);
  const [aiGenerating, setAiGenerating] = useState(false);

  // New Feature States: OCR & CFO Chat
  const [ocrFile, setOcrFile] = useState(null);
  const [ocrSource, setOcrSource] = useState("Bank");
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState(null);

  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState([
    {
      sender: "ai",
      text: "Hello! I am your CFO AI Agent. Ask me anything about your reconciliations, variances, or ledger status.",
    },
  ]);
  const [chatLoading, setChatLoading] = useState(false);

  useEffect(() => {
    if (currentUser && currentUser.status === "APPROVED") {
      fetchDashboardData();
    }
  }, [currentUser]);

  const fetchDashboardData = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/transactions`);
      if (res.ok) setTransactions(await res.json());
      const audRes = await fetch(`${API_BASE}/api/auditors`);
      if (audRes.ok) setAuditors(await audRes.json());
      const logRes = await fetch(`${API_BASE}/api/audit-logs`);
      if (logRes.ok) setAuditLogs(await logRes.json());
      const metRes = await fetch(`${API_BASE}/api/metrics`);
      if (metRes.ok) setMetrics(await metRes.json());
    } catch (err) {
      console.error("Backend Connection Error:", err);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthMsg(null);
    const endpoint =
      authTab === "signin" ? "/api/auth/login" : "/api/auth/register";
    const payload = {
      email,
      password,
      role: authRole,
      org_name: authRole === "admin" ? orgName : firmName,
      erp_target: erpTarget,
      passcode,
    };

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Authentication failed");

      if (data.status === "PENDING_APPROVAL") {
        setAuthMsg({
          type: "warning",
          text: "Account registered! Pending Finance Admin approval before login.",
        });
      } else {
        setCurrentUser(data);
        fetchDashboardData();
      }
    } catch (err) {
      setAuthMsg({ type: "error", text: err.message });
    }
  };

  const handleOcrUpload = async (e) => {
    e.preventDefault();
    if (!ocrFile) return;
    setOcrLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/ocr/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: ocrFile.name,
          base64_data: "mock_base64",
          source_type: ocrSource,
        }),
      });
      const data = await res.json();
      setOcrResult(data);
      fetchDashboardData();
    } catch (err) {
      console.error(err);
    } finally {
      setOcrLoading(false);
    }
  };

  const handleSendChat = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const userMsg = chatInput;
    setChatMessages((prev) => [...prev, { sender: "user", text: userMsg }]);
    setChatInput("");
    setChatLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/chat/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: userMsg }),
      });
      const data = await res.json();
      setChatMessages((prev) => [...prev, { sender: "ai", text: data.answer }]);
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        { sender: "ai", text: "Error connecting to CFO AI agent." },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleBulkAction = async (action) => {
    try {
      await fetch(`${API_BASE}/api/transactions/bulk-action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tx_ids: selectedTxIds,
          action,
          actor: currentUser.email,
        }),
      });
      setSelectedTxIds([]);
      fetchDashboardData();
    } catch (err) {
      console.error(err);
    }
  };

  const triggerAiTriage = async (tx) => {
    setAiGenerating(true);
    try {
      const res = await fetch(`${API_BASE}/api/ai/triage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tx_id: tx.id }),
      });
      const data = await res.json();
      setInspectTx({ ...tx, aje: data.aje });
    } catch (err) {
      console.error(err);
    } finally {
      setAiGenerating(false);
    }
  };

  const handleAuditorStatus = async (email, status) => {
    await fetch(`${API_BASE}/api/auditors/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, status, actor: currentUser.email }),
    });
    fetchDashboardData();
  };

  const downloadDossier = () => {
    window.open(`${API_BASE}/api/export/dossier`, "_blank");
  };

  const filteredTxs = transactions.filter((t) => {
    const matchesSearch =
      t.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.reference.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory =
      categoryFilter === "ALL" || t.status === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#0D1B2A] text-white flex items-center justify-center p-4">
        <div className="w-full max-w-4xl grid md:grid-cols-2 bg-[#112233] rounded-2xl border border-navy-700 overflow-hidden shadow-2xl">
          <div className="p-8 bg-gradient-to-br from-[#0D1B2A] to-[#112233] flex flex-col justify-between border-r border-navy-700">
            <div>
              <div className="flex items-center gap-2 mb-6">
                <ShieldCheck className="w-8 h-8 text-[#2ECC71]" />
                <span className="text-2xl font-bold tracking-wider">
                  ReconAgent
                </span>
              </div>
              <h1 className="text-3xl font-extrabold mb-3">
                Enterprise Financial Reconciliation
              </h1>
              <p className="text-gray-400 text-sm leading-relaxed">
                Autonomous cross-system transaction verification, AI Adjusting
                Journal Entries (AJE), and SHA-256 cryptographic audit
                protection.
              </p>
            </div>
            <div className="mt-8 space-y-3">
              <div className="flex items-center gap-3 text-xs text-gray-300">
                <CheckCircle2 className="w-4 h-4 text-[#2ECC71]" /> Multi-Modal
                OCR Ingestion
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-300">
                <CheckCircle2 className="w-4 h-4 text-[#2ECC71]" /> Natural
                Language CFO Chat Agent
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-300">
                <CheckCircle2 className="w-4 h-4 text-[#2ECC71]" /> ₹-INR Native
                Currency Engine
              </div>
            </div>
          </div>

          <div className="p-8 flex flex-col justify-center">
            <div className="flex bg-[#0D1B2A] p-1 rounded-lg border border-navy-700 mb-6">
              <button
                onClick={() => setAuthRole("admin")}
                className={`flex-1 py-2 text-xs font-semibold rounded-md transition-all ${authRole === "admin" ? "bg-[#2ECC71] text-[#0D1B2A]" : "text-gray-400"}`}
              >
                Ops Admin
              </button>
              <button
                onClick={() => setAuthRole("auditor")}
                className={`flex-1 py-2 text-xs font-semibold rounded-md transition-all ${authRole === "auditor" ? "bg-[#2ECC71] text-[#0D1B2A]" : "text-gray-400"}`}
              >
                Compliance Auditor
              </button>
            </div>

            <div className="flex gap-4 border-b border-navy-700 mb-6 pb-2">
              <button
                onClick={() => setAuthTab("signin")}
                className={`text-sm font-semibold pb-1 ${authTab === "signin" ? "text-[#2ECC71] border-b-2 border-[#2ECC71]" : "text-gray-400"}`}
              >
                Sign In
              </button>
              <button
                onClick={() => setAuthTab("signup")}
                className={`text-sm font-semibold pb-1 ${authTab === "signup" ? "text-[#2ECC71] border-b-2 border-[#2ECC71]" : "text-gray-400"}`}
              >
                Register
              </button>
            </div>

            {authMsg && (
              <div
                className={`p-3 rounded-md mb-4 text-xs ${authMsg.type === "error" ? "bg-red-900/40 text-red-300 border border-red-700" : "bg-amber-900/40 text-amber-300 border border-amber-700"}`}
              >
                {authMsg.text}
              </div>
            )}

            <form onSubmit={handleAuth} className="space-y-4">
              <div>
                <label className="text-xs text-gray-300 block mb-1">
                  Work Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#0D1B2A] border border-navy-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#2ECC71]"
                  placeholder="name@company.com"
                />
              </div>
              <div>
                <label className="text-xs text-gray-300 block mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#0D1B2A] border border-navy-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#2ECC71]"
                  placeholder="••••••••"
                />
              </div>
              {authRole === "admin" ? (
                <>
                  <div>
                    <label className="text-xs text-gray-300 block mb-1">
                      Organization Name
                    </label>
                    <input
                      type="text"
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      className="w-full bg-[#0D1B2A] border border-navy-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#2ECC71]"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-300 block mb-1">
                      ERP Accounting Tool
                    </label>
                    <select
                      value={erpTarget}
                      onChange={(e) => setErpTarget(e.target.value)}
                      className="w-full bg-[#0D1B2A] border border-navy-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#2ECC71]"
                    >
                      <option value="Tally Prime">Tally Prime</option>
                      <option value="QuickBooks">QuickBooks Online</option>
                      <option value="Zoho Books">Zoho Books</option>
                      <option value="SAP">SAP S/4HANA</option>
                    </select>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="text-xs text-gray-300 block mb-1">
                      Audit Firm Name
                    </label>
                    <input
                      type="text"
                      value={firmName}
                      onChange={(e) => setFirmName(e.target.value)}
                      className="w-full bg-[#0D1B2A] border border-navy-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#2ECC71]"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-300 block mb-1">
                      Cryptographic Passcode
                    </label>
                    <input
                      type="password"
                      value={passcode}
                      onChange={(e) => setPasscode(e.target.value)}
                      className="w-full bg-[#0D1B2A] border border-navy-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#2ECC71]"
                      placeholder="AUDIT-KEY-2026"
                    />
                  </div>
                </>
              )}
              <button
                type="submit"
                className="w-full bg-[#2ECC71] hover:bg-mint-600 text-[#0D1B2A] font-bold py-2.5 rounded-lg text-sm transition-all shadow-lg flex items-center justify-center gap-2"
              >
                {authTab === "signin"
                  ? "Enter Workspace"
                  : "Submit Registration"}{" "}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0D1B2A] text-white flex flex-col relative">
      <header className="bg-[#112233] border-b border-navy-700 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-7 h-7 text-[#2ECC71]" />
          <span className="font-bold text-lg tracking-wide">ReconAgent</span>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold tracking-wider ${currentUser.role === "admin" ? "bg-[#2ECC71]/20 text-[#2ECC71] border border-[#2ECC71]/40" : "bg-blue-500/20 text-blue-400 border border-blue-500/40"}`}
          >
            {currentUser.role === "admin" ? "Ops Admin" : "Compliance Auditor"}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setChatOpen(!chatOpen)}
            className="flex items-center gap-1.5 text-xs text-[#0D1B2A] bg-[#2ECC71] font-bold px-3 py-1.5 rounded-lg hover:bg-mint-600 transition-all"
          >
            <MessageSquare className="w-4 h-4" /> Ask CFO AI
          </button>
          <button
            onClick={() => setShowHelpModal(true)}
            className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white bg-[#0D1B2A] px-3 py-1.5 rounded-lg border border-navy-700"
          >
            <HelpCircle className="w-4 h-4 text-[#2ECC71]" /> Help
          </button>
          <button
            onClick={downloadDossier}
            className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white bg-[#0D1B2A] px-3 py-1.5 rounded-lg border border-navy-700"
          >
            <FileCheck className="w-4 h-4 text-[#2ECC71]" /> Audit Dossier
          </button>
          <button
            onClick={() => setCurrentUser(null)}
            className="text-gray-400 hover:text-red-400 p-1"
            title="Log Out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* KPI Metrics Bar */}
      <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-4 gap-4 bg-[#0D1B2A]">
        <div className="bg-[#112233] p-4 rounded-xl border border-navy-700">
          <span className="text-gray-400 text-xs block mb-1">
            Total Volume Processed
          </span>
          <span className="text-2xl font-bold text-white">
            ₹{metrics.total_vol?.toLocaleString("en-IN")}
          </span>
        </div>
        <div className="bg-[#112233] p-4 rounded-xl border border-navy-700">
          <span className="text-gray-400 text-xs block mb-1">
            Exact Match Rate
          </span>
          <span className="text-2xl font-bold text-[#2ECC71]">
            {metrics.match_rate}%
          </span>
        </div>
        <div className="bg-[#112233] p-4 rounded-xl border border-navy-700">
          <span className="text-gray-400 text-xs block mb-1">
            Total Discrepancy Variance
          </span>
          <span className="text-2xl font-bold text-amber-400">
            ₹{metrics.total_variance?.toLocaleString("en-IN")}
          </span>
        </div>
        <div className="bg-[#112233] p-4 rounded-xl border border-navy-700">
          <span className="text-gray-400 text-xs block mb-1">
            Pending Auditor Requests
          </span>
          <span className="text-2xl font-bold text-blue-400">
            {metrics.pending_auditors}
          </span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="px-6 border-b border-navy-700 flex gap-6 text-sm">
        <button
          onClick={() => setActiveTab("exceptions")}
          className={`pb-3 font-semibold ${activeTab === "exceptions" ? "text-[#2ECC71] border-b-2 border-[#2ECC71]" : "text-gray-400"}`}
        >
          Reconciliation Exceptions ({filteredTxs.length})
        </button>
        <button
          onClick={() => setActiveTab("ocr")}
          className={`pb-3 font-semibold ${activeTab === "ocr" ? "text-[#2ECC71] border-b-2 border-[#2ECC71]" : "text-gray-400"}`}
        >
          Multi-Modal OCR Ingestion
        </button>
        {currentUser.role === "admin" && (
          <button
            onClick={() => setActiveTab("auditors")}
            className={`pb-3 font-semibold relative ${activeTab === "auditors" ? "text-[#2ECC71] border-b-2 border-[#2ECC71]" : "text-gray-400"}`}
          >
            Auditor Management{" "}
            {metrics.pending_auditors > 0 && (
              <span className="ml-2 bg-blue-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                {metrics.pending_auditors}
              </span>
            )}
          </button>
        )}
        <button
          onClick={() => setActiveTab("audit_logs")}
          className={`pb-3 font-semibold ${activeTab === "audit_logs" ? "text-[#2ECC71] border-b-2 border-[#2ECC71]" : "text-gray-400"}`}
        >
          SHA-256 Audit Trail
        </button>
      </div>

      {/* Main Content */}
      <div className="p-6 flex-1 overflow-auto">
        {activeTab === "exceptions" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-[#112233] p-3 rounded-xl border border-navy-700">
              <div className="flex items-center gap-3 flex-1 min-w-[280px]">
                <Search className="w-4 h-4 text-gray-400 ml-2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by Transaction ID or Gateway Reference..."
                  className="bg-transparent text-sm w-full focus:outline-none text-white placeholder-gray-500"
                />
              </div>
              <div className="flex items-center gap-3">
                <Filter className="w-4 h-4 text-gray-400" />
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="bg-[#0D1B2A] border border-navy-700 text-xs rounded-lg px-3 py-1.5 text-white focus:outline-none"
                >
                  <option value="ALL">All Status Categories</option>
                  <option value="Exact Match">Exact Match</option>
                  <option value="Amount Mismatch">Amount Mismatch</option>
                  <option value="Missing in Ledger">Missing in Ledger</option>
                  <option value="Duplicate Suspected">
                    Duplicate Suspected
                  </option>
                </select>
              </div>
            </div>

            {selectedTxIds.length > 0 && currentUser.role === "admin" && (
              <div className="bg-[#2ECC71]/10 border border-[#2ECC71]/40 p-3 rounded-xl flex items-center justify-between text-xs">
                <span className="text-[#2ECC71] font-semibold">
                  {selectedTxIds.length} Transactions Selected
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleBulkAction("ACCEPT")}
                    className="bg-[#2ECC71] text-[#0D1B2A] font-bold px-3 py-1.5 rounded-md hover:bg-mint-600 transition-all"
                  >
                    Bulk Accept
                  </button>
                  <button
                    onClick={() => handleBulkAction("FLAG")}
                    className="bg-red-500/20 text-red-400 border border-red-500/40 font-bold px-3 py-1.5 rounded-md hover:bg-red-500/30 transition-all"
                  >
                    Bulk Flag / Reject
                  </button>
                </div>
              </div>
            )}

            <div className="bg-[#112233] rounded-xl border border-navy-700 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#0D1B2A] border-b border-navy-700 text-xs text-gray-400">
                    <th className="p-3 w-10">
                      {currentUser.role === "admin" && (
                        <input
                          type="checkbox"
                          onChange={(e) => {
                            if (e.target.checked)
                              setSelectedTxIds(filteredTxs.map((t) => t.id));
                            else setSelectedTxIds([]);
                          }}
                          checked={
                            selectedTxIds.length === filteredTxs.length &&
                            filteredTxs.length > 0
                          }
                        />
                      )}
                    </th>
                    <th className="p-3">TX ID & Source</th>
                    <th className="p-3">Reference Code</th>
                    <th className="p-3">Amount (₹)</th>
                    <th className="p-3">Status Category</th>
                    <th className="p-3">Maker-Checker</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-700 text-xs">
                  {filteredTxs.map((tx) => (
                    <tr
                      key={tx.id}
                      className="hover:bg-navy-800/50 transition-all"
                    >
                      <td className="p-3">
                        {currentUser.role === "admin" && (
                          <input
                            type="checkbox"
                            checked={selectedTxIds.includes(tx.id)}
                            onChange={(e) => {
                              if (e.target.checked)
                                setSelectedTxIds([...selectedTxIds, tx.id]);
                              else
                                setSelectedTxIds(
                                  selectedTxIds.filter((id) => id !== tx.id),
                                );
                            }}
                          />
                        )}
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-white">{tx.id}</div>
                        <div className="text-[10px] text-gray-400">
                          {tx.source} • {tx.date}
                        </div>
                      </td>
                      <td className="p-3 text-gray-300 font-mono text-[11px]">
                        {tx.reference}
                      </td>
                      <td className="p-3 font-semibold text-white">
                        ₹{tx.amount.toLocaleString("en-IN")}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${tx.status === "Exact Match" ? "bg-[#2ECC71]/20 text-[#2ECC71]" : tx.status === "Amount Mismatch" ? "bg-amber-500/20 text-amber-400" : "bg-red-500/20 text-red-400"}`}
                        >
                          {tx.status}
                        </span>
                      </td>
                      <td className="p-3">
                        {tx.amount >= 50000 ? (
                          <span className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30 w-fit">
                            <Lock className="w-3 h-3" /> Manager Approval Req.
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-400">
                            Standard Match
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => {
                            setInspectTx(tx);
                            if (!tx.aje) triggerAiTriage(tx);
                          }}
                          className="bg-[#0D1B2A] border border-navy-700 hover:border-[#2ECC71] text-xs px-2.5 py-1 rounded text-gray-300 hover:text-white transition-all inline-flex items-center gap-1"
                        >
                          <Cpu className="w-3.5 h-3.5 text-[#2ECC71]" /> Inspect
                          / AI AJE
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Multi-Modal OCR Ingestion Tab */}
        {activeTab === "ocr" && (
          <div className="bg-[#112233] rounded-xl border border-navy-700 p-6 max-w-2xl mx-auto space-y-6">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                <UploadCloud className="text-[#2ECC71]" /> Multi-Modal OCR
                Document Ingestion
              </h2>
              <p className="text-gray-400 text-xs mt-1">
                Upload scanned bank statements, invoices, or gateway settlement
                PDFs. Gemini Vision will auto-extract tables and ingest into
                DuckDB.
              </p>
            </div>

            <form onSubmit={handleOcrUpload} className="space-y-4">
              <div>
                <label className="text-xs text-gray-300 block mb-1">
                  Source System
                </label>
                <select
                  value={ocrSource}
                  onChange={(e) => setOcrSource(e.target.value)}
                  className="w-full bg-[#0D1B2A] border border-navy-700 rounded-lg px-3 py-2 text-xs text-white"
                >
                  <option value="Bank">Bank Statement (PDF/Image)</option>
                  <option value="Payment Gateway">
                    Payment Gateway Settlement (Stripe/Razorpay)
                  </option>
                  <option value="Ledger">General Ledger Invoice</option>
                </select>
              </div>

              <div className="border-2 border-dashed border-navy-700 rounded-xl p-8 text-center bg-[#0D1B2A]">
                <input
                  type="file"
                  onChange={(e) => setOcrFile(e.target.files[0])}
                  className="text-xs text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#2ECC71] file:text-[#0D1B2A] hover:file:bg-mint-600 cursor-pointer"
                />
                <p className="text-xs text-gray-500 mt-2">
                  {ocrFile
                    ? `Selected: ${ocrFile.name}`
                    : "Drop PDF or image file here"}
                </p>
              </div>

              <button
                type="submit"
                disabled={ocrLoading}
                className="w-full bg-[#2ECC71] text-[#0D1B2A] font-bold py-2.5 rounded-lg text-xs hover:bg-mint-600 transition-all flex items-center justify-center gap-2"
              >
                {ocrLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <UploadCloud className="w-4 h-4" />
                )}
                Process Document via Gemini Vision OCR
              </button>
            </form>

            {ocrResult && (
              <div className="bg-[#0D1B2A] p-4 rounded-xl border border-[#2ECC71]/40 space-y-2 text-xs">
                <span className="text-[#2ECC71] font-bold block">
                  ✓ Document successfully parsed & matched!
                </span>
                <div>
                  <strong>Generated ID:</strong> {ocrResult.tx_id}
                </div>
                <div>
                  <strong>Extracted Reference:</strong> {ocrResult.reference}
                </div>
                <div>
                  <strong>Detected Amount:</strong> ₹
                  {ocrResult.amount?.toLocaleString("en-IN")}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Auditor Management */}
        {activeTab === "auditors" && currentUser.role === "admin" && (
          <div className="bg-[#112233] rounded-xl border border-navy-700 p-6 space-y-4">
            <h2 className="text-lg font-bold">
              Compliance Auditor Authorizations
            </h2>
            <table className="w-full text-left border-collapse text-xs mt-4">
              <thead>
                <tr className="bg-[#0D1B2A] border-b border-navy-700 text-gray-400">
                  <th className="p-3">Auditor Email</th>
                  <th className="p-3">Firm Name</th>
                  <th className="p-3">Passcode</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-700">
                {auditors.map((a) => (
                  <tr key={a.email}>
                    <td className="p-3 font-semibold">{a.email}</td>
                    <td className="p-3 text-gray-300">{a.firm_name}</td>
                    <td className="p-3 font-mono text-gray-400">
                      {a.passcode}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${a.status === "APPROVED" ? "bg-[#2ECC71]/20 text-[#2ECC71]" : "bg-amber-500/20 text-amber-400"}`}
                      >
                        {a.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      {a.status === "PENDING_APPROVAL" ? (
                        <button
                          onClick={() =>
                            handleAuditorStatus(a.email, "APPROVED")
                          }
                          className="bg-[#2ECC71] text-[#0D1B2A] font-bold px-3 py-1 rounded text-xs"
                        >
                          Approve
                        </button>
                      ) : (
                        <button
                          onClick={() =>
                            handleAuditorStatus(a.email, "REVOKED")
                          }
                          className="bg-red-500/20 text-red-400 px-3 py-1 rounded text-xs"
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Audit Log */}
        {activeTab === "audit_logs" && (
          <div className="bg-[#112233] rounded-xl border border-navy-700 p-6 space-y-4">
            <h2 className="text-lg font-bold">
              SHA-256 Tamper-Proof Audit Ledger
            </h2>
            <div className="space-y-2 mt-4 font-mono text-xs">
              {auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="bg-[#0D1B2A] p-3 rounded-lg border border-navy-700 flex justify-between gap-2"
                >
                  <div>
                    <span className="text-gray-500">[{log.timestamp}]</span>{" "}
                    <span className="text-[#2ECC71] font-bold">
                      {log.actor}
                    </span>
                    : {log.action}
                  </div>
                  <div className="text-[10px] text-gray-400">
                    HASH: {log.sha256}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Floating CFO AI Chat Drawer */}
      {chatOpen && (
        <div className="absolute right-6 bottom-6 w-96 bg-[#112233] border border-navy-700 rounded-2xl shadow-2xl flex flex-col h-[450px] z-50">
          <div className="p-3 bg-[#0D1B2A] border-b border-navy-700 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-[#2ECC71]">
              <MessageSquare className="w-4 h-4" /> Ask CFO AI Agent
            </div>
            <button
              onClick={() => setChatOpen(false)}
              className="text-gray-400 hover:text-white text-xs"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 p-3 overflow-auto space-y-3 text-xs">
            {chatMessages.map((msg, idx) => (
              <div
                key={idx}
                className={`p-2.5 rounded-xl max-w-[85%] ${msg.sender === "user" ? "bg-[#2ECC71] text-[#0D1B2A] ml-auto font-medium" : "bg-[#0D1B2A] text-gray-200 border border-navy-700"}`}
              >
                {msg.text}
              </div>
            ))}
            {chatLoading && (
              <div className="text-gray-400 text-xs italic">
                CFO AI is analyzing ledger records...
              </div>
            )}
          </div>
          <form
            onSubmit={handleSendChat}
            className="p-3 border-t border-navy-700 flex gap-2"
          >
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Ask about variances, fees..."
              className="flex-1 bg-[#0D1B2A] border border-navy-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
            />
            <button
              type="submit"
              className="bg-[#2ECC71] text-[#0D1B2A] p-2 rounded-lg font-bold"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* Inspection Modal */}
      {inspectTx && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-[#112233] border border-navy-700 rounded-2xl p-6 w-full max-w-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-navy-700 pb-3">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Cpu className="text-[#2ECC71]" /> Recon-Guard AI Triage & AJE
              </h3>
              <button
                onClick={() => setInspectTx(null)}
                className="text-gray-400"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4 text-xs bg-[#0D1B2A] p-3 rounded-lg border border-navy-700">
              <div>
                <span className="text-gray-400">TX ID:</span> {inspectTx.id}
              </div>
              <div>
                <span className="text-gray-400">Amount:</span> ₹
                {inspectTx.amount?.toLocaleString("en-IN")}
              </div>
              <div>
                <span className="text-gray-400">Reference:</span>{" "}
                {inspectTx.reference}
              </div>
              <div>
                <span className="text-gray-400">Status:</span>{" "}
                {inspectTx.status}
              </div>
            </div>
            <div className="bg-[#0D1B2A] p-4 rounded-xl border border-navy-700 space-y-2 text-xs">
              <span className="font-bold text-[#2ECC71]">
                GAAP / IFRS Auto-Drafted Journal Entry
              </span>
              {aiGenerating ? (
                <div className="text-gray-400 py-4">
                  Calculating via Gemini...
                </div>
              ) : (
                inspectTx.aje && (
                  <div className="space-y-1 font-mono">
                    <div>
                      DEBIT: {inspectTx.aje.debit_account} - ₹
                      {inspectTx.aje.debit_amount?.toLocaleString("en-IN")}
                    </div>
                    <div>
                      CREDIT: {inspectTx.aje.credit_account} - ₹
                      {inspectTx.aje.credit_amount?.toLocaleString("en-IN")}
                    </div>
                    <div className="text-amber-300 font-sans mt-2">
                      <strong>Leakage Risk Score:</strong>{" "}
                      {inspectTx.aje.fraud_score}/100 —{" "}
                      {inspectTx.aje.explanation}
                    </div>
                  </div>
                )
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setInspectTx(null)}
                className="px-4 py-2 bg-[#0D1B2A] border border-navy-700 text-xs rounded-lg"
              >
                Close
              </button>
              {currentUser.role === "admin" && (
                <button
                  onClick={() => {
                    handleBulkAction("ACCEPT");
                    setInspectTx(null);
                  }}
                  className="px-4 py-2 bg-[#2ECC71] text-[#0D1B2A] font-bold text-xs rounded-lg"
                >
                  Accept & Post to {currentUser.erp_target}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-[#112233] border border-navy-700 rounded-2xl p-6 w-full max-w-2xl shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-navy-700 pb-3">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-[#2ECC71]" />
                <h3 className="font-bold text-lg text-white">
                  ReconAgent Help & Learning Center
                </h3>
              </div>
              <button
                onClick={() => setShowHelpModal(false)}
                className="text-gray-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex gap-4 border-b border-navy-700 text-xs pb-1">
              <button
                onClick={() => setHelpTab("quickstart")}
                className={`pb-2 font-semibold transition-all ${helpTab === "quickstart" ? "text-[#2ECC71] border-b-2 border-[#2ECC71]" : "text-gray-400 hover:text-white"}`}
              >
                Quickstart & Architecture
              </button>
              <button
                onClick={() => setHelpTab("pipeline")}
                className={`pb-2 font-semibold transition-all ${helpTab === "pipeline" ? "text-[#2ECC71] border-b-2 border-[#2ECC71]" : "text-gray-400 hover:text-white"}`}
              >
                5-Stage Pipeline
              </button>
              <button
                onClick={() => setHelpTab("cfo_ai")}
                className={`pb-2 font-semibold transition-all ${helpTab === "cfo_ai" ? "text-[#2ECC71] border-b-2 border-[#2ECC71]" : "text-gray-400 hover:text-white"}`}
              >
                CFO AI Chat Guide
              </button>
            </div>

            <div className="text-xs text-gray-300 space-y-3 leading-relaxed max-h-80 overflow-auto pr-2">
              {helpTab === "quickstart" && (
                <>
                  <p>
                    <strong>ReconAgent</strong> is an autonomous cross-system
                    financial transaction reconciliation system built to
                    eliminate manual spreadsheet comparisons between Bank
                    Statements, General Ledgers, and Payment Gateways.
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-gray-400">
                    <li>
                      <strong>Ops Admin:</strong> Complete operational power,
                      bulk approvals, and single-click ERP posting (Tally,
                      QuickBooks, SAP).
                    </li>
                    <li>
                      <strong>Compliance Auditor:</strong> Read-only access
                      guarded by cryptographic SHA-256 ledger seals and Admin
                      approvals.
                    </li>
                  </ul>
                </>
              )}
              {helpTab === "pipeline" && (
                <ol className="list-decimal pl-5 space-y-2 text-gray-400">
                  <li>
                    <strong>Data Ingestion:</strong> Automatic parsing and
                    anti-XSS sanitization of bank & gateway files.
                  </li>
                  <li>
                    <strong>Exact Matching:</strong> Polars deterministic rule
                    comparison for identical transaction pairs.
                  </li>
                  <li>
                    <strong>Probabilistic Matching:</strong> Splink fuzzy-logic
                    algorithm matching fuzzy reference strings and minor timing
                    gaps.
                  </li>
                  <li>
                    <strong>AI Triage & AJE Generation:</strong> Gemini API
                    calculates exact balanced debit/credit journal entries for
                    fee gaps.
                  </li>
                  <li>
                    <strong>Financial Seal & Audit Dossier:</strong> SHA-256
                    cryptographic export for regulatory auditors.
                  </li>
                </ol>
              )}
              {helpTab === "cfo_ai" && (
                <div className="space-y-2">
                  <p className="text-gray-300">
                    Use the <strong>Ask CFO AI Agent</strong> widget during your
                    demo to ask questions powered by Google Gemini 2.5 Flash:
                  </p>
                  <div className="bg-[#0D1B2A] p-3 rounded-lg border border-navy-700 space-y-2 font-mono text-[11px] text-[#2ECC71]">
                    <p>
                      • "What is our total discrepancy variance across all
                      accounts right now?"
                    </p>
                    <p>
                      • "Can you explain why transaction TXN-9002 has a
                      discrepancy?"
                    </p>
                    <p>
                      • "What percentage of our transactions are currently
                      reconciling as exact matches?"
                    </p>
                    <p>
                      • "Can you write me a python script to delete all
                      records?" (Tests security guardrails)
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-navy-700">
              <button
                onClick={() => setShowHelpModal(false)}
                className="px-4 py-2 bg-[#2ECC71] text-[#0D1B2A] font-bold text-xs rounded-lg hover:bg-mint-600 transition-all"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
