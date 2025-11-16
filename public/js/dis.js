(async function () {
  const domain = window.location.origin
  const API_BASE = `${domain}/api/dashboard`;
  const userId = localStorage.getItem("ui"); // uses same key as your main.js

  // DOM refs (must exist in page)
  const disputeSection = document.getElementById("disputeSection");
  const disputeListWrapper = disputeSection?.querySelector('div[style*="margin-top:18px"]') || disputeSection;
  const totalDisputesEl = document.getElementById("totalDisputes");
  const resolvedCountEl = document.getElementById("resolvedCount");
  const pendingCountEl = document.getElementById("pendingCount");

  const panelOverlay = document.getElementById("panelOverlay");
  const detailPanel = document.getElementById("detailPanel");
  const panelContent = document.getElementById("panelContent");
  const panelBackBtn = document.getElementById("panelBackBtn");

  if (!userId) {
    console.warn("No userId in localStorage (ui). Cannot load disputes.");
    return;
  }

  // safe html escape
  function escapeHtml(s) {
    if (s === undefined || s === null) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // Panel control (reuse your existing open/close)
  function openPanel() {
    panelOverlay.classList.add("visible");
    panelOverlay.setAttribute("aria-hidden", "false");
    detailPanel.classList.add("open");
    detailPanel.setAttribute("aria-hidden", "false");
  }
  function closePanel() {
    detailPanel.classList.remove("open");
    panelOverlay.classList.remove("visible");
    panelOverlay.setAttribute("aria-hidden", "true");
    detailPanel.setAttribute("aria-hidden", "true");
    setTimeout(() => (panelContent.innerHTML = ""), 300);
  }
  panelOverlay?.addEventListener("click", (e) => { if (e.target === panelOverlay) closePanel(); });
  panelBackBtn?.addEventListener("click", closePanel);

  // Build dispute details markup for the slide panel
  function disputeDetailMarkup(contract) {
    // contract may contain fields like:
    // ._id, .title, .amount, .currency, .buyer, .sellerEmail, .buyername, .sellername,
    // .disputeStatus, .disputeReason, .createdAt, .updatedAt
    const id = contract._id || contract.id || "N/A";
    const title = contract.title || contract.contractTitle || "Untitled";
    const amount = contract.amount != null ? contract.amount : (contract.amountPaid || "N/A");
    const currency = contract.currency || "NGN";
    const buyer = contract.buyername || contract.buyer || contract.buyerEmail || "Unknown";
    const seller = contract.sellername || contract.seller || contract.sellerEmail || "Unknown";
    const disputeStatus = contract.disputeStatus || contract.status || "Pending";
    const desc = contract.description || contract.reason || contract.desc || "No description provided.";
    const created = contract.createdAt || contract.updatedAt || new Date().toISOString();

    return `
      <div style="padding:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <h2 style="margin:0 0 6px 0">${escapeHtml(title)}</h2>
            <div class="meta" style="color:var(--gray);font-size:.95rem">
              Dispute Ref: <strong>${escapeHtml(String(id).slice(-8))}</strong>
            </div>
          </div>
          <div style="text-align:right;">
            <div style="font-weight:800;color:var(--primary);font-size:1.15rem">
              ${escapeHtml(currency)} ${escapeHtml(String(amount))}
            </div>
            <div style="font-size:.85rem;color:var(--gray)">${escapeHtml(disputeStatus)}</div>
          </div>
        </div>

        <section style="margin-top:16px;">
          <h4 style="margin:8px 0 6px 0">Related Escrow</h4>
          <div style="background:#fafafa;padding:12px;border-radius:10px;">
            <div style="font-weight:700">${escapeHtml(contract._id || contract.contractId || "N/A")}</div>
            <div style="color:var(--gray);font-size:.95rem">${escapeHtml(contract.title || "")}</div>
          </div>
        </section>

        <section style="margin-top:14px;">
          <h4 style="margin:8px 0">Parties</h4>
          <div style="display:flex;gap:12px;flex-wrap:wrap">
            <div style="background:#fff;padding:10px;border-radius:8px;border:1px solid #f0f0f0;min-width:140px">
              <div style="font-size:.85rem;color:var(--gray)">Buyer</div>
              <div style="font-weight:700">${escapeHtml(buyer)}</div>
            </div>
            <div style="background:#fff;padding:10px;border-radius:8px;border:1px solid #f0f0f0;min-width:140px">
              <div style="font-size:.85rem;color:var(--gray)">Seller</div>
              <div style="font-weight:700">${escapeHtml(seller)}</div>
            </div>
          </div>
        </section>

        <section style="margin-top:14px;">
          <h4 style="margin:8px 0">Description</h4>
          <div style="color:var(--gray);line-height:1.5">${escapeHtml(desc)}</div>
        </section>

        <section style="margin-top:16px;display:flex;gap:10px;">
          <button class="btn-primary" id="joinDisputeChatBtn">Join Dispute</button>
          <button class="btn-secondary" id="closeDisputePanelBtn">Close</button>
        </section>

        <div style="margin-top:12px;color:var(--gray);font-size:.9rem">Opened: ${escapeHtml(new Date(created).toLocaleString())}</div>
      </div>
    `;
  }

  // Render a dispute card (DOM node)
  function makeDisputeCard(contract) {
  const id = contract._id || contract.id || "";
  const title = contract.title || contract.contractTitle || "Untitled";
  const amount = contract.amount != null ? contract.amount : contract.amountPaid || "N/A";
  const currency = contract.currency || "NGN";
  const disputeStatus = contract.disputeStatus || contract.status || "Pending";
  const created = contract.createdAt || contract.updatedAt || new Date().toISOString();
  const desc = contract.disputeReason || contract.reason || contract.desc || "";

  const card = document.createElement("div");
  card.className = "dispute-card";
  card.dataset.id = id;
  card.dataset.title = title;
  card.dataset.escrow = contract.contractId || contract._id || "";
  card.dataset.created = new Date(created).toLocaleDateString();
  card.dataset.status = disputeStatus;
  card.dataset.desc = desc;

  // visually mark it clickable
  card.style.cursor = "pointer";
  card.style.transition = "all 0.2s ease";
  card.style.position = "relative";

  // hover lift & shadow
  card.addEventListener("mouseenter", () => {
    card.style.boxShadow = "0 3px 10px rgba(0,0,0,0.1)";
    card.style.transform = "translateY(-2px)";
  });
  card.addEventListener("mouseleave", () => {
    card.style.boxShadow = "";
    card.style.transform = "";
  });

  const statusClass = (disputeStatus || "").toLowerCase() === "resolved"
    ? "status-badge"
    : "status-badge pending";

  card.innerHTML = `
    <div>
      <div class="dispute-title">${escapeHtml(title)}</div>
      <div class="dispute-meta">Opened ${escapeHtml(new Date(created).toLocaleDateString())} • Ref: #${escapeHtml(String(id).slice(-6))}</div>
    </div>
    <div style="display:flex;align-items:center;gap:8px;">
      <span class="${statusClass}">${escapeHtml(disputeStatus)}</span>
      <span class="escrow-indicator">›</span>
    </div>
    <div class="click-hint" style="
      position:absolute;
      bottom:6px;right:12px;
      font-size:0.75rem;
      color:var(--gray);
      opacity:0;
      transition:opacity .2s;
    ">Click to view</div>
  `;

  // show "Click to view" hint on hover
  const hint = card.querySelector(".click-hint");
  card.addEventListener("mouseenter", () => (hint.style.opacity = "1"));
  card.addEventListener("mouseleave", () => (hint.style.opacity = "0"));

  // click to open details
  card.addEventListener("click", () => {
    panelContent.innerHTML = disputeDetailMarkup(contract);
    openPanel();
    setTimeout(() => {
      document.getElementById("joinDisputeChatBtn")?.addEventListener("click", () => {
        const disputeIdForChat = id || contract._id;
        if (disputeIdForChat)
          window.location.href = `/dispute?contract=${encodeURIComponent(disputeIdForChat)}`;
      });
      document.getElementById("closeDisputePanelBtn")?.addEventListener("click", closePanel);
    }, 50);
  });

  return card;
}
  // Render list (first n = 5), add view all button if more
  function renderDisputesList(disputes) {
    // clear existing (but keep the "Dispute History" heading if present)
    // we try to find the header node and put content after it
    // fallback: just clear wrapper
    const heading = disputeListWrapper.querySelector("h3");
    disputeListWrapper.innerHTML = heading ? heading.outerHTML : `<h3 style="color:var(--primary)">Dispute History</h3>`;

    // counts
    const total = disputes.length;
    const resolved = disputes.filter(d => (d.disputeStatus || d.status || "").toLowerCase() === "resolved").length;
    const pending = total - resolved;
    if (totalDisputesEl) totalDisputesEl.textContent = total;
    if (resolvedCountEl) resolvedCountEl.textContent = resolved;
    if (pendingCountEl) pendingCountEl.textContent = pending;
    if (total === 0) {
      disputeListWrapper.insertAdjacentHTML("beforeend", `<p style="color:gray;margin-top:10px;">No disputes yet.</p>`);
      return;
    }
    if(pending > 0 ){
      
    }showToast("You have "+ pending +" "+"disputes, check the dispute screen to address it ","error")
    const visible = disputes.slice(0, 5);
    visible.forEach(d => disputeListWrapper.appendChild(makeDisputeCard(d)));

    if (disputes.length > 5) {
      const viewAllBtn = document.createElement("button");
      viewAllBtn.className = "view-all-btn";
      viewAllBtn.textContent = "View All Disputes";
      viewAllBtn.style.cssText = "display:block;margin:15px auto;padding:8px 12px;border-radius:8px;border:none;background:var(--primary);color:#fff;cursor:pointer;";
      viewAllBtn.addEventListener("click", () => openAllDisputesPanel(disputes));
      disputeListWrapper.appendChild(viewAllBtn);
    }
  }

  // Open all disputes in same slide panel (list + click-to-open details)
  function openAllDisputesPanel(disputes) {
    const listHtml = disputes.map(d => "").join(""); // we'll populate programmatically
    panelContent.innerHTML = `
      <div style="padding:14px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <h2 style="margin:0">All Disputes</h2>
          <button id="closeAllDisputesBtn" style="background:none;border:none;font-size:20px;cursor:pointer;">✕</button>
        </div>
        <div id="allDisputesContainer" style="margin-top:12px;display:flex;flex-direction:column;gap:10px;max-height:70vh;overflow:auto"></div>
      </div>
    `;
    const container = document.getElementById("allDisputesContainer");
    disputes.forEach(d => container.appendChild(makeDisputeCard(d)));
    document.getElementById("closeAllDisputesBtn")?.addEventListener("click", closePanel);
    openPanel();
  }

  // Fetch user dashboard (same endpoint and header pattern as your main.js)
  async function loadDisputesFromServer() {
    try {
      const res = await fetch(`${API_BASE}/`, { headers: { userid: userId } });
      const json = await res.json();
      if (!res.ok || !json.success) {
        console.error("Failed to load dashboard data:", json?.message || res.statusText);
        renderDisputesList([]);
        return;
      }
      const contracts = Array.isArray(json.contracts) ? json.contracts : (json.data || []);
      // filter disputed contracts (normalize status)
      const disputed = contracts.filter(c => (c.status || "").toLowerCase() === "disputed");
      // ensure sorting by newest first (optional)
      disputed.sort((a, b) => new Date(b.createdAt || b.updatedAt || Date.now()) - new Date(a.createdAt || a.updatedAt || Date.now()));
      renderDisputesList(disputed);
    } catch (err) {
      console.error("Error fetching disputes:", err);
      renderDisputesList([]);
    }
  }

  // initial load
  loadDisputesFromServer();

  // optional: refresh every 30s (uncomment if you want auto-refresh)
})();