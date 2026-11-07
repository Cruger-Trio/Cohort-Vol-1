import { connectSupabase } from '../core/supabase.js';
import { workspace, loadWorkspaceData, moneyFromPaise, slugify } from '../data/workspace.js';
import { businessProducts, businessProductForm, faqEditorRow, pricingOptionCard, pricingOptionDialog, pricingDialogQuestion, savePricingOptionDialog } from './business/products.js';
import { businessCustomers, customerCrmDialog, customerMemberDialog, audienceSegmentDialog } from './business/customers.js';
import { businessAccess, accessCodeRows, accessCodeCreatedDialog } from './business/access.js';
import { businessPayments } from './business/payments.js';
import { businessHome, businessAnalytics } from './business/analytics.js';
import { portalSubpage, openProfileEditor } from './personal.js';
import { creatorOnboarding } from './onboarding.js';
import { businessCommunity, memberCommunity, memberCommunities, loadCommunityFeed } from './community.js';
import { communicationCenterPage, loadCommunicationCenter, createCustomerConversation, sendInboxMessage, selectInboxConversation, stopCommunicationCenterRealtime, messageTemplateEditor, messageTemplateManager } from './messaging.js';
import { businessNotificationMarkup, bindBusinessNotificationRealtime } from './notifications.js';
import { skeletonWorkspace } from '../ui/skeletons.js';

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
let workspaceLoading = true;
let initError = '';
function refreshBusinessNotifications() {
  const node=document.querySelector('.business-notifications');
  if(node)node.outerHTML=businessNotificationMarkup(workspace,escapeHTML);
}
function updateNav() {
  const actions = document.querySelector('.nav-actions');
  if (!actions) return;
  const profile = workspace.profile || {};
  actions.innerHTML = `<button class="icon-button nav-search-button" id="search-toggle" aria-label="Search Cohort" title="Search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg></button>
    ${currentUser ? `<a class="public-account-link" href="#portal/profile" aria-label="My portal"><span class="public-account-avatar" ${profile.avatar_url ? `style="background-image:url('${escapeHTML(profile.avatar_url)}')"` : ''}>${profile.avatar_url ? '' : escapeHTML(initialsFor(displayName()))}</span><span>My portal</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></a>` : `<a class="login-link" href="#login"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.5-3.4 2.8-5 7-5s6.5 1.6 7 5"/></svg>Log in</a><a class="button button-dark button-sm creator-nav-cta" href="#signup-creator">I’m a creator <span aria-hidden="true">↗</span></a>`}
    <button class="mobile-menu" id="mobile-menu" aria-label="Open menu" aria-expanded="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>`;
  document.querySelector('#search-toggle')?.addEventListener('click', () => { location.hash = 'explore'; });
  document.querySelector('#mobile-menu')?.addEventListener('click', event => { const nav = document.querySelector('.main-nav'), open = nav?.classList.toggle('open'); event.currentTarget.setAttribute('aria-expanded', String(Boolean(open))); event.currentTarget.setAttribute('aria-label', open ? 'Close menu' : 'Open menu'); });
}

function authPage(mode) {
  const signup = mode.startsWith('signup');
  const creatorSignup = mode === 'signup-creator';
  const title = signup ? 'Make a little room for good things.' : 'Good to see you again.';
  const intro = signup
    ? creatorSignup ? 'Create your account, shape your creator profile, and launch your first product on Cohort.' : 'Join the home for independent creators and the people who love what they make.'
    : 'Log in to find your purchases, memberships and communities.';
  return `<div class="container page auth-page"><div class="form-shell auth-shell">
    <span class="auth-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 10V7a5 5 0 0 1 10 0v3"/><rect x="4" y="10" width="16" height="11" rx="3"/><path d="M12 14v3"/></svg></span><span class="eyebrow">${signup ? 'Your next chapter' : 'Welcome back'}</span>
    <h1>${title}</h1><p>${intro}</p>
    <form id="auth-form" data-mode="${mode}" novalidate>
      ${signup ? '<label class="form-field"><span>Your name</span><input name="full_name" placeholder="e.g. Ananya Sharma" autocomplete="name" required></label>' : ''}
      <label class="form-field"><span>Email address</span><span class="auth-input-wrap"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></svg><input name="email" type="email" placeholder="you@example.com" autocomplete="email" required></span></label>
      <label class="form-field"><span>Password</span><span class="auth-input-wrap"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg><input name="password" type="password" placeholder="At least 8 characters" autocomplete="${signup ? 'new-password' : 'current-password'}" minlength="8" required><button type="button" class="auth-password-toggle" data-password-toggle aria-label="Show password"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg></button></span></label>
      ${signup ? '' : '<div class="forgot-row"><a href="#forgot-password">Forgot password?</a></div>'}
      <button class="button button-dark auth-submit" type="submit">${signup ? 'Create your account' : 'Log in'}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg></button>
    </form>
    <p class="auth-message" id="auth-message" role="status">${initError ? escapeHTML(initError) : ''}</p>
    <div class="form-foot">${signup ? 'Already have an account? <a href="#login">Log in</a>' : 'New to Cohort? <a href="#signup">Create an account</a>'}</div>
    <small class="auth-legal">By continuing, you agree to Cohort's Terms and Privacy Policy.</small>
  </div></div>`;
}

