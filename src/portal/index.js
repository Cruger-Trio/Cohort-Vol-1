import { connectSupabase } from '../core/supabase.js';
import { workspace, loadWorkspaceData, moneyFromPaise, slugify } from '../data/workspace.js';
import { businessProducts, businessProductForm, faqEditorRow, pricingOptionCard, pricingOptionDialog, pricingDialogQuestion, savePricingOptionDialog } from './business/products.js';
import { businessCustomers } from './business/customers.js';
import { businessPayments } from './business/payments.js';
import { businessHome, businessAnalytics } from './business/analytics.js';
import { portalSubpage, openProfileEditor } from './personal.js';
import { creatorOnboarding } from './onboarding.js';

const app = document.querySelector('#app');
for (const key of ['portal-theme', 'analytics-hidden', 'insights', 'marketplace-query', 'business-query']) {
  const oldKey = `cohort-${key}`, newKey = `cohort-${key}`;
  if (localStorage.getItem(newKey) === null && localStorage.getItem(oldKey) !== null) localStorage.setItem(newKey, localStorage.getItem(oldKey));
}
const status = (message, error = false) => {
  const node = document.querySelector('#auth-message');
  if (!node) return;
  node.textContent = message;
  node.classList.toggle('auth-error', error);
};
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));

let supabase;
let currentUser = null;
let initError = '';
function updateNav() {
  const actions = document.querySelector('.nav-actions');
  if (!actions) return;
  actions.innerHTML = `<button class="icon-button" id="search-toggle" aria-label="Search">âŒ•</button>
    <a class="login-link" href="${currentUser ? '#portal' : '#login'}">${currentUser ? 'My portal' : 'Log in'}</a>
    <a class="button button-dark button-sm" href="${currentUser ? '#portal' : '#signup-creator'}">${currentUser ? 'Account â†—' : 'Iâ€™m a creator â†—'}</a>
    <button class="mobile-menu" id="mobile-menu" aria-label="Open menu">â˜°</button>`;
  document.querySelector('#search-toggle')?.addEventListener('click', () => { location.hash = 'explore'; });
  document.querySelector('#mobile-menu')?.addEventListener('click', () => document.querySelector('.main-nav')?.classList.toggle('open'));
}

function authPage(mode) {
  const signup = mode.startsWith('signup');
  const creatorSignup = mode === 'signup-creator';
  const title = signup ? 'Make a little room for good things.' : 'Good to see you again.';
  const intro = signup
    ? creatorSignup ? 'Create your account, shape your creator profile, and launch your first product on Cohort.' : 'Join the home for independent creators and the people who love what they make.'
    : 'Log in to find your purchases, memberships and communities.';
  return `<div class="container page"><div class="form-shell">
    <span class="eyebrow">${signup ? 'Your next chapter' : 'Welcome back'}</span>
    <h1>${title}</h1><p>${intro}</p>
    <form id="auth-form" data-mode="${mode}" novalidate>
      ${signup ? '<label class="form-field"><span>Your name</span><input name="full_name" placeholder="e.g. Ananya Sharma" autocomplete="name" required></label>' : ''}
      <label class="form-field"><span>Email address</span><input name="email" type="email" placeholder="you@example.com" autocomplete="email" required></label>
      <label class="form-field"><span>Password</span><input name="password" type="password" placeholder="At least 8 characters" autocomplete="${signup ? 'new-password' : 'current-password'}" minlength="8" required></label>
      ${signup ? '' : '<div class="forgot-row"><a href="#forgot-password">Forgot password?</a></div>'}
      <button class="button button-dark" type="submit">${signup ? 'Create your account' : 'Log in'}&nbsp; â†—</button>
    </form>
    <p class="auth-message" id="auth-message" role="status">${initError ? escapeHTML(initError) : ''}</p>
    <div class="form-foot">${signup ? 'Already have an account? <a href="#login">Log in</a>' : 'New to Cohort? <a href="#signup">Create an account</a>'}</div>
    <small class="auth-legal">By continuing, you agree to Cohortâ€™s Terms and Privacy Policy.</small>
  </div></div>`;
}

