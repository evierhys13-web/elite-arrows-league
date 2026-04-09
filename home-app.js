// Minimal Home page data wiring using existing data file
async function renderHome() {
  try {
    const res = await fetch('/api/state');
    const data = await res.json();
    const homeProfileName = document.getElementById('homeProfileName');
    const homeProfileRating = document.getElementById('homeProfileRating');
    const homeSeasonOverview = document.getElementById('homeSeasonOverview');
    const homeSeasonMetrics = document.getElementById('homeSeasonMetrics');
    // pick first player as current for demo if none in state
    const user = (data?.players?.[0]) || { username: 'Guest', threeDartAverage: null };
    if (homeProfileName) homeProfileName.textContent = user.username;
    // Lightweight rating display; if you have a rating field, use it; otherwise fallback
    const rating = user.rating || 1200;
    if (homeProfileRating) homeProfileRating.textContent = 'Rating: ' + rating;
    if (homeSeasonOverview) homeSeasonOverview.textContent = 'Season: ' + (data?.seasons?.[0]?.name || '2026 Season');
    if (homeSeasonMetrics) homeSeasonMetrics.textContent = 'Season progress coming soon';
  } catch (e) {
    console.warn('Home data load failed', e);
  }
}

document.addEventListener('DOMContentLoaded', renderHome);
