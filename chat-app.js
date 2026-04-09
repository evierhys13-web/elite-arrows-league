async function renderChat(){
  // Simple static chat placeholder using state
  const container = document.getElementById('chatBox');
  if (!container) return;
  try {
    const res = await fetch('/api/state');
    const s = await res.json();
    const lines = (s?.chats || []).slice(-20);
    container.innerHTML = lines.map(l => `<div>${l.user ?? 'User'}: ${l.message ?? ''}</div>`).join('') || '<div>No messages yet</div>';
  } catch {
    container.innerHTML = '<div>No messages yet</div>';
  }
}
document.addEventListener('DOMContentLoaded', renderChat);
