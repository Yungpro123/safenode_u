// ==========================
// 🟢 SafeNode Toast Function
// ==========================

function showToast(message, type = "success") {
  // Create toast container if it doesn't exist
  let container = document.getElementById("toastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    document.body.appendChild(container);

    // Add basic styles
    const style = document.createElement("style");
    style.innerHTML = `
      #toastContainer {
        position: fixed;
        top: 15px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 999999;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        width: 100%;
        max-width: 400px;
        pointer-events: none;
      }

      .toast {
        pointer-events: auto;
        color: #fff;
        padding: 14px 20px;
        border-radius: 12px;
        font-weight: 600;
        font-size: 14px;
        text-align: center;
        min-width: 240px;
        opacity: 0;
        transform: translateY(-20px);
        transition: all 0.4s ease;
        
      }

      .toast.show {
        opacity: 1;
        transform: translateY(0);
      }

      .toast.success {
        background: #00a86b;
        
      }

      .toast.error {
        background: #b91c1c;
        
      }

      .toast.info {
        background: #1d4ed8;
        
      }
    `;
    document.head.appendChild(style);
  }

  // Create the toast element
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  // Show animation
  setTimeout(() => toast.classList.add("show"), 100);

  // Auto remove after 4 seconds
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}