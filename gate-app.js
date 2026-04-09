async function applyGating() {
  try {
    const r = await fetch('/api/state');
    const data = await r.json();
    const paid = !!data?.hasPaid;
    const path = window.location.pathname;
    const bannerId = 'gate-banner';
    function showBanner(text) {
      let b = document.getElementById(bannerId);
      if (!b) {
        b = document.createElement('div');
        b.id = bannerId;
        b.style.position = 'fixed';
        b.style.top = '0';
        b.style.left = '0';
        b.style.right = '0';
        b.style.background = '#ffeb3b';
        b.style.color = '#000';
        b.style.padding = '0.5rem 1rem';
        b.style.zIndex = '9999';
        b.style.textAlign = 'center';
        document.body.appendChild(b);
      }
      b.textContent = text;
    }
    // Gate for submitting results
    if (path.includes('/submit') || path.includes('/dashboard.html?page=submit')) {
      if (!paid) {
        showBanner('Payment required to submit results.');
        // Disable all form controls on the page
        document.querySelectorAll('input, button, select, textarea').forEach((el) => {
          if (el && typeof el.disabled !== 'undefined') el.disabled = true;
        });
      }
    }
    // Gate for chat
    if (path.includes('/chat')) {
      if (!paid) {
        showBanner('Chat is available to paid members only.');
        document.querySelectorAll('#chatBox input, #chatBox button, #chatBox textarea').forEach((el)=>{ if (el) el.disabled = true; });
      }
    }
  } catch (e) {
    // silent
  }
}
window.addEventListener('DOMContentLoaded', applyGating);
