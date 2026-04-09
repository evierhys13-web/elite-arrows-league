// Client-side Settings page wiring: render sections for Profile, Theme, Language, Chat, Sign Out
function renderSettings() {
  const container = document.getElementById('settingsContainer');
  if (!container) return;
  container.innerHTML = `
    <section class="panel">
      <h2>Profile Settings</h2>
      <form id="settingsProfileForm" class="stack-form">
        <div class="profile-photo-edit">
          <div class="profile-avatar-large" id="settingsProfileAvatar">
            <img id="settingsProfileImg" src="" alt="Profile Picture">
            <span id="settingsProfileInitial" class="avatar-initial"></span>
          </div>
          <label class="photo-upload-btn">
            Change Photo
            <input type="file" id="settingsProfilePictureInput" accept="image/*" hidden>
          </label>
        </div>
        <label>Username<input name="profileUsername" type="text" maxlength="30" required></label>
        <label>Bio<textarea name="profileBio" rows="4"></textarea></label>
        <label>DartCounter link<input name="profileDartCounterLink" type="url"></label>
        <label>3-dart average<input name="profileThreeDartAverage" type="number" step="0.01" min="0" max="150"></label>
        <button class="primary-button" type="submit">Save Changes</button>
      </form>
    </section>
    <section class="panel">
      <h2>Appearance</h2>
      <div class="settings-item">
        Theme
        <div style="margin-left:auto; display:flex; gap:.5rem; align-items:center;">
          <span>Light</span>
          <input id="themeToggle" type="checkbox" />
          <span>Dark</span>
        </div>
      </div>
      <div class="settings-item">Language: English</div>
      <div class="settings-item">Chat Settings</div>
      <button class="ghost-button" id="logoutButtonSettings" type="button">Sign Out</button>
    </section>`;
  // Hook up photo chooser and save
  const input = document.getElementById('settingsProfilePictureInput');
  input?.addEventListener('change', (e)=>{
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev)=>{ const img = document.getElementById('settingsProfileImg'); if(img) img.src = ev.target?.result; };
    reader.readAsDataURL(file);
  });
  const form = document.getElementById('settingsProfileForm');
  form?.addEventListener('submit', async (evt)=>{ evt.preventDefault(); try {
    const f = new FormData(form);
    await fetch('/api/profile', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ profileUsername: f.get('profileUsername'), profileBio: f.get('profileBio'), profileDartCounterLink: f.get('profileDartCounterLink'), profileThreeDartAverage: f.get('profileThreeDartAverage') })});
    alert('Settings saved');
  } catch { alert('Error saving settings'); } });
  document.getElementById('logoutButtonSettings')?.addEventListener('click', ()=>{ window.location.href = '/index.html'; });
}

document.addEventListener('DOMContentLoaded', renderSettings);
