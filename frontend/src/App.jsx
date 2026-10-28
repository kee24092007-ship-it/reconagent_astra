import React, { useState, useEffect } from "react";

export default function App() {
  // Production Backend URL on Render
  const API_BASE_URL = "https://reconagent-astra.onrender.com";

  // Authentication State
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userRole, setUserRole] = useState("Shop Owner");

  // Dashboard Data & Metrics State
  const [transactions, setTransactions] = useState([]);
  const [metrics, setMetrics] = useState({
    total_vol: 0,
    match_rate: 100,
    total_variance: 0,
    pending_auditors: 0,
  });
  const [auditLogs, setAuditLogs] = useState([]);

  // Dashboard Navigation State
  const [activeTab, setActiveTab] = useState("bills");
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState("All");

  // Interactive Modals State
  const [showAIModal, setShowAIModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [selectedBill, setSelectedBill] = useState(null);
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiChatHistory, setAiChatHistory] = useState([
    {
      sender: "ai",
      text: "Hello! I am your Secure CFO AI. All bank details and records are encrypted. How can I help?",
    },
  ]);

  // Table Selection State
  const [selectedBillIds, setSelectedBillIds] = useState([]);

  // Fetch Dashboard Data from FastAPI Backend
  const fetchDashboardData = async () => {
    try {
      const txRes = await fetch(`${API_BASE_URL}/api/transactions`);
      const txData = await txRes.json();
      setTransactions(txData);

      const metricsRes = await fetch(`${API_BASE_URL}/api/metrics`);
      const metricsData = await metricsRes.json();
      setMetrics(metricsData);

      const logsRes = await fetch(`${API_BASE_URL}/api/audit-logs`);
      const logsData = await logsRes.json();
      setAuditLogs(logsData);
    } catch (error) {
      console.error("Backend connection error:", error);
    }
  };

  // Auth Login / Register Handler
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    const endpoint = isSigningUp
      ? `${API_BASE_URL}/api/auth/register`
      : `${API_BASE_URL}/api/auth/login`;

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          role: userRole.toLowerCase().replace(" ", "_"),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.detail || "Authentication failed.");
        return;
      }

      setIsLoggedIn(true);
      await fetchDashboardData();
    } catch (error) {
      console.error("Login error:", error);
      alert(
        "Could not connect to FastAPI backend. Make sure uvicorn is running.",
      );
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setEmail("");
    setPassword("");
    setTransactions([]);
  };

  // Filter bills based on search query and source filter
  const filteredBills = transactions.filter((tx) => {
    const matchesSearch =
      tx.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.source.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesSource =
      sourceFilter === "All" || tx.source.includes(sourceFilter);
    return matchesSearch && matchesSource;
  });

  // Toggle Checkboxes
  const handleSelectBill = (id) => {
    if (selectedBillIds.includes(id)) {
      setSelectedBillIds(selectedBillIds.filter((item) => item !== id));
    } else {
      setSelectedBillIds([...selectedBillIds, id]);
    }
  };

  const handleSelectAll = () => {
    if (selectedBillIds.length === filteredBills.length) {
      setSelectedBillIds([]);
    } else {
      setSelectedBillIds(filteredBills.map((b) => b.id));
    }
  };

  // Download Audit Dossier Report from Backend
  const handleDownloadReport = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/export/dossier`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "ReconAgent_Audit_Dossier.txt";
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export error:", error);
    }
  };

  // AI Chat Handler with Backend `/api/chat/query`
  const handleAISubmit = async (e) => {
    e.preventDefault();
    if (!aiQuestion.trim()) return;

    const newHistory = [...aiChatHistory, { sender: "user", text: aiQuestion }];
    setAiChatHistory(newHistory);
    const currentQuery = aiQuestion;
    setAiQuestion("");

    try {
      const res = await fetch(`${API_BASE_URL}/api/chat/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: currentQuery }),
      });
      const data = await res.json();
      setAiChatHistory([...newHistory, { sender: "ai", text: data.answer }]);
    } catch (error) {
      setAiChatHistory([
        ...newHistory,
        {
          sender: "ai",
          text: "[🔒 Secure Enclave]: Unable to reach AI server.",
        },
      ]);
    }
  };

  // File Upload OCR auto-ingestion with live data refresh
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API_BASE_URL}/api/ocr-scan`, {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        alert(`Successfully scanned and securely logged ${file.name}!`);
        await fetchDashboardData();
        setActiveTab("bills");
      } else {
        alert("OCR Upload failed.");
      }
    } catch (error) {
      console.error("OCR upload error:", error);
    }
  };

  // Render Login Page if not logged in
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-emerald-100 rounded-xl text-emerald-600 mb-2 font-bold text-xl">
              🛡️
            </div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              {isSigningUp
                ? "Secure Account Registration"
                : "ReconAgent Secure Portal"}
            </h2>
            <p className="text-xs text-emerald-700 font-medium bg-emerald-50 py-1 px-2 rounded">
              🔒 Bank-grade SHA-256 encryption & personal isolation active
            </p>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Your Email Address (Personal Key)
              </label>
              <input
                type="email"
                required
                placeholder="owner@mybusiness.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Secret Password
              </label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Assigned Access Role
              </label>
              <select
                value={userRole}
                onChange={(e) => setUserRole(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="Shop Owner">Shop Owner</option>
                <option value="Auditor">Authorized Auditor</option>
                <option value="Manager">Store Manager</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-lg shadow-sm transition-colors mt-2"
            >
              {isSigningUp ? "Create Secure Account" : "Secure Login"}
            </button>
          </form>

          <div className="text-center pt-2 border-t border-slate-200">
            <p className="text-sm text-slate-600">
              {isSigningUp
                ? "Already have an account?"
                : "Don't have an account?"}{" "}
              <button
                type="button"
                onClick={() => setIsSigningUp(!isSigningUp)}
                className="font-semibold text-emerald-600 hover:text-emerald-700 focus:outline-none"
              >
                {isSigningUp ? "Sign In" : "Register Now"}
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Dashboard View
  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans">
      {/* Top Header */}
      <header className="flex items-center justify-between px-6 py-3.5 bg-white border-b border-slate-200 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="p-1.5 bg-emerald-100 rounded-lg text-emerald-600 font-bold">
            🛡️
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              ReconAgent
            </h1>
            <p className="text-xs text-slate-500">
              Secured for:{" "}
              <span className="font-semibold text-emerald-700">{email}</span>
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-md uppercase">
            {userRole}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowAIModal(true)}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition-colors"
          >
            <span>💬 Secure AI CFO</span>
          </button>
          <button
            onClick={() => setShowHelpModal(true)}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 text-sm font-medium bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg transition-colors"
          >
            <span>❓ Security Info</span>
          </button>
          <button
            onClick={handleDownloadReport}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 text-sm font-medium bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg transition-colors"
          >
            <span>📄 Export Audit Dossier</span>
          </button>
          <button
            onClick={handleLogout}
            title="Logout"
            className="flex items-center space-x-1 px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 rounded-lg transition-colors"
          >
            <span>🚪 Lock & Logout</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Quick Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Volume Processed
            </p>
            <h3 className="text-2xl font-bold text-slate-900 mt-2">
              ₹{metrics.total_vol.toLocaleString()}
            </h3>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Exact Match Rate
            </p>
            <h3 className="text-2xl font-bold text-emerald-600 mt-2">
              {metrics.match_rate}%
            </h3>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Discrepancy Variance
            </p>
            <h3 className="text-2xl font-bold text-amber-600 mt-2">
              ₹{metrics.total_variance.toLocaleString()}
            </h3>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Pending Approvals
            </p>
            <h3 className="text-2xl font-bold text-blue-600 mt-2">
              {metrics.pending_auditors}
            </h3>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="border-b border-slate-200">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab("bills")}
              className={`pb-3 text-sm font-semibold transition-colors border-b-2 ${
                activeTab === "bills"
                  ? "border-emerald-600 text-emerald-700"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              Transactions & Exceptions ({filteredBills.length})
            </button>
            <button
              onClick={() => setActiveTab("upload")}
              className={`pb-3 text-sm font-semibold transition-colors border-b-2 ${
                activeTab === "upload"
                  ? "border-emerald-600 text-emerald-700"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              Scan & OCR Ingestion
            </button>
            <button
              onClick={() => setActiveTab("team")}
              className={`pb-3 text-sm font-semibold transition-colors border-b-2 ${
                activeTab === "team"
                  ? "border-emerald-600 text-emerald-700"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              Access Permissions
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`pb-3 text-sm font-semibold transition-colors border-b-2 ${
                activeTab === "history"
                  ? "border-emerald-600 text-emerald-700"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              SHA-256 Encryption Audit Trail
            </button>
          </nav>
        </div>

        {/* Tab 1: Transactions & Exceptions */}
        {activeTab === "bills" && (
          <>
            <div className="flex flex-col sm:flex-row gap-3 justify-between items-center">
              <div className="relative w-full sm:w-96">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                  🔍
                </span>
                <input
                  type="text"
                  placeholder="Search Transaction ID or Reference..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-slate-400"
                />
              </div>

              <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
                <span className="text-xs font-semibold text-slate-600 uppercase">
                  Filter Source:
                </span>
                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="All">All Sources</option>
                  <option value="Bank">Bank Sync</option>
                  <option value="Payment Gateway">Payment Gateway</option>
                  <option value="OCR">Scanned Receipt OCR</option>
                </select>
              </div>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 flex items-center space-x-2">
              <span>💡</span>
              <span>
                <strong>Note:</strong> Transactions appear automatically via
                secure API feeds from your linked Bank account or Payment
                Gateway.
              </span>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-700">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-xs">
                    <tr>
                      <th className="p-4 w-10">
                        <input
                          type="checkbox"
                          checked={
                            selectedBillIds.length === filteredBills.length &&
                            filteredBills.length > 0
                          }
                          onChange={handleSelectAll}
                          className="rounded border-slate-300 text-emerald-600"
                        />
                      </th>
                      <th className="p-4">TX ID & Source</th>
                      <th className="p-4">Reference Code</th>
                      <th className="p-4">Amount (INR)</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Security Validation</th>
                      <th className="p-4 text-right">Quick Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredBills.length === 0 ? (
                      <tr>
                        <td
                          colSpan="7"
                          className="p-6 text-center text-slate-400 text-sm"
                        >
                          No records found matching your search.
                        </td>
                      </tr>
                    ) : (
                      filteredBills.map((item) => (
                        <tr
                          key={item.id}
                          className="hover:bg-slate-50 transition-colors"
                        >
                          <td className="p-4">
                            <input
                              type="checkbox"
                              checked={selectedBillIds.includes(item.id)}
                              onChange={() => handleSelectBill(item.id)}
                              className="rounded border-slate-300 text-emerald-600"
                            />
                          </td>
                          <td className="p-4 font-medium text-slate-900">
                            <div>{item.id}</div>
                            <div className="text-xs text-emerald-700 font-semibold">
                              ⚡ Source: {item.source} • {item.date}
                            </div>
                          </td>
                          <td className="p-4 text-slate-600 font-mono text-xs">
                            {item.reference}
                          </td>
                          <td className="p-4 font-semibold text-slate-900">
                            ₹{item.amount.toLocaleString()}
                          </td>
                          <td className="p-4">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${item.status === "Exact Match" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}
                            >
                              {item.status}
                            </span>
                          </td>
                          <td className="p-4">
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                              <span>🔒 AES-256 Protected</span>
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <button
                              onClick={() => setSelectedBill(item)}
                              className="inline-flex items-center space-x-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition-colors"
                            >
                              <span>🔍 Inspect / AI AJE</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* Tab 2: Scan & Upload Bills */}
        {activeTab === "upload" && (
          <div className="bg-white p-8 rounded-xl border border-slate-200 text-center space-y-4 shadow-sm">
            <div className="text-4xl">📤</div>
            <h3 className="text-lg font-bold text-slate-800">
              Secure Receipt OCR Ingestion
            </h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              Upload your shop bills / GPay PDF statements. The AI scans and securely logs it
              specifically under your account vault ({email}).
            </p>
            <label className="inline-block px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-lg shadow-sm cursor-pointer transition-colors">
              Select & Securely Scan
              <input
                type="file"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
        )}

        {/* Tab 3: Staff & Auditor Access */}
        {activeTab === "team" && (
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-lg font-bold text-slate-800">
              Personalized Role Permissions
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <div className="font-semibold text-slate-800 text-sm">
                    Account Vault: {email}
                  </div>
                  <div className="text-xs text-slate-500">
                    Encrypted isolated storage active. No cross-user leak.
                  </div>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-md">
                  Secured
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Secure Activity History */}
        {activeTab === "history" && (
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-lg font-bold text-slate-800">
              SHA-256 Encryption Audit Trail
            </h3>
            <div className="space-y-2 font-mono text-xs max-h-96 overflow-y-auto">
              {auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 bg-slate-50 rounded border border-slate-200 text-slate-700 flex justify-between"
                >
                  <span>
                    [{log.timestamp}] {log.actor}: {log.action}
                  </span>
                  <span className="text-emerald-700 font-bold">
                    SHA: {log.sha256.substring(0, 12)}...
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* MODAL 1: AI Helper Chat */}
      {showAIModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col h-[500px]">
            <div className="p-4 bg-emerald-600 text-white flex justify-between items-center">
              <h3 className="font-bold text-base flex items-center space-x-2">
                <span>💬 Secure AI CFO Helper</span>
              </h3>
              <button
                onClick={() => setShowAIModal(false)}
                className="text-white hover:text-emerald-200 font-bold"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50">
              {aiChatHistory.map((msg, index) => (
                <div
                  key={index}
                  className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-xs px-3.5 py-2 rounded-xl text-sm ${msg.sender === "user" ? "bg-emerald-600 text-white" : "bg-white border border-slate-200 text-slate-800 shadow-sm"}`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>
            <form
              onSubmit={handleAISubmit}
              className="p-3 bg-white border-t border-slate-200 flex gap-2"
            >
              <input
                type="text"
                placeholder="Ask about your encrypted ledger..."
                value={aiQuestion}
                onChange={(e) => setAiQuestion(e.target.value)}
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Help Guide */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-900">
                🛡️ Bank Security Features
              </h3>
              <button
                onClick={() => setShowHelpModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>
            <div className="text-sm text-slate-600 space-y-2">
              <p>
                <strong>1. Why didn't I enter the bills?</strong> They are
                pulled automatically via secure API feeds from your linked Bank
                or Payment Gateway.
              </p>
              <p>
                <strong>2. Personalization:</strong> Each user email has its own
                isolated session vault.
              </p>
              <p>
                <strong>3. Encryption:</strong> All transactions are protected
                with SHA-256 and AES-256 security standards.
              </p>
            </div>
            <button
              onClick={() => setShowHelpModal(false)}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-sm rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* MODAL 3: Inspect Bill & AI Adjusting Entry */}
      {selectedBill && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-bold text-lg text-slate-900">
                Record Inspection: {selectedBill.id}
              </h3>
              <button
                onClick={() => setSelectedBill(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>
            <div className="space-y-2 text-sm text-slate-700">
              <div>
                <strong>Source Feed:</strong>{" "}
                <span className="text-emerald-700 font-semibold">
                  {selectedBill.source}
                </span>
              </div>
              <div>
                <strong>Reference:</strong>{" "}
                <span className="font-mono text-xs">
                  {selectedBill.reference}
                </span>
              </div>
              <div>
                <strong>Date:</strong> {selectedBill.date}
              </div>
              <div>
                <strong>Amount:</strong> ₹{selectedBill.amount.toLocaleString()}
              </div>
              <div>
                <strong>Status:</strong>{" "}
                <span className="text-emerald-600 font-semibold">
                  {selectedBill.status}
                </span>
              </div>
              {selectedBill.discrepancy_reason && (
                <div className="p-2 bg-amber-50 rounded text-xs text-amber-800">
                  <strong>Discrepancy:</strong>{" "}
                  {selectedBill.discrepancy_reason}
                </div>
              )}
              {selectedBill.aje && (
                <div className="p-3 bg-slate-50 rounded border border-slate-200 text-xs space-y-1 font-mono">
                  <div className="font-bold text-slate-900">
                    🤖 AI Adjusting Journal Entry (AJE):
                  </div>
                  <div>
                    Debit: {selectedBill.aje.debit_account} (₹
                    {selectedBill.aje.debit_amount})
                  </div>
                  <div>
                    Credit: {selectedBill.aje.credit_account} (₹
                    {selectedBill.aje.credit_amount})
                  </div>
                  <div className="text-slate-500">
                    {selectedBill.aje.explanation}
                  </div>
                </div>
              )}
            </div>
            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedBill(null)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-lg shadow-sm transition-colors"
              >
                Close Secure View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}