const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]));

function productShell({ title, description, image, url, notFound = false }) {
  const pageTitle = notFound ? 'Offer not found — Cohort' : `${title} — Cohort`;
  const summary = description || 'Discover digital products and memberships by independent creators in India.';
  const imageMeta = image ? `<meta property="og:image" content="${escapeHtml(image)}"><meta name="twitter:image" content="${escapeHtml(image)}">` : '';
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#f7f6f1"><meta name="description" content="${escapeHtml(summary)}"><title>${escapeHtml(pageTitle)}</title><link rel="canonical" href="${escapeHtml(url)}"><meta property="og:type" content="product"><meta property="og:site_name" content="Cohort"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(summary)}"><meta property="og:url" content="${escapeHtml(url)}">${imageMeta}<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}"><meta name="twitter:title" content="${escapeHtml(title)}"><meta name="twitter:description" content="${escapeHtml(summary)}"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet"><link rel="stylesheet" href="/styles.css?v=cohort-v1"><link rel="stylesheet" href="/styles/creator-onboarding.css?v=cohort-v1"></head><body><div class="announcement"><span class="spark">✳</span> Your next favourite thing is made in India <a href="/#explore">Explore the marketplace ↗</a></div><header class="topbar"><a class="brand" href="/#home" aria-label="Cohort home"><span class="brand-mark">C</span><span>cohort<span class="brand-dot">.</span></span></a><nav class="main-nav"><a href="/#explore">Explore</a><a href="/#communities">Communities</a><a href="/#creators">For creators</a></nav><div class="nav-actions"><a class="login-link" href="/#login">Log in</a><a class="button button-dark button-sm" href="/#signup">Start selling ↗</a></div></header><main id="app">${notFound ? '<div class="container page"><div class="empty-state"><b>This offer is not available.</b><p>It may have been unpublished or the link may have changed.</p><a class="button button-dark" href="/#explore">Browse Cohort</a></div></div>' : '<div class="container page"><section class="product-page-loading"><span class="cohort-spinner" aria-hidden="true"></span><b>Opening this creator’s offer…</b><p>Loading product details and available plans.</p></section></div>'}</main><footer class="footer"><div class="footer-bottom"><span>© 2026 Cohort Technologies Pvt. Ltd.</span><span>Made in India · INR ₹</span></div></footer><div class="toast" id="toast" role="status"></div><script type="module" src="/src/marketplace/app.js"></script><script type="module" src="/vendor/auth.js"></script></body></html>`;
}

export default async function handler(request, response) {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;
  const pieces = String(request.query?.path || '').split('/').filter(Boolean);
  const [handle, slug] = pieces;
  const forwardedHost = request.headers['x-forwarded-host'] || request.headers.host || 'cohort-vol-1.vercel.app';
  const protocol = request.headers['x-forwarded-proto'] || 'https';
  const origin = `${protocol}://${forwardedHost}`;
  const pageUrl = `${origin}/p/${encodeURIComponent(handle || '')}/${encodeURIComponent(slug || '')}`;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return response.status(503).send('Cohort is temporarily unavailable.');
  if (!handle || !slug) return response.status(404).setHeader('Content-Type', 'text/html; charset=utf-8').send(productShell({ title: 'Offer not found', url: pageUrl, notFound: true }));

  try {
    const endpoint = new URL('/rest/v1/products', SUPABASE_URL);
    endpoint.searchParams.set('select', 'name,headline,description,media_url,slug,businesses!inner(name,handle)');
    endpoint.searchParams.set('slug', `eq.${slug}`);
    endpoint.searchParams.set('businesses.handle', `eq.${handle}`);
    endpoint.searchParams.set('status', 'eq.visible');
    endpoint.searchParams.set('listed', 'eq.true');
    endpoint.searchParams.set('limit', '1');
    const result = await fetch(endpoint, { headers: { apikey: SUPABASE_ANON_KEY, authorization: `Bearer ${SUPABASE_ANON_KEY}` } });
    if (!result.ok) throw new Error('Product lookup failed.');
    const [product] = await result.json();
    if (!product) return response.status(404).setHeader('Content-Type', 'text/html; charset=utf-8').send(productShell({ title: 'Offer not found', url: pageUrl, notFound: true }));
    const media = product.media_url;
    const image = media && /^https?:\/\//i.test(media) ? media : '';
    const description = product.headline || product.description || `Explore ${product.name} by ${product.businesses?.name || 'an independent creator'} on Cohort.`;
    response.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=600');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    return response.status(200).setHeader('Content-Type', 'text/html; charset=utf-8').send(productShell({ title: product.name, description, image, url: pageUrl }));
  } catch {
    return response.status(503).setHeader('Content-Type', 'text/html; charset=utf-8').send(productShell({ title: 'Offer temporarily unavailable', url: pageUrl, notFound: true }));
  }
}
