import { moneyFromPaise } from '../../data/workspace.js';

const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char]));
const inr = value => `â‚¹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function businessPayments(orders = []) {
  const paid = orders.filter(order => order.status === 'paid');
  const demoCount = orders.filter(order => order.is_demo).length;
  const pending = orders.filter(order => ['pending', 'processing'].includes(order.status));
  const collected = paid.reduce((total, order) => total + moneyFromPaise(order.amount_paise), 0);
  const rows = orders.length ? `<div class="customer-table-wrap"><table class="customer-table"><thead><tr><th>Order</th><th>Product</th><th>Status</th><th>Date</th><th>Amount</th></tr></thead><tbody>${orders.map(order => `<tr><td>${escapeHTML(order.order_number || order.id.slice(0, 8))}</td><td>${escapeHTML(order.products?.name || 'Digital product')}${order.is_demo?'<small class="demo-record-label">DEMO DATA</small>':''}</td><td><span class="customer-status-pill">${escapeHTML(order.status)}</span></td><td>${escapeHTML(new Date(order.created_at).toLocaleDateString('en-IN'))}</td><td>${inr(moneyFromPaise(order.amount_paise))}</td></tr>`).join('')}</tbody></table></div>` : `<div class="analytics-empty"><span>INR</span><b>No payment records yet</b><p>Orders appear here after checkout is connected and a buyer completes a purchase.</p></div>`;

  return `<div class="portal-page-heading business-heading"><div><span class="portal-kicker">MONEY</span><h1>Payments</h1><p>Recorded order activity for your business.${demoCount?` ${demoCount} demo orders are included for analytics and are not real payments.`:""}</p></div><button class="portal-action" type="button" data-payment-export ${orders.length ? '' : 'disabled'}>Export</button></div><div class="business-metric-grid"><article><span>Total collected</span><b>${inr(collected)}</b><small>Paid orders recorded</small></article><article><span>Pending orders</span><b>${pending.length}</b><small>Awaiting payment status</small></article><article><span>Paid orders</span><b>${paid.length}</b><small>All time</small></article></div><section class="portal-panel payment-panel"><div class="panel-title-row"><h2>Transactions</h2></div>${rows}</section><section class="portal-panel payout-note"><b>Payouts</b><p>Payment processing and creator payouts are not connected yet. Recorded order totals are not withdrawable balances.</p></section>`;
}