let activeProfileTab = 'created';
let activeCustomerTab = 'Customers';
const iconSvg = {home:'<svg viewBox="0 0 24 24"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',messages:'<svg viewBox="0 0 24 24"><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 8.7 4a8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z"/></svg>',partners:'<svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm7-7.8a4 4 0 0 1 0 7.6M20 21v-2a4 4 0 0 0-3-3.9"/></svg>',affiliates:'<svg viewBox="0 0 24 24"><circle cx="6" cy="5" r="3"/><circle cx="18" cy="19" r="3"/><circle cx="6" cy="19" r="3"/><path d="m8.7 6.5 6.6 11m0-11L8.7 17.5"/></svg>',workforce:'<svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18m-11 0v2h4v-2"/></svg>',communities:'<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',settings:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.7 2.9-.2-.1a1.7 1.7 0 0 0-1.9.3l-.1.1h-3.4l-.1-.2a1.7 1.7 0 0 0-1.6-1.1 1.7 1.7 0 0 0-.9.3l-.2.1L6.8 17l.1-.2a1.7 1.7 0 0 0-.3-1.9l-.1-.1v-3.4l.2-.1a1.7 1.7 0 0 0 1.1-1.6 1.7 1.7 0 0 0-.3-.9l-.1-.2 1.7-2.9.2.1a1.7 1.7 0 0 0 1.9-.3l.1-.1h3.4l.1.2a1.7 1.7 0 0 0 1.6 1.1 1.7 1.7 0 0 0 .9-.3l.2-.1 2.9 1.7-.1.2a1.7 1.7 0 0 0 .3 1.9l.1.1v3.4z"/></svg>'};
const portalLinks = [['home','Home'],['orders','Orders'],['library','My library'],['messages','Messages'],['partners','Partners'],['affiliates','Affiliates'],['workforce','Workforce'],['communities','Communities']];
const businessIcons={home:iconSvg.home,analytics:'<svg viewBox="0 0 24 24"><path d="M3 3v18h18M7 14l4-4 4 3 6-7"/></svg>',products:'<svg viewBox="0 0 24 24"><path d="m12 3 9 5-9 5-9-5 9-5zm-9 5v9l9 5 9-5V8M12 13v9"/></svg>',payments:'<svg viewBox="0 0 24 24"><rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M3 10h18m-14 5h4"/></svg>',customers:iconSvg.partners,websites:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></svg>',ads:'<svg viewBox="0 0 24 24"><path d="m3 11 18-5v12L3 13v-2zm0 2-1 5h5l2-4m5-5 2-5"/></svg>',workforce:iconSvg.workforce,affiliates:iconSvg.affiliates,cards:'<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18m-14 6h4"/></svg>',support:iconSvg.messages,more:'<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>'};
function displayName() { return workspace.profile?.full_name || currentUser?.user_metadata?.full_name || currentUser?.email?.split('@')[0] || 'Creator'; }
function initialsFor(value) { return String(value || 'G').trim().split(/\s+/).slice(0,2).map(x => x[0]).join('').toUpperCase(); }
function portalShell(content, active='profile') {
  const name=displayName(), business=getBusiness();
  return `<div class="portal-app"><header class="portal-topbar"><a class="portal-brand" href="#portal/profile"><span class="brand-mark">C</span> Cohort</a><form class="portal-search" id="portal-search-form"><span class="portal-search-icon"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg></span><input name="query" placeholder="Search Cohort" aria-label="Search Cohort"><kbd>Ctrl K</kbd></form><div class="portal-top-actions"><button class="portal-icon-button" data-notifications aria-label="Notifications"><svg viewBox="0 0 24 24"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg></button><button class="portal-account-button" data-menu-toggle aria-expanded="false"><span class="portal-avatar">${escapeHTML(initialsFor(name))}</span><span class="account-name">${escapeHTML(name)}</span><span aria-hidden="true">v</span></button><div class="portal-account-menu" id="portal-account-menu" hidden><div class="account-menu-head"><span class="portal-avatar">${escapeHTML(initialsFor(name))}</span><span><b>${escapeHTML(name)}</b><small>${escapeHTML(currentUser?.email||'')}</small></span></div><a href="#portal/profile">View profile</a><a href="#portal/resolution">Resolution center</a><a href="#portal/orders">Orders</a><a href="#portal/library">My library</a><a href="#portal/settings">Settings</a><a href="#portal/help">Help and support</a><a href="#portal/language">Language</a><a href="#portal/legal">Legal</a><button data-signout>Sign out</button><div class="theme-picks"><button data-theme="dark">Dark</button><button data-theme="light">Light</button></div></div></div></header><div class="portal-layout"><aside class="portal-sidebar"><div class="portal-workspace-switch"><button class="workspace-selected">${escapeHTML(initialsFor(name))}</button>${business?`<a class="workspace-business" href="#business/home" title="Open ${escapeHTML(business.name)}">${escapeHTML(initialsFor(business.name))}</a>`:''}${business?`<button class="workspace-add" data-business-notice="Multiple business workspaces are coming soon." aria-label="Add business">+</button>`:`<a href="#portal/create-business" aria-label="Create business">+</a>`}</div><span class="sidebar-label">Personal</span><nav class="portal-nav">${portalLinks.map(([route,label])=>`<a class="portal-nav-link ${active===route?'active':''}" href="#portal/${route}"><span>${iconSvg[route]||iconSvg.communities}</span>${label}</a>`).join('')}</nav><div class="portal-sidebar-bottom"><a class="portal-nav-link ${active==='settings'?'active':''}" href="#portal/settings"><span>${iconSvg.settings}</span>Settings</a></div></aside><main class="portal-main">${content}</main></div></div>`;
}
const businessRoutes=['business/home','business/analytics','business/products','business/product-new','business/payments','business/customers','business/websites','business/ads','business/workforce','business/affiliates','business/cards','business/support','business/more','business/developer','business/settings'];
const bizSections=[['', [['home','Home'],['analytics','Analytics'],['products','Products'],['payments','Payments'],['customers','Customers'],['websites','Websites']]],['Grow',[['ads','Ads'],['workforce','Workforce'],['affiliates','Affiliates']]],['Operations',[['cards','Cards'],['support','Support'],['more','More']]]];
const bizLabel={home:'Home',analytics:'Analytics',products:'Products','product-new':'New product',payments:'Payments',customers:'Customers',websites:'Websites',ads:'Ads',workforce:'Workforce',affiliates:'Affiliates',cards:'Cards',support:'Support',more:'More',developer:'Developer',settings:'Settings'};
function getBusiness(){return workspace.business;}
function businessShell(content,active,business){
 const name=business.name||'Your business';
  return `<div class="portal-app business-app"><header class="portal-topbar"><a class="portal-brand" href="#business/home"><span class="brand-mark">C</span> Cohort</a><form class="portal-search" id="portal-search-form"><span class="portal-search-icon"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg></span><input name="query" placeholder="Search ${escapeHTML(name)}" aria-label="Search business"><kbd>Ctrl K</kbd></form><div class="portal-top-actions"><button class="portal-icon-button" data-notifications aria-label="Notifications"><svg viewBox="0 0 24 24"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg></button><button class="portal-account-button" data-menu-toggle aria-expanded="false"><span class="portal-avatar">${escapeHTML(initialsFor(name))}</span><span class="account-name">${escapeHTML(displayName())}</span><span>v</span></button><div class="portal-account-menu" id="portal-account-menu" hidden><div class="account-menu-head"><span class="portal-avatar">${escapeHTML(initialsFor(name))}</span><span><b>${escapeHTML(name)}</b><small>${escapeHTML(currentUser?.email||'')}</small></span></div><a href="#portal/profile">Personal portal</a><a href="#business/settings">Business settings</a><a href="#portal/help">Help and support</a><button data-signout>Sign out</button><div class="theme-picks"><button data-theme="dark">Dark</button><button data-theme="light">Light</button></div></div></div></header><div class="portal-layout"><aside class="portal-sidebar business-sidebar"><div class="business-switcher"><a class="workspace-personal" href="#portal/profile" title="Personal portal">${escapeHTML(initialsFor(displayName()))}</a><button class="workspace-selected business-switch-button" title="Current business">${escapeHTML(initialsFor(name))}</button><button class="workspace-add" data-business-notice="Multiple business workspaces are coming soon." aria-label="Add another business">+</button></div><div class="business-side-title">${escapeHTML(name)}<span>${escapeHTML(business.status==='setup'?'Setup':'Business')}</span></div><nav class="business-nav">${bizSections.map(([group,items])=>`${group?`<span class="biz-section-label">${group}</span>`:''}${items.map(([key,label])=>`<a class="portal-nav-link ${active===key?'active':''}" href="#business/${key}"><span class="biz-icon">${businessIcons[key]||iconSvg.communities}</span>${label}${key==='workforce'?'<small class="biz-badge">Beta</small>':''}</a>`).join('')}`).join('')}<div class="business-more-links" id="business-more-links" hidden><a href="#business/developer">Developer</a><a href="#business/settings">Settings</a></div></nav><div class="business-side-bottom"><a class="portal-nav-link ${active==='developer'?'active':''}" href="#business/developer"><span class="biz-icon">${businessIcons.more}</span>Developer</a><a class="portal-nav-link ${active==='settings'?'active':''}" href="#business/settings"><span>${iconSvg.settings}</span>Settings</a></div></aside><main class="portal-main business-main">${content}</main></div></div>`;
}
function businessHeading(kicker,title,copy='',action=''){return `<div class="portal-page-heading business-heading"><div><span class="portal-kicker">${kicker}</span><h1>${title}</h1>${copy?`<p>${copy}</p>`:''}</div>${action}</div>`;}
function businessPage(route,b,id){
 if(route==='home') return businessHome(b);
 if(route==='products') return businessProducts(b);
 if(route==='product-new') return businessProductForm();
 if(route==='product-edit') return businessProductForm((Array.isArray(b.products)?b.products:[]).find(p=>p&&p.id===id));
 if(route==='analytics') return businessAnalytics(b);
 if(route==='payments') return businessPayments(workspace.orders);
 if(route==='customers') return businessCustomers(b, activeCustomerTab);
 if(route==='websites') return `${businessHeading('STOREFRONT','Websites','Manage the link customers use to find your Cohort business.')}<section class="portal-panel business-form"><h2>${b.website?'Storefront link':'Add a website'}</h2><p class="settings-row-note">Add your website or public storefront URL. This saves the link only; it does not publish a website.</p><form id="business-website-form"><label class="form-field"><span>Website URL</span><input name="website_url" type="url" value="${escapeHTML(b.website||'')}" placeholder="https://your-site.in"></label><button class="button button-primary" type="submit">Save website link</button><p class="auth-message" id="auth-message" role="status"></p></form></section><section class="portal-panel website-preview"><b>Cohort storefront</b><p>${escapeHTML(b.name)} | ${escapeHTML(b.handle||'your-page')}</p><span>Product catalog and public checkout will be enabled in a later phase.</span></section>`;
 if(route==='ads') return `${businessHeading('GROW','Ads','Promote products when your storefront is ready.')}<section class="portal-panel feature-placeholder"><span class="feature-letter">A</span><h2>Campaigns are coming soon</h2><p>Campaign setup will connect after products, checkout and audience targeting are ready.</p><button class="portal-action" data-business-notice="Promotions are not connected yet.">Create a campaign</button></section>`;
 if(route==='workforce') return `${businessHeading('TEAM','Workforce','Manage people who help run your creator business.')}<section class="portal-panel feature-placeholder"><span class="feature-letter">T</span><h2>Your team starts here</h2><p>Invite teammates with clear roles once team access controls are ready.</p><button class="portal-action" data-business-notice="Team invites will be available with role-based access setup.">Invite teammate</button></section>`;
 if(route==='affiliates') return `${businessHeading('GROW','Affiliates','Let partners recommend your products.')}<section class="portal-panel settings-list"><div class="settings-row"><div><b>Affiliate program</b><p>Turn on referrals after checkout is connected.</p></div><button class="portal-action" data-business-notice="Affiliate tracking will be available with checkout.">Set up program</button></div><div class="settings-row"><div><b>Commission</b><p>Choose the reward for a successful referral.</p></div><span>Not configured</span></div></section>`;
 if(route==='cards') return `${businessHeading('OPERATIONS','Cards','Business spending cards and controls.')}<section class="portal-panel feature-placeholder"><span class="feature-letter">INR</span><h2>Business cards are not connected</h2><p>Card issuance depends on a supported financial provider and business verification.</p><button class="portal-action" disabled>Request a card</button></section>`;
 if(route==='support') return `${businessHeading('HELP','Support','Get help with your Cohort business.')}<div class="help-cards"><article class="portal-panel help-card"><span>O</span><b>Payments and orders</b><p>Review common checkout questions.</p><a class="text-link" href="#business/payments">Open payments &rarr;</a></article><article class="portal-panel help-card"><span>P</span><b>Products</b><p>Need help setting up an offer?</p><a class="text-link" href="#business/products">Open products &rarr;</a></article><article class="portal-panel help-card"><span>@</span><b>Contact Cohort</b><p>Send us a note about your business.</p><a class="text-link" href="mailto:support@cohort.in">Email support &rarr;</a></article></div>`;
 if(route==='more') return `${businessHeading('WORKSPACE','More tools','Quick links to business controls.')}<div class="business-quick-grid"><a href="#business/developer"><b>Developer</b><span>API access</span><small>Tools for your integrations</small></a><a href="#business/settings"><b>Settings</b><span>Business profile</span><small>Update your business details</small></a><a href="#business/support"><b>Support</b><span>Get help</span><small>Contact Cohort support</small></a></div>`;
 if(route==='developer') return `${businessHeading('DEVELOPER','Developer','Build integrations for your Cohort business.')}<section class="portal-panel feature-placeholder"><span class="feature-letter">&lt;/&gt;</span><h2>Developer access is coming soon</h2><p>API keys and webhooks will be enabled after access controls and event delivery are ready.</p><button class="portal-action" disabled>Create API key</button><pre><code>GET /api/v1/products
Authorization: Bearer YOUR_API_KEY</code></pre></section>`;
 if(route==='settings') return `${businessHeading('BUSINESS','Settings','Edit your creator business profile.')}<section class="portal-panel business-form"><form id="business-settings-form"><label class="form-field"><span>Business name</span><input name="business_name" value="${escapeHTML(b.name||'')}" required maxlength="80"></label><label class="form-field"><span>Handle</span><input name="business_handle" value="${escapeHTML(b.handle||'')}" required pattern="[a-z0-9][a-z0-9-]{1,28}[a-z0-9]"></label><label class="form-field"><span>Category</span><input name="business_category" value="${escapeHTML(b.category||'')}" maxlength="50"></label><label class="form-field"><span>Description</span><textarea name="business_description" rows="4" maxlength="240">${escapeHTML(b.description||'')}</textarea></label><button class="button button-primary" type="submit">Save changes</button><p id="auth-message" class="auth-message" role="status"></p></form></section>`;
 return businessHome(b);
}
function renderBusinessPage(route){
 const business=getBusiness();
 if(!business){location.hash=currentUser?'create-business':'login';return;}
 const parts=route.split('/'),section=parts[1]||'home',id=section==='product-edit'?parts.slice(2).join('/'):'';
 const page=businessPage(section,business,id);
 app.innerHTML=businessShell(page,section==='product-edit'?'products':section,business);
 document.body.classList.toggle('portal-mode',true);
 document.body.classList.toggle('portal-light',localStorage.getItem('cohort-portal-theme')==='light');
 const period=document.querySelector('#analytics-period');
 period?.addEventListener('change',()=>{const note=document.querySelector('#analytics-period-note');if(note)note.textContent=period.value==='Today'?'Showing today':`Showing the last ${period.value}`;});
 const customerSearch=document.querySelector('#business-customer-search'),customerStatus=document.querySelector('#customer-status-filter'),customerDate=document.querySelector('#customer-date-filter');
 const filterCustomers=()=>{document.querySelectorAll('.customer-table tbody tr').forEach(row=>{const query=(customerSearch?.value||'').toLowerCase(),status=customerStatus?.value||'all';row.hidden=!row.textContent.toLowerCase().includes(query)||(status!=='all'&&!row.textContent.toLowerCase().includes(status.toLowerCase()));});};
 customerSearch?.addEventListener('input',filterCustomers);customerStatus?.addEventListener('change',filterCustomers);
 customerDate?.addEventListener('change',()=>{const body=document.querySelector('.customer-table tbody'),rows=[...(body?.rows||[])],direction=customerDate.value==='oldest'?1:-1;rows.sort((a,b)=>direction*(new Date(a.dataset.customerDate||0)-new Date(b.dataset.customerDate||0)));rows.forEach(row=>body.append(row));});
 document.querySelectorAll('[data-customer-tab]').forEach(tab=>tab.addEventListener('click',()=>{activeCustomerTab=tab.dataset.customerTab;renderAuthRoute();}));
 const productSearch=document.querySelector('#product-search'),visibility=document.querySelector('#product-visibility-filter');
 const filterProducts=()=>{document.querySelectorAll('.business-product-table tbody tr').forEach(row=>{const text=row.textContent.toLowerCase(),filter=visibility?.value||'all',pill=row.querySelector('.product-status-pill'),state=pill?.textContent.trim().toLowerCase();row.hidden=!text.includes((productSearch?.value||'').toLowerCase())||(filter!=='all'&&filter!==state);});};
 productSearch?.addEventListener('input',filterProducts);visibility?.addEventListener('change',filterProducts);
 document.querySelector('#business-product-form')?.addEventListener('input',e=>{if(e.target.name==='product_name'){const title=document.querySelector('#product-preview-title');if(title)title.textContent=e.target.value||'Your product title';}if(e.target.name.startsWith('pricing_amount_')||e.target.name.startsWith('pricing_cadence_')){const amount=document.querySelector('[name^="pricing_amount_"]')?.value||'0',cadence=document.querySelector('[name^="pricing_cadence_"]')?.value||'once',price=document.querySelector('#product-preview-price');if(price)price.innerHTML=`&#8377;${Number(amount).toLocaleString('en-IN')}${cadence!=='once'?` / ${escapeHTML(cadence)}`:''}`;}});
 if(section==='analytics'){let hidden=[];try{hidden=JSON.parse(localStorage.getItem('cohort-analytics-hidden')||'[]');}catch{}document.querySelectorAll('[data-analytics-widget],[data-analytics-metric]').forEach(card=>{const key=card.dataset.analyticsWidget||card.dataset.analyticsMetric;card.hidden=hidden.includes(key);});}
 document.querySelectorAll('[data-traffic-tab]').forEach(tab=>tab.addEventListener('click',()=>{document.querySelectorAll('[data-traffic-tab]').forEach(x=>x.classList.toggle('selected',x===tab));const copy=document.querySelector('#traffic-empty-copy');if(copy)copy.textContent=`${tab.dataset.trafficTab} data appears when your website is connected`;}));
}
function portalPage(route='profile') {
 if(!supabase||!currentUser) return `<div class="container page"><div class="empty-state"><b>${supabase?'Log in to open your portal.':'Connecting your account...'}</b>${initError?escapeHTML(initError):''}<a class="button button-dark" href="#login">Log in &rarr;</a></div></div>`;
 if(route==='onboarding')return portalShell(creatorOnboarding({profile:workspace.profile,business:getBusiness()}),'home');
 return portalShell(portalSubpage(route,{user:currentUser,name:displayName(),activeTab:activeProfileTab,escapeHTML,initialsFor,editProfileButton:'<button class="portal-action" data-edit-profile>Edit profile</button>'}),route);
}
function portalToast(message) {
  let node = document.querySelector('#portal-toast');
  if (!node) {
    node = document.createElement('div');
    node.id = 'portal-toast';
    node.className = 'portal-toast';
    document.body.append(node);
  }
  node.textContent = message;
  node.classList.add('show');
  clearTimeout(node._timer);
  node._timer = setTimeout(() => node.classList.remove('show'), 2600);
}

function renderAuthRoute() {
  const rawRoute = decodeURIComponent(location.hash.slice(1) || 'home');
  const route = rawRoute === 'portal' ? 'portal/profile' : rawRoute;
  const portalRoutes=['portal/profile','portal/home','portal/orders','portal/library','portal/messages','portal/partners','portal/affiliates','portal/workforce','portal/communities','portal/settings','portal/create-business','portal/onboarding','portal/resolution','portal/help','portal/language','portal/legal'];
  const isBusinessRoute=route.startsWith('business/');
  document.body.classList.toggle('portal-mode',portalRoutes.includes(route)||isBusinessRoute);
  document.body.classList.toggle('portal-light',portalRoutes.includes(route)&&localStorage.getItem('cohort-portal-theme')==='light');
  if(route==='home'){document.body.classList.remove('portal-mode','portal-light');updateNav();return;}
  if(isBusinessRoute){renderBusinessPage(route);updateNav();return;}
  if(route==='signup-creator'&&currentUser){localStorage.setItem(`cohort-creator-intent:${currentUser.id}`,'1');location.hash='portal/onboarding';return;}
  if(route==='portal/create-business'&&getBusiness()){location.hash='business/home';return;}
  if(route==='signup'||route==='signup-creator'||route==='login') { if(route==='signup-creator')localStorage.setItem('cohort-creator-intent-pending','1'); app.innerHTML=authPage(route); }
  if(portalRoutes.includes(route)) app.innerHTML=portalPage(route.split('/')[1]);
  if(route==='forgot-password') app.innerHTML=`<div class="container page"><div class="form-shell"><span class="eyebrow">Account recovery</span><h1>Reset your password.</h1><p>We will email you a secure link to choose a new password.</p><form id="reset-request-form"><label class="form-field"><span>Email address</span><input name="email" type="email" autocomplete="email" required placeholder="you@example.com"></label><button class="button button-dark" type="submit">Send reset link &rarr;</button></form><p class="auth-message" id="auth-message" role="status"></p><div class="form-foot"><a href="#login">Back to log in</a></div></div></div>`;
  if(route==='reset-password') app.innerHTML=`<div class="container page"><div class="form-shell"><span class="eyebrow">Account recovery</span><h1>Choose a new password.</h1><form id="new-password-form"><label class="form-field"><span>New password</span><input name="password" type="password" minlength="8" autocomplete="new-password" required></label><button class="button button-dark" type="submit">Update password &rarr;</button></form><p class="auth-message" id="auth-message" role="status"></p></div></div>`;
  updateNav();
}
function showError(error) {
  const message = error?.message || 'Something went wrong. Please try again.';
  status(message, true);
}
function setProductSaveState(form, message, state='loading') {
  const indicator=form.querySelector('#product-save-indicator');if(!indicator)return;
  indicator.hidden=false;indicator.classList.toggle('is-error',state==='error');
  indicator.querySelector('.cohort-spinner')?.toggleAttribute('hidden',state==='error');
  indicator.querySelector('span:last-child').textContent=message;
}

document.addEventListener('submit', async event => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  if (!['auth-form', 'edit-profile-form', 'business-form', 'portal-search-form', 'reset-request-form', 'new-password-form', 'business-product-form'].includes(form.id)) return;
  event.preventDefault();
  if (!supabase) return status(initError || 'Supabase is not configured.', true);
  const data = new FormData(form);
  const button = form.querySelector('button[type="submit"]');
  if(form.dataset.saving==='true')return;
  form.dataset.saving='true';
  const originalButtonText=button?.textContent;
  if (button) button.disabled = true;
  if(form.id==='business-product-form'){if(button)button.textContent='Savingâ€¦';setProductSaveState(form,'Saving product detailsâ€¦');}
  try {
    if (form.id === 'auth-form') {
      const email = String(data.get('email') || '').trim();
      const password = String(data.get('password') || '');
      if (form.dataset.mode.startsWith('signup')) {
        const fullName = String(data.get('full_name') || '').trim();
        const creatorFlow = form.dataset.mode === 'signup-creator';
        const { data: result, error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: fullName }, emailRedirectTo: `${location.origin}/#portal/${creatorFlow?'onboarding':'profile'}` },
        });
        if (error) throw error;
        if (result.session) { if(creatorFlow&&result.user)localStorage.setItem(`cohort-creator-intent:${result.user.id}`,'1'); location.hash = creatorFlow?'portal/onboarding':'portal/profile'; }
        else status('Check your email to confirm your account, then log in.');
      } else {
        const { data: signedIn, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const pending=localStorage.getItem('cohort-creator-intent-pending')==='1';
        const creatorFlow=pending||localStorage.getItem(`cohort-creator-intent:${signedIn.user.id}`)==='1';
        if(creatorFlow&&signedIn.user)localStorage.setItem(`cohort-creator-intent:${signedIn.user.id}`,'1');
        localStorage.removeItem('cohort-creator-intent-pending');
        location.hash = creatorFlow?'portal/onboarding':'portal/profile';
      }
    } else if (form.id === 'edit-profile-form') {
      const fullName = String(data.get('full_name') || '').trim();
      const username = String(data.get('username') || '').trim().replace(/^@/, '');
      const profile = {
        full_name: fullName,
        username,
        location: String(data.get('location') || '').trim(),
        bio: String(data.get('bio') || '').trim(),
        cover_color: String(data.get('cover_color') || '#dbeaa8'),
      };
      const avatarFile=document.querySelector('#profile-avatar-file')?.files?.[0];
      if(avatarFile){if(!['image/jpeg','image/png','image/webp'].includes(avatarFile.type)||avatarFile.size>5*1024*1024)throw new Error('Choose a JPG, PNG or WebP image under 5 MB.');const ext=avatarFile.type.split('/')[1].replace('jpeg','jpg'),path=`${currentUser.id}/profile/avatar-${Date.now()}.${ext}`,{error:uploadError}=await supabase.storage.from('product-media').upload(path,avatarFile,{contentType:avatarFile.type,upsert:true});if(uploadError)throw uploadError;profile.avatar_url=supabase.storage.from('product-media').getPublicUrl(path).data.publicUrl;}
      const coverFile=document.querySelector('#profile-cover-file')?.files?.[0];
      if(coverFile){if(!['image/jpeg','image/png','image/webp','video/mp4','video/webm'].includes(coverFile.type)||coverFile.size>20*1024*1024)throw new Error('Choose a JPG, PNG, WebP, MP4 or WebM cover under 20 MB.');if(coverFile.type.startsWith('video/')){const duration=await new Promise((resolve,reject)=>{const video=document.createElement('video'),url=URL.createObjectURL(coverFile);video.preload='metadata';video.onloadedmetadata=()=>{URL.revokeObjectURL(url);resolve(video.duration);};video.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Could not read this video.'));};video.src=url;});if(duration>20)throw new Error('Profile cover videos must be 20 seconds or shorter.');}const ext=coverFile.type.split('/')[1].replace('jpeg','jpg'),path=`${currentUser.id}/profile/cover-${Date.now()}.${ext}`,{error:uploadError}=await supabase.storage.from('profile-covers').upload(path,coverFile,{contentType:coverFile.type,upsert:false});if(uploadError)throw uploadError;profile.cover_media_url=supabase.storage.from('profile-covers').getPublicUrl(path).data.publicUrl;profile.cover_media_type=coverFile.type;}
      const { data: result, error } = await supabase.from('profiles').update({ ...profile, updated_at: new Date().toISOString() }).eq('id', currentUser.id).select().single();
      if (error) throw error;
      workspace.profile = result;
      document.querySelector('.portal-modal-backdrop')?.remove();
      renderAuthRoute();
      portalToast('Profile saved.');
    } else if (form.id === 'business-form') {
      const handle = String(data.get('handle') || '').trim().toLowerCase();
      const business = {
        owner_id: currentUser.id,
        name: String(data.get('business_name') || '').trim(),
        handle,
        description: String(data.get('description') || '').trim(),
        category: String(data.get('category') || 'Courses'),
        status: 'setup',
      };
      const { data: result, error } = await supabase.from('businesses').insert(business).select().single();
      if (error) throw error;
      workspace.business = { ...result, products: [], website: '' };
      activeProfileTab = 'created';
      const creatorFlow=localStorage.getItem(`cohort-creator-intent:${currentUser.id}`)==='1';
      location.hash = creatorFlow?'portal/onboarding':'business/home';
      portalToast('Your business workspace is ready.');
    } else if (form.id === 'business-product-form') {
      const b=getBusiness(),id=form.dataset.productId,old=Array.isArray(b.products)?b.products.find(p=>p?.id===id):null,pricingOptions=[],faqRows=[...form.querySelectorAll('.faq-editor-row')],faqs=faqRows.map(row=>({question:row.querySelector('input')?.value.trim()||'',answer:row.querySelector('textarea')?.value.trim()||''})).filter(f=>f.question||f.answer);
      [...form.querySelectorAll('[data-pricing-option]')].forEach((card,i)=>{const val=prefix=>card.querySelector(`[name^="${prefix}_"]`),cadence=val('pricing_cadence')?.value||'once',amount=Number(val('pricing_amount')?.value||0),checkoutQuestions=!!val('pricing_questions')?.checked,questions=[...card.querySelectorAll('[data-question-source]')].map(row=>({title:row.querySelector('[name^="checkout_title_"]')?.value.trim()||'',placeholder:row.querySelector('[name^="checkout_placeholder_"]')?.value.trim()||'',optional:!!row.querySelector('[name^="checkout_optional_"]')?.checked})).filter(q=>q.title||q.placeholder);pricingOptions.push({id:card.dataset.priceId||null,name:val('pricing_internal_enabled')?.checked?(val('pricing_internal')?.value.trim()||'Internal plan'):(cadence==='once'?'One-time':cadence),amount,currency:'INR',cadence,checkoutQuestions,questions,stock:val('pricing_stock')?.value?Number(val('pricing_stock').value):null,waitlist:!!val('pricing_waitlist')?.checked,hideFromStore:!!val('pricing_hidden')?.checked,autoExpire:!!val('pricing_expire')?.checked,expireDays:Number(val('pricing_expire_days')?.value||30),allowMultiple:!!val('pricing_multiple')?.checked,internalName:val('pricing_internal_enabled')?.checked?val('pricing_internal')?.value.trim()||'': '',buttonText:val('pricing_button')?.value||'default'});});
      const name=String(data.get('product_name')||'').trim(),visibility=String(data.get('visibility')||'draft'),product={business_id:b.id,slug:old?.slug||slugify(name),name,headline:String(data.get('headline')||'').trim()||null,type:String(data.get('product_type')||'Digital product'),description:String(data.get('description')||'').trim(),faqs,media_url:form.dataset.mediaPreviewOnly==='true'?'':(form.dataset.mediaUrl||old?.mediaUrl||null),status:old?.status==='archived'?'archived':visibility,listed:visibility==='visible'};
      setProductSaveState(form,'Saving product detailsâ€¦');
      let savedProduct;
      if(id){const {data:row,error}=await supabase.from('products').update(product).eq('id',id).select().single();if(error)throw error;savedProduct=row;}
      else {const {data:row,error}=await supabase.from('products').insert(product).select().single();if(error)throw error;savedProduct=row;}
      setProductSaveState(form,'Saving pricing and checkout settingsâ€¦');
      const priceRows=pricingOptions.map(option=>({id:option.id,product_id:savedProduct.id,name:option.internalName||option.name||'Standard',amount_paise:Math.round(option.amount*100),currency:'INR',cadence:option.cadence,stock:option.stock,waitlist:option.waitlist,hide_from_store:option.hideFromStore,expire_days:option.autoExpire?option.expireDays:null,allow_multiple:option.allowMultiple,checkout_questions:option.checkoutQuestions?option.questions:[],button_text:option.buttonText==='default'?null:option.buttonText,is_active:true}));
      const retainedPriceIds=priceRows.map(row=>row.id).filter(Boolean);
      if(id){
        const removedPrices=(old?.pricingOptions||[]).map(price=>price.id).filter(priceId=>priceId&&!retainedPriceIds.includes(priceId));
        if(removedPrices.length){const {error}=await supabase.from('prices').update({is_active:false,hide_from_store:true}).in('id',removedPrices);if(error)throw error;}
      }
      for(const row of priceRows){const {id:priceId,...values}=row;const result=priceId?await supabase.from('prices').update(values).eq('id',priceId).eq('product_id',savedProduct.id):await supabase.from('prices').insert(values);if(result.error)throw result.error;}
      const mediaFile=form._mediaFile;
      if(mediaFile)setProductSaveState(form,'Uploading product imageâ€¦');
      if(mediaFile){if(!['image/jpeg','image/png','image/webp'].includes(mediaFile.type)||mediaFile.size>5*1024*1024)throw new Error('Product preview must be JPG, PNG or WebP under 5 MB.');const ext=mediaFile.type.split('/')[1].replace('jpeg','jpg'),path=`${currentUser.id}/${savedProduct.id}/cover-${Date.now()}.${ext}`,{error:uploadError}=await supabase.storage.from('product-media').upload(path,mediaFile,{contentType:mediaFile.type,upsert:true});if(uploadError)throw uploadError;const publicUrl=supabase.storage.from('product-media').getPublicUrl(path).data.publicUrl,{error:updateError}=await supabase.from('products').update({media_url:publicUrl}).eq('id',savedProduct.id);if(updateError)throw updateError;}
      const deliverable=form._deliverableFile;
      if(deliverable)setProductSaveState(form,'Uploading private customer filesâ€¦');
      if(deliverable){if(deliverable.size>50*1024*1024)throw new Error('Product files must be 50 MB or smaller.');const safeName=deliverable.name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g,'-').slice(-120)||'download',path=`${currentUser.id}/${savedProduct.id}/${Date.now()}-${safeName}`,{error:uploadError}=await supabase.storage.from('deliverables').upload(path,deliverable,{contentType:deliverable.type||'application/octet-stream',upsert:false});if(uploadError)throw uploadError;const {error:rowError}=await supabase.from('product_deliverables').insert({product_id:savedProduct.id,kind:'file',title:deliverable.name.slice(0,120),storage_path:path});if(rowError)throw rowError;}
      setProductSaveState(form,'Publishing product and refreshing your storefrontâ€¦');
      await loadWorkspaceData(supabase, currentUser);const creatorFlow=localStorage.getItem(`cohort-creator-intent:${currentUser.id}`)==='1';location.hash=creatorFlow?'portal/onboarding':'business/products';portalToast('Product saved to Cohort.');
    } else if (form.id === 'business-website-form') {
      const b=getBusiness(), website=String(data.get('website_url')||'').trim();
      if(website){const url=new URL(website);if(!['https:','http:'].includes(url.protocol))throw new Error('Enter a valid website URL.');}
      const {data:result,error}=await supabase.from('businesses').update({website,updated_at:new Date().toISOString()}).eq('id',b.id).select().single();
      if(error)throw error; workspace.business={...workspace.business,...result}; renderAuthRoute(); portalToast('Website link saved.');
    } else if (form.id === 'business-settings-form') {
      const b=getBusiness(), updated={name:String(data.get('business_name')||'').trim(),handle:String(data.get('business_handle')||'').trim().toLowerCase(),category:String(data.get('business_category')||'').trim(),description:String(data.get('business_description')||'').trim(),updated_at:new Date().toISOString()};
      const {data:result,error}=await supabase.from('businesses').update(updated).eq('id',b.id).select().single();
      if(error)throw error; workspace.business={...workspace.business,...result}; renderAuthRoute(); portalToast('Business settings saved.');
    } else if (form.id === 'portal-search-form') {
      const query = String(data.get('query') || '').trim();
      sessionStorage.setItem('cohort-marketplace-query', query);
      const businessSearch=location.hash.slice(1).startsWith('business/');
      if(businessSearch){sessionStorage.setItem('cohort-business-query',query);location.hash='business/products';return;}
      location.hash = 'explore';
      setTimeout(() => {
        const search = document.querySelector('#market-search');
        if (search) { search.value = query; search.dispatchEvent(new Event('input', { bubbles: true })); }
      }, 50);
    } else if (form.id === 'reset-request-form') {
      const email = String(data.get('email') || '').trim();
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/#reset-password` });
      if (error) throw error;
      status('If an account exists for that email, a reset link is on its way.');
    } else if (form.id === 'new-password-form') {
      const { error } = await supabase.auth.updateUser({ password: String(data.get('password') || '') });
      if (error) throw error;
      status('Password updated. You can now use your new password.');
      setTimeout(() => { location.hash = 'portal/profile'; }, 900);
    }
  } catch (error) {
    if(form.id==='business-product-form')setProductSaveState(form,error?.message||'Save failed. Please try again.','error');
    showError(error);
  } finally {
    form.dataset.saving='false';if (button) {button.disabled = false;if(originalButtonText!==undefined)button.textContent=originalButtonText;}
  }
}, true);

document.addEventListener('click', async event => {
  const menu = document.querySelector('#portal-account-menu');
  if (menu && !event.target.closest('.portal-top-actions')) menu.hidden = true;
  const target = event.target.closest('[data-menu-toggle], [data-theme], [data-profile-tab], [data-edit-profile], [data-close-modal], [data-notifications], [data-signout], [data-money-action], [data-business-insights], [data-business-notice], [data-product-archive], [data-product-export], [data-product-settings], [data-product-stock], [data-pricing-add], [data-pricing-remove], [data-pricing-edit], [data-pricing-done], [data-pricing-delete], [data-price-preset], [data-dialog-add-question], [data-dialog-remove-question], [data-stock-unlimited], [data-faq-add], [data-faq-remove], [data-checkout-question-add], [data-product-copy], [data-stock-url], [data-analytics-customize], [data-analytics-date], [data-analytics-shift], [data-customer-export], [data-customer-settings], [data-copy-link], [data-customer-download]');
  if (!target) return;
  event.preventDefault();
  if(target.matches('[data-customer-download]')){const path=target.dataset.customerDownload,name=(target.dataset.downloadName||'cohort-download').replace(/[^a-zA-Z0-9._-]+/g,'-');target.disabled=true;target.textContent='Preparingâ€¦';try{const {data,error}=await supabase.storage.from('deliverables').download(path);if(error)throw error;const url=URL.createObjectURL(data),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1500);portalToast('Your download is ready.');}catch(error){portalToast(error?.message||'Could not access this file.');}finally{target.disabled=false;target.textContent='Download';}return;}
  if(target.matches('[data-copy-link]')){await navigator.clipboard.writeText(`${location.origin}${target.dataset.copyLink}`);portalToast('Product link copied.');return;}
  if (target.matches('[data-menu-toggle]')) {
    const panel = document.querySelector('#portal-account-menu');
    panel.hidden = !panel.hidden;
    target.setAttribute('aria-expanded', String(!panel.hidden));
    return;
  }
  if (target.matches('[data-theme]')) {
    const theme = target.dataset.theme;
    localStorage.setItem('cohort-portal-theme', theme);
    document.body.classList.toggle('portal-light', theme === 'light');
    return;
  }
  if(target.matches('[data-money-action]')){portalToast(target.dataset.moneyAction==='Export transactions'?'There are no transactions to export yet.':'Payments and payouts are not connected yet.');return;}
  if(target.matches('[data-business-notice]')){portalToast(target.dataset.businessNotice);return;}
  if(target.matches('[data-business-insights]')){const on=localStorage.getItem('cohort-insights')==='on';localStorage.setItem('cohort-insights',on?'off':'on');renderAuthRoute();portalToast(on?'Cohort Insights paused.':'Cohort Insights turned on.');return;}
  if(target.matches('[data-product-archive]')){const product=getBusiness()?.products?.find(item=>item.id===target.dataset.productArchive);if(!product)return;const archived=product.status!=='archived';const {error}=await supabase.from('products').update({status:archived?'archived':'draft',listed:false,updated_at:new Date().toISOString()}).eq('id',product.id);if(error)throw error;await loadWorkspaceData(supabase,currentUser);renderAuthRoute();portalToast(archived?'Product archived.':'Product restored as a draft.');return;}
  if(target.matches('[data-product-settings]')){portalToast('Catalog visibility and storefront settings will be available with public product pages.');return;}
  if(target.matches('[data-customer-export]')){const headers=activeCustomerTab==='Customers'?['Customer ID','Email','Status','Country','Total spend (INR)','Joined at','Last accessed']:activeCustomerTab==='Memberships'?['Member ID','Email','Plan','Status','Price (INR)','Started','Renews']:['Person','Email','Role','Status','Added'];let rows=[];if(activeCustomerTab==='Customers'){const byBuyer=new Map();for(const order of workspace.orders){if(!order.buyer_id)continue;const row=byBuyer.get(order.buyer_id)||[order.buyer_id.slice(0,8),'Private to customer',order.status==='paid'?'Joined':'Order pending','â€”',0,order.created_at,'â€”'];if(order.status==='paid')row[4]+=moneyFromPaise(order.amount_paise);byBuyer.set(order.buyer_id,row);}rows=[...byBuyer.values()];}else if(activeCustomerTab==='Memberships')rows=workspace.entitlements.map(item=>[String(item.buyer_id||'').slice(0,8),'Private to member',item.products?.name||'Membership',item.status,moneyFromPaise(item.products?.prices?.[0]?.amount_paise),item.starts_at||'',item.ends_at||'']);const csv=[headers,...rows].map(row=>row.map(value=>`"${String(value??'').replace(/"/g,'""')}"`).join(',')).join('\n'),url=URL.createObjectURL(new Blob([csv],{type:'text/csv'})),link=document.createElement('a');link.href=url;link.download=`cohort-${activeCustomerTab.toLowerCase()}.csv`;link.click();URL.revokeObjectURL(url);portalToast(`${activeCustomerTab} exported.`);return;}
  if(target.matches('[data-customer-settings]')){portalToast('Customer columns use the default Cohort layout.');return;}
  if(target.matches('[data-pricing-edit]')){const card=target.closest('[data-pricing-option]'),modal=document.createElement('div');modal.innerHTML=pricingOptionDialog(card);const backdrop=modal.firstElementChild;backdrop._pricingCard=card;document.body.append(backdrop);backdrop.addEventListener('click',e=>{if(e.target===backdrop)backdrop.remove();});return;}
  if(target.matches('[data-pricing-done]')){const backdrop=target.closest('.pricing-modal-backdrop'),card=backdrop?._pricingCard;if(!card)return;savePricingOptionDialog(card,backdrop);const amount=Number(card.querySelector('[name^="pricing_amount_"]')?.value||0),cadence=card.querySelector('[name^="pricing_cadence_"]')?.value||'once',preview=document.querySelector('#product-preview-price');if(preview)preview.innerHTML=`&#8377;${amount.toLocaleString('en-IN')}${cadence!=='once'?` / ${escapeHTML(cadence)}`:''}`;backdrop.remove();return;}
  if(target.matches('[data-pricing-delete]')){const backdrop=target.closest('.pricing-modal-backdrop'),card=backdrop?._pricingCard,list=document.querySelector('#pricing-options-list');if(list?.querySelectorAll('[data-pricing-option]').length<=1){portalToast('Keep at least one pricing option.');return;}card?.remove();backdrop?.remove();return;}
  if(target.matches('[data-price-preset]')){const amount=target.closest('.pricing-modal')?.querySelector('[data-dialog-amount]');if(amount)amount.value=target.dataset.pricePreset;return;}
  if(target.matches('[data-dialog-add-question]')){const list=target.closest('.pricing-modal')?.querySelector('.pricing-dialog-questions');if(list){list.hidden=false;list.insertAdjacentHTML('beforeend',pricingDialogQuestion({},list.querySelectorAll('[data-dialog-question]').length));}return;}
  if(target.matches('[data-dialog-remove-question]')){target.closest('[data-dialog-question]')?.remove();[...document.querySelectorAll('[data-dialog-question]')].forEach((row,i)=>{const number=row.querySelector('.question-number');if(number)number.textContent=i+1;});return;}
  if(target.matches('[data-stock-unlimited]')){const input=target.closest('.pricing-modal')?.querySelector('[data-dialog-stock]');if(input){input.value='';input.placeholder='Unlimited';}return;}
  if(target.matches('[data-analytics-customize]')){const names=[...document.querySelectorAll('[data-analytics-widget],[data-analytics-metric]')].map(el=>el.dataset.analyticsWidget||el.dataset.analyticsMetric);let hidden=[];try{hidden=JSON.parse(localStorage.getItem('cohort-analytics-hidden')||'[]');}catch{}const backdrop=document.createElement('div');backdrop.className='portal-modal-backdrop';backdrop.innerHTML=`<section class="portal-modal analytics-customize-modal" role="dialog" aria-modal="true"><button class="portal-modal-close" data-close-modal aria-label="Close">&times;</button><span class="portal-kicker">ANALYTICS</span><h2>Customize dashboard</h2><p>Choose which metric cards appear on this dashboard.</p><form id="analytics-customize-form" class="analytics-customize-list">${names.map((name,i)=>`<label><input type="checkbox" data-analytics-choice="${escapeHTML(name)}" ${hidden.includes(name)?'':'checked'}><span>${escapeHTML(name)}</span></label>`).join('')}</form></section>`;document.body.append(backdrop);backdrop.addEventListener('click',e=>{if(e.target===backdrop)backdrop.remove();});return;}
  if(target.matches('[data-analytics-date]')){const label=document.querySelector('.analytics-date-label');if(!label)return;const input=document.createElement('input');input.type='date';input.className='analytics-date-input';input.value=new Date(`${label.textContent.trim().slice(0,12)} 12:00:00`).toISOString().slice(0,10);input.addEventListener('change',()=>{if(input.value)label.innerHTML=`${new Date(`${input.value}T12:00:00`).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})} <span>&#9662;</span>`;input.remove();});label.after(input);input.showPicker?.();return;}
  if(target.matches('[data-analytics-shift]')){const label=document.querySelector('.analytics-date-label');if(label){const date=new Date(`${label.textContent.trim().slice(0,12)} 12:00:00`);date.setDate(date.getDate()+Number(target.dataset.analyticsShift));label.innerHTML=`${date.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})} <span>&#9662;</span>`;}return;}
  if(target.matches('[data-product-export]')){const b=getBusiness(),items=(Array.isArray(b?.products)?b.products:[]).filter(p=>p&&p.status!=='archived'),csv=[['Name','Type','Visibility','Currency','Price','Billing'],...items.map(p=>[p.name,p.type,p.visibility||'draft','INR',p.price||0,p.billing||'once'])].map(row=>row.map(value=>`"${String(value??'').replace(/"/g,'""')}"`).join(',')).join('\n'),url=URL.createObjectURL(new Blob([csv],{type:'text/csv'})),link=document.createElement('a');link.href=url;link.download='cohort-products.csv';link.click();URL.revokeObjectURL(url);portalToast('Product catalog exported.');return;}
  if(target.matches('[data-payment-export]')){const rows=[['Order','Product','Status','Date','Amount (INR)'],...workspace.orders.map(order=>[order.order_number||order.id,order.products?.name||'Digital product',order.status,order.created_at,moneyFromPaise(order.amount_paise)])],csv=rows.map(row=>row.map(value=>`"${String(value??'').replace(/"/g,'""')}"`).join(',')).join('\n'),url=URL.createObjectURL(new Blob([csv],{type:'text/csv'})),link=document.createElement('a');link.href=url;link.download='cohort-payments.csv';link.click();URL.revokeObjectURL(url);portalToast('Payment records exported.');return;}
  if(target.matches('[data-faq-add]')){const list=document.querySelector('#product-faq-list');if(list)list.insertAdjacentHTML('beforeend',faqEditorRow({},list.querySelectorAll('.faq-editor-row').length));return;}
  if(target.matches('[data-faq-remove]')){target.closest('.faq-editor-row')?.remove();return;}
  if(target.matches('[data-pricing-add]')){const list=document.querySelector('#pricing-options-list');if(list){const i=list.querySelectorAll('[data-pricing-option]').length;list.insertAdjacentHTML('beforeend',pricingOptionCard({amount:0,cadence:'once'},i));list.querySelectorAll('[data-pricing-option]')[i]?.querySelector('[data-pricing-edit]')?.click();}return;}
  if(target.matches('[data-pricing-remove]')){const list=document.querySelector('#pricing-options-list');if(list?.querySelectorAll('[data-pricing-option]').length<=1){portalToast('Keep at least one pricing option.');return;}target.closest('[data-pricing-option]')?.remove();return;}
  if(target.matches('[data-checkout-question-add]')){const wrap=target.closest('[data-pricing-option]')?.querySelector('.pricing-question-fields');if(wrap){wrap.hidden=false;wrap.insertAdjacentHTML('beforeend','<input maxlength="160" placeholder="Question for the customer">');}return;}
  if(target.matches('[data-product-stock]')){const backdrop=document.createElement('div');backdrop.className='portal-modal-backdrop';backdrop.innerHTML='<section class="portal-modal stock-photo-modal" role="dialog" aria-modal="true"><button class="portal-modal-close" data-close-modal aria-label="Close">&times;</button><span class="portal-kicker">PRODUCT MEDIA</span><h2>Choose a visual style</h2><p>Pick a sample image preview. Add your own hosted media when storage is connected.</p><div class="stock-photo-grid"><button type="button" data-stock-url="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200&q=80">Creator desk</button><button type="button" data-stock-url="https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=1200&q=80">Digital learning</button><button type="button" data-stock-url="https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=1200&q=80">Community</button></div></section>';document.body.append(backdrop);backdrop.addEventListener('click',e=>{if(e.target===backdrop)backdrop.remove();});return;}
  if(target.matches('[data-product-copy]')){const form=document.querySelector('#business-product-form'),title=form?.elements.product_name?.value.trim()||'this offer',headline=form?.elements.headline,description=form?.elements.description;if(headline&&!headline.value)headline.value=`A practical way to make progress with ${title}`;if(description&&!description.value)description.value=`Get clear guidance, useful resources and a supportive creator-led experience with ${title}. Designed to help you take the next step at your own pace.`;headline?.dispatchEvent(new Event('input',{bubbles:true}));portalToast('Starter copy added. Edit it to match your offer.');return;}
  if(target.matches('[data-stock-url]')){const url=target.dataset.stockUrl,form=document.querySelector('#business-product-form'),preview=document.querySelector('#product-media-preview');if(form){form.dataset.mediaUrl=url;form.dataset.mediaPreviewOnly='false';}if(preview){preview.style.backgroundImage=`url("${url}")`;preview.classList.add('has-media');}target.closest('.portal-modal-backdrop')?.remove();return;}
  if (target.matches('[data-profile-tab]')) {
    activeProfileTab = target.dataset.profileTab;
    renderAuthRoute();
    return;
  }
  if (target.matches('[data-edit-profile]')) { openProfileEditor({user:currentUser,name:displayName(),escapeHTML}); return; }
  if (target.matches('[data-close-modal]')) { target.closest('.portal-modal-backdrop')?.remove(); return; }
  if (target.matches('[data-notifications]')) { portalToast('Youâ€™re all caught up.'); return; }
  if (target.matches('[data-signout]')) {
    if (!supabase) return status(initError || 'Supabase is not configured.', true);
    target.disabled = true;
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      currentUser = null;
      document.body.classList.remove('portal-mode');
      location.hash = 'home';
      updateNav();
    } catch (error) {
      showError(error);
      target.disabled = false;
    }
  }
}, true);

