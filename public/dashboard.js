<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Dispute Chat — SafeNode</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --me-bg: #00a86b;
      --me-text: #fff;
      --them-bg: #f3f7f5;
      --them-text: #0b2540;
      --admin-bg: #2563eb;
      --admin-text: #fff;
      --bg: #f6fbf8;
      --muted: #6b7280;
    }
    body { font-family: Inter, system-ui; background: var(--bg); margin:0; padding:20px; color:#0b2540; }
    .wrap{max-width:980px;margin:18px auto;background:#fff;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.06);overflow:hidden}
    .top{display:flex;gap:16px;padding:18px;border-bottom:1px solid #eee;align-items:center}
    .contract-summary{flex:1}
    .contract-summary h3{margin:0;color:#0b2540;font-weight:700}
    .contract-summary p{margin:6px 0;color:var(--muted)}
    .status{font-weight:700;padding:6px 10px;border-radius:999px;background:#eefaf2;color:#00a86b}
    .chat{display:flex;flex-direction:column;height:65vh}
    .messages{flex:1;padding:18px;overflow:auto;display:flex;flex-direction:column;gap:12px;background:linear-gradient(180deg,#fbfff9,#ffffff)}
    .msg{max-width:78%;padding:12px;border-radius:12px;box-shadow:0 4px 12px rgba(10,20,30,0.04);word-wrap:break-word}
    .me{align-self:flex-end;background:var(--me-bg);color:var(--me-text);border-bottom-right-radius:4px}
    .them{align-self:flex-start;background:var(--them-bg);color:var(--them-text);border-bottom-left-radius:4px}
    .admin{align-self:center;background:var(--admin-bg);color:var(--admin-text);border-radius:10px}
    .meta{font-size:12px;color:var(--muted);margin-top:6px}
    .input-row{display:flex;gap:10px;padding:12px;border-top:1px solid #eee;align-items:center;background:#fff}
    textarea{flex:1;padding:10px;border-radius:10px;border:1px solid #e6eef0;min-height:48px;resize:none;font-size:14px}
    .file-preview{max-width:220px;border-radius:10px;border:1px solid #ddd;margin-top:8px}
    .attach { background:#e6eef0;color:#0b2540;border-radius:10px;padding:8px 10px;border:none;cursor:pointer }
    button.send { background:#00a86b;color:white;border:none;padding:10px 14px;border-radius:10px;font-weight:600;cursor:pointer }
    .small{font-size:13px;color:#9aa6a0}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="top">
      <div class="contract-summary">
        <h3 id="contractTitle">Loading contract…</h3>
        <p id="contractDesc" class="small"></p>
        <div style="display:flex;gap:8px;margin-top:8px;align-items:center">
          <div class="status" id="contractStatus">—</div>
          <div class="small" id="contractAmount"></div>
        </div>
      </div>
      <div style="text-align:right">
        <div class="small">Dispute reason</div>
        <div id="disputeReason" style="font-weight:600"></div>
      </div>
    </div>

    <div class="chat">
      <div class="messages" id="messages"></div>

      <div class="input-row">
        <textarea id="messageInput" placeholder="Type your message…"></textarea>
        <input id="fileInput" type="file" accept="image/*" style="display:none" />
        <button class="attach" id="attachBtn">📎</button>
        <button class="send" id="sendBtn">Send</button>
      </div>
      <div style="padding:0 18px 18px;">
        <img id="previewImage" class="file-preview" style="display:none" />
      </div>
    </div>
  </div>

  <script>
    (function(){
      const params = new URLSearchParams(window.location.search);
      const contractId = params.get('contract');
      const messagesEl = document.getElementById('messages');
      const sendBtn = document.getElementById('sendBtn');
      const msgInput = document.getElementById('messageInput');
      const attachBtn = document.getElementById('attachBtn');
      const fileInput = document.getElementById('fileInput');
      const previewImage = document.getElementById('previewImage');

      let disputeId = null;
      let lastMsgCount = 0;
      let attachedFile = null;

      // helper: create bubble for message
      function makeMessageEl(m) {
        const el = document.createElement('div');
        const role = (m.senderRole || '').toLowerCase();
        if (role === 'admin' || role === 'moderator' || role === 'system') {
          el.className = 'msg admin';
        } else {
          // decide if it's me (local) or other
          const meEmail = localStorage.getItem('userEmail');
          const isMe = meEmail && m.senderEmail && meEmail === m.senderEmail;
          el.className = 'msg ' + (isMe ? 'me' : 'them');
        }

        let inner = `<div>${escapeHtml(m.body || m.message || '')}</div>`;
        if (m.fileUrl) {
          inner += `<div style="margin-top:8px"><a target="_blank" href="${m.fileUrl}"><img src="${m.fileUrl}" style="max-width:220px;border-radius:8px;border:1px solid #eee"/></a></div>`;
        }
        inner += `<div class="meta">${escapeHtml((m.senderRole||'').toString())} • ${new Date(m.createdAt||m.timestamp||m.createdAt).toLocaleString()}</div>`;
        el.innerHTML = inner;
        return el;
      }

      function renderMessages(arr) {
        messagesEl.innerHTML = '';
        arr.forEach(m => messagesEl.appendChild(makeMessageEl(m)));
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }
      function appendMessage(m) {
        messagesEl.appendChild(makeMessageEl(m));
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }
      function escapeHtml(s=''){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

      // Attach file
      attachBtn.addEventListener('click', ()=> fileInput.click());
      fileInput.addEventListener('change', ()=> {
        attachedFile = fileInput.files[0] || null;
        if (attachedFile) {
          const url = URL.createObjectURL(attachedFile);
          previewImage.src = url; previewImage.style.display = '';
        } else {
          previewImage.style.display = 'none';
        }
      });

      // load contract then dispute
      async function loadContractAndEnsureDispute() {
        if (!contractId) {
          document.getElementById('contractTitle').textContent = 'Contract #null';
          return;
        }

        // fetch contract (so we can use title/currency)
        let contract = null;
        try {
          const cres = await fetch(`/api/contracts/${contractId}`, { credentials: 'include' });
          const cjson = await cres.json();
          if (cres.ok && cjson.data) contract = cjson.data;
        } catch (e) { /* ignore */ }

        if (contract) {
          document.getElementById('contractTitle').textContent = contract.title || 'Contract';
          document.getElementById('contractDesc').textContent = contract.description || '';
          document.getElementById('contractStatus').textContent = (contract.status || '').toUpperCase() || '—';
          document.getElementById('contractAmount').textContent = `${contract.currency || 'NGN'} ${contract.amount || 0}`;
        }

        // Try find dispute by contract (backend must implement /api/disputes/by-contract/:contractId)
        try {
          const findRes = await fetch(`/api/disputes/by-contract/${contractId}`, { credentials: 'include' });
          const findJson = await findRes.json();
          if (findRes.ok && findJson.data) {
            disputeId = findJson.data._id;
            document.getElementById('disputeReason').textContent = findJson.data.reason || (contract && contract.title) || '—';
            renderMessages(findJson.data.messages || []);
            lastMsgCount = (findJson.data.messages||[]).length;
          } else {
            // create dispute automatically: backend uses contract title as dispute reason/title
            const createPayload = {
              contractId,
              reason: contract?.title || 'Dispute for contract',
              initialMessage: `Dispute created for contract ${contract?.title || contractId}`
            };
            const createRes = await fetch('/api/disputes/create', {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(createPayload)
            });
            const createJson = await createRes.json();
            if (!createRes.ok) throw new Error(createJson.message || 'Failed creating dispute');
            disputeId = createJson.data._id;
            document.getElementById('disputeReason').textContent = createJson.data.reason || (contract && contract.title) || '—';
            renderMessages(createJson.data.messages || []);
            lastMsgCount = (createJson.data.messages||[]).length;
          }

          // start polling after dispute loaded
          setInterval(pollMessages, 2500);
        } catch (err) {
          console.error('Failed to find/create dispute:', err);
        }
      }

      // polling
      async function pollMessages(){
        if (!disputeId) return;
        try {
          const res = await fetch(`/api/disputes/${disputeId}/messages`, { credentials: 'include' });
          const json = await res.json();
          if (res.ok && json.data) {
            if ((json.data || []).length !== lastMsgCount) {
              renderMessages(json.data || []);
              lastMsgCount = (json.data||[]).length;
            }
          }
        } catch (e) { console.error('poll err', e); }
      }

      // Send message (with optional file)
      sendBtn.addEventListener('click', async () => {
        const text = msgInput.value.trim();
        if (!text && !attachedFile) return;
        if (!disputeId) { alert('Dispute not ready'); return; }

        try {
          const form = new FormData();
          if (text) form.append('message', text);
          if (attachedFile) form.append('evidence', attachedFile);

          const res = await fetch(`/api/disputes/${disputeId}/reply`, {
            method: 'POST',
            credentials: 'include',
            body: form
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.message || 'Failed to send');

          // append optimistic
          appendMessage({
            senderEmail: localStorage.getItem('userEmail') || 'you',
            senderRole: 'you',
            body: text,
            fileUrl: json.data?.uploadedFileUrl || (attachedFile ? URL.createObjectURL(attachedFile) : null),
            createdAt: new Date().toISOString()
          });

          // reset
          msgInput.value = '';
          attachedFile = null;
          fileInput.value = '';
          previewImage.style.display = 'none';
        } catch (err) {
          alert('Send failed: ' + err.message);
        }
      });

      // start
      loadContractAndEnsureDispute();
    })();
  </script>
</body>
</html>