async function renderPlayers(){
  try {
    const res = await fetch('/api/state');
    const s = await res.json();
    const list = document.getElementById('profilesByDivision') || document.getElementById('divisionTables');
    if (!list) return;
    const players = s?.players ?? [];
    list.innerHTML = players.map(p => `<div class="player-card">${p.username ?? 'Player'} - ${p.divisionId ?? ''}</div>`).join('');
  } catch(e){ console.error(e); }
}
document.addEventListener('DOMContentLoaded', renderPlayers);