document.addEventListener('change',event=>{
 const target=event.target;
 if(target.matches('[data-analytics-choice]')){const key=target.dataset.analyticsChoice;let hidden=[];try{hidden=JSON.parse(localStorage.getItem('cohort-analytics-hidden')||'[]');}catch{}hidden=target.checked?hidden.filter(x=>x!==key):[...new Set([...hidden,key])];localStorage.setItem('cohort-analytics-hidden',JSON.stringify(hidden));document.querySelectorAll('[data-analytics-widget],[data-analytics-metric]').forEach(card=>{const name=card.dataset.analyticsWidget||card.dataset.analyticsMetric;card.hidden=hidden.includes(name);});}
 if(target.matches('[data-dialog-questions]')){const modal=target.closest('.pricing-modal'),questions=modal?.querySelector('.pricing-dialog-questions'),add=modal?.querySelector('[data-dialog-add-question]');if(questions)questions.hidden=!target.checked;if(add)add.hidden=!target.checked;}
 if(target.matches('[data-dialog-setting="expire"]')){const input=target.closest('.pricing-modal')?.querySelector('.pricing-expire-days');if(input)input.hidden=!target.checked;}
 if(target.matches('[data-dialog-setting="internal-enabled"]')){const input=target.closest('.pricing-modal')?.querySelector('.pricing-internal-field');if(input)input.hidden=!target.checked;}
 if(target.matches('#profile-cover-file')){const file=target.files?.[0],form=target.closest('#edit-profile-form'),preview=document.querySelector('#profile-cover-preview');if(!file||!form)return;if(!['image/jpeg','image/png','image/webp','video/mp4','video/webm'].includes(file.type)||file.size>20*1024*1024){target.value='';portalToast('Choose a supported image or video under 20 MB.');return;}const url=URL.createObjectURL(file);form._coverFile=file;if(preview){preview.hidden=false;preview.innerHTML=file.type.startsWith('video/')?`<video src="${url}" muted loop autoplay playsinline></video>`:`<img src="${url}" alt="New profile cover preview">`;}if(file.type.startsWith('video/')){const video=document.createElement('video');video.preload='metadata';video.onloadedmetadata=()=>{if(video.duration>20){target.value='';form._coverFile=null;preview.hidden=true;portalToast('Profile cover videos must be 20 seconds or shorter.');}};video.src=url;}portalToast('Cover ready to upload when you save.');}
 if(target.matches('#product-media-file')){const file=target.files?.[0];if(!file)return;const preview=document.querySelector('#product-media-preview'),url=URL.createObjectURL(file),form=document.querySelector('#business-product-form');if(form){form._mediaFile=file;form.dataset.mediaPreviewOnly='false';}if(preview){preview.style.backgroundImage=`url("${url}")`;preview.classList.add('has-media');preview.querySelector('b')?.replaceChildren(document.createTextNode(file.name));}portalToast('Product image ready to upload when you save.');}
 if(target.matches('#product-deliverable-file')){const file=target.files?.[0],form=document.querySelector('#business-product-form'),label=document.querySelector('#product-deliverable-name');if(!file||!form)return;if(file.size>50*1024*1024){target.value='';portalToast('Product files must be 50 MB or smaller.');return;}form._deliverableFile=file;if(label)label.innerHTML=`<div class="saved-deliverable"><span>â–¤</span><span><b>${escapeHTML(file.name)}</b><small>Will upload privately when you save</small></span></div>`;portalToast('Product file ready to upload when you save.');}
 if(target.matches('[name^="pricing_questions_"]')){const wrap=target.closest('[data-pricing-option]')?.querySelector('.pricing-question-fields');if(wrap)wrap.hidden=!target.checked;}
});
window.addEventListener('hashchange', renderAuthRoute);

