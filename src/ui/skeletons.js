const card = () => `<div class="skeleton-card" aria-hidden="true"><div class="skeleton-shape skeleton-cover"></div><div class="skeleton-card-body"><div class="skeleton-shape skeleton-avatar"></div><div class="skeleton-shape skeleton-line short"></div><div class="skeleton-shape skeleton-line title"></div><div class="skeleton-shape skeleton-line medium"></div><div class="skeleton-shape skeleton-line footer"></div></div></div>`;

export function skeletonCards(label = 'Loading offers', count = 4) {
  return `<div class="cohort-loading" role="status" aria-live="polite" aria-busy="true"><span class="sr-only">${label}…</span><div class="cohort-grid skeleton-grid">${Array.from({ length: count }, card).join('')}</div></div>`;
}

export function skeletonFeed() {
  return `<div class="cohort-loading skeleton-feed" role="status" aria-live="polite" aria-busy="true"><span class="sr-only">Loading conversation…</span>${Array.from({length: 2}, () => `<div class="skeleton-post" aria-hidden="true"><div class="skeleton-post-head"><span class="skeleton-shape skeleton-avatar"></span><span class="skeleton-shape skeleton-line short"></span></div><span class="skeleton-shape skeleton-line title"></span><span class="skeleton-shape skeleton-line medium"></span><span class="skeleton-shape skeleton-line short"></span></div>`).join('')}</div>`;
}

export function skeletonInbox() {
  return `<div class="cohort-loading skeleton-inbox" role="status" aria-live="polite" aria-busy="true"><span class="sr-only">Loading your inbox…</span><aside aria-hidden="true">${Array.from({length: 5}, () => `<div class="skeleton-thread"><span class="skeleton-shape skeleton-avatar"></span><span class="skeleton-shape skeleton-line medium"></span></div>`).join('')}</aside><div class="skeleton-inbox-content" aria-hidden="true"><span class="skeleton-shape skeleton-line short"></span><span class="skeleton-shape skeleton-message"></span><span class="skeleton-shape skeleton-message own"></span><span class="skeleton-shape skeleton-message"></span></div></div>`;
}

export function skeletonWorkspace() {
  return `<div class="workspace-loading" role="status" aria-live="polite" aria-busy="true"><span class="sr-only">Loading your workspace…</span><div class="workspace-loading-nav" aria-hidden="true"><span class="skeleton-shape skeleton-line medium"></span>${Array.from({length: 6}, () => `<span class="skeleton-shape skeleton-line title"></span>`).join('')}</div><div class="workspace-loading-main" aria-hidden="true"><span class="skeleton-shape skeleton-line short"></span><span class="skeleton-shape skeleton-heading"></span><span class="skeleton-shape skeleton-line medium"></span><div class="cohort-grid skeleton-grid">${Array.from({length: 3}, card).join('')}</div></div></div>`;
}

export function skeletonOffer() {
  return `<div class="container page"><div class="offer-skeleton cohort-loading" role="status" aria-live="polite" aria-busy="true"><span class="sr-only">Loading this offer…</span><div class="skeleton-shape offer-skeleton-cover" aria-hidden="true"></div><div class="offer-skeleton-details" aria-hidden="true"><span class="skeleton-shape skeleton-line short"></span><span class="skeleton-shape skeleton-heading"></span><span class="skeleton-shape skeleton-line title"></span><span class="skeleton-shape skeleton-line medium"></span><span class="skeleton-shape skeleton-message"></span></div></div></div>`;
}
