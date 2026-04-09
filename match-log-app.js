async function renderMatches(){
  try {
    const resp = await fetch('/api/state');
    const state = await resp.json();
    const list = document.getElementById('matchCards');
    if (!list) return;
    const m = (state?.matches || []).slice(0, 20);
    list.innerHTML = m.map(match => {
      const p1 = state?.players.find(p => p.id === match.playerOneId) || { username: 'Player1' };
      const p2 = state?.players.find(p => p.id === match.playerTwoId) || { username: 'Player2' };
      return `<div class="result-card"><strong>${p1.username}</strong> vs <strong>${p2.username}</strong> - ${match.playerOneScore||0} : ${match.playerTwoScore||0} on ${match.scheduledDate || ''}</div>`;
    }).join('');
  } catch(e){ console.error(e); }
}
document.addEventListener('DOMContentLoaded', renderMatches);
