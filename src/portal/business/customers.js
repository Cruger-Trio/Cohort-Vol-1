import { workspace, moneyFromPaise } from '../../data/workspace.js';

const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char]));

function businessHeading(kicker, title, copy = '', action = '') {
  return `<div class="portal-page-heading business-heading"><div><span class="portal-kicker">${kicker}</span><h1>${title}</h1>${copy ? `<p>${copy}</p>` : ''}</div>${action}</div>`;
}

function businessCustomers(business, activeCustomerTab) {
  const relationships = new Map(workspace.customerRelationships.map(row => [row.customer_id, row]));
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
      <select id="customer-status-filter" aria-label="Filter by status"><option value="all">All statuses</option><option>Joined</option><option>Active</option><option>Order pending</option><option>Expired</option><option>Revoked</option></select>
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
        const crmButton = `<button class="customer-crm-edit" type="button" data-customer-crm="${escapeHTML(person.buyerId)}" aria-label="Edit notes and tags for ${escapeHTML(person.name)}">${crm?.note || tags.length ? 'Edit details' : '+ Add details'}</button>`;
        return `<tr data-customer-date="${escapeHTML(date || '')}" data-customer-tags="${escapeHTML(tags.join(' ').toLowerCase())}" data-customer-note="${escapeHTML(crm?.note || '')}" data-customer-demo="${person.isDemo ? 'true' : 'false'}">
          <td><b>${escapeHTML(person.name)}</b>${person.isDemo ? '<small class="demo-record-label">DEMO DATA</small>' : ''}</td>
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
