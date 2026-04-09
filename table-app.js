async function renderTable(){
  try {
    const r = await fetch('/api/state');
    const state = await r.json();
    const body = document.getElementById('overallStandingsBody');
    if (!body) return;
    body.innerHTML = '';
    // Build standings from players and matches if possible
    const players = (state?.players || []);
    const matches = (state?.matches || []);
    const standings = players.map(p => {
      const pid = p.id;
      const related = matches.filter(m => m.playerOneId === pid || m.playerTwoId === pid);
      const played = related.length;
      let wins = 0;
      related.forEach(m => {
        if (m.playerOneId === pid && (m.playerOneScore > (m.playerTwoScore||0))) wins++;
        if (m.playerTwoId === pid && (m.playerTwoScore > (m.playerOneScore||0))) wins++;
      });
      const pts = wins * 3;
      const divisionName = state?.divisions?.find(d => d.id === p.divisionId)?.name || '';
      return { id: pid, username: p.username ?? p.name ?? 'Player', divisionName, played, wins, pts };
    }).sort((a,b)=>b.pts-a.pts || b.wins-a.wins);
    standings.forEach((s, idx)=>{
      body.innerHTML += `<tr><td>${idx+1}</td><td>${s.username}</td><td>${s.divisionName}</td><td>${s.played}</td><td>${s.wins}</td><td>0</td><td>${(s.played - s.wins)}</td><td>0</td><td>${s.pts}</td></tr>`;
    });
  } catch(e){ console.error(e); }
}
document.addEventListener('DOMContentLoaded', renderTable);
