async function loadProfile() {
  try {
    const res = await fetch('/api/profile');
    if (!res.ok) throw new Error('Not authenticated');
    const user = await res.json();
    const form = document.querySelector('#profileForm');
    if (!form) return;
    // Prefill
    const usernameInput = form.querySelector('[name="profileUsername"]');
    const bioInput = form.querySelector('[name="profileBio"]');
    const linkInput = form.querySelector('[name="profileDartCounterLink"]');
    const avgInput = form.querySelector('[name="profileThreeDartAverage"]');
    if (usernameInput) usernameInput.value = user.username || '';
    if (bioInput) bioInput.value = user.bio || '';
    if (linkInput) linkInput.value = user.dartCounterLink || '';
    if (avgInput) avgInput.value = user.threeDartAverage != null ? Number(user.threeDartAverage) : '';
  } catch (e) {
    console.error('Could not load profile', e);
  }
}

async function saveProfile(event) {
  event.preventDefault();
  const form = event.target.closest('form');
  const payload = {
    profileUsername: form.querySelector('[name="profileUsername"]').value,
    profileBio: form.querySelector('[name="profileBio"]').value,
    profileDartCounterLink: form.querySelector('[name="profileDartCounterLink"]').value,
    profileThreeDartAverage: form.querySelector('[name="profileThreeDartAverage"]').value
  };
  const res = await fetch('/api/profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (res.ok) {
    alert('Profile updated');
  } else {
    const err = await res.json();
    alert('Error: ' + (err?.error || 'failed to save'));
  }
}

document.addEventListener('DOMContentLoaded', loadProfile);
const profileForm = document.querySelector('#profileForm');
if (profileForm) profileForm.addEventListener('submit', saveProfile);
