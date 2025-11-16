// main.js — SafeNode Dashboard (currency detection + buyer/seller logic + all escrows)
document.addEventListener("DOMContentLoaded", () => {
  const userId = localStorage.getItem("ui");
  const API_BASE = "/api/dashboard";
const API_BASEE = "/";
  if (!userId) {
    console.log("...")
    return;
  }

  const userNameEls = document.querySelectorAll("#userName, main p strong");
  const walletBalanceEl = document.getElementById("walletBalance");
  const walletBalanceE = document.getElementById("walletBalanc");
  const usdtBalanceEl = document.getElementById("usdtBalance");
  const totalDisputesEl = document.getElementById("totalDisputes");
  const escrowListEl = document.getElementById("escrowList");
  const summaryCards = Array.from(document.querySelectorAll(".card-grid .card"));

  let currentUserEmail = "";
  let userCountry = "";

  const safeNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const escapeHtml = (s) =>
    String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function updateSummaryCards({ totalBalanceFormatted, activeCount, completedCount }) {
    summaryCards.forEach((card) => {
      const heading = card.querySelector("h4")?.textContent?.trim().toLowerCase() || "";
      const valueEl = card.querySelector("h2");
      if (!valueEl) return;
      if (heading.includes("total balance")) valueEl.textContent = totalBalanceFormatted;
      else if (heading.includes("active escrows")) valueEl.textContent = String(activeCount);
      else if (heading.includes("completed deals")) valueEl.textContent = String(completedCount);
    });
  }

  // 🔹 Determine currency symbol
  function getCurrencySymbol(currency) {
  if (!currency) return "₦"; // default
  const c = currency.toUpperCase();
  if (c === "USDT") return " ₮";
  if (c === "NGN") return "₦";
  return c;
}
let buyernamme = null ;
let sellernamme = null; 
  // 🧩 Build escrow card
  function buildEscrowCard(c) {
    const title = c.title || "Untitled Contract";
    const amount = safeNum(c.amount);
    const buyer = c.buyerEmail || c.buyer || "N/A";
    const buyername = c.buyername || c.buyer || "N/A";
    const sellername = c.sellername || c.seller || "Not yet accepted";
    buyernamme = buyername
    sellernamme = sellername
    const seller = c.sellerEmail || c.seller || "Not yet accepted";
    const status = (c.status || "Pending").toLowerCase();
    const created = c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "";
    const symbol = getCurrencySymbol(c.currency);

    const statusClass =
      status === "completed"
        ? "completed"
        : status === "pending"
        ? "pending"
        : status === "disputed"
        ? "disputed"
        : status === "funded"
        ? "funded"
        : status === "accepted"
        ? "accepted"
        : "";

    return `
      <div class="escrow-card ${statusClass}"
           data-id="${c._id || ""}"
           data-title="${escapeHtml(title)}"
           data-amount="${amount}"
           data-currency="${symbol}"
           data-paymentmethod="${c.paymentMethod || "paystack"}"
           data-buyer="${escapeHtml(buyer)}"
           data-seller="${escapeHtml(seller)}"
           data-started="${escapeHtml(created)}"
           data-status="${escapeHtml(status)}">
        <div class="escrow-card-content">
          <div>
            <div class="escrow-title">${escapeHtml(title)}</div>
            <div class="escrow-meta">
              ${symbol === "₦" ? "₦" + " " +Number(amount).toLocaleString() : Number(amount).toLocaleString() +""+ "USDT"}
              • Buyer: ${escapeHtml(buyername)} • Seller: ${escapeHtml(sellername)}
            </div>
          </div>
        </div>
                            <span class="status-badge ${statusClass}">${escapeHtml(status)}</span>
        <span class="escrow-indicator" >›</span>
      </div>
    `;
  }

  // Clickable escrow cards
  function attachEscrowClickHandlers() {
    document.querySelectorAll(".escrow-card").forEach((card) => {
      const newCard = card.cloneNode(true);
      card.parentNode.replaceChild(newCard, card);

      newCard.addEventListener("click", () => {
        const data = {
          id: newCard.dataset.id,
          title: newCard.dataset.title,
          amount: newCard.dataset.amount,
          currency: newCard.dataset.currency,
          paymentMethod: newCard.dataset.paymentmethod,
          buyername:buyernamme,
          sellername:sellernamme,
          buyer: newCard.dataset.buyer,
          seller: newCard.dataset.seller,
          started: newCard.dataset.started,
          status: newCard.dataset.status || "Active",
        };
        openEscrowPanel(data);
      });
    });
  }

  // 🧾 API: Release Funds (buyer)
  async function releaseFunds(contractId) {
    try {
      const res = await fetch(`${API_BASE}/release-funds`, {
        method: "POST",
        headers: { "Content-Type": "application/json", userid: userId },
        body: JSON.stringify({ contractId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to release funds");
      await loadDashboard();
    } catch (err) {
      showToast(err.message,"error");
    }
  }

  // 🧾 API: Request Funds (seller)
async function requestFunds(contractId) {
  try {
    alert(contractId)
    alert()
    const res = await fetch(`/api/contracts/request/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: contractId, 
        ui: userId// seller’s email (so backend knows who’s requesting)
      }),
    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.message || "Failed to request funds");

    showToast(data.message || "Request sent to buyer!", "success");
  } catch (err) {
    showToast(err.message, "error");
  }
}

  // 🧾 API: Dispute
  async function initiateDispute(contractId, title, reason) {
    try {
      showToast("Dispute successfully initiated")
      window.location.href = `/dispute?contract=${encodeURIComponent(contractId)}`; // ✅ redirect with contract ID
    } catch (err) {
      showToast(err.message,"sucess");
    }
  }

  // 🔍 Escrow detail panel
  function openEscrowPanel(data) {
    const panelOverlay = document.getElementById("panelOverlay");
    const detailPanel = document.getElementById("detailPanel");
    const panelContent = document.getElementById("panelContent");
    if (!panelOverlay || !detailPanel || !panelContent) return;

    const buyerEmail = (data.buyer || "").toLowerCase();
    const sellerEmail = (data.seller || "").toLowerCase();
    const me = (currentUserEmail || "").toLowerCase();
    const sellername = data.sellername
    const buyername = data.buyername
    const isBuyer = me === buyerEmail;
    const isSeller = me === sellerEmail;

    let actionBtnHtml = "";
    if (isBuyer) actionBtnHtml = `<button class="btn-primary" id="releaseFundsBtn">Release Funds</button>`;
    else if (isSeller) {
  actionBtnHtml = `
    <button class="btn-primary" id="requestFundsBtn">Request Funds</button>
    <button class="btn-secondary" id="initiateDisputeBtn">Initiate Dispute</button>
  `;
}
    const symbol = getCurrencySymbol(data.currency);

    panelContent.innerHTML = `
      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
          <div>
            <h2>${escapeHtml(data.title)}</h2>
            <div class="meta">Escrow Ref: <strong>${escapeHtml(data.id)}</strong></div>
          </div>
          <div style="text-align:right;">
            <div style="font-weight:800;color:var(--primary);font-size:1.25rem">
              ${symbol === "₦" ? "₦" + Number(data.amount).toLocaleString() : Number(data.amount).toLocaleString() + "  ₮"}
            </div>
            <div style="font-size:.85rem;color:var(--gray)">${escapeHtml(data.status)}</div>
          </div>
        </div>

        <section style="margin-top:18px;">
          <h3>Parties</h3>
          <div style="display:flex;gap:12px;flex-wrap:wrap">
            <div style="background:#fafafa;padding:12px;border-radius:10px;min-width:160px">
              <div style="font-size:.85rem;color:var(--gray)">Buyer</div>
              <div style="font-weight:700">${escapeHtml(data.buyername)}</div>
            </div>
            <div style="background:#fafafa;padding:12px;border-radius:10px;min-width:160px">
              <div style="font-size:.85rem;color:var(--gray)">Seller</div>
              <div style="font-weight:700">${escapeHtml(data.sellername)}</div>
            </div>
          </div>
        </section>

        <section style="margin-top:18px;">
          <h3>Details</h3>
          <p>Contract title: <strong>${escapeHtml(data.title)}</strong></p>
          <p>Status: <strong>${escapeHtml(data.status)}</strong></p>
        </section>

        <section style="margin-top:20px;display:flex;gap:10px;">
          ${actionBtnHtml}
          <button class="btn-secondary" id="initiateDisputeBtn">Initiate Dispute</button>
        </section>
      </div>
    `;

    panelOverlay.classList.add("visible");
    detailPanel.classList.add("open");

    if (isBuyer)
      document.getElementById("releaseFundsBtn")?.addEventListener("click", () => {
        if (true) releaseFunds(data.id);
      });
    if (isSeller)
      document.getElementById("requestFundsBtn")?.addEventListener("click", () => {
    requestFunds(data.id);
      });

    document.getElementById("initiateDisputeBtn")?.addEventListener("click", async () => {
      const reason = "Enter reason for dispute:"
      
      await initiateDispute(data.id, `Dispute: ${data.title}`, reason.trim());
    });
  }

  // 🔄 Load dashboard
  async function loadDashboard() {
    try {
      const res = await fetch(`${API_BASE}/`, { headers: { userid: userId } });
      const data = await res.json();
      if (!res.ok || !data.success) throw console.log(data.message || "Error loading dashboard");

      const user = data.user || {};
      // Remove disputed contracts entirely
let contracts = Array.isArray(data.contracts) ? data.contracts : [];
contracts = contracts.filter(c => (c.status || "").toLowerCase() !== "disputed");

      currentUserEmail = (user.email || "").toString();
      userCountry = (user.country || "").toString();

      const firstName = (user.name || "User").split(" ")[0];
      userNameEls.forEach((el) => (el.textContent = firstName));

      const nairaBalance =
        (user.wallet && typeof user.wallet === "object" ? safeNum(user.wallet.balance) : safeNum(user.wallet)) || 0;
      const usdtBalance =
        (user.wallet && typeof user.wallet === "object" ? safeNum(user.wallet.balance) : safeNum(user.balance)) || 0;

      // currency logic for wallet
      const userCurrency = user.currency || "NGN";
const walletBalance = safeNum(user.wallet);
const displayBalance =
  userCurrency === "NGN"
    ? `₦${walletBalance.toLocaleString() + '.00'}`
    : `${walletBalance.toFixed(2) }  USDT`;

walletBalanceEl.textContent = displayBalance;
walletBalanceE.textContent = displayBalance;

      const activeCount = contracts.filter((c) => c.status?.toLowerCase() !== "completed").length;
      const completedCount = contracts.filter((c) => c.status?.toLowerCase() === "completed").length;

      updateSummaryCards({
        totalBalanceFormatted: displayBalance,
        activeCount,
        completedCount,
      });

      const sortOrder = ["accepted","funded", "completed", "pending"];
      contracts.sort((a, b) => sortOrder.indexOf(a.status?.toLowerCase()) - sortOrder.indexOf(b.status?.toLowerCase()));

if (escrowListEl) {
  // Show *all* escrows, but limit to 6 for the preview
  const limitedContracts = contracts.slice(0, 4);

  escrowListEl.innerHTML = `
    <h3 style="margin-top:18px;color:#00a86b">Recent Escrow Contracts</h3>
    ${
      limitedContracts.length
        ? limitedContracts.map((c) => buildEscrowCard(c)).join("")
        : `<p style="color:#777;margin-top:10px;">No escrows yet.</p>`
    }
    ${
      contracts.length > 4
        ? `<div style="margin-top:20px;text-align:center;">
             <button id="viewAllEscrowBtn" class="view-escrow-btn">View All Contracts</button>
           </div>`
        : ""
    }
  `;

  attachEscrowClickHandlers();

  // Handle "View All" button
  document.getElementById("viewAllEscrowBtn")?.addEventListener("click", () =>
    openAllEscrowsPanel(contracts)
  );
}
    } catch (e) {
      console.log('hi')
    }
  }

  // 🔹 All Escrows Panel
  // 🔹 All Escrows Panel
function openAllEscrowsPanel(contracts) {
  const panelOverlay = document.getElementById("panelOverlay");
  const detailPanel = document.getElementById("detailPanel");
  const panelContent = document.getElementById("panelContent");
  if (!panelOverlay || !detailPanel || !panelContent) return;

  const sortedContracts = [...contracts].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
panelContent.innerHTML = `
  <div>
    <h2 style="margin-bottom:10px;">All Escrow Contracts</h2>
    <div id="filterWrap" 
         style="display:flex;gap:7px;margin:10px 0;width:100%">
    </div>

    <div id="allEscrowsContainer" 
         style="display:flex;flex-direction:column;gap:10px;
                max-height:80vh;overflow-y:auto;">
      ${
        sortedContracts.length
          ? sortedContracts.map((c) => buildEscrowCard(c)).join("")
          : `<p style="color:#777">No escrows found.</p>`
      }
    </div>
  </div>
`;

// ✅ Activate filter functionality
const filters = ["All", "Accepted", "Funded", "Completed"];
const wrap = document.getElementById("filterWrap");
const container = document.getElementById("allEscrowsContainer");

filters.forEach((label, i) => {
  const btn = document.createElement("button");
  btn.textContent = label;
  btn.dataset.value = label.toLowerCase();
  btn.style.padding = "6px 10px";
  btn.style.borderRadius = "9px";
  btn.style.border = "none";
  btn.style.cursor = "pointer";
  btn.style.boxShadow = "0 6px 18px rgba(0,0,0,0.08)"
  btn.style.background = i === 0 ? "#00a86b" : "#fff";
  btn.style.color = i === 0 ? "#fff" : "#000";
  btn.style.transition = "all 0.2s ease";

  btn.addEventListener("click", () => {
    const val = btn.dataset.value;
    const cards = container.querySelectorAll(".escrow-card");

    wrap.querySelectorAll("button").forEach(b => {
      b.style.background = "#fff";
      b.style.color = "#000";
    });

    btn.style.background = "#00a86b";
    btn.style.color = "#fff";

    cards.forEach(card => {
      const status = (card.dataset.status || "").toLowerCase();
      card.style.display = val === "all" || status === val ? "" : "none";
    });
  });

  wrap.appendChild(btn);
});
  

  panelOverlay.classList.add("visible");
  detailPanel.classList.add("open");

  attachEscrowClickHandlers();
}

// 🔹 Escrow Detail Panel (Final Version)
function openEscrowPanel(data) {
  const panelOverlay = document.getElementById("panelOverlay");
  const detailPanel = document.getElementById("detailPanel");
  const panelContent = document.getElementById("panelContent");
  if (!panelOverlay || !detailPanel || !panelContent) return;

  const buyerEmail = (data.buyer || "").toLowerCase();
  const sellerEmail = (data.seller || "").toLowerCase();
  const me = (currentUserEmail || "").toLowerCase();

  const isBuyer = me === buyerEmail;
  const isSeller = me === sellerEmail;
  const status = (data.status || "").toLowerCase();
  const symbol = getCurrencySymbol(data.currency);

  let actionBtnHtml = "";

  // 🎯 Action button logic
  if (status === "accepted") {
    if (isBuyer) {
      actionBtnHtml = `
        <button class="btn-primary" id="releaseFundsBtn">Release Funds</button>
        <button class="btn-secondary" id="initiateDisputeBtn">Initiate Dispute</button>
      `;
    } else if (isSeller) {
      actionBtnHtml = `
        <button class="btn-primary" id="requestFundsBtn">Request Funds</button>
        <button class="btn-secondary" id="initiateDisputeBtn">Initiate Dispute</button>
      `;
    }
  } else if (status === "funded") {
    actionBtnHtml = `
      <button class="btn-primary" id="copyLinkBtn">Copy Link</button>
      ${isBuyer ? `<button class="btn-secondary" id="cancelOrderBtn">Cancel Order</button>` : ""}
    `;
  } else if (status === "completed") {
    actionBtnHtml = `<button class="btn-primary" id="downloadReceiptBtn">Download Receipt</button>`;
  } else if (status === "disputed") {
    actionBtnHtml = `<button class="btn-primary" id="initiateDisputeBtn">View Dispute</button>`;
  }

  // 🧱 Panel content
  panelContent.innerHTML = `
    <div>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
        <div>
          <h2>${escapeHtml(data.title)}</h2>
          <div class="meta">Escrow Ref: <strong>${escapeHtml(data.id)}</strong></div>
        </div>
        <div style="text-align:right;">
          <div style="font-weight:800;color:var(--primary);font-size:1.25rem">
            ${symbol === "₦"
              ? "₦" + Number(data.amount).toLocaleString()
              : Number(data.amount).toLocaleString() + " ₮"}
          </div>
        </div>
      </div>

      <section style="margin-top:18px;">
        <h3>Parties</h3>
        <div style="display:flex;gap:12px;flex-wrap:wrap">
          <div style="background:#fafafa;padding:12px;border-radius:10px;min-width:160px">
            <div style="font-size:.85rem;color:var(--gray)">Buyer</div>
            <div style="font-weight:700">${escapeHtml(data.buyername)}</div>
          </div>
          <div style="background:#fafafa;padding:12px;border-radius:10px;min-width:160px">
            <div style="font-size:.85rem;color:var(--gray)">Seller</div>
            <div style="font-weight:700">${escapeHtml(data.sellername)}</div>
          </div>
        </div>
      </section>

      <section style="margin-top:18px;">
        <h3>Details</h3>
        <p>Contract title: <strong>${escapeHtml(data.title)}</strong></p>
        <p>Started: ${escapeHtml(data.started)}</p>
        <p>Status: <strong>${escapeHtml(data.status)}</strong></p>
      </section>

      <section style="margin-top:20px;display:flex;gap:10px;flex-wrap:wrap;">
        ${actionBtnHtml}
      </section>
    </div>
  `;

  // Show the panel
  panelOverlay.classList.add("visible");
  detailPanel.classList.add("open");

  // 🎯 Button Handlers
  if (document.getElementById("releaseFundsBtn")) {
    document.getElementById("releaseFundsBtn").addEventListener("click", () => {
      if (confirm(`Release funds for "${data.title}"?`)) releaseFunds(data.id);
    });
  }

  if (document.getElementById("requestFundsBtn")) {
    document.getElementById("requestFundsBtn").addEventListener("click", () => {
   requestFunds(data.id);
    });
  }

  if (document.getElementById("initiateDisputeBtn")) {
    document.getElementById("initiateDisputeBtn").addEventListener("click", async () => {
      const reason = "Enter reason for dispute:";
      await initiateDispute(data.id, `Dispute: ${data.title}`, reason.trim());
    });
  }

  if (document.getElementById("copyLinkBtn")) {
    document.getElementById("copyLinkBtn").addEventListener("click", () => {
      navigator.clipboard.writeText(window.location.origin + `/accept.html?contract=${data.id}`);
      showToast("Link copied to clipboard!","success");
    });
  }
if (document.getElementById("cancelOrderBtn")) {
  document.getElementById("cancelOrderBtn").addEventListener("click", async () => {
    try {
      const res = await fetch(`/api/contracts/cancel/${data.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", userid: userId },
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || "Failed to cancel contract");

      showToast(result.message || "Contract cancelled successfully!", "success");
      

      // Close the detail panel
      document.getElementById("panelOverlay").classList.remove("visible");
      document.getElementById("detailPanel").classList.remove("open");
    } catch (err) {
      showToast(err.message, "error");
    }
  });
}
  

  if (document.getElementById("downloadReceiptBtn")) {
    document.getElementById("downloadReceiptBtn").addEventListener("click", () => {
      window.location.href = `/accepted?id=${encodeURIComponent(data.id)}`;
    });
  }
}


  // Initial load
  loadDashboard();
  window.addEventListener("load", () => {
  const loader = document.getElementById("loader");
  const main = document.querySelector("main");
  if (main) main.style.display = "none"; // hide main content initially

  // Start dashboard data load
  loadDashboard().then(() => {
    // Once data arrives, show main and hide loader
    if (loader) loader.classList.add("hidden");
    if (main) main.style.display = "block";
  });
});
async function autoRefreshDashboard() {
  try {
    await loadDashboard(); // refresh user and escrows
  } catch (err) {
    console.warn("Auto-refresh failed:", err.message);
  } finally {
    // schedule next refresh
    setTimeout(autoRefreshDashboard, 4000); // every 20s
  }
}

// Initial load (first dashboard load)
loadDashboard().then(() => {
  // start continuous background updates
  autoRefreshDashboard();

});
});

