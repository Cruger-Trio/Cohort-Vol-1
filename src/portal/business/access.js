import { workspace } from '../../data/workspace.js';

const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char]));
const dateLabel = value => value ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

export function businessAccess(business) {
  const products = (business.products || []).filter(product => product.status !== 'archived');
  const codes = workspace.accessCodes || [];
  const rows = codes.length ? codes.map(code => {
    const disabled = !!code.disabled_at;
    const spent = Number(code.redemption_count || 0) >= Number(code.max_redemptions || 1);
    const status = disabled ? 'Revoked' : spent ? 'Fully used' : code.expires_at && new Date(code.expires_at) < new Date() ? 'Expired' : 'Ready';
    return `<article class="access-code-row"><span class="access-code-symbol" aria-hidden="true">⌘</span><div class="access-code-detail"><b>${escapeHTML(code.label)}</b><span>${escapeHTML(code.products?.name || 'Product')} · ${escapeHTML(code.code_hint)}</span><small>${Number(code.redemption_count || 0)} of ${Number(code.max_redemptions || 1)} uses${code.access_days ? ` · ${Number(code.access_days)} days’ access` : ' · No expiry'}</small></div><span class="access-code-status ${status==='Ready'?'is-ready':''}">${status}</span>${!disabled && !spent ? `<button type="button" class="portal-action" data-access-code-disable="${escapeHTML(code.id)}">Revoke</button>` : ''}</article>`;
  }).join('') : `<div class="portal-empty-state access-empty"><span>⌘</span><b>No access codes yet</b><p>Create a private code for a beta group, collaborator, scholarship, or customer support case.</p></div>`;

  return `${accessHeading()}<div class="access-layout"><section class="portal-panel access-create-panel"><div class="access-panel-heading"><span class="access-panel-icon">＋</span><div><h2>Create an access code</h2><p>Give someone a direct path into one of your Cohort offers. Codes can be limited and revoked.</p></div></div><form id="access-code-form"><label class="form-field"><span>Product or membership</span><select name="product_id" required>${products.map(product => `<option value="${escapeHTML(product.id)}">${escapeHTML(product.name)}${product.status==='visible'?' · Published':' · Draft'}</option>`).join('')}</select></label><label class="form-field"><span>Internal label</span><input name="label" maxlength="80" placeholder="e.g. Beta group, scholarship cohort"></label><div class="access-form-grid"><label class="form-field"><span>Number of people</span><select name="max_redemptions"><option value="1">One use</option><option value="5">5 uses</option><option value="10">10 uses</option><option value="25">25 uses</option><option value="100">100 uses</option></select></label><label class="form-field"><span>Access duration</span><select name="access_days"><option value="">No expiry</option><option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option><option value="365">1 year</option></select></label></div><button class="button button-primary" type="submit" ${products.length?'':'disabled'}>Generate private code <span aria-hidden="true">↗</span></button><p class="access-form-status" id="access-code-status" role="status"></p></form><div class="access-safety-note"><span aria-hidden="true">i</span><p>Each code is random and can be redeemed by signed-in Cohort users. The raw code is shown only once; Cohort stores a one-way digest.</p></div></section><section class="portal-panel access-list-panel"><div class="access-panel-heading"><span class="access-panel-icon">⌁</span><div><h2>Codes you’ve created</h2><p>See usage and revoke codes that should stop working.</p></div><span class="access-count">${codes.length}</span></div><div class="access-code-list" id="access-code-list">${rows}</div></section></div>`;
}

function accessHeading() {
  return `<div class="portal-page-heading business-heading"><div><span class="portal-kicker">PRODUCT DELIVERY</span><h1>Access</h1><p>Invite beta users, collaborators, or customers into a product without losing track of who can get in.</p></div><a class="portal-action" href="#business/customers">View members →</a></div>`;
}

export function accessCodeRows() {
  const codes = workspace.accessCodes || [];
  if (!codes.length) return `<div class="portal-empty-state access-empty"><span>⌘</span><b>No access codes yet</b><p>Create a private code for a beta group, collaborator, scholarship, or customer support case.</p></div>`;
  return codes.map(code => {
    const disabled = !!code.disabled_at;
    const spent = Number(code.redemption_count || 0) >= Number(code.max_redemptions || 1);
    const status = disabled ? 'Revoked' : spent ? 'Fully used' : code.expires_at && new Date(code.expires_at) < new Date() ? 'Expired' : 'Ready';
    return `<article class="access-code-row"><span class="access-code-symbol" aria-hidden="true">⌘</span><div class="access-code-detail"><b>${escapeHTML(code.label)}</b><span>${escapeHTML(code.products?.name || 'Product')} · ${escapeHTML(code.code_hint)}</span><small>${Number(code.redemption_count || 0)} of ${Number(code.max_redemptions || 1)} uses${code.access_days ? ` · ${Number(code.access_days)} days’ access` : ' · No expiry'}</small></div><span class="access-code-status ${status==='Ready'?'is-ready':''}">${status}</span>${!disabled && !spent ? `<button type="button" class="portal-action" data-access-code-disable="${escapeHTML(code.id)}">Revoke</button>` : ''}</article>`;
  }).join('');
}

export function accessCodeCreatedDialog(code, label) {
  const backdrop = document.createElement('div');
  backdrop.className = 'portal-modal-backdrop';
  backdrop.innerHTML = `<section class="portal-modal access-issued-modal" role="dialog" aria-modal="true" aria-labelledby="access-issued-title"><button type="button" class="portal-modal-close" data-close-modal aria-label="Close">×</button><span class="portal-kicker">PRIVATE INVITE</span><h2 id="access-issued-title">Your code is ready</h2><p>Share this code with the people you want to let in. It will not be shown again after you close this window.</p><div class="issued-access-code"><code>${escapeHTML(code)}</code><button class="portal-action" type="button" data-copy-issued-code="${escapeHTML(code)}">Copy code</button></div><small class="draft-note">${escapeHTML(label)} · Keep this code private. You can revoke it from Access.</small><div class="portal-modal-actions"><button type="button" class="button button-primary" data-close-modal>Done</button></div></section>`;
  document.body.append(backdrop);
  backdrop.addEventListener('click', event => { if (event.target === backdrop) backdrop.remove(); });
  backdrop.querySelector('[data-copy-issued-code]')?.addEventListener('click', async event => {
    try { await navigator.clipboard.writeText(event.currentTarget.dataset.copyIssuedCode); event.currentTarget.textContent = 'Copied'; }
    catch { event.currentTarget.textContent = 'Select and copy the code'; }
  });
  backdrop.querySelector('[data-close-modal]')?.focus();
}