let activeProfileTab = 'created';
let activeCustomerTab = 'Customers';
let activeAudienceFilter = { id: 'all', filters: {} };
const iconSvg = {home:'<svg viewBox="0 0 24 24"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',messages:'<svg viewBox="0 0 24 24"><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 8.7 4a8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z"/></svg>',partners:'<svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm7-7.8a4 4 0 0 1 0 7.6M20 21v-2a4 4 0 0 0-3-3.9"/></svg>',affiliates:'<svg viewBox="0 0 24 24"><circle cx="6" cy="5" r="3"/><circle cx="18" cy="19" r="3"/><circle cx="6" cy="19" r="3"/><path d="m8.7 6.5 6.6 11m0-11L8.7 17.5"/></svg>',workforce:'<svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18m-11 0v2h4v-2"/></svg>',communities:'<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',settings:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.7 2.9-.2-.1a1.7 1.7 0 0 0-1.9.3l-.1.1h-3.4l-.1-.2a1.7 1.7 0 0 0-1.6-1.1 1.7 1.7 0 0 0-.9.3l-.2.1L6.8 17l.1-.2a1.7 1.7 0 0 0-.3-1.9l-.1-.1v-3.4l.2-.1a1.7 1.7 0 0 0 1.1-1.6 1.7 1.7 0 0 0-.3-.9l-.1-.2 1.7-2.9.2.1a1.7 1.7 0 0 0 1.9-.3l.1-.1h3.4l.1.2a1.7 1.7 0 0 0 1.6 1.1 1.7 1.7 0 0 0 .9-.3l.2-.1 2.9 1.7-.1.2a1.7 1.7 0 0 0 .3 1.9l.1.1v3.4z"/></svg>'};
const portalLinks = [['home','Home'],['orders','Orders'],['library','My library'],['messages','Messages'],['partners','Partners'],['affiliates','Affiliates'],['workforce','Workforce'],['communities','Communities']];
const businessIcons={home:iconSvg.home,analytics:'<svg viewBox="0 0 24 24"><path d="M3 3v18h18M7 14l4-4 4 3 6-7"/></svg>',products:'<svg viewBox="0 0 24 24"><path d="m12 3 9 5-9 5-9-5 9-5zm-9 5v9l9 5 9-5V8M12 13v9"/></svg>',payments:'<svg viewBox="0 0 24 24"><rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M3 10h18m-14 5h4"/></svg>',customers:iconSvg.partners,messages:iconSvg.messages,access:'<svg viewBox="0 0 24 24"><circle cx="8" cy="15" r="4"/><path d="m11 12 9-9m-4 0h4v4M11 15h6"/></svg>',websites:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></svg>',ads:'<svg viewBox="0 0 24 24"><path d="m3 11 18-5v12L3 13v-2zm0 2-1 5h5l2-4m5-5 2-5"/></svg>',workforce:iconSvg.workforce,affiliates:iconSvg.affiliates,cards:'<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18m-14 6h4"/></svg>',support:iconSvg.messages,more:'<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>'};
function displayName() { return workspace.profile?.full_name || currentUser?.user_metadata?.full_name || currentUser?.email?.split('@')[0] || 'Creator'; }
function initialsFor(value) { return String(value || 'G').trim().split(/\s+/).slice(0,2).map(x => x[0]).join('').toUpperCase(); }
function revealActiveMobileNav() {
  if (!window.matchMedia('(max-width: 600px)').matches) return;
  const nav = document.querySelector('.business-nav, .portal-nav');
  const active = nav?.querySelector('[aria-current="page"]');
  if (!nav || !active) return;
  requestAnimationFrame(() => {
    if (!active.isConnected) return;
    const item = active.getBoundingClientRect(), area = nav.getBoundingClientRect();
    nav.scrollLeft += item.left - area.left - (area.width - item.width) / 2;
  });
}
function portalShell(content, active='profile') {
  const name=displayName(), business=getBusiness();
  const avatar = workspace.profile?.avatar_url ? `<span class="portal-avatar has-image" style="background-image:url('${escapeHTML(workspace.profile.avatar_url)}')" aria-label="${escapeHTML(name)}"></span>` : `<span class="portal-avatar">${escapeHTML(initialsFor(name))}</span>`;
  return `<div class="portal-app"><header class="portal-topbar"><a class="portal-brand" href="#portal/profile"><span class="brand-mark">C</span><span>Cohort</span></a><form class="portal-search" id="portal-search-form"><span class="portal-search-icon"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg></span><input name="query" placeholder="Search Cohort" aria-label="Search Cohort"><kbd>Ctrl K</kbd></form><div class="portal-top-actions"><a class="portal-icon-button" href="#portal/messages" aria-label="Messages" title="Messages"><svg viewBox="0 0 24 24"><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 8.7 4a8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z"/></svg></a><button class="portal-account-button" id="portal-account-toggle" data-menu-toggle aria-expanded="false" aria-haspopup="true" aria-controls="portal-account-menu">${avatar}<span class="account-name">${escapeHTML(name)}</span><svg class="account-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg></button><div class="portal-account-menu" id="portal-account-menu" role="menu" aria-labelledby="portal-account-toggle" hidden><div class="account-menu-head">${avatar}<span><b>${escapeHTML(name)}</b><small>${escapeHTML(currentUser?.email||'')}</small></span></div><a role="menuitem" class="account-menu-profile" href="#portal/profile"><span class="account-menu-icon">${iconSvg.partners}</span><span><b>View profile</b><small>Your public Cohort profile</small></span><span class="account-menu-arrow">↗</span></a><div class="account-menu-label">YOUR ACCOUNT</div><a role="menuitem" href="#portal/orders"><span class="account-menu-icon">▤</span>Orders</a><a role="menuitem" href="#portal/library"><span class="account-menu-icon">▦</span>My library</a><a role="menuitem" href="#portal/messages"><span class="account-menu-icon">${iconSvg.messages}</span>Messages</a><a role="menuitem" href="#portal/settings"><span class="account-menu-icon">${iconSvg.settings}</span>Settings</a><div class="account-menu-label">SUPPORT</div><a role="menuitem" href="#portal/help"><span class="account-menu-icon">?</span>Help and support</a><a role="menuitem" href="#portal/resolution"><span class="account-menu-icon">◉</span>Resolution center</a><div class="account-menu-footer"><div class="theme-picks" aria-label="Appearance"><button data-theme="dark" aria-label="Dark appearance" title="Dark">◐</button><button data-theme="light" aria-label="Light appearance" title="Light">☼</button></div><button class="account-signout" data-signout><span>↪</span> Sign out</button></div></div></div></header><div class="portal-layout"><aside class="portal-sidebar"><div class="portal-workspace-switch"><button class="workspace-selected" aria-label="Personal workspace">${escapeHTML(initialsFor(name))}</button>${business?`<a class="workspace-business" href="#business/home" title="Open ${escapeHTML(business.name)}">${escapeHTML(initialsFor(business.name))}</a>`:''}${business?`<button class="workspace-add" data-business-notice="Multiple business workspaces are coming soon." aria-label="Add business">+</button>`:`<a href="#portal/create-business" aria-label="Create business">+</a>`}</div><span class="sidebar-label">Personal</span><nav class="portal-nav" aria-label="Personal workspace">${portalLinks.map(([route,label])=>`<a class="portal-nav-link ${active===route?'active':''}" ${active===route?'aria-current="page"':''} href="#portal/${route}"><span>${iconSvg[route]||iconSvg.communities}</span>${label}</a>`).join('')}</nav><div class="portal-sidebar-bottom"><a class="portal-nav-link ${active==='settings'?'active':''}" href="#portal/settings"><span>${iconSvg.settings}</span>Settings</a></div></aside><main class="portal-main">${content}</main></div></div>`;
}
const businessRoutes=['business/home','business/analytics','business/products','business/product-new','business/payments','business/customers','business/community','business/messages','business/access','business/websites','business/ads','business/workforce','business/affiliates','business/cards','business/support','business/more','business/developer','business/settings'];
const bizSections=[['', [['home','Home'],['analytics','Analytics'],['products','Products'],['payments','Payments'],['customers','Customers'],['community','Community'],['access','Access'],['websites','Websites']]],['Grow',[['ads','Ads'],['workforce','Workforce'],['affiliates','Affiliates']]],['Operations',[['messages','Messages'],['cards','Cards'],['support','Support'],['more','More']]]];
const bizLabel={home:'Home',analytics:'Analytics',products:'Products','product-new':'New product',payments:'Payments',customers:'Customers',community:'Community',messages:'Messages',access:'Access',websites:'Websites',ads:'Ads',workforce:'Workforce',affiliates:'Affiliates',cards:'Cards',support:'Support',more:'More',developer:'Developer',settings:'Settings'};
function getBusiness(){return workspace.business;}
function ordersCustomerName(customerId){const order=workspace.orders.find(item=>item.buyer_id===customerId),demo=order?.is_demo;return demo?(order.answers?.demo_customer_name||`Demo customer ${String(customerId||'').slice(0,6)}`):`Customer ${String(customerId||'').slice(0,6)}`;}
function businessShell(content,active,business){
 const name=business.name||'Your business';
  const profileName=displayName(), avatar=workspace.profile?.avatar_url?`<span class="portal-avatar has-image" style="background-image:url('${escapeHTML(workspace.profile.avatar_url)}')"></span>`:`<span class="portal-avatar">${escapeHTML(initialsFor(profileName))}</span>`;
  return `<div class="portal-app business-app"><header class="portal-topbar"><a class="portal-brand" href="#business/home"><span class="brand-mark">C</span><span>Cohort</span></a><form class="portal-search" id="portal-search-form"><span class="portal-search-icon"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg></span><input name="query" placeholder="Search ${escapeHTML(name)}" aria-label="Search business"><kbd>Ctrl K</kbd></form><div class="portal-top-actions">${businessNotificationMarkup(workspace,escapeHTML)}<button class="portal-account-button" id="portal-account-toggle" data-menu-toggle aria-expanded="false" aria-haspopup="true" aria-controls="portal-account-menu">${avatar}<span class="account-name">${escapeHTML(profileName)}</span><svg class="account-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg></button><div class="portal-account-menu business-account-menu" id="portal-account-menu" role="menu" aria-labelledby="portal-account-toggle" hidden><div class="account-menu-head">${avatar}<span><b>${escapeHTML(profileName)}</b><small>${escapeHTML(currentUser?.email||'')}</small></span></div><div class="account-business-identity"><small>BUSINESS WORKSPACE</small><b>${escapeHTML(name)}</b><span>@${escapeHTML(business.handle||'')}</span></div><a role="menuitem" href="#portal/profile"><span class="account-menu-icon">${iconSvg.partners}</span>Personal portal</a><a role="menuitem" href="#business/settings"><span class="account-menu-icon">${iconSvg.settings}</span>Business settings</a><a role="menuitem" href="#business/messages"><span class="account-menu-icon">${iconSvg.messages}</span>Creator inbox</a><a role="menuitem" href="#portal/help"><span class="account-menu-icon">?</span>Help and support</a><div class="account-menu-footer"><div class="theme-picks" aria-label="Appearance"><button data-theme="dark" aria-label="Dark appearance" title="Dark">◐</button><button data-theme="light" aria-label="Light appearance" title="Light">☼</button></div><button class="account-signout" data-signout><span>↪</span> Sign out</button></div></div></div></header><div class="portal-layout"><aside class="portal-sidebar business-sidebar"><div class="business-switcher"><a class="workspace-personal" href="#portal/profile" title="Personal portal">${escapeHTML(initialsFor(profileName))}</a><button class="workspace-selected business-switch-button" title="Current business">${escapeHTML(initialsFor(name))}</button><button class="workspace-add" data-business-notice="Multiple business workspaces are coming soon." aria-label="Add another business">+</button></div><div class="business-side-title">${escapeHTML(name)}<span>${escapeHTML(business.status==='setup'?'Setup':'Business')}</span></div><nav class="business-nav" aria-label="Business workspace">${bizSections.map(([group,items])=>`${group?`<span class="biz-section-label">${group}</span>`:''}${items.map(([key,label])=>`<a class="portal-nav-link ${active===key?'active':''}" ${active===key?'aria-current="page"':''} href="#business/${key}"><span class="biz-icon">${businessIcons[key]||iconSvg.communities}</span>${label}${key==='workforce'?'<small class="biz-badge">Beta</small>':''}</a>`).join('')}`).join('')}<div class="business-more-links" id="business-more-links" hidden><a href="#business/developer">Developer</a><a href="#business/settings">Settings</a></div></nav><div class="business-side-bottom"><a class="portal-nav-link ${active==='developer'?'active':''}" href="#business/developer"><span class="biz-icon">${businessIcons.more}</span>Developer</a><a class="portal-nav-link ${active==='settings'?'active':''}" href="#business/settings"><span>${iconSvg.settings}</span>Settings</a></div></aside><main class="portal-main business-main">${content}</main></div></div>`;
}
function businessHeading(kicker,title,copy='',action=''){return `<div class="portal-page-heading business-heading"><div><span class="portal-kicker">${kicker}</span><h1>${title}</h1>${copy?`<p>${copy}</p>`:''}</div>${action}</div>`;}
function businessPage(route,b,id){
 if(route==='home') return businessHome(b);
 if(route==='products') return businessProducts(b);
 if(route==='product-new') return businessProductForm();
 if(route==='product-edit') return businessProductForm((Array.isArray(b.products)?b.products:[]).find(p=>p&&p.id===id));
 if(route==='analytics') return businessAnalytics(b);
 if(route==='messages') return communicationCenterPage({business:b,user:currentUser,escapeHTML,initialsFor});
 if(route==='payments') return businessPayments(workspace.orders);
 if(route==='customers') return businessCustomers(b, activeCustomerTab, workspace.audienceSegments);
 if(route==='community') return businessCommunity(b,id);
 if(route==='access') return businessAccess(b);
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
 const parts=route.split('/'),section=parts[1]||'home',id=['product-edit','community'].includes(section)?parts.slice(2).join('/') : '';
 const page=businessPage(section,business,id);
 app.innerHTML=businessShell(page,['product-edit','product-new'].includes(section)?'products':section,business);
 revealActiveMobileNav();
 void bindBusinessNotificationRealtime(supabase,business,currentUser,workspace,()=>{const node=document.querySelector('.business-notifications');if(node)node.outerHTML=businessNotificationMarkup(workspace,escapeHTML);});
 if(section==='community'&&id) void loadCommunityFeed(supabase,id);
 document.body.classList.toggle('portal-mode',true);
 document.body.classList.toggle('portal-light',localStorage.getItem('cohort-portal-theme')==='light');
 const period=document.querySelector('#analytics-period');
 period?.addEventListener('change',()=>{const note=document.querySelector('#analytics-period-note');if(note)note.textContent=period.value==='Today'?'Showing today':`Showing the last ${period.value}`;});
  const customerSearch=document.querySelector('#business-customer-search'),customerStatus=document.querySelector('#customer-status-filter'),customerSegment=document.querySelector('#customer-segment-filter'),customerDate=document.querySelector('#customer-date-filter');
  const filterCustomers=()=>{let visible=0;document.querySelectorAll('.customer-table tbody tr').forEach(row=>{const query=(customerSearch?.value||'').toLowerCase().trim(),status=customerStatus?.value||'all',segment=customerSegment?.value||'all',filters=activeAudienceFilter.filters||{},text=`${row.textContent} ${row.dataset.customerTags||''} ${row.dataset.customerNote||''}`.toLowerCase(),hasNote=!!row.dataset.customerNote?.trim(),hasTags=!!row.dataset.customerTags?.trim(),demo=row.dataset.customerDemo==='true',products=new Set((row.dataset.customerProducts||'').split(',').filter(Boolean)),purchase=row.dataset.customerLastPurchase?new Date(row.dataset.customerLastPurchase).getTime():0,activity=row.dataset.customerLastActivity?new Date(row.dataset.customerLastActivity).getTime():0,now=Date.now(),membership=row.dataset.customerMembership==='active';let tags=[];try{tags=JSON.parse(row.dataset.customerTagList||'[]');}catch{}let matches=true;if(filters.product_id&&!products.has(filters.product_id))matches=false;if(filters.membership==='active'&&!membership)matches=false;if(filters.membership==='none'&&membership)matches=false;if(filters.tag&&!tags.includes(filters.tag.trim().toLowerCase()))matches=false;if(Number(filters.min_spend)>0&&Number(row.dataset.customerSpend||0)<Number(filters.min_spend))matches=false;if(filters.purchase_window==='30d'&&(!purchase||now-purchase>30*864e5))matches=false;if(filters.purchase_window==='90d'&&(!purchase||now-purchase>90*864e5))matches=false;if(filters.purchase_window==='stale90'&&purchase&&now-purchase<90*864e5)matches=false;if(filters.activity_window==='active30'&&(!activity||now-activity>30*864e5))matches=false;if(filters.activity_window==='inactive90'&&activity&&now-activity<90*864e5)matches=false;const statusMatches=status==='all'||(row.dataset.customerStatus||'').includes(status.toLowerCase());row.hidden=(!text.includes(query))||!statusMatches||(segment==='tagged'&&!hasTags)||(segment==='noted'&&!hasNote)||(segment==='demo'&&!demo)||!matches;if(!row.hidden)visible++;});const note=document.querySelector('#audience-selection-note');if(note)note.textContent=`${activeAudienceFilter.id==='all'?'Showing all customers':`Showing ${activeAudienceFilter.name||'selected audience'}`} · ${visible} ${visible===1?'customer':'customers'}. Open a profile to start an individual follow-up.`;};
 customerSearch?.addEventListener('input',filterCustomers);customerStatus?.addEventListener('change',filterCustomers);customerSegment?.addEventListener('change',filterCustomers);
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
 if(route==='communities')return portalShell(memberCommunities(workspace.memberships),'communities');
 if(route==='messages')return portalShell(communicationCenterPage({business:null,user:currentUser,escapeHTML,initialsFor}),'messages');
 if(route.startsWith('community/')){
  const productId=route.slice('community/'.length),membership=workspace.memberships.find(item=>item.product_id===productId);
  const content=memberCommunity(membership);
  return portalShell(content,'communities');
 }
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
  document.querySelectorAll('.portal-modal-backdrop, .customer-member-backdrop, .customer-crm-backdrop').forEach(node => node.remove());
  const rawRoute = decodeURIComponent(location.hash.slice(1) || 'home');
  const route = rawRoute === 'portal' ? 'portal/profile' : rawRoute;
  if(route!=='portal/messages'&&route!=='business/messages')void stopCommunicationCenterRealtime(supabase);
  const portalRoutes=['portal/profile','portal/home','portal/orders','portal/library','portal/messages','portal/partners','portal/affiliates','portal/workforce','portal/communities','portal/settings','portal/create-business','portal/onboarding','portal/resolution','portal/help','portal/language','portal/legal'];
  const isMemberCommunity=route.startsWith('portal/community/');
  const isBusinessRoute=route.startsWith('business/');
  if (isBusinessRoute) document.title = `${bizLabel[route.split('/')[1]] || 'Workspace'} — Cohort`;
  else if (portalRoutes.includes(route) || isMemberCommunity) document.title = `${isMemberCommunity ? 'Community' : portalLinks.find(([key]) => key === route.split('/')[1])?.[1] || 'Your portal'} — Cohort`;
  document.body.classList.toggle('portal-mode',portalRoutes.includes(route)||isMemberCommunity||isBusinessRoute);
  document.body.classList.toggle('portal-light',(portalRoutes.includes(route)||isMemberCommunity||isBusinessRoute)&&localStorage.getItem('cohort-portal-theme')==='light');
  if(workspaceLoading&&(portalRoutes.includes(route)||isMemberCommunity||isBusinessRoute)){app.innerHTML=skeletonWorkspace();return;}
  if(route==='home'){document.body.classList.remove('portal-mode','portal-light');updateNav();return;}
  if(isBusinessRoute){renderBusinessPage(route);updateNav();if(route==='business/messages')void loadCommunicationCenter(supabase,{business:getBusiness(),user:currentUser,escapeHTML,initialsFor});return;}
  if(route==='signup-creator'&&currentUser){localStorage.setItem(`cohort-creator-intent:${currentUser.id}`,'1');location.hash='portal/onboarding';return;}
  if(route==='portal/create-business'&&getBusiness()){location.hash='business/home';return;}
  if(route==='signup'||route==='signup-creator'||route==='login') { if(route==='signup-creator')localStorage.setItem('cohort-creator-intent-pending','1'); app.innerHTML=authPage(route); }
  if(portalRoutes.includes(route)||isMemberCommunity){app.innerHTML=portalPage(isMemberCommunity?route.slice('portal/'.length):route.split('/')[1]);revealActiveMobileNav();if(isMemberCommunity)void loadCommunityFeed(supabase,route.slice('portal/community/'.length));if(route==='portal/messages')void loadCommunicationCenter(supabase,{business:null,user:currentUser,escapeHTML,initialsFor});}
  if(route==='forgot-password') app.innerHTML=`<div class="container page"><div class="form-shell"><span class="eyebrow">Account recovery</span><h1>Reset your password.</h1><p>We will email you a secure link to choose a new password.</p><form id="reset-request-form"><label class="form-field"><span>Email address</span><input name="email" type="email" autocomplete="email" required placeholder="you@example.com"></label><button class="button button-dark" type="submit">Send reset link &rarr;</button></form><p class="auth-message" id="auth-message" role="status"></p><div class="form-foot"><a href="#login">Back to log in</a></div></div></div>`;
  if(route==='reset-password') app.innerHTML=`<div class="container page"><div class="form-shell"><span class="eyebrow">Account recovery</span><h1>Choose a new password.</h1><form id="new-password-form"><label class="form-field"><span>New password</span><input name="password" type="password" minlength="8" autocomplete="new-password" required></label><button class="button button-dark" type="submit">Update password &rarr;</button></form><p class="auth-message" id="auth-message" role="status"></p></div></div>`;
  updateNav();
}
function showError(error) {
  const message = error?.message || 'Something went wrong. Please try again.';
  const node = document.querySelector('#auth-message, #access-code-status, #redeem-access-status');
  if (node) { node.textContent = message; node.classList.add('auth-error'); }
  else portalToast(message);
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
  const communityForm = form.matches('[data-community-post-form], [data-community-reply-form]');
  if (!communityForm && !['auth-form', 'edit-profile-form', 'business-form', 'portal-search-form', 'reset-request-form', 'new-password-form', 'business-product-form', 'access-code-form', 'redeem-access-code-form', 'customer-crm-form', 'audience-segment-form', 'customer-follow-up-form', 'member-access-form', 'member-block-form', 'conversation-message-form', 'message-template-form'].includes(form.id)) return;
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
    if (form.id === 'message-template-form') {
      const name=String(data.get('name')||'').trim(),body=String(data.get('body')||'').trim(),businessId=form.dataset.businessId||getBusiness()?.id,templateId=form.dataset.templateId;
      if(name.length<2||name.length>60)throw new Error('Use a template name between 2 and 60 characters.');
      if(!body||body.length>2000)throw new Error('Write a reply of up to 2,000 characters.');
      const values={name,body,updated_at:new Date().toISOString()};
      const result=templateId?await supabase.from('creator_message_templates').update(values).eq('id',templateId).eq('business_id',businessId):await supabase.from('creator_message_templates').insert({...values,business_id:businessId,creator_id:currentUser.id});
      if(result.error){if(result.error.code==='23505')throw new Error('A saved reply with that name already exists.');throw result.error;}
      const draft=document.querySelector('#inbox-message-input')?.value||'';
      document.querySelector('.message-template-backdrop')?.remove();
      await loadCommunicationCenter(supabase,{business:getBusiness(),user:currentUser,escapeHTML,initialsFor});
      const composer=document.querySelector('#inbox-message-input');if(composer)composer.value=draft;
      portalToast(templateId?'Saved reply updated.':'Saved reply added.');
    } else if (form.id === 'customer-follow-up-form') {
      const title=String(data.get('title')||'').trim(),notes=String(data.get('notes')||'').trim(),dueAt=new Date(String(data.get('due_at')||''));
      if(title.length<3||title.length>100)throw new Error('Use a reminder title between 3 and 100 characters.');
      if(notes.length>1000)throw new Error('Keep the private note under 1,000 characters.');
      if(!Number.isFinite(dueAt.getTime()))throw new Error('Choose a valid follow-up date and time.');
      const businessId=form.dataset.businessId,customerId=form.dataset.customerId;
      const {error}=await supabase.from('customer_follow_ups').insert({business_id:businessId,customer_id:customerId,created_by:currentUser.id,title,notes,due_at:dueAt.toISOString()});
      if(error)throw error;
      await loadWorkspaceData(supabase,currentUser);
      document.querySelector('.customer-member-backdrop')?.remove();
      customerMemberDialog(getBusiness(),customerId,ordersCustomerName(customerId));
      portalToast('Follow-up reminder added.');
    } else if (form.id === 'audience-segment-form') {
      const name=String(data.get('name')||'').trim();
      if(name.length<2||name.length>50)throw new Error('Use a segment name between 2 and 50 characters.');
      const tag=String(data.get('tag')||'').trim();
      if(tag.length>24)throw new Error('Customer tags can be up to 24 characters.');
      const minSpend=Number(data.get('min_spend')||0);
      if(!Number.isFinite(minSpend)||minSpend<0)throw new Error('Enter a valid minimum spend.');
      const filters={product_id:String(data.get('product_id')||''),membership:String(data.get('membership')||'any'),tag,min_spend:minSpend,purchase_window:String(data.get('purchase_window')||'any'),activity_window:String(data.get('activity_window')||'any')};
      const values={business_id:form.dataset.businessId,created_by:currentUser.id,name,filters,updated_at:new Date().toISOString()};
      const segmentId=form.dataset.segmentId;
      const result=segmentId?await supabase.from('creator_audience_segments').update({name,filters,updated_at:values.updated_at}).eq('id',segmentId).eq('business_id',values.business_id):await supabase.from('creator_audience_segments').insert(values);
      if(result.error){if(result.error.code==='23505')throw new Error('A segment with that name already exists.');throw result.error;}
      await loadWorkspaceData(supabase,currentUser);
      document.querySelector('.audience-modal-backdrop')?.remove();
      activeAudienceFilter={id:'all',filters:{}};
      renderAuthRoute();
      portalToast('Audience segment saved.');
    } else if (form.id === 'conversation-message-form') {
      const followUpId = form.dataset.followUpId || null;
      const outcome = data.get('follow_up_outcome');
      form.dataset.messageId ||= crypto.randomUUID();
      form.querySelectorAll('textarea,select').forEach(input => { input.disabled = true; });
      await sendInboxMessage(supabase,{conversationId:form.dataset.conversationId,user:currentUser,body:data.get('body'),followUpId,outcome,messageId:form.dataset.messageId});
      form.reset();
      form.dataset.saving='false';
      delete form.dataset.messageId;
      delete form.dataset.followUpId;
      const isBusinessInbox=location.hash.slice(1)==='business/messages';
      await loadCommunicationCenter(supabase,{business:isBusinessInbox?getBusiness():null,user:currentUser,escapeHTML,initialsFor});
      portalToast(followUpId ? 'Reply sent and follow-up outcome saved.' : 'Message sent.');
      if (followUpId) {
        try { await loadWorkspaceData(supabase,currentUser); refreshBusinessNotifications(); }
        catch { portalToast('Reply and outcome saved. Refresh to update the reminder list.'); }
      }
    } else if (form.id === 'member-access-form') {
      const businessId=form.dataset.businessId,customerId=form.dataset.customerId,productId=String(data.get('product_id')||''),selectedResource=String(data.get('resource_id')||''),reason=String(data.get('reason')||'').trim(),effect=event.submitter?.value==='revoke'?'revoke':'grant';
      const [resourceProductId,resourceId]=selectedResource ? selectedResource.split('::') : [productId,null];
      if(!productId||resourceProductId!==productId)throw new Error('Choose a resource from the selected program.');
      const filters=query=>{let q=query.eq('business_id',businessId).eq('customer_id',customerId).eq('product_id',productId);q=resourceId?q.eq('resource_id',resourceId):q.is('resource_id',null);return q;};
      const {data:existing,error:lookupError}=await filters(supabase.from('customer_product_access').select('id')).maybeSingle();
      if(lookupError)throw lookupError;
      const values={business_id:businessId,customer_id:customerId,product_id:productId,resource_id:resourceId,effect,reason,created_by:currentUser.id,updated_at:new Date().toISOString()};
      const result=existing?await supabase.from('customer_product_access').update({effect,reason,updated_at:values.updated_at}).eq('id',existing.id):await supabase.from('customer_product_access').insert(values);
      if(result.error)throw result.error;
      await loadWorkspaceData(supabase,currentUser);
      document.querySelector('.customer-member-backdrop')?.remove();
      const customerName=ordersCustomerName(customerId);
      customerMemberDialog(getBusiness(),customerId,customerName);
      portalToast(effect==='grant'?'Access granted.':'Access restricted.');
    } else if (form.id === 'member-block-form') {
      const {error}=await supabase.from('business_customer_blocks').insert({business_id:form.dataset.businessId,customer_id:form.dataset.customerId,reason:String(data.get('reason')||'').trim(),created_by:currentUser.id});
      if(error)throw error;
      await loadWorkspaceData(supabase,currentUser);
      document.querySelector('.customer-member-backdrop')?.remove();
      customerMemberDialog(getBusiness(),form.dataset.customerId,ordersCustomerName(form.dataset.customerId));
      portalToast('Customer blocked from this business.');
    } else if (form.id === 'customer-crm-form') {
      const businessId=form.dataset.businessId,customerId=form.dataset.customerId;
      const note=String(data.get('note')||'').trim();
      const tags=[...new Set(String(data.get('tags')||'').split(',').map(tag=>tag.trim()).filter(Boolean))];
      if(tags.length>8)throw new Error('Add up to 8 tags per customer.');
      if(tags.some(tag=>tag.length>24))throw new Error('Each tag must be 24 characters or fewer.');
      if(note.length>2000)throw new Error('Keep notes under 2,000 characters.');
      const query=supabase.from('customer_relationships');
      if(!note&&!tags.length){
        const {error}=await query.delete().eq('business_id',businessId).eq('customer_id',customerId);
        if(error)throw error;
      }else{
        const {error}=await query.upsert({business_id:businessId,customer_id:customerId,tags,note,updated_at:new Date().toISOString()},{onConflict:'business_id,customer_id'});
        if(error)throw error;
      }
      await loadWorkspaceData(supabase,currentUser);
      document.querySelector('.customer-crm-backdrop')?.remove();
      renderAuthRoute();
      portalToast(note||tags.length?'Customer details saved.':'Customer notes and tags cleared.');
    } else if (form.id === 'auth-form') {
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
    } else if (form.id === 'access-code-form') {
      const business = getBusiness();
      if (!business || !currentUser) throw new Error('Sign in to create an access code.');
      const productId = String(data.get('product_id') || '');
      const product = business.products.find(item => item.id === productId);
      if (!product) throw new Error('Choose one of your products.');
      const label = String(data.get('label') || '').trim() || `Invite · ${product.name}`;
      const bytes = crypto.getRandomValues(new Uint8Array(20));
      const raw = [...bytes].map(value => value.toString(16).padStart(2, '0')).join('').toUpperCase();
      const code = `COH-${raw.match(/.{1,5}/g).join('-')}`;
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code.toUpperCase()));
      const codeHash = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
      const accessDays = String(data.get('access_days') || '');
      const { error } = await supabase.from('product_access_codes').insert({
        business_id: business.id,
        product_id: product.id,
        created_by: currentUser.id,
        label,
        code_hash: codeHash,
        code_hint: code.slice(-5),
        max_redemptions: Number(data.get('max_redemptions') || 1),
        access_days: accessDays ? Number(accessDays) : null,
      });
      if (error) throw error;
      await loadWorkspaceData(supabase, currentUser);
      const list = document.querySelector('#access-code-list');
      if (list) list.innerHTML = accessCodeRows();
      form.reset();
      accessCodeCreatedDialog(code, label);
    } else if (form.id === 'redeem-access-code-form') {
      const code = String(data.get('access_code') || '').trim().toUpperCase();
      const field = form.querySelector('[name="access_code"]');
      const submit = form.querySelector('button[type="submit"]');
      if (submit) submit.textContent = 'Checking code…';
      if (field) field.disabled = true;
      const { error } = await supabase.rpc('redeem_product_access', { p_code: code });
      if (error) throw error;
      await loadWorkspaceData(supabase, currentUser);
      renderAuthRoute();
      portalToast('Access added to your library.');
    } else if (communityForm) {
      const body=String(data.get('body')||'').trim(),productId=form.dataset.productId;
      if(!body)throw new Error('Write something before you post.');
      if(button)button.textContent=form.matches('[data-community-post-form]')?'Publishing…':'Replying…';
      const row=form.matches('[data-community-post-form]')
        ? {product_id:productId,author_id:currentUser.id,body}
        : {post_id:form.dataset.postId,author_id:currentUser.id,body};
      const {error}=await supabase.from(form.matches('[data-community-post-form]')?'community_posts':'community_comments').insert(row);
      if(error)throw error;
      await loadCommunityFeed(supabase,productId);
      portalToast(form.matches('[data-community-post-form]')?'Update published.':'Reply added.');
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
      const resourceTitle=String(data.get('resource_title')||'').trim(),resourceValue=String(data.get('resource_url')||'').trim(),deliverable=form._deliverableFile;
      let resourceUrl=null;
      if(resourceTitle||resourceValue){if(!resourceTitle||!resourceValue)throw new Error('Add both a name and a URL for this resource.');try{resourceUrl=new URL(resourceValue);}catch{throw new Error('Enter a valid hosted resource URL.');}if(!['https:','http:'].includes(resourceUrl.protocol))throw new Error('Resource links must start with http:// or https://.');}
      if(deliverable&&deliverable.size>50*1024*1024)throw new Error('Product files must be 50 MB or smaller.');
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
      if(deliverable)setProductSaveState(form,'Uploading private customer filesâ€¦');
      if(deliverable){if(deliverable.size>50*1024*1024)throw new Error('Product files must be 50 MB or smaller.');const safeName=deliverable.name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g,'-').slice(-120)||'download',path=`${currentUser.id}/${savedProduct.id}/${Date.now()}-${safeName}`,{error:uploadError}=await supabase.storage.from('deliverables').upload(path,deliverable,{contentType:deliverable.type||'application/octet-stream',upsert:false});if(uploadError)throw uploadError;const {error:rowError}=await supabase.from('product_deliverables').insert({product_id:savedProduct.id,kind:'file',title:deliverable.name.slice(0,120),storage_path:path});if(rowError)throw rowError;}
      if(resourceUrl){setProductSaveState(form,'Saving member resource link...');const {error:resourceError}=await supabase.from('product_deliverables').insert({product_id:savedProduct.id,kind:'link',title:resourceTitle.slice(0,120),url:resourceUrl.toString()});if(resourceError)throw resourceError;}
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
    const inline=form.querySelector('[role="status"]');
    if(inline){inline.textContent=error?.message||'Something went wrong. Please try again.';inline.classList.add('auth-error');}
    else showError(error);
  } finally {
    if(form.id==='conversation-message-form')form.querySelectorAll('textarea,select').forEach(input=>{input.disabled=false;});
    if(form.id==='redeem-access-code-form')form.querySelector('[name="access_code"]')?.removeAttribute('disabled');
    form.dataset.saving='false';if (button) {button.disabled = false;if(originalButtonText!==undefined)button.textContent=originalButtonText;}
  }
}, true);

