document.addEventListener("DOMContentLoaded", async () => {
  const walletTxContainer = document.querySelector(".transactions");
  const userId = localStorage.getItem("ui");

  if (!userId) {
    walletTxContainer.innerHTML = `<p style="color:red;">User not logged in.</p>`;
    return;
  }

  try {
    walletTxContainer.innerHTML = `<p style="color:#00a86b;font-weight:600">Fetching transactions...</p>`;

    const response = await fetch("/api/dashboard/transactions", {
      headers: { userid: userId },
    });

    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } 
    catch (err) { 
      console.error("Invalid JSON response:", text); 
      walletTxContainer.innerHTML = `<p style="color:red;">Error loading transactions.</p>`; 
      return; 
    }

    if (!data.success) {
      walletTxContainer.innerHTML = `<p style="color:red;">${data.message || "Unable to fetch transactions."}</p>`;
      return;
    }

    const transactions = data.transactions || [];
    if (transactions.length === 0) {
      walletTxContainer.innerHTML = `
        <h3 style="margin-top:18px;color:var(--primary)">Transaction History</h3>
        <p>No transactions yet.</p>
      `;
      return;
    }

    // ---------- Format Transactions ----------
    const formatTransaction = (tx) => {
      const amount = Number(tx.amount) || 0;
      const currency = tx.currency || "NGN";
      const formattedAmount = currency === "NGN"
        ? `₦${amount.toLocaleString()}`
        : `${amount.toFixed(2)} ${currency}`;

      const formattedDate = tx.createdAt
        ? new Date(tx.createdAt).toLocaleDateString()
        : "Unknown Date";

      const isSuccessful = tx.status === "success";

      const title = tx.type === "fee" ? "Transaction Fee"
                  : tx.type === "payment" ? "Payment Transaction"
                  : tx.type === "release" ? "Released Funds"
                  : tx.type === "withdraw" ? "Withdrawal"
                  : tx.type === "deposit" ? (isSuccessful ? "Deposit" : "Deposit")
                  : tx.type === "refund" ? "Refund Received"
                  : "Transaction";

      const isNegative = ["withdraw", "fee", "payment"].includes(tx.type);
      const sign = isNegative ? "-" : isSuccessful ? "+" : "";
      const color = isNegative ? "#e74c3c" : isSuccessful ? "#00a86b" : "#00a86b"; // orange for pending

      return `
        <div class="tx-card" data-type="${tx.type}" data-date="${tx.createdAt}" data-amount="${amount}" 
             style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-radius:12px;margin-bottom:8px;box-shadow:0 2px 6px rgba(0,0,0,0.05);background:#fff;">
          <div>
            <div class="tx-title" style="font-weight:600;color:#333;font-size:15px;">${title}</div>
            <div class="tx-meta" style="font-size:12px;color:#555;">${formattedDate}</div>
          </div>
          <div class="tx-amount" style="font-weight:600;color:${color};font-size:14px;">${sign}${formattedAmount}</div>
        </div>
      `;
    };

    // ---------- Show First 5 Transactions ----------
    const previewTx = transactions.slice(0, 5).map(formatTransaction).join("");
    walletTxContainer.innerHTML = `
      <h3 style="margin-top:18px;color:var(--primary)">Transaction History</h3>
      <div class="tx-list">${previewTx}</div>
      ${transactions.length > 5 ? `<button id="view-all-tx" style="margin-top:12px;padding:10px 16px;border:none;border-radius:8px;background:#00a86b;color:#fff;cursor:pointer;font-weight:600;box-shadow:0 3px 8px rgba(0,168,96,0.2);transition:all 0.2s;">View All</button>` : ""}
    `;

    // ---------- View All Modal ----------
    if (transactions.length > 5) {
      const viewAllBtn = document.getElementById("view-all-tx");

      viewAllBtn.addEventListener("click", () => {
        let slide = document.getElementById("tx-slide");
        if (!slide) {
          slide = document.createElement("div");
          slide.id = "tx-slide";
          slide.style.cssText = `
            position:fixed; inset:0; background:rgba(0,0,0,0.45); display:flex; justify-content:center; align-items:flex-end; z-index:9999;overflow-y:visible;
          `;

          const uniqueTypes = [...new Set(transactions.map(tx => tx.type))];
          const controlsHTML = `
            <div style="position:sticky; top:0; z-index:10; padding:16px 0; border-bottom:1px solid #ddd; box-shadow:0 2px 4px rgba(0,0,0,0.05); margin-bottom:12px; display:flex; flex-wrap:wrap; gap:8px;">
              <select id="tx-filter" style="flex:1;min-width:140px;padding:8px 10px;border-radius:8px;border:1px solid #00a86b;background:#00a86b;color:white;font-weight:600;font-size:14px;">
                <option value="all">All Types</option>
                ${uniqueTypes.map(type => `<option value="${type}">${type.charAt(0).toUpperCase() + type.slice(1)}</option>`).join("")}
              </select>

              <select id="tx-sort" style="flex:1;min-width:140px;padding:8px 10px;border-radius:8px;border:1px solid #00a86b;background:white;color:#00a86b;font-weight:600;font-size:14px;">
                <option value="date-desc">Sort</option>
                <option value="date-asc">Date</option>
                <option value="amount-desc">Amount</option>
                <option value="amount-asc">Amount Asc</option>
              </select>
            </div>
          `;

          slide.innerHTML = `
            <div style="width:100%; max-width:480px; max-height:85%; background:#f9f9f9; border-radius:16px 16px 0 0; overflow-y:auto; padding:20px; transform:translateY(100%); transition:transform 0.35s ease;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                <h3 style="margin:0;font-size:18px;font-weight:700;color:#333;">All Transactions</h3>
                <button id="close-slide" style="background:none;border:none;font-size:22px;cursor:pointer;color:#333;">✕</button>
              </div>
              ${controlsHTML}
              <div class="tx-list-full">${transactions.map(formatTransaction).join("")}</div>
            </div>
          `;

          document.body.appendChild(slide);
          requestAnimationFrame(() => slide.firstElementChild.style.transform = "translateY(0%)");

          // Close handlers
          slide.querySelector("#close-slide").addEventListener("click", () => {
            slide.firstElementChild.style.transform = "translateY(100%)";
            setTimeout(() => slide.remove(), 350);
          });
          slide.addEventListener("click", (e) => {
            if (e.target === slide) {
              slide.firstElementChild.style.transform = "translateY(100%)";
              setTimeout(() => slide.remove(), 350);
            }
          });

          // Filter & Sort
          const filterType = slide.querySelector("#tx-filter");
          const txSort = slide.querySelector("#tx-sort");
          const txListFull = slide.querySelector(".tx-list-full");

          const applyFilterSort = () => {
            const typeVal = filterType.value;
            const sortVal = txSort.value;

            let filtered = transactions.filter(tx => typeVal === "all" || tx.type === typeVal);

            filtered.sort((a, b) => {
              if (sortVal === "date-desc") return new Date(b.createdAt) - new Date(a.createdAt);
              if (sortVal === "date-asc") return new Date(a.createdAt) - new Date(b.createdAt);
              if (sortVal === "amount-desc") return Number(b.amount) - Number(a.amount);
              if (sortVal === "amount-asc") return Number(a.amount) - Number(b.amount);
              return 0;
            });

            txListFull.innerHTML = filtered.map(formatTransaction).join("") || `<p style="color:#555;">No transactions found.</p>`;
          };

          [filterType, txSort].forEach(el => el.addEventListener("change", applyFilterSort));
        }
      });
    }

  } catch (err) {
    console.error("Error fetching transactions:", err);
    walletTxContainer.innerHTML = `<p style="color:red;">Server error fetching transactions.</p>`;
  }
});