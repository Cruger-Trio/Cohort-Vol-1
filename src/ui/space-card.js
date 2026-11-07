const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

export function spaceCard({ href, title, type, detail, action = 'Open space', index = 0 }) {
  return `<a class="cohort-space-card" href="${esc(href)}"><span class="cohort-space-art tone-${index % 4}" aria-hidden="true"><span>✳</span><small>COHORT / MEMBER SPACE</small></span><span class="cohort-space-content"><span class="cohort-space-type">${esc(type || 'Community')}</span><strong>${esc(title || 'Member space')}</strong><span class="cohort-space-detail">${esc(detail)}</span><span class="cohort-space-action">${esc(action)} <span aria-hidden="true">↗</span></span></span></a>`;
}
