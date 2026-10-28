const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function creatorOnboarding({ profile, business }) {
  const products = business?.products || [];
  const profileReady = !!(profile?.full_name && profile?.username && profile?.bio && profile?.avatar_url);
  const businessReady = !!business;
  const published = products.find(product => product.status === 'visible' && product.listed);
  const unfinished = products.find(product => product.status !== 'archived');
  const productReady = !!published;
  const steps = [
    { title: 'Build your creator profile', description: 'Add your name, public username, photo and a short introduction.', done: profileReady, action: true, label: profileReady ? 'Edit profile' : 'Complete profile' },
    { title: 'Create your business', description: 'Set up the storefront that brings your products and community together.', done: businessReady, href: '#portal/create-business', label: businessReady ? 'Business created' : 'Create business' },
    { title: 'Create and publish a product', description: 'Add your offer, pricing and the file or material customers will receive.', done: productReady, href: productReady ? `/p/${encodeURIComponent(business.handle)}/${encodeURIComponent(published.slug)}` : unfinished ? `#business/product-edit/${encodeURIComponent(unfinished.id)}` : businessReady ? '#business/product-new' : '#portal/create-business', label: productReady ? 'View public product' : unfinished ? 'Finish and publish product' : 'Create first product' },
  ];
  const complete = steps.every(step => step.done);
  const productPath = published ? `/p/${published.businessHandle}/${published.slug}` : '';
  return `<div class="creator-onboarding"><header class="onboarding-intro"><span class="portal-kicker">CREATOR SETUP</span><h1>${complete ? 'Your creator page is ready to meet the world.' : 'Let’s get your creator business ready.'}</h1><p>${complete ? 'Your product is published and can be shared with anyone.' : 'A few guided steps will take you from profile to your first public offer.'}</p><div class="onboarding-progress"><span style="width:${Math.round(steps.filter(step => step.done).length / steps.length * 100)}%"></span></div><small>${steps.filter(step => step.done).length} of ${steps.length} steps complete</small></header><section class="onboarding-steps">${steps.map((step,index)=>{const locked=(index===1&&!profileReady)||(index===2&&(!profileReady||!businessReady));return `<article class="onboarding-step ${step.done?'is-done':''}"><span class="onboarding-step-number">${step.done?'✓':index+1}</span><div><h2>${esc(step.title)}</h2><p>${esc(step.description)}</p>${step.action?`<button class="button button-primary" data-edit-profile>${esc(step.label)} →</button>`:locked?`<button class="button portal-action" type="button" disabled>${esc(step.label)}</button>`:`<a class="button ${step.done?'portal-action':'button-primary'}" href="${esc(step.href)}">${esc(step.label)}${step.done?'':' →'}</a>`}</div></article>`}).join('')}</section>${complete?`<section class="onboarding-share"><b>Your public product link</b><a href="${esc(productPath)}">${location.origin}${esc(productPath)}</a><button class="portal-action" type="button" data-copy-link="${esc(productPath)}">Copy link</button></section>`:''}<footer><a href="#portal/profile">Go to personal portal</a>${business?`<a href="#business/home">Open business workspace →</a>`:''}</footer></div>`;
}
