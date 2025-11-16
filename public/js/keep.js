/* depositWithdrawModal.js
   Handles deposit + withdraw slide-up modals (open/close, method & network selection,
   amount entry, cancel, overlay click). Redirects to deposit.html or withdraw.html
   with query params on confirm.
*/

(function () {
  // ---------- Inject styles ----------
  const css = `
  /* overlay + slide-up container */
  .sn-modal-overlay { display:none; position:fixed; inset:0; z-index:9998; align-items:flex-end; justify-content:center; background:rgba(0,0,0,0.38); }
  .sn-modal-overlay.open { display:flex; }
  .sn-modal { width:100%; max-width:480px; margin:0 12px 18px; border-radius:12px 12px 8px 8px; transform:translateY(110%); transition:transform 320ms cubic-bezier(.2,.9,.2,1); background:#fff; box-shadow:0 18px 40px rgba(0,0,0,0.12); padding:16px; }
  .sn-modal.open { transform:translateY(0%); }
  .sn-modal .header { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:8px; }
  .sn-modal h3{ margin:0; font-size:18px; color:#043; }
  .sn-close { background:none;border:0;font-size:18px;cursor:pointer; }
  .sn-row { margin-top:8px; }
  .sn-label { font-weight:600; font-size:13px; color:#222; margin-bottom:6px; display:block; }
  .sn-methods, .sn-networks { display:flex; gap:8px; }
  .sn-option { flex:1; padding:10px; border-radius:10px; border:1px solid #e7eef0; text-align:center; cursor:pointer; user-select:none; background:#fff;}
  .sn-option.selected { border-color:#00a86b; background:#f3fff6; box-shadow:0 8px 22px rgba(0,168,107,0.06); }
  .sn-input { width:100%; padding:10px; margin-top:8px; border-radius:8px; border:1px solid #ddd; font-size:16px; }
  .sn-actions { display:flex; gap:8px; margin-top:12px; }
  .sn-btn { flex:1; padding:10px; border-radius:8px; border:0; cursor:pointer; font-weight:700; }
  .sn-btn.primary { background:#00a86b; color:#fff; }
  .sn-btn.ghost { background:#f2f4f3; color:#222; }
  .sn-foot { font-size:13px; color:#666; margin-top:8px; text-align:center; }
  `;

  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  // ---------- Inject HTML for both modals ----------
  if (!document.getElementById("sn-deposit-modal")) {
    const depositHtml = `
    <div class="sn-modal-overlay" id="sn-deposit-modal" aria-hidden="true">
      <div class="sn-modal" role="dialog" aria-modal="true" aria-labelledby="sn-deposit-title">
        <div class="header">
          <h3 id="sn-deposit-title">Deposit Funds</h3>
          <button class="sn-close" id="sn-deposit-close" aria-label="Close">✕</button>
        </div>

        <div class="sn-row">
          <label class="sn-label">Payment Method</label>
          <div class="sn-methods" id="sn-deposit-methods">
            <div class="sn-option" data-method="paystack">Paystack (NGN)</div>
            <div class="sn-option selected" data-method="crypto">Crypto</div>
          </div>
        </div>

        <div class="sn-row" id="sn-deposit-networks-wrap">
          <label class="sn-label">Network</label>
          <div class="sn-networks" id="sn-deposit-networks">
            <div class="sn-option selected" data-network="USDT">USDT</div>
            <div class="sn-option" data-network="BNB">BNB</div>
            <div class="sn-option" data-network="USDC">USDC</div>
          </div>
        </div>

        <div class="sn-row">
          <label class="sn-label">Amount</label>
          <input inputmode="decimal" id="sn-deposit-amount" class="sn-input" type="number" min="0" step="any" placeholder="Enter amount to deposit">
        </div>

        <div class="sn-actions">
          <button class="sn-btn primary" id="sn-deposit-confirm">Continue</button>
          <button class="sn-btn ghost" id="sn-deposit-cancel">Cancel</button>
        </div>

        <div class="sn-foot">You will be redirected to complete your deposit.</div>
      </div>
    </div>
    `;
    document.body.insertAdjacentHTML("beforeend", depositHtml);
  }

  if (!document.getElementById("sn-withdraw-modal")) {
    const withdrawHtml = `
    <div class="sn-modal-overlay" id="sn-withdraw-modal" aria-hidden="true">
      <div class="sn-modal" role="dialog" aria-modal="true" aria-labelledby="sn-withdraw-title">
        <div class="header">
          <h3 id="sn-withdraw-title">Withdraw Funds</h3>
          <button class="sn-close" id="sn-withdraw-close" aria-label="Close">✕</button>
        </div>

        <div class="sn-row">
          <label class="sn-label">Withdraw Network</label>
          <div class="sn-networks" id="sn-withdraw-networks">
            <div class="sn-option selected" data-network="USDT">USDT</div>
            <div class="sn-option" data-network="BNB">BNB</div>
            <div class="sn-option" data-network="USDC">USDC</div>
          </div>
        </div>

        <div class="sn-row">
          <label class="sn-label">Amount</label>
          <input inputmode="decimal" id="sn-withdraw-amount" class="sn-input" type="number" min="0" step="any" placeholder="Enter amount to withdraw">
        </div>

        <div class="sn-actions">
          <button class="sn-btn primary" id="sn-withdraw-confirm">Continue</button>
          <button class="sn-btn ghost" id="sn-withdraw-cancel">Cancel</button>
        </div>

        <div class="sn-foot">Withdrawals are processed manually — expect processing time.</div>
      </div>
    </div>
    `;
    document.body.insertAdjacentHTML("beforeend", withdrawHtml);
  }

  // ---------- Utilities ----------
  const qsAll = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const qs = (sel, root = document) => root.querySelector(sel);

  // ---------- Elements ----------
  const depositOverlay = document.getElementById("sn-deposit-modal");
  const depositDialog = qs(".sn-modal", depositOverlay);
  const depositMethods = document.getElementById("sn-deposit-methods");
  const depositNetworksWrap = document.getElementById("sn-deposit-networks-wrap");
  const depositNetworks = document.getElementById("sn-deposit-networks");
  const depositAmount = document.getElementById("sn-deposit-amount");
  const depositConfirm = document.getElementById("sn-deposit-confirm");
  const depositCancel = document.getElementById("sn-deposit-cancel");
  const depositClose = document.getElementById("sn-deposit-close");

  const withdrawOverlay = document.getElementById("sn-withdraw-modal");
  const withdrawDialog = qs(".sn-modal", withdrawOverlay);
  const withdrawNetworks = document.getElementById("sn-withdraw-networks");
  const withdrawAmount = document.getElementById("sn-withdraw-amount");
  const withdrawConfirm = document.getElementById("sn-withdraw-confirm");
  const withdrawCancel = document.getElementById("sn-withdraw-cancel");
  const withdrawClose = document.getElementById("sn-withdraw-close");

  // Buttons on the page that should open modals
  const depositButtons = qsAll('[id="depositBtn"]'); // handles multiple elements with same id
  const withdrawButtons = qsAll('[id="withdrawBtn"]');

  // Safe fallback: also allow data-action attributes
  const depositBtnsData = qsAll('[data-action="open-deposit"]');
  const withdrawBtnsData = qsAll('[data-action="open-withdraw"]');

  // ---------- Open / Close helpers ----------
  function openModal(overlay, dialog) {
    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden", "false");
    requestAnimationFrame(() => dialog.classList.add("open"));
  }
  function closeModal(overlay, dialog) {
    dialog.classList.remove("open");
    setTimeout(() => {
      overlay.classList.remove("open");
      overlay.setAttribute("aria-hidden", "true");
    }, 320);
  }

  // ---------- Selection helpers ----------
  function singleSelect(container, selector, valueAttr = "data-method") {
    const options = qsAll(selector, container);
    options.forEach(opt => {
      const v = opt.getAttribute(valueAttr) || opt.dataset[valueAttr.replace("data-", "")];
      if (v && v === valueAttr) console.warn('valueAttr misuse'); // shouldn't happen
    });
    return {
      select: v => {
        options.forEach(o => o.classList.toggle("selected", (o.getAttribute(valueAttr) || o.dataset[valueAttr.replace("data-", "")]) === v));
      }
    };
  }

  function handleOptionsClick(container, optionSelector, attributeName, onChange) {
    qsAll(optionSelector, container).forEach(opt => {
      opt.addEventListener("click", () => {
        // remove selected
        qsAll(optionSelector, container).forEach(o => o.classList.remove("selected"));
        // add to clicked
        opt.classList.add("selected");
        const chosen = opt.getAttribute(attributeName) || opt.dataset[attributeName.replace("data-", "")];
        if (onChange) onChange(chosen, opt);
      });
    });
  }

  // ---------- Deposit behavior ----------
  // Method select (paystack / crypto)
  handleOptionsClick(depositMethods, ".sn-option", "data-method", (method) => {
    // show/hide networks when crypto selected
    if (method === "crypto") depositNetworksWrap.style.display = "block";
    else depositNetworksWrap.style.display = "none";
  });

  // Networks select
  handleOptionsClick(depositNetworks, ".sn-option", "data-network", (network) => {
    // nothing else needed for now — UI highlight works
  });

  // Withdraw networks
  handleOptionsClick(withdrawNetworks, ".sn-option", "data-network", (network) => { /* UI only */ });

  // Open handlers
  depositButtons.concat(depositBtnsData).forEach(b => b && b.addEventListener("click", (e) => {
    e.preventDefault();
    depositAmount.value = "";
    // default: crypto method selected and USDT network selected
    qsAll(".sn-option", depositMethods).forEach(o => o.classList.toggle("selected", o.dataset.method === "crypto"));
    qsAll(".sn-option", depositNetworks).forEach(o => o.classList.toggle("selected", o.dataset.network === "USDT"));
    depositNetworksWrap.style.display = "block";
    openModal(depositOverlay, depositDialog);
  }));

  withdrawButtons.concat(withdrawBtnsData).forEach(b => b && b.addEventListener("click", (e) => {
    e.preventDefault();
    withdrawAmount.value = "";
    // default: USDT network selected
    qsAll(".sn-option", withdrawNetworks).forEach(o => o.classList.toggle("selected", o.dataset.network === "USDT"));
    openModal(withdrawOverlay, withdrawDialog);
  }));

  // Close / cancel handlers (works)
  depositCancel.addEventListener("click", () => closeModal(depositOverlay, depositDialog));
  depositClose.addEventListener("click", () => closeModal(depositOverlay, depositDialog));
  depositOverlay.addEventListener("click", (ev) => { if (ev.target === depositOverlay) closeModal(depositOverlay, depositDialog); });

  withdrawCancel.addEventListener("click", () => closeModal(withdrawOverlay, withdrawDialog));
  withdrawClose.addEventListener("click", () => closeModal(withdrawOverlay, withdrawDialog));
  withdrawOverlay.addEventListener("click", (ev) => { if (ev.target === withdrawOverlay) closeModal(withdrawOverlay, withdrawDialog); });

  // Confirm actions
  depositConfirm.addEventListener("click", () => {
    // get selected method & network
    const selectedMethodEl = qs(".sn-option.selected", depositMethods);
    const selectedMethod = selectedMethodEl ? (selectedMethodEl.dataset.method || selectedMethodEl.getAttribute("data-method")) : "crypto";
    const selectedNetworkEl = qs(".sn-option.selected", depositNetworks);
    const selectedNetwork = selectedNetworkEl ? (selectedNetworkEl.dataset.network || selectedNetworkEl.getAttribute("data-network")) : "USDT";
    const amount = parseFloat(depositAmount.value);

    if (!amount || amount <= 0) {
      alert("Please enter a valid amount to deposit.");
      depositAmount.focus();
      return;
    }

    // close and redirect to deposit page with params
    closeModal(depositOverlay, depositDialog);
    const params = new URLSearchParams({ method: selectedMethod, network: selectedNetwork, amount: String(amount) }).toString();
    // redirect to deposit page
    window.location.href = `/deposit.html?${params}`;
  });

  withdrawConfirm.addEventListener("click", () => {
    const selectedNetworkEl = qs(".sn-option.selected", withdrawNetworks);
    const selectedNetwork = selectedNetworkEl ? (selectedNetworkEl.dataset.network || selectedNetworkEl.getAttribute("data-network")) : "USDT";
    const amount = parseFloat(withdrawAmount.value);

    if (!amount || amount <= 0) {
      alert("Please enter a valid amount to withdraw.");
      withdrawAmount.focus();
      return;
    }

    // close and redirect to withdraw page
    closeModal(withdrawOverlay, withdrawDialog);
    const params = new URLSearchParams({ network: selectedNetwork, amount: String(amount) }).toString();
    window.location.href = `/withdraw.html?${params}`;
  });

  // keyboard escape to close
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (depositOverlay.classList.contains("open")) closeModal(depositOverlay, depositDialog);
      if (withdrawOverlay.classList.contains("open")) closeModal(withdrawOverlay, withdrawDialog);
    }
  });

})();