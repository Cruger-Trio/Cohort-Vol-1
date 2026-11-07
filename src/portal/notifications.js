const escapeDefault = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
let channel = null;
let channelClient = null;

function dueTasks(workspace) {
  const now = new Date();
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  return (workspace.customerFollowUps || [])
    .filter(task => task.status === 'open' && new Date(task.due_at) <= endOfToday)
    .sort((a, b) => new Date(a.due_at) - new Date(b.due_at));
}

function customerName(task, workspace) {
  const order = workspace.orders.find(item => item.buyer_id === task.customer_id);
  if (order?.is_demo) return order.answers?.demo_customer_name || 'Demo customer';
  return `Customer ${String(task.customer_id || '').slice(0, 6)}`;
}

function timeLabel(value) {
  const date = new Date(value), now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (date < now) return `Overdue · ${date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
  return sameDay ? `Due today · ${date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}` : 'Due today';
}

export function businessNotificationMarkup(workspace, escapeHTML = escapeDefault) {
  const messages = workspace.unreadCreatorMessages || [];
  const tasks = dueTasks(workspace);
  const count = messages.length + tasks.length;
  const rows = [
    ...messages.slice(0, 5).map(message => {
      const person = message.creator_conversations?.customer || {};
      const name = person.full_name || (person.username ? `@${person.username}` : 'Customer');
      return `<a class="notification-row" href="#business/messages"><span class="notification-row-icon message">✉</span><span><b>New message from ${escapeHTML(name)}</b><small>${escapeHTML(message.body.slice(0, 86))}${message.body.length > 86 ? '…' : ''}</small></span><time>${escapeHTML(new Date(message.created_at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }))}</time></a>`;
    }),
    ...tasks.slice(0, 6).map(task => `<button class="notification-row notification-followup-action" type="button" data-follow-up-id="${escapeHTML(task.id)}" data-follow-up-message="${escapeHTML(task.customer_id)}" data-follow-up-title="${escapeHTML(task.title)}" data-follow-up-customer="${escapeHTML(customerName(task, workspace))}"><span class="notification-row-icon followup">↗</span><span><b>${escapeHTML(task.title)}</b><small>${escapeHTML(customerName(task, workspace))} · ${escapeHTML(timeLabel(task.due_at))}</small></span><span class="notification-row-cta">Draft</span></button>`),
  ];
  const content = rows.length
    ? rows.join('')
    : '<div class="notification-empty"><span>✓</span><b>You’re all caught up</b><small>New customer messages and follow-ups due today will appear here.</small></div>';
  return `<div class="business-notifications"><button class="portal-icon-button notification-toggle" id="business-notification-toggle" data-notification-toggle aria-label="Notifications${count ? `, ${count} unread or due` : ''}" aria-expanded="false" aria-haspopup="true" aria-controls="business-notification-panel" title="Notifications"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>${count ? `<span class="notification-count" id="business-notification-count">${count > 9 ? '9+' : count}</span>` : ''}</button><section class="business-notification-panel" id="business-notification-panel" aria-label="Notifications" hidden><header><span><b>Notifications</b><small>${count ? `${messages.length} unread message${messages.length === 1 ? '' : 's'} · ${tasks.length} follow-up${tasks.length === 1 ? '' : 's'} due` : 'No new activity'}</small></span><a href="#business/messages">Open inbox</a></header><div class="notification-list">${content}</div><footer><a href="#business/customers">View follow-ups</a><a href="#business/messages">View inbox</a></footer></section></div>`;
}

export async function bindBusinessNotificationRealtime(supabase, business, user, workspace, refreshMarkup) {
  if (channel && channelClient) await channelClient.removeChannel(channel);
  channel = null;
  channelClient = supabase;
  if (!supabase || !business || !user) return;
  channel = supabase.channel(`cohort-notifications:${business.id}:${user.id}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'creator_messages' }, async () => {
      try {
        const { data, error } = await supabase.from('creator_messages')
          .select('id,body,created_at,conversation_id,creator_conversations!inner(id,business_id,creator_id,customer:profiles!creator_conversations_customer_id_fkey(full_name,username))')
          .eq('creator_conversations.business_id', business.id)
          .eq('creator_conversations.creator_id', user.id)
          .neq('sender_id', user.id)
          .is('read_at', null)
          .order('created_at', { ascending: false })
          .limit(20);
        if (error) throw error;
        workspace.unreadCreatorMessages = data || [];
        refreshMarkup();
      } catch (error) {
        console.warn('Could not refresh Cohort notifications:', error.message);
      }
    })
    .subscribe();
}
