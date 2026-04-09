function renderSubscription(){
  const root = document.querySelector('.subscription-page') || document.body;
  root.innerHTML = `<section class="panel"><h2>Subscription</h2><p>Details coming soon. This is a placeholder page.</p></section>`;
}
document.addEventListener('DOMContentLoaded', renderSubscription);
