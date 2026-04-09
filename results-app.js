async function renderResults(){
  try {
    const res = await fetch('/api/state');
    const state = await res.json();
    const list = document.getElementById('resultsList');
    if (!list) return;
    const matches = state?.matches || [];
    list.innerHTML = matches.slice(0, 10).map(m => {
      const a = state?.players.find(p => p.id === m.playerOneId) || { username: 'Unknown' };
      const b = state?.players.find(p => p.id === m.playerTwoId) || { username: 'Unknown' };
      return `<div class="result-card"><strong>${a.username}</strong> vs <strong>${b.username}</strong> — ${m.playerOneScore||0}:${m.playerTwoScore||0} on ${m.scheduledDate || ''}</div>`;
    }).join('');
  } catch(e){ console.error(e); }
}
document.addEventListener('DOMContentLoaded', renderResults);
