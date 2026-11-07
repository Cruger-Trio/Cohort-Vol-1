import { skeletonFeed } from '../ui/skeletons.js';
import { spaceCard } from '../ui/space-card.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const active = item => item?.status === 'active' && (!item.starts_at || new Date(item.starts_at) <= new Date()) && (!item.ends_at || new Date(item.ends_at) > new Date());
const initials = name => String(name || 'C').trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
const displayName = (profile, fallback = 'Cohort member') => profile?.full_name || (profile?.username ? `@${profile.username}` : fallback);
const productSpaces = business => (business?.products || []).filter(product => ['Community', 'Membership'].includes(product.type));

export function businessCommunity(business, productId = '') {
  const spaces = productSpaces(business);
  const selected = spaces.find(product => product.id === productId);
  if (productId && selected) {
    return `<div class="portal-page-heading"><div><span class="portal-kicker">MEMBER SPACE</span><h1>${esc(selected.name)}</h1><p>${esc(selected.description || 'Share updates and keep your members close.')}</p></div><a class="portal-action" href="#business/community">All spaces</a></div>
      <section class="portal-panel community-composer"><div class="community-composer-head"><span class="community-avatar">${esc(initials(business.name))}</span><span><b>Post an update</b><small>Your active members will see this in their Cohort community.</small></span></div><form data-community-post-form data-product-id="${esc(selected.id)}"><label class="sr-only" for="community-post-body">Your update</label><textarea id="community-post-body" name="body" maxlength="4000" rows="4" placeholder="Share a lesson, announcement, prompt, or useful link…" required></textarea><div class="community-form-footer"><span>Plain text · up to 4,000 characters</span><button class="button button-primary" type="submit">Publish update</button></div><p class="auth-message" data-community-status role="status"></p></form></section>
      <section class="community-feed-section"><div class="community-feed-heading"><div><h2>Member conversation</h2><p>Posts and replies from this space.</p></div><button class="portal-action" data-community-refresh type="button" data-product-id="${esc(selected.id)}">Refresh</button></div><div class="community-feed" data-community-feed data-product-id="${esc(selected.id)}" data-owner="true" data-viewer-name="${esc(business.name)}">${skeletonFeed()}</div></section>`;
  }
  const cards = spaces.map((product, index) => {
    const members = (business.entitlements || []).filter(item => item.product_id === product.id && active(item)).length;
    return spaceCard({ href: `#business/community/${encodeURIComponent(product.id)}`, title: product.name, type: product.type, detail: `${members} active ${members === 1 ? 'member' : 'members'}`, action: 'Manage space', index });
  }).join('');
  return `<div class="portal-page-heading"><div><span class="portal-kicker">AUDIENCE</span><h1>Community</h1><p>Bring your member updates and conversations into Cohort.</p></div><a class="button button-primary" href="#business/product-new">Create a membership</a></div>
    ${spaces.length ? `<section class="community-space-list">${cards}</section>` : `<section class="portal-panel"><div class="portal-empty-state"><span>✳</span><b>Start with a member space</b><p>Create a Community or Membership product. Its active members can then read your updates and reply from their own Cohort portal.</p><a class="button button-primary" href="#business/product-new">Create a member product</a></div></section>`}`;
}

export function memberCommunity(membership) {
  const product = membership?.products || {};
  if (!membership || !active(membership)) return `<div class="portal-page-heading"><span class="portal-kicker">MEMBER SPACE</span><h1>Access ended</h1><p>This community is no longer available to your account.</p></div><a class="text-link" href="#portal/communities">Back to my communities →</a>`;
  return `<div class="portal-page-heading"><div><span class="portal-kicker">${esc(membership.businesses?.name || 'COHORT COMMUNITY')}</span><h1>${esc(product.name || 'Member space')}</h1><p>${esc(product.headline || product.type || 'Updates and conversation with your creator.')}</p></div><a class="portal-action" href="#portal/communities">All communities</a></div>
    <section class="portal-panel community-composer member-reply-intro"><b>Welcome to the conversation</b><p>Read creator updates, ask a thoughtful question, or share what you’re learning.</p></section>
    <section class="community-feed-section"><div class="community-feed-heading"><div><h2>Latest updates</h2><p>From ${esc(membership.businesses?.name || 'your creator')} and the members in this space.</p></div><button class="portal-action" data-community-refresh type="button" data-product-id="${esc(membership.product_id)}">Refresh</button></div><div class="community-feed" data-community-feed data-product-id="${esc(membership.product_id)}" data-owner="false" data-viewer-name="${esc(displayName(membership._viewerProfile))}">${skeletonFeed()}</div></section>`;
}

export function memberCommunities(memberships = []) {
  const items = memberships.filter(item => ['Community', 'Membership'].includes(item.products?.type) && active(item));
  const cards = items.map((item, index) => spaceCard({ href: `#portal/community/${encodeURIComponent(item.product_id)}`, title: item.products?.name, type: item.products?.type, detail: `${item.businesses?.name || 'Cohort creator'} · ${item.ends_at ? `Access until ${new Date(item.ends_at).toLocaleDateString('en-IN')}` : 'Active membership'}`, index })).join('');
  return `<div class="portal-page-heading"><span class="portal-kicker">YOUR MEMBERSHIPS</span><h1>Communities</h1><p>Your creator spaces, conversations and member updates.</p></div>${cards ? `<div class="community-space-list">${cards}</div>` : `<section class="portal-panel"><div class="portal-empty-state"><span>✳</span><b>No active community spaces</b><p>When you join a creator’s Community or Membership offer, its updates and discussions will show up here.</p><a class="button button-primary" href="#communities">Explore Cohort →</a></div></section>`}`;
}

export async function loadCommunityFeed(supabase, productId) {
  const feed = [...document.querySelectorAll('[data-community-feed]')].find(node => node.dataset.productId === productId);
  if (!feed) return;
  feed.innerHTML = skeletonFeed();
  const { data: posts, error } = await supabase.from('community_posts')
    .select('id,product_id,author_id,author_name,body,pinned,created_at,community_comments(id,author_id,author_name,body,created_at)')
    .eq('product_id', productId).order('pinned', { ascending: false }).order('created_at', { ascending: false });
  if (error) {
    feed.innerHTML = `<div class="community-feed-empty"><b>Could not load this conversation</b><p>${esc(error.message)}</p></div>`;
    return;
  }
  if (!posts?.length) {
    feed.innerHTML = `<div class="community-feed-empty"><span>✳</span><b>${feed.dataset.owner === 'true' ? 'Your space is ready' : 'A quiet start'}</b><p>${feed.dataset.owner === 'true' ? 'Post your first update to welcome members and start a conversation.' : 'The creator has not posted an update here yet. Check back soon.'}</p></div>`;
    return;
  }
  feed.innerHTML = posts.map(post => {
    const author = post.author_name || 'Cohort creator';
    const comments = (post.community_comments || []).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    return `<article class="community-post"><header class="community-post-head"><span class="community-avatar">${esc(initials(author))}</span><span class="community-post-author"><b>${esc(author)}</b><small>${new Date(post.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}${post.pinned ? ' · Pinned' : ''}</small></span>${feed.dataset.owner === 'true' ? `<button class="community-delete" type="button" data-community-delete-post="${esc(post.id)}" aria-label="Delete post">Delete</button>` : ''}</header><div class="community-post-body">${esc(post.body).replace(/\r?\n/g, '<br>')}</div><div class="community-replies">${comments.map(comment => {
      const replyName = comment.author_name || 'Cohort member';
      return `<div class="community-reply"><span class="community-avatar community-avatar-small">${esc(initials(replyName))}</span><div><div class="community-reply-meta"><b>${esc(replyName)}</b><small>${new Date(comment.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</small></div><p>${esc(comment.body).replace(/\r?\n/g, '<br>')}</p></div></div>`;
    }).join('')}</div><form class="community-reply-form" data-community-reply-form data-post-id="${esc(post.id)}" data-product-id="${esc(productId)}"><label class="sr-only" for="reply-${esc(post.id)}">Reply to ${esc(author)}</label><input id="reply-${esc(post.id)}" name="body" maxlength="2000" placeholder="Write a helpful reply…" required><button class="portal-action" type="submit">Reply</button></form></article>`;
  }).join('');
}
