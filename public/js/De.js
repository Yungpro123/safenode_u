/* depositWithdrawModal.js — Advanced Bottom Sheet with Modern Paystack & Network Display */

(function () {
  // ---------- Inject Styles ----------
  const css = `
  .sn-modal-overlay { display:none; position:fixed; inset:0; z-index:9998; align-items:flex-end; justify-content:center; background:rgba(0,0,0,0.38); }
  .sn-modal-overlay.open { display:flex; }
  .sn-modal { width:100%; max-width:480px; margin:0 12px 12px; border-radius:16px; transform:translateY(110%); transition:transform 0.35s cubic-bezier(.2,.9,.2,1); background:#fff; box-shadow:0 -8px 30px rgba(0,0,0,0.12); padding:20px; font-family:Arial, sans-serif; }
  .sn-modal.open { transform:translateY(0%); }
  .sn-modal .header { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; }
  .sn-modal h3 { margin:0; font-size:20px; font-weight:700; color:#043; }
  .sn-close { background:none; border:0; font-size:22px; cursor:pointer; }
  .sn-row { margin-top:14px; }
  .sn-label { font-weight:600; font-size:14px; color:#222; margin-bottom:8px; display:block; }
  .sn-methods { display:flex; gap:12px; }
  .sn-option { flex:1; padding:12px; border-radius:12px; border:1px solid #e7eef0; text-align:center; cursor:pointer; user-select:none; background:#fff; transition:all 0.25s ease; font-weight:600; font-size:14px; }
  .sn-option:hover { border-color:#00996033; transform:scale(1.02); }
  .sn-option.selected { border-color:#009960; background:#f3fff6; box-shadow:0 6px 18px rgba(0,153,96,0.12); }
  .sn-actions { display:flex; gap:12px; margin-top:20px; }
  .sn-btn { flex:1; padding:12px; border-radius:12px; border:0; cursor:pointer; font-weight:700; font-size:14px; transition:all 0.25s ease; }
  .sn-btn.primary { background: #009960; color:#fff; box-shadow:0 4px 12px rgba(0,153,96,0.15); }
  .sn-btn.primary:hover { filter:brightness(1.05); }
  .sn-btn.ghost { background:#f2f4f3; color:#222; }
  .sn-foot { font-size:13px; color:#555; margin-top:14px; text-align:center; }
  #sn-deposit-qr { text-align:center; margin:16px 0; }
  #sn-deposit-address { width:100%; padding:12px; border-radius:10px; border:1px solid #ddd; font-size:14px; margin-top:6px; }
  #sn-copy-address { margin-top:8px; padding:10px; border-radius:10px; border:none; background:#009960; color:#fff; cursor:pointer; width:100%; font-weight:600; transition:all 0.25s ease; }
  #sn-copy-address:hover { filter:brightness(1.1); }
  #sn-deposit-amount { width:100%; padding:12px 16px; border-radius:10px; border:1px solid #ddd; font-size:14px; box-shadow:0 2px 6px rgba(0,0,0,0.05); }
  #sn-deposit-amount::placeholder { color:#aaa; }
  .sn-spinner { display:inline-block; width:36px; height:36px; border:3px solid #cce8de; border-top:3px solid #009960; border-radius:50%; animation:spin 1s linear infinite; margin:auto; }
  @keyframes spin { to { transform: rotate(360deg); } }
  `;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  // ---------- Inject Modal ----------
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
            <div class="sn-option selected" data-method="crypto">Crypto (USDT)</div>
            <div class="sn-option" data-method="paystack">Paystack (NGN)</div>
          </div>
        </div>

        <!-- Crypto Section -->
        <div class="sn-row" id="sn-deposit-crypto-wrap">
          <div id="sn-deposit-qr"></div>
          <input type="text" id="sn-deposit-address" readonly>
          <div style="margin-top:6px; font-size:13px; color:#555; text-align:center;">
            <b>Network:</b> USDT (TRC20)
          </div>
          <button id="sn-copy-address">Copy Address</button>
        </div>

        <!-- Paystack Section -->
        <div class="sn-row" id="sn-deposit-amount-wrap" style="display:none;">
          <label class="sn-label">Enter Amount (NGN)</label>
          <input id="sn-deposit-amount" type="number" min="0" step="any" placeholder="Amount in NGN">
        </div>

        <div class="sn-actions">
          <button class="sn-btn primary" id="sn-deposit-confirm">Continue</button>
          <button class="sn-btn ghost" id="sn-deposit-cancel">Cancel</button>
        </div>

        <div class="sn-foot">
          Crypto deposits use <b>USDT (TRC20)</b>.
        </div>
      </div>
    </div>`;
    document.body.insertAdjacentHTML("beforeend", depositHtml);
  }

  // ---------- Helpers ----------
  const qs = (sel, root=document) => root.querySelector(sel);
  const qsAll = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  const depositOverlay = qs("#sn-deposit-modal");
  const depositDialog = qs(".sn-modal", depositOverlay);
  const depositConfirm = qs("#sn-deposit-confirm");
  const depositCancel = qs("#sn-deposit-cancel");
  const depositClose = qs("#sn-deposit-close");
  const depositMethods = qs("#sn-deposit-methods");
  const depositAmountWrap = qs("#sn-deposit-amount-wrap");
  const depositCryptoWrap = qs("#sn-deposit-crypto-wrap");
  const depositAmount = qs("#sn-deposit-amount");
  const depositButtons = qsAll('[id="depositBtn"], [data-action="open-deposit"]');
  const withdrawButtons = qsAll('[id="withdrawBtn"], [data-action="open-withdraw"]');

  

  // ---------- Load Wallet Info ----------
  async function loadWalletInfo() {
    const qrContainer = qs("#sn-deposit-qr");
    const addressInput = qs("#sn-deposit-address");
    qrContainer.innerHTML = `<div class="sn-spinner"></div><p>Fetching wallet address...</p>`;

    try {
      const userId = localStorage.getItem("ui");
      const res = await fetch(`/api/users/wallet/${userId}`);
      const data = await res.json();

      if (!data.success || !data.walletAddress) {
        qrContainer.innerHTML = "<p style='color:red;'>⚠️ Wallet not found.</p>";
        return;
      }

      const walletAddress = data.walletAddress;
      addressInput.value = walletAddress;
      qrContainer.innerHTML = "";

      new QRCode(qrContainer, {
        text: walletAddress,
        width: 180,
        height: 180,
        colorDark: "#009960",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
      });

      qs("#sn-copy-address").onclick = () =>
        navigator.clipboard.writeText(walletAddress)
          .then(() => showToast("Wallet address copied!"));
    } catch (err) {
      console.error(err);
      qrContainer.innerHTML = "<p style='color:red;'>⚠️ Unable to fetch wallet address.</p>";
    }
  }

  // ---------- Open / Close ----------
  function openModal() {
    depositOverlay.classList.add("open");
    depositOverlay.setAttribute("aria-hidden","false");
    requestAnimationFrame(()=>depositDialog.classList.add("open"));
    loadWalletInfo();
  }
  function closeModal() {
    depositDialog.classList.remove("open");
    setTimeout(()=>{ depositOverlay.classList.remove("open"); depositOverlay.setAttribute("aria-hidden","true"); },300);
  }

  // ---------- Method Selection ----------
  qsAll(".sn-option", depositMethods).forEach(opt => {
    opt.addEventListener("click", () => {
      qsAll(".sn-option", depositMethods).forEach(o => o.classList.remove("selected"));
      opt.classList.add("selected");
      const method = opt.dataset.method;
      if (method === "crypto") {
        depositAmountWrap.style.display = "none";
        depositCryptoWrap.style.display = "block";
        loadWalletInfo();
      } else {
        depositAmountWrap.style.display = "block";
        depositCryptoWrap.style.display = "none";
      }
    });
  });

  // ---------- Open Modal ----------
  depositButtons.forEach(btn => btn.addEventListener("click", e => { e.preventDefault(); openModal(); }));

  // ---------- Withdraw ----------
  withdrawButtons.forEach(btn => btn.addEventListener("click", e => {
    e.preventDefault();
    window.location.href = "/withdraw.html?network=USDT";
  }));

  // ---------- Close Modal ----------
  depositCancel.addEventListener("click", closeModal);
  depositClose.addEventListener("click", closeModal);
  depositOverlay.addEventListener("click", e => { if (e.target === depositOverlay) closeModal(); });

  // ---------- Confirm Deposit ----------
  // ---------- Confirm Deposit ----------
depositConfirm.addEventListener("click", async () => {
  const selectedMethod = qs(".sn-option.selected", depositMethods)?.dataset.method;

  if (selectedMethod === "crypto") {
    showToast("Send USDT (TRC20) to your wallet address.");
    closeModal();
    return;
  }

  if (selectedMethod === "paystack") {
    const amount = parseFloat(depositAmount.value);
    if (!amount || amount <= 0) return showToast("Enter a valid amount.");
    
    // Show loading overlay inside modal
    const loadingOverlay = document.createElement("div");
    loadingOverlay.id = "sn-loading-overlay";
    loadingOverlay.style.cssText = `
      position:absolute; inset:0; background:rgba(255,255,255,0.8); display:flex; 
      justify-content:center; align-items:center; border-radius:16px; z-index:10;
    `;
    loadingOverlay.innerHTML = `<div class="sn-spinner" " style="width:50px;height:50px;border-width:4px;"></div>`;
    depositDialog.appendChild(loadingOverlay);

    const userId = localStorage.getItem("ui"); // now we use userId, not email

    try {
      const res = await fetch(`/api/deposit/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, amount })
      });

      const data = await res.json();
      if (data.success && data.paymentUrl) {
        document.getElementById('sn-loading-overlay').style.display = 'none'
        window.location.href = data.paymentUrl; // Redirect to Paystack
      } else {
        showToast(data.message || "⚠️ Failed to initialize Paystack payment.");
        loadingOverlay.remove(); // remove loading overlay
      }
    } catch (err) {
      console.error(err);
      showToast("⚠️ Error connecting to Paystack.");
      loadingOverlay.remove(); // remove loading overlay
    }
  }
});

  // ---------- ESC key ----------
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && depositOverlay.classList.contains("open")) closeModal();
  });
})();