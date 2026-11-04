import { workspace, moneyFromPaise } from '../../data/workspace.js';

const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char]));

function businessHeading(kicker, title, copy = '', action = '') {
  return `<div class="portal-page-heading business-heading"><div><span class="portal-kicker">${kicker}</span><h1>${title}</h1>${copy ? `<p>${copy}</p>` : ''}</div>${action}</div>`;
}

function businessCustomers(business, activeCustomerTab) {
  const relationships = new Map(workspace.customerRelationships.map(row => [row.customer_id, row]));
  const blockedCustomers = new Set(workspace.customerBlocks.map(row => row.customer_id));
  const buyers = new Map();

  for (const order of workspace.orders) {
    const key = order.buyer_id;
    if (!key) continue;
    const answers = order.answers || {};
    const row = buyers.get(key) || {
      buyerId: key,
      name: order.is_demo ? (answers.demo_customer_name || `Demo customer ${key.slice(0, 6)}`) : `Customer ${key.slice(0, 6)}`,
      email: order.is_demo ? (answers.demo_customer_email || 'demo@cohort.invalid') : 'Private to customer',
      status: order.status === 'paid' ? 'Joined' : 'Order pending',
      country: order.is_demo ? (answers.demo_country || 'India') : '—',
      totalSpend: 0,
      joinedAt: order.created_at,
      isDemo: !!order.is_demo,
      relationship: relationships.get(key),
    };
    if (order.status === 'paid') {
      row.totalSpend += moneyFromPaise(order.amount_paise);
      row.status = 'Joined';
    }
    if (new Date(order.created_at) < new Date(row.joinedAt)) row.joinedAt = order.created_at;
    buyers.set(key, row);
  }

  const customers = [...buyers.values()].sort((a, b) => new Date(b.joinedAt) - new Date(a.joinedAt));
  customers.forEach(row => { if (blockedCustomers.has(row.buyerId)) row.status = 'Banned'; });
  const memberships = workspace.entitlements.map(item => {
    const demoOrder = workspace.orders.find(order => order.buyer_id === item.buyer_id && order.is_demo);
    const answers = demoOrder?.answers || {};
    return {
      id: item.id,
      buyerId: item.buyer_id,
      name: demoOrder ? (answers.demo_customer_name || 'Demo customer') : `Member ${String(item.buyer_id || '').slice(0, 6)}`,
      email: demoOrder ? (answers.demo_customer_email || 'demo@cohort.invalid') : 'Private to member',
      plan: item.products?.name || 'Membership',
      status: item.status,
      price: moneyFromPaise(item.products?.prices?.[0]?.amount_paise),
      startedAt: item.starts_at,
      renewsAt: item.ends_at,
      isDemo: !!demoOrder,
    };
  });
  memberships.forEach(row => { if (blockedCustomers.has(row.buyerId)) row.status = 'Banned'; });

  const list = activeCustomerTab === 'Customers' ? customers : activeCustomerTab === 'Memberships' ? memberships : [];
  const empty = activeCustomerTab === 'Customers' ? 'No customers yet' : activeCustomerTab === 'Memberships' ? 'No memberships yet' : 'No people added';
  const sub = activeCustomerTab === 'Customers'
    ? 'Buyers from your orders appear here. Keep private notes and tags to remember what matters.'
    : activeCustomerTab === 'Memberships'
      ? 'Member access is shown from active and past product entitlements.'
      : 'Team invitations are not available yet.';
  const headers = activeCustomerTab === 'Customers'
    ? ['Customer', 'Email', 'Tags', 'Status', 'Country', 'Total spend', 'Joined at', 'CRM']
    : activeCustomerTab === 'Memberships'
      ? ['Member', 'Email', 'Plan', 'Status', 'Price', 'Started', 'Access']
      : ['Person', 'Email', 'Role', 'Status', 'Added'];

  return `${businessHeading('RELATIONSHIPS', 'Customers', 'Keep track of buyers, membership access, and the follow-up each person needs.')}
    <div class="customer-tabs" role="tablist" aria-label="Business relationships">${['Customers', 'Memberships', 'People'].map(tab => `<button type="button" role="tab" aria-selected="${activeCustomerTab === tab}" class="${activeCustomerTab === tab ? 'selected' : ''}" data-customer-tab="${tab}">${tab}</button>`).join('')}</div>
    <div class="customer-page-title"><div><h2>${activeCustomerTab}</h2><p>${activeCustomerTab === 'Customers' ? `${customers.length} ${customers.length === 1 ? 'buyer' : 'buyers'} across your business` : activeCustomerTab === 'Memberships' ? `${memberships.length} membership records` : 'Invite teammates to help manage your business'}</p></div></div>
    <div class="customer-toolbar">
      <label class="customer-search"><span aria-hidden="true">⌕</span><input id="business-customer-search" placeholder="Search by name, customer ID, or tag" aria-label="Search ${activeCustomerTab.toLowerCase()}"></label>
      <select id="customer-status-filter" aria-label="Filter by status"><option value="all">All statuses</option><option>Joined</option><option>Active</option><option>Order pending</option><option>Expired</option><option>Revoked</option><option>Banned</option></select>
      ${activeCustomerTab === 'Customers' ? '<select id="customer-segment-filter" aria-label="Filter customer segment"><option value="all">All customers</option><option value="tagged">Has tags</option><option value="noted">Has a note</option><option value="demo">Demo data</option></select>' : ''}
      <select id="customer-date-filter" aria-label="Sort by join date"><option value="newest" selected>Newest first</option><option value="oldest">Oldest first</option></select>
      <span class="toolbar-spacer"></span><button class="portal-action" type="button" data-customer-export>Export</button>
    </div>
    <div class="customer-table-wrap"><table class="customer-table"><thead><tr>${headers.map(header => `<th>${header}</th>`).join('')}</tr></thead><tbody>
      ${list.map(person => {
        const crm = person.relationship;
        const tags = crm?.tags || [];
        const date = person.joinedAt || person.startedAt;
        const dateLabel = date ? new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : '—';
        const profileButton = `<button class="customer-profile-open" type="button" data-customer-open="${escapeHTML(person.buyerId)}" aria-label="Open customer details for ${escapeHTML(person.name)}">Open profile <span aria-hidden="true">↗</span></button>`;
        const crmButton = `<button class="customer-crm-edit" type="button" data-customer-crm="${escapeHTML(person.buyerId)}" aria-label="Edit notes and tags for ${escapeHTML(person.name)}">${crm?.note || tags.length ? 'Edit notes' : '+ Add notes'}</button>`;
        return `<tr data-customer-date="${escapeHTML(date || '')}" data-customer-tags="${escapeHTML(tags.join(' ').toLowerCase())}" data-customer-note="${escapeHTML(crm?.note || '')}" data-customer-demo="${person.isDemo ? 'true' : 'false'}">
          <td><b>${profileButton}</b>${person.isDemo ? '<small class="demo-record-label">DEMO DATA</small>' : ''}</td>
          <td>${escapeHTML(person.email)}</td>
          ${activeCustomerTab === 'Customers' ? `<td class="customer-tag-cell">${tags.length ? tags.map(tag => `<span class="customer-tag">${escapeHTML(tag)}</span>`).join('') : '<span class="customer-no-tags">—</span>'}</td>` : ''}
          <td><span class="customer-status-pill">${escapeHTML(person.status)}</span></td>
          ${activeCustomerTab === 'Customers'
            ? `<td>${escapeHTML(person.country)}</td><td>₹${Number(person.totalSpend).toLocaleString('en-IN')}</td><td>${dateLabel}</td><td>${crmButton}</td>`
            : activeCustomerTab === 'Memberships'
              ? `<td>${escapeHTML(person.plan)}</td><td>${escapeHTML(person.status)}</td><td>₹${Number(person.price).toLocaleString('en-IN')}</td><td>${dateLabel}</td><td>${person.renewsAt ? new Date(person.renewsAt).toLocaleDateString('en-IN') : 'No expiry'}</td>`
              : '<td>—</td><td>—</td><td>—</td>'}
        </tr>`;
      }).join('')}
    </tbody></table>${list.length ? '' : `<div class="customer-empty"><span>◯</span><b>${empty}</b><p>${sub}</p>${activeCustomerTab === 'Customers' ? '<a class="text-link" href="#business/products">View products →</a>' : ''}</div>`}</div>`;
}

function customerCrmDialog(businessId, customerId, personName, relationship = {}) {
  const tags = Array.isArray(relationship.tags) ? relationship.tags.join(', ') : '';
  const updated = relationship.updated_at ? `Last updated ${new Date(relationship.updated_at).toLocaleDateString('en-IN')}` : 'Only you and your business team can see these details.';
  const backdrop = document.createElement('div');
  backdrop.className = 'portal-modal-backdrop customer-crm-backdrop';
  backdrop.innerHTML = `<section class="portal-modal customer-crm-modal" role="dialog" aria-modal="true" aria-labelledby="customer-crm-title">
    <button class="portal-modal-close" type="button" data-close-modal aria-label="Close">×</button>
    <span class="portal-kicker">PRIVATE CUSTOMER RECORD</span><h2 id="customer-crm-title">${escapeHTML(personName)}</h2>
    <p class="customer-crm-intro">Add context for your next conversation. These notes and tags are private to your business.</p>
    <form id="customer-crm-form" data-business-id="${escapeHTML(businessId)}" data-customer-id="${escapeHTML(customerId)}">
      <label class="form-field"><span>Tags <small>Up to 8, comma separated</small></span><input name="tags" maxlength="220" value="${escapeHTML(tags)}" placeholder="e.g. VIP, renewal, course cohort"></label>
      <label class="form-field"><span>Internal note</span><textarea name="note" rows="6" maxlength="2000" placeholder="Remember goals, support context, or the next action…">${escapeHTML(relationship.note || '')}</textarea><small class="customer-crm-updated">${updated}</small></label>
      <div class="customer-crm-footer"><button class="portal-action" type="button" data-close-modal>Cancel</button><button class="button button-primary" type="submit">Save details</button></div>
      <p class="auth-message" role="status"></p>
    </form>
  </section>`;
  backdrop.addEventListener('click', event => { if (event.target === backdrop) backdrop.remove(); });
  document.body.append(backdrop);
  backdrop.querySelector('[name="tags"]')?.focus();
}

export { businessCustomers, customerCrmDialog };

function when(value) {
  return value ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not recorded';
}

function customerMemberDialog(business, customerId, personName) {
  const orders = workspace.orders.filter(row => row.buyer_id === customerId).sort((a,b) => new Date(b.created_at)-new Date(a.created_at));
  const entitlements = workspace.entitlements.filter(row => row.buyer_id === customerId);
  const overrides = workspace.customerAccess.filter(row => row.customer_id === customerId);
  const block = workspace.customerBlocks.find(row => row.customer_id === customerId);
  const progress = workspace.customerProgress.filter(row => row.customer_id === customerId);
  const replies = workspace.customerActivity.filter(row => row.author_id === customerId);
  const products = business.products || [];
  const names = new Map(products.map(row => [row.id, row.name]));
  const resources = new Map(products.flatMap(product => (product.deliverables || []).map(file => [file.id, { ...file, productId: product.id, productName: product.name }])));
  const blockedProductIds = new Set(overrides.filter(row => !row.resource_id && row.effect === 'revoke').map(row => row.product_id));
  const grantedProductIds = new Set(overrides.filter(row => !row.resource_id && row.effect === 'grant').map(row => row.product_id));
  const activeEntitlementIds = new Set(entitlements.filter(row => row.status === 'active' && (!row.starts_at || new Date(row.starts_at) <= new Date()) && (!row.ends_at || new Date(row.ends_at) > new Date())).map(row => row.product_id));
  const resourceOverrides = new Map(overrides.filter(row => row.resource_id).map(row => [row.resource_id, row.effect]));
  const eligibleResourceIds = new Set();
  for (const file of resources.values()) {
    if (blockedProductIds.has(file.productId)) continue;
    if (activeEntitlementIds.has(file.productId) || grantedProductIds.has(file.productId)) {
      if (resourceOverrides.get(file.id) !== 'revoke') eligibleResourceIds.add(file.id);
    } else if (resourceOverrides.get(file.id) === 'grant') eligibleResourceIds.add(file.id);
  }
  const completed = progress.filter(row => row.completed_at && eligibleResourceIds.has(row.resource_id));
  const activityTimes = [...completed.map(row => row.completed_at), ...replies.map(row => row.created_at)].filter(Boolean).sort((a,b) => new Date(b)-new Date(a));
  const lastActivity = activityTimes[0];
  const resourceTotal = eligibleResourceIds.size;
  const firstOrder = orders.length ? orders.reduce((earliest,row) => new Date(row.created_at)<new Date(earliest.created_at) ? row : earliest, orders[0]) : null;
  const customerEmail = orders.find(row => row.is_demo)?.answers?.demo_customer_email || 'Private to customer';
  const paid = orders.filter(row => row.status === 'paid');
  const spend = paid.reduce((sum,row) => sum + moneyFromPaise(row.amount_paise), 0);
  const titleForScope = row => row.resource_id ? resources.get(row.resource_id)?.title || 'Resource' : names.get(row.product_id) || 'Program';
  const accessRows = entitlements.map(row => `<div class="member-access-row"><span><b>${escapeHTML(row.products?.name || 'Program')}</b><small>${escapeHTML(row.status)} · started ${escapeHTML(when(row.starts_at))}${row.ends_at ? ` · ends ${escapeHTML(when(row.ends_at))}` : ''}</small></span><span class="customer-status-pill ${row.status === 'active' ? 'is-active' : ''}">${row.status === 'active' ? 'Purchased' : escapeHTML(row.status)}</span>${row.status === 'active' ? `<button type="button" class="portal-action" data-member-entitlement-revoke="${escapeHTML(row.id)}">Revoke access</button>` : `<button type="button" class="portal-action" data-member-entitlement-restore="${escapeHTML(row.id)}">Restore access</button>`}</div>`).join('');
  const overrideRows = overrides.map(row => `<div class="member-access-row"><span><b>${escapeHTML(titleForScope(row))}</b><small>${row.effect === 'grant' ? 'Creator grant' : 'Creator restriction'}${row.reason ? ` · ${escapeHTML(row.reason)}` : ''}</small></span><span class="customer-status-pill ${row.effect === 'grant' ? 'is-active' : ''}">${row.effect === 'grant' ? 'Granted' : 'Restricted'}</span><button type="button" class="portal-action" data-member-access-reset="${escapeHTML(row.id)}">Remove override</button></div>`).join('');
  const options = products.map(product => `<option value="${escapeHTML(product.id)}">${escapeHTML(product.name)}</option>`).join('');
  const resourceOptions = products.flatMap(product => (product.deliverables || []).map(file => `<option value="${escapeHTML(product.id)}::${escapeHTML(file.id)}">${escapeHTML(product.name)} · ${escapeHTML(file.title || 'Untitled resource')}</option>`)).join('');
  const historyRows = orders.length ? orders.map(row => `<div class="member-history-row"><span><b>${escapeHTML(row.products?.name || 'Digital product')}</b><small>${escapeHTML(row.order_number || row.id.slice(0,8))} · ${escapeHTML(when(row.created_at))}</small></span><span>${row.status === 'paid' ? '₹' + moneyFromPaise(row.amount_paise).toLocaleString('en-IN') : escapeHTML(row.status)}</span></div>`).join('') : '<p class="customer-empty-note">No orders recorded for this customer.</p>';
  const activityRows = [...completed.map(row => ({ date: row.completed_at, label: `Marked complete · ${resources.get(row.resource_id)?.title || 'Resource'}`, product: names.get(row.product_id) })), ...replies.map(row => ({ date: row.created_at, label: 'Community reply', product: row.community_posts?.products?.name }))].sort((a,b) => new Date(b.date)-new Date(a.date)).slice(0,12).map(row => `<div class="member-history-row"><span><b>${escapeHTML(row.label)}</b><small>${escapeHTML(row.product || 'Program')}</small></span><time>${escapeHTML(when(row.date))}</time></div>`).join('') || '<p class="customer-empty-note">No learning or community activity has been recorded yet.</p>';
  const backdrop = document.createElement('div');
  backdrop.className = 'portal-modal-backdrop customer-member-backdrop';
  backdrop.innerHTML = `<section class="portal-modal customer-member-modal" data-customer-id="${escapeHTML(customerId)}" role="dialog" aria-modal="true" aria-labelledby="member-title">
    <button class="portal-modal-close" type="button" data-close-modal aria-label="Close">×</button>
    <span class="portal-kicker">CUSTOMER WORKSPACE</span><h2 id="member-title">${escapeHTML(personName)}</h2><p class="customer-member-subtitle">${escapeHTML(customerEmail)} · Customer ID ${escapeHTML(customerId.slice(0,8))}${firstOrder ? ` · Joined ${escapeHTML(new Date(firstOrder.created_at).toLocaleDateString('en-IN'))}` : ''}</p><button type="button" class="portal-action message-customer-cta" data-message-customer="${escapeHTML(customerId)}" data-business-id="${escapeHTML(business.id)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 8.7 4a8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z"/></svg> Message customer <span>↗</span></button>
    <div class="customer-member-stats"><div><small>Paid orders</small><b>${paid.length}</b></div><div><small>Total spend</small><b>₹${spend.toLocaleString('en-IN')}</b></div><div><small>Last recorded activity</small><b>${escapeHTML(lastActivity ? when(lastActivity) : 'Not recorded')}</b></div><div><small>Program completion</small><b>${completed.length} of ${resourceTotal} resources</b></div></div>
    <div class="customer-member-grid"><section class="member-detail-card"><h3>Program access</h3>${accessRows || '<p class="customer-empty-note">No purchased program access found.</p>'}${overrideRows}</section>
      <section class="member-detail-card"><h3>Manage access</h3><p>Grant or restrict a program or one of its resources. Overrides do not alter orders or revenue.</p>
        <form id="member-access-form" class="member-access-form" data-member-access-form data-business-id="${escapeHTML(business.id)}" data-customer-id="${escapeHTML(customerId)}"><label>Program<select name="product_id" required><option value="">Choose a program</option>${options}</select></label><label>Resource scope <small>Leave blank to manage the full program</small><select name="resource_id"><option value="">Entire program</option>${resourceOptions}</select></label><label>Reason (optional)<input name="reason" maxlength="500" placeholder="Internal context for this change"></label><div><button class="button button-primary" type="submit" name="effect" value="grant">Grant access</button><button class="portal-action" type="submit" name="effect" value="revoke">Restrict access</button></div><p class="auth-message" role="status"></p></form>
      </section>
      <section class="member-detail-card"><h3>Member safety</h3>${block ? `<p>This customer is blocked from all programs in this business since ${escapeHTML(when(block.created_at))}.${block.reason ? ` Reason: ${escapeHTML(block.reason)}` : ''}</p><button type="button" class="portal-action" data-member-unblock="${escapeHTML(block.id)}">Restore business access</button>` : `<p>Block this customer from all of your programs and private resources.</p><form id="member-block-form" data-member-block-form data-business-id="${escapeHTML(business.id)}" data-customer-id="${escapeHTML(customerId)}"><label>Reason (optional)<input name="reason" maxlength="500" placeholder="e.g. repeated abuse of community rules"></label><button type="submit" class="portal-action danger-action">Block from all programs</button><p class="auth-message" role="status"></p></form>`}</section>
      <section class="member-detail-card"><h3>Order history</h3><div class="member-history-list">${historyRows}</div></section>
      <section class="member-detail-card"><h3>Activity timeline</h3><p>Last activity is based on recorded resource completions and community replies.</p><div class="member-history-list">${activityRows}</div></section>
    </div>
  </section>`;
  backdrop.addEventListener('click', event => { if (event.target === backdrop) backdrop.remove(); });
  document.body.append(backdrop);
  backdrop.querySelector('[data-member-access-form] select[name="product_id"]')?.addEventListener('change', event => {
    const scope = backdrop.querySelector('[data-member-access-form] select[name="resource_id"]');
    [...scope.options].forEach(option => { option.hidden = !!option.value && !option.value.startsWith(`${event.target.value}::`); });
    scope.value = '';
  });
}

export { customerMemberDialog };