document.addEventListener('click', async event => {
  const button=event.target.closest('[data-community-delete-post], [data-community-refresh]');
  if(!button)return;
  event.preventDefault();
  if(button.matches('[data-community-refresh]')){button.disabled=true;try{await loadCommunityFeed(supabase,button.dataset.productId);}catch(error){portalToast(error?.message||'Could not refresh this community.');}finally{button.disabled=false;}return;}
  if(!window.confirm('Delete this community post and its replies?'))return;
  const postId=button.dataset.communityDeletePost;
  const feed=button.closest('[data-community-feed]'),productId=feed?.dataset.productId;
  button.disabled=true;
  try{
    const {error}=await supabase.from('community_posts').delete().eq('id',postId);
    if(error)throw error;
    await loadCommunityFeed(supabase,productId);
    portalToast('Community post deleted.');
  }catch(error){button.disabled=false;portalToast(error?.message||'Could not delete that post.');}
}, true);

document.addEventListener('click', async event => {
  const menu = document.querySelector('#portal-account-menu');
  if (menu && !event.target.closest('.portal-top-actions')) { menu.hidden = true; document.querySelector('[data-menu-toggle]')?.setAttribute('aria-expanded','false'); }
  const notifications=document.querySelector('#business-notification-panel');if(notifications&&!event.target.closest('.business-notifications')){notifications.hidden=true;document.querySelector('[data-notification-toggle]')?.setAttribute('aria-expanded','false');}
  const target = event.target.closest('[data-menu-toggle], [data-notification-toggle], [data-theme], [data-profile-tab], [data-edit-profile], [data-close-modal], [data-notifications], [data-signout], [data-money-action], [data-business-insights], [data-business-notice], [data-product-archive], [data-product-export], [data-product-settings], [data-product-stock], [data-pricing-add], [data-pricing-remove], [data-pricing-edit], [data-pricing-done], [data-pricing-delete], [data-price-preset], [data-dialog-add-question], [data-dialog-remove-question], [data-stock-unlimited], [data-faq-add], [data-faq-remove], [data-checkout-question-add], [data-product-copy], [data-stock-url], [data-analytics-customize], [data-analytics-date], [data-analytics-shift], [data-customer-export], [data-customer-crm], [data-customer-open], [data-audience-create], [data-audience-delete], [data-audience-filter], [data-follow-up-done], [data-follow-up-message], [data-follow-up-reopen], [data-follow-up-conversation], [data-member-entitlement-revoke], [data-member-entitlement-restore], [data-member-access-reset], [data-member-unblock], [data-resource-progress], [data-copy-link], [data-customer-download], [data-access-code-disable], [data-access-revoke], [data-deliverable-delete], [data-password-toggle], [data-inbox-open], [data-inbox-refresh], [data-message-customer], [data-template-insert], [data-template-save], [data-template-manage], [data-template-edit], [data-template-delete], [data-template-new], [data-template-close]');
  if (!target) return;
  event.preventDefault();
  if(target.matches('[data-notification-toggle]')){const panel=document.querySelector('#business-notification-panel'),open=panel?.hidden;if(panel)panel.hidden=!open;target.setAttribute('aria-expanded',String(Boolean(open)));return;}
  if(target.matches('[data-audience-create]')){audienceSegmentDialog(getBusiness());return;}
  if(target.matches('[data-audience-filter]')){try{activeAudienceFilter={id:target.dataset.audienceFilter,name:target.querySelector('b')?.textContent||'audience',filters:JSON.parse(target.dataset.audienceFilters||'{}')};document.querySelectorAll('[data-audience-filter]').forEach(item=>item.classList.toggle('is-active',item===target));document.querySelector('#business-customer-search')?.dispatchEvent(new Event('input',{bubbles:true}));}catch{portalToast('Could not open this audience filter.');}return;}
  if(target.matches('[data-audience-delete]')){const segment=workspace.audienceSegments.find(item=>item.id===target.dataset.audienceDelete);if(!segment)return;if(!window.confirm(`Delete the saved audience “${segment.name}”?`))return;try{const {error}=await supabase.from('creator_audience_segments').delete().eq('id',segment.id).eq('business_id',getBusiness()?.id);if(error)throw error;activeAudienceFilter={id:'all',filters:{}};await loadWorkspaceData(supabase,currentUser);renderAuthRoute();portalToast('Saved audience deleted.');}catch(error){portalToast(error?.message||'Could not delete this audience.');}return;}
  if(target.matches('[data-follow-up-message]')){try{const customerName=target.dataset.followUpCustomer||'there',firstName=customerName.split(/\s+/)[0],taskTitle=target.dataset.followUpTitle||'your program';const conversationId=await createCustomerConversation(supabase,{businessId:getBusiness()?.id,customerId:target.dataset.followUpMessage,user:currentUser});selectInboxConversation(conversationId,`Hi ${firstName}, just checking in about ${taskTitle}. How are things going? Let me know if you need any help.`,{id:target.dataset.followUpId,title:taskTitle});document.querySelector('.customer-member-backdrop')?.remove();if(location.hash.slice(1)==='business/messages')await loadCommunicationCenter(supabase,{business:getBusiness(),user:currentUser,escapeHTML,initialsFor});else location.hash='business/messages';portalToast('Draft ready in your inbox. Review it before sending.');}catch(error){portalToast(error?.message||'Could not prepare a message draft.');}return;}
  if(target.matches('[data-follow-up-conversation]')) {
    selectInboxConversation(target.dataset.followUpConversation);
    document.querySelector('.customer-member-backdrop')?.remove();
    location.hash='business/messages';
    return;
  }
  if(target.matches('[data-follow-up-reopen]')) {
    const task=workspace.customerFollowUps.find(row=>row.id===target.dataset.followUpReopen);
    if(!task)return;
    target.disabled=true;
    try {
      const {data:updated,error}=await supabase.from('customer_follow_ups').update({status:'open',completed_at:null,updated_at:new Date().toISOString()}).eq('id',task.id).eq('business_id',getBusiness()?.id).select('id').single();
      if(error)throw error;
      await loadWorkspaceData(supabase,currentUser);
      document.querySelector('.customer-member-backdrop')?.remove();
      customerMemberDialog(getBusiness(),task.customer_id,ordersCustomerName(task.customer_id));
      portalToast('Reminder reopened.');
    } catch(error){target.disabled=false;portalToast(error.message||'Could not reopen reminder.');}
    return;
  }
  if(target.matches('[data-follow-up-done]')){const task=workspace.customerFollowUps.find(row=>row.id===target.dataset.followUpDone);if(!task||task.status!=='open')return;try{const {error}=await supabase.from('customer_follow_ups').update({status:'done',completed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',task.id).eq('business_id',getBusiness()?.id);if(error)throw error;await loadWorkspaceData(supabase,currentUser);if(document.querySelector('.customer-member-backdrop')){document.querySelector('.customer-member-backdrop')?.remove();customerMemberDialog(getBusiness(),task.customer_id,ordersCustomerName(task.customer_id));}else renderAuthRoute();portalToast('Follow-up marked complete.');}catch(error){portalToast(error?.message||'Could not update this reminder.');}return;}
  if(target.matches('[data-password-toggle]')){const input=target.closest('.auth-input-wrap')?.querySelector('input');if(input){const reveal=input.type==='password';input.type=reveal?'text':'password';target.setAttribute('aria-label',reveal?'Hide password':'Show password');target.classList.toggle('is-visible',reveal);}return;}
  if(target.matches('[data-template-insert]')){const id=document.querySelector('#message-template-select')?.value,template=document.querySelector('#inbox-shell')?._messageTemplates?.find(row=>row.id===id);if(!template){portalToast('Choose a saved reply first.');return;}const composer=document.querySelector('#inbox-message-input');if(composer?.value.trim()&&!window.confirm('Replace the current draft with this saved reply?'))return;if(composer){composer.value=template.body;composer.focus();}return;}
  if(target.matches('[data-template-save]')){const draft=document.querySelector('#inbox-message-input')?.value||'';document.body.append(messageTemplateEditor({business_id:getBusiness()?.id,body:draft},escapeHTML));document.querySelector('.message-template-modal input[name="name"]')?.focus();return;}
  if(target.matches('[data-template-manage]')){const templates=document.querySelector('#inbox-shell')?._messageTemplates||[];document.body.append(messageTemplateManager(templates,escapeHTML));return;}
  if(target.matches('[data-template-new]')){target.closest('.message-template-backdrop')?.remove();document.body.append(messageTemplateEditor({business_id:getBusiness()?.id},escapeHTML));document.querySelector('.message-template-modal input[name="name"]')?.focus();return;}
  if(target.matches('[data-template-edit]')){const template=document.querySelector('#inbox-shell')?._messageTemplates?.find(row=>row.id===target.dataset.templateEdit);if(!template)return;target.closest('.message-template-backdrop')?.remove();document.body.append(messageTemplateEditor(template,escapeHTML));document.querySelector('.message-template-modal input[name="name"]')?.focus();return;}
  if(target.matches('[data-template-delete]')){const template=document.querySelector('#inbox-shell')?._messageTemplates?.find(row=>row.id===target.dataset.templateDelete);if(!template)return;if(!window.confirm(`Delete saved reply "${template.name}"?`))return;try{const {error}=await supabase.from('creator_message_templates').delete().eq('id',template.id).eq('business_id',getBusiness()?.id).eq('creator_id',currentUser.id);if(error)throw error;const draft=document.querySelector('#inbox-message-input')?.value||'';await loadCommunicationCenter(supabase,{business:getBusiness(),user:currentUser,escapeHTML,initialsFor});const composer=document.querySelector('#inbox-message-input');if(composer)composer.value=draft;document.body.append(messageTemplateManager(document.querySelector('#inbox-shell')?._messageTemplates||[],escapeHTML));portalToast('Saved reply deleted.');}catch(error){portalToast(error?.message||'Could not delete this saved reply.');}return;}
  if(target.matches('[data-template-close]')){target.closest('.message-template-backdrop')?.remove();return;}
  if(target.matches('[data-inbox-open]')){selectInboxConversation(target.dataset.inboxOpen);await loadCommunicationCenter(supabase,{business:location.hash.slice(1)==='business/messages'?getBusiness():null,user:currentUser,escapeHTML,initialsFor});return;}
  if(target.matches('[data-inbox-refresh]')){target.disabled=true;await loadCommunicationCenter(supabase,{business:location.hash.slice(1)==='business/messages'?getBusiness():null,user:currentUser,escapeHTML,initialsFor});return;}
  if(target.matches('[data-message-customer]')){try{await createCustomerConversation(supabase,{businessId:target.dataset.businessId||getBusiness()?.id,customerId:target.dataset.messageCustomer,user:currentUser});document.querySelector('.customer-member-backdrop')?.remove();if(location.hash.slice(1)==='business/messages')await loadCommunicationCenter(supabase,{business:getBusiness(),user:currentUser,escapeHTML,initialsFor});else location.hash='business/messages';portalToast('Private conversation opened.');}catch(error){portalToast(error?.message||'Could not open a conversation with this customer.');}return;}
  if(target.matches('[data-customer-download]')){const path=target.dataset.customerDownload,name=(target.dataset.downloadName||'cohort-download').replace(/[^a-zA-Z0-9._-]+/g,'-');target.disabled=true;target.textContent='Preparingâ€¦';try{const {data,error}=await supabase.storage.from('deliverables').download(path);if(error)throw error;const url=URL.createObjectURL(data),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1500);portalToast('Your download is ready.');}catch(error){portalToast(error?.message||'Could not access this file.');}finally{target.disabled=false;target.textContent='Download';}return;}
  if(target.matches('[data-deliverable-delete]')){if(!window.confirm('Remove this resource from the product? Customers will lose access to it.'))return;const form=document.querySelector('#business-product-form'),productId=form?.dataset.productId,path=target.dataset.deliverablePath;try{if(path){const {error:storageError}=await supabase.storage.from('deliverables').remove([path]);if(storageError)throw storageError;}const {error}=await supabase.from('product_deliverables').delete().eq('id',target.dataset.deliverableDelete).eq('product_id',productId);if(error)throw error;await loadWorkspaceData(supabase,currentUser);renderAuthRoute();portalToast('Product resource removed.');}catch(error){portalToast(error?.message||'Could not remove this resource.');}return;}
  if(target.matches('[data-access-code-disable]')){if(!window.confirm('Revoke this code? Anyone who has not redeemed it will lose access to this invite.'))return;try{const {error}=await supabase.from('product_access_codes').update({disabled_at:new Date().toISOString()}).eq('id',target.dataset.accessCodeDisable).eq('business_id',getBusiness()?.id);if(error)throw error;await loadWorkspaceData(supabase,currentUser);renderAuthRoute();portalToast('Access code revoked.');}catch(error){portalToast(error?.message||'Could not revoke this code.');}return;}
  if(target.matches('[data-access-revoke]')){if(!window.confirm('Revoke this member?s access now? Their order record will remain unchanged.'))return;try{const entitlement=workspace.entitlements.find(row=>row.id===target.dataset.accessRevoke);if(!entitlement)throw new Error('This access record is no longer available.');const {data:override,error:lookupError}=await supabase.from('customer_product_access').select('id').eq('business_id',entitlement.business_id).eq('customer_id',entitlement.buyer_id).eq('product_id',entitlement.product_id).is('resource_id',null).maybeSingle();if(lookupError)throw lookupError;const values={effect:'revoke',reason:'Creator revoked purchased access',updated_at:new Date().toISOString()};const change=override?await supabase.from('customer_product_access').update(values).eq('id',override.id):await supabase.from('customer_product_access').insert({...values,business_id:entitlement.business_id,customer_id:entitlement.buyer_id,product_id:entitlement.product_id,resource_id:null,created_by:currentUser.id});if(change.error)throw change.error;const {error}=await supabase.from('entitlements').update({status:'revoked',ends_at:new Date().toISOString()}).eq('id',entitlement.id).eq('business_id',getBusiness()?.id);if(error)throw error;await loadWorkspaceData(supabase,currentUser);renderAuthRoute();portalToast('Member access revoked.');}catch(error){portalToast(error?.message||'Could not revoke access.');}return;}
  if(target.matches('[data-customer-crm]')){const customerId=target.dataset.customerCrm,order=workspace.orders.find(item=>item.buyer_id===customerId),demo=order?.is_demo,displayName=demo?(order.answers?.demo_customer_name||`Demo customer ${customerId.slice(0,6)}`):`Customer ${customerId.slice(0,6)}`,relationship=workspace.customerRelationships.find(item=>item.customer_id===customerId)||{};customerCrmDialog(getBusiness()?.id,customerId,displayName,relationship);return;}
  if(target.matches('[data-customer-open]')){const customerId=target.dataset.customerOpen;customerMemberDialog(getBusiness(),customerId,ordersCustomerName(customerId));return;}
  if(target.matches('[data-member-entitlement-revoke]')){if(!window.confirm('Revoke this purchased program access? The order will remain unchanged.'))return;try{const entitlement=workspace.entitlements.find(row=>row.id===target.dataset.memberEntitlementRevoke);if(!entitlement)throw new Error('This access record is no longer available.');const scoped=supabase.from('customer_product_access').select('id').eq('business_id',entitlement.business_id).eq('customer_id',entitlement.buyer_id).eq('product_id',entitlement.product_id).is('resource_id',null);const {data:override,error:lookupError}=await scoped.maybeSingle();if(lookupError)throw lookupError;const access={business_id:entitlement.business_id,customer_id:entitlement.buyer_id,product_id:entitlement.product_id,resource_id:null,effect:'revoke',reason:'Creator revoked purchased access',created_by:currentUser.id,updated_at:new Date().toISOString()};const changed=override?await supabase.from('customer_product_access').update({effect:'revoke',reason:access.reason,updated_at:access.updated_at}).eq('id',override.id):await supabase.from('customer_product_access').insert(access);if(changed.error)throw changed.error;const {error}=await supabase.from('entitlements').update({status:'revoked',ends_at:new Date().toISOString()}).eq('id',entitlement.id).eq('business_id',getBusiness()?.id);if(error)throw error;await loadWorkspaceData(supabase,currentUser);document.querySelector('.customer-member-backdrop')?.remove();customerMemberDialog(getBusiness(),entitlement.buyer_id,ordersCustomerName(entitlement.buyer_id));portalToast('Program access revoked.');}catch(error){portalToast(error?.message||'Could not revoke access.');}return;}
  if(target.matches('[data-member-entitlement-restore]')){try{const entitlement=workspace.entitlements.find(row=>row.id===target.dataset.memberEntitlementRestore);if(!entitlement)throw new Error('This access record is no longer available.');const {error}=await supabase.from('entitlements').update({status:'active',ends_at:null}).eq('id',entitlement.id).eq('business_id',getBusiness()?.id);if(error)throw error;const {data:override}=await supabase.from('customer_product_access').select('id').eq('business_id',entitlement.business_id).eq('customer_id',entitlement.buyer_id).eq('product_id',entitlement.product_id).is('resource_id',null).eq('effect','revoke').maybeSingle();if(override){const removed=await supabase.from('customer_product_access').delete().eq('id',override.id);if(removed.error)throw removed.error;}await loadWorkspaceData(supabase,currentUser);document.querySelector('.customer-member-backdrop')?.remove();customerMemberDialog(getBusiness(),entitlement.buyer_id,ordersCustomerName(entitlement.buyer_id));portalToast('Purchased access restored.');}catch(error){portalToast(error?.message||'Could not restore access.');}return;}
  if(target.matches('[data-member-access-reset]')){try{const {error}=await supabase.from('customer_product_access').delete().eq('id',target.dataset.memberAccessReset).eq('business_id',getBusiness()?.id);if(error)throw error;const customerId=workspace.customerAccess.find(row=>row.id===target.dataset.memberAccessReset)?.customer_id;await loadWorkspaceData(supabase,currentUser);document.querySelector('.customer-member-backdrop')?.remove();customerMemberDialog(getBusiness(),customerId,ordersCustomerName(customerId));portalToast('Access override removed.');}catch(error){portalToast(error?.message||'Could not remove access override.');}return;}
  if(target.matches('[data-member-unblock]')){try{const customerId=workspace.customerBlocks.find(row=>row.id===target.dataset.memberUnblock)?.customer_id;const {error}=await supabase.from('business_customer_blocks').delete().eq('id',target.dataset.memberUnblock).eq('business_id',getBusiness()?.id);if(error)throw error;await loadWorkspaceData(supabase,currentUser);document.querySelector('.customer-member-backdrop')?.remove();customerMemberDialog(getBusiness(),customerId,ordersCustomerName(customerId));portalToast('Customer access restored.');}catch(error){portalToast(error?.message||'Could not restore access.');}return;}
  if(target.matches('[data-resource-progress]')){try{const resourceId=target.dataset.resourceProgress,existing=workspace.resourceProgress.find(row=>row.resource_id===resourceId&&row.completed_at),productId=target.dataset.productId;target.disabled=true;const value={business_id:target.dataset.businessId,customer_id:currentUser.id,product_id:productId,resource_id:resourceId,completed_at:existing?null:new Date().toISOString(),updated_at:new Date().toISOString()};const {error}=await supabase.from('member_resource_progress').upsert(value,{onConflict:'customer_id,resource_id'});if(error)throw error;await loadWorkspaceData(supabase,currentUser);renderAuthRoute();portalToast(existing?'Completion status cleared.':'Resource marked complete.');}catch(error){target.disabled=false;portalToast(error?.message||'Could not save progress.');}return;}
  if(target.matches('[data-copy-link]')){await navigator.clipboard.writeText(`${location.origin}${target.dataset.copyLink}`);portalToast('Product link copied.');return;}
  if (target.matches('[data-menu-toggle]')) {
    const panel = document.querySelector('#portal-account-menu');
    panel.hidden = !panel.hidden;
    target.setAttribute('aria-expanded', String(!panel.hidden));
    if(!panel.hidden)panel.querySelector('a,button')?.focus({preventScroll:true});
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
  if(target.matches('[data-customer-export]')){const headers=activeCustomerTab==='Customers'?['Customer ID','Email','Status','Country','Total spend (INR)','Joined at','Tags']:['Member ID','Email','Plan','Status','Price (INR)','Started','Renews'];let rows=[];if(activeCustomerTab==='Customers'){const byBuyer=new Map();for(const order of workspace.orders){if(!order.buyer_id)continue;const relation=workspace.customerRelationships.find(item=>item.customer_id===order.buyer_id),row=byBuyer.get(order.buyer_id)||[order.buyer_id.slice(0,8),order.is_demo?(order.answers?.demo_customer_email||'demo@cohort.invalid'):'Private to customer',order.status==='paid'?'Joined':'Order pending',order.is_demo?(order.answers?.demo_country||'India'):'—',0,order.created_at,(relation?.tags||[]).join('; ')];if(order.status==='paid')row[4]+=moneyFromPaise(order.amount_paise);byBuyer.set(order.buyer_id,row);}rows=[...byBuyer.values()];}else if(activeCustomerTab==='Memberships')rows=workspace.entitlements.map(item=>[String(item.buyer_id||'').slice(0,8),'Private to member',item.products?.name||'Membership',item.status,moneyFromPaise(item.products?.prices?.[0]?.amount_paise),item.starts_at||'',item.ends_at||'']);const csv=[headers,...rows].map(row=>row.map(value=>`"${String(value??'').replace(/"/g,'""')}"`).join(',')).join('\n'),url=URL.createObjectURL(new Blob([csv],{type:'text/csv'})),link=document.createElement('a');link.href=url;link.download=`cohort-${activeCustomerTab.toLowerCase()}.csv`;link.click();URL.revokeObjectURL(url);portalToast(`${activeCustomerTab} exported.`);return;}
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

document.addEventListener('keydown', event => {
  if(event.key==='Escape'){
    const menu=document.querySelector('#portal-account-menu');
    if(menu&&!menu.hidden){menu.hidden=true;const toggle=document.querySelector('[data-menu-toggle]');toggle?.setAttribute('aria-expanded','false');toggle?.focus();}
    document.querySelector('.portal-modal-backdrop')?.remove();
  }
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){
    const search=document.querySelector('#portal-search-form input,#search-toggle');
    if(search){event.preventDefault();if(search.id==='search-toggle'){location.hash='explore';}else search.focus();}
  }
});

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

renderAuthRoute();
try {
  supabase = await connectSupabase();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  currentUser = data.session?.user || null;
  await loadWorkspaceData(supabase, currentUser);
  workspaceLoading = false;
  supabase.auth.onAuthStateChange((event, session) => {
    currentUser = session?.user || null;
    if (currentUser && workspace.profile?.id !== currentUser.id) workspaceLoading = true;
    updateNav();
    setTimeout(async () => {
      try { await loadWorkspaceData(supabase, currentUser); workspaceLoading = false; renderAuthRoute(); }
      catch (loadError) { workspaceLoading = false; initError = loadError?.message || ''; renderAuthRoute(); }
    }, 0);
    if(event==='SIGNED_IN'&&session?.user){const pending=localStorage.getItem('cohort-creator-intent-pending')==='1';if(pending)localStorage.setItem(`cohort-creator-intent:${session.user.id}`,'1');localStorage.removeItem('cohort-creator-intent-pending');if(['#login','#signup','#signup-creator'].includes(location.hash))location.hash=(pending||localStorage.getItem(`cohort-creator-intent:${session.user.id}`)==='1')?'portal/onboarding':'portal/profile';}
  });
  window.cohortAuth = { client: supabase, get user() { return currentUser; } };
  renderAuthRoute();
} catch (error) {
  workspaceLoading = false;
  initError = error?.message || 'Supabase could not be reached.';
  window.cohortCatalogError=true;window.cohortMarketProducts=[];window.dispatchEvent(new CustomEvent('cohort:catalog-ready'));
  renderAuthRoute();
}