try {
  supabase = await connectSupabase();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  currentUser = data.session?.user || null;
  await loadWorkspaceData(supabase, currentUser);
  supabase.auth.onAuthStateChange((event, session) => {
    currentUser = session?.user || null;
    updateNav();
    setTimeout(async () => {
      try { await loadWorkspaceData(supabase, currentUser); renderAuthRoute(); }
      catch (loadError) { initError = loadError?.message || ''; renderAuthRoute(); }
    }, 0);
    if(event==='SIGNED_IN'&&session?.user){const pending=localStorage.getItem('cohort-creator-intent-pending')==='1';if(pending)localStorage.setItem(`cohort-creator-intent:${session.user.id}`,'1');localStorage.removeItem('cohort-creator-intent-pending');if(['#login','#signup','#signup-creator'].includes(location.hash))location.hash=(pending||localStorage.getItem(`cohort-creator-intent:${session.user.id}`)==='1')?'portal/onboarding':'portal/profile';}
  });
  window.cohortAuth = { client: supabase, get user() { return currentUser; } };
  renderAuthRoute();
} catch (error) {
  initError = error?.message || 'Supabase could not be reached.';
  window.cohortMarketProducts=[];window.dispatchEvent(new CustomEvent('cohort:catalog-ready'));
  renderAuthRoute();
}

