let selectedConversationId = null;
let realtimeChannel = null;
let realtimeKey = '';

const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const ago = value => {
  if (!value) return '';
  const date = new Date(value), seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return 'now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

export function communicationCenterPage({ business = null, user, escapeHTML = safe, initialsFor = value => String(value || '?').slice(0, 1).toUpperCase() }) {
  const creatorMode = Boolean(business && business.owner_id === user?.id);
  const title = creatorMode ? 'Creator inbox' : 'Messages';
  const subhead = creatorMode
    ? 'Keep customer questions and program conversations in one place.'
    : 'Your conversations with Cohort creators, all together.';
  return `<section class="communication-center" data-creator-mode="${creatorMode}">
    <header class="inbox-heading"><div><span class="portal-kicker">${creatorMode ? 'AUDIENCE' : 'YOUR COHORT'}</span><h1>${title}</h1><p>${subhead}</p></div>${creatorMode ? '<a class="inbox-secondary-action" href="#business/customers"><span aria-hidden="true">＋</span> Find a customer</a>' : '<a class="inbox-secondary-action" href="#explore">Explore creators <span aria-hidden="true">↗</span></a>'}</header>
    <div class="inbox-shell" id="inbox-shell" aria-live="polite"><div class="inbox-loading"><span class="cohort-spinner" aria-hidden="true"></span><span>Loading your inbox…</span></div></div>
  </section>`;
}

function participantName(row, creatorMode) {
  const person = creatorMode ? row.customer : row.creator;
  return person?.full_name || (person?.username ? `@${person.username}` : creatorMode ? 'Cohort customer' : row.business?.name || 'Cohort creator');
}

function messageListItem(row, creatorMode, activeId, userId, escapeHTML, initialsFor) {
  const personName = participantName(row, creatorMode);
  const last = row.creator_messages?.[0];
  const unread = Boolean(last && last.sender_id !== userId && !last.read_at);
  const detail = creatorMode ? (row.customer?.username ? `@${row.customer.username}` : row.business?.name || 'Customer') : row.business?.name || 'Creator';
  return `<button type="button" class="inbox-thread-row ${row.id === activeId ? 'is-selected' : ''}" data-inbox-open="${escapeHTML(row.id)}" aria-current="${row.id === activeId ? 'true' : 'false'}">
    <span class="inbox-avatar">${row[creatorMode ? 'customer' : 'creator']?.avatar_url ? `<img src="${escapeHTML(row[creatorMode ? 'customer' : 'creator'].avatar_url)}" alt="">` : escapeHTML(initialsFor(personName))}</span>
    <span class="inbox-thread-copy"><span class="inbox-thread-title"><b>${escapeHTML(personName)}</b><time>${escapeHTML(ago(row.last_message_at))}</time></span><span class="inbox-thread-detail">${escapeHTML(detail)}</span><span class="inbox-thread-preview">${last ? `${last.sender_id === userId ? 'You: ' : ''}${escapeHTML(last.body)}` : 'Start a conversation'}</span></span>
    ${unread ? '<i class="inbox-unread-dot" aria-label="Unread"></i>' : ''}
  </button>`;
}

function renderMessages(messages, userId, escapeHTML, initialsFor, counterpart) {
  if (!messages.length) return '<div class="inbox-thread-empty"><span class="inbox-empty-icon">✳</span><b>Start the conversation</b><p>Send a thoughtful note. Keep customer conversations useful and respectful.</p></div>';
  return messages.map(message => {
    const own = message.sender_id === userId;
    const date = new Date(message.created_at);
    return `<article class="inbox-message ${own ? 'is-own' : ''}"><span class="inbox-message-avatar">${own ? 'You' : escapeHTML(initialsFor(counterpart))}</span><div class="inbox-message-body"><div class="inbox-message-meta"><b>${own ? 'You' : escapeHTML(counterpart)}</b><time>${escapeHTML(date.toLocaleString('en-IN', { day:'numeric', month:'short', hour:'numeric', minute:'2-digit' }))}</time></div><p>${escapeHTML(message.body).replace(/\n/g, '<br>')}</p></div></article>`;
  }).join('');
}

export async function loadCommunicationCenter(supabase, { business = null, user, escapeHTML = safe, initialsFor = value => String(value || '?').slice(0, 1).toUpperCase() } = {}) {
  const shell = document.querySelector('#inbox-shell');
  if (!shell || !supabase || !user) return;
  const creatorMode = Boolean(business && business.owner_id === user.id);
  const contextKey = creatorMode ? `creator:${business.id}` : `customer:${user.id}`;
  try {
    let query = supabase.from('creator_conversations').select(`id,business_id,customer_id,creator_id,last_message_at,customer:profiles!creator_conversations_customer_id_fkey(id,full_name,username,avatar_url),creator:profiles!creator_conversations_creator_id_fkey(id,full_name,username,avatar_url),business:businesses!creator_conversations_business_id_fkey(name),creator_messages!creator_messages_conversation_id_fkey(id,sender_id,body,read_at,created_at)`)
      .order('created_at', { foreignTable: 'creator_messages', ascending: false })
      .limit(1, { foreignTable: 'creator_messages' })
      .order('last_message_at', { ascending: false });
    query = creatorMode ? query.eq('business_id', business.id).eq('creator_id', user.id) : query.eq('customer_id', user.id);
    const { data: conversations, error } = await query;
    if (error) throw error;
    const rows = conversations || [];
    if (selectedConversationId && !rows.some(row => row.id === selectedConversationId)) selectedConversationId = null;
    if (!selectedConversationId && rows.length) selectedConversationId = rows[0].id;
    const selected = rows.find(row => row.id === selectedConversationId);
    let messages = [];
    if (selected) {
      const response = await supabase.from('creator_messages').select('id,conversation_id,sender_id,body,read_at,created_at').eq('conversation_id', selected.id).order('created_at', { ascending: true });
      if (response.error) throw response.error;
      messages = response.data || [];
      const unread = messages.filter(item => item.sender_id !== user.id && !item.read_at).map(item => item.id);
      if (unread.length) {
        const marked = await supabase.from('creator_messages').update({ read_at: new Date().toISOString() }).in('id', unread);
        if (marked.error) throw marked.error;
        messages = messages.map(item => unread.includes(item.id) ? { ...item, read_at: new Date().toISOString() } : item);
      }
    }
    const counterpart = selected ? participantName(selected, creatorMode) : '';
    const rowsMarkup = rows.length ? rows.map(row => messageListItem(row, creatorMode, selectedConversationId, user.id, escapeHTML, initialsFor)).join('') : `<div class="inbox-list-empty"><span class="inbox-empty-icon">${creatorMode ? '↗' : '✳'}</span><b>${creatorMode ? 'Your inbox is ready' : 'No messages yet'}</b><p>${creatorMode ? 'Open a customer profile and choose Message customer to start a private thread.' : 'When a creator starts a conversation with you, it will appear here.'}</p>${creatorMode ? '<a href="#business/customers">Open customers</a>' : '<a href="#explore">Explore the marketplace</a>'}</div>`;
    const conversationMarkup = selected ? `<header class="inbox-conversation-head"><span class="inbox-avatar">${selected[creatorMode ? 'customer' : 'creator']?.avatar_url ? `<img src="${escapeHTML(selected[creatorMode ? 'customer' : 'creator'].avatar_url)}" alt="">` : escapeHTML(initialsFor(counterpart))}</span><span><b>${escapeHTML(counterpart)}</b><small>${escapeHTML(creatorMode ? (selected.customer?.username ? `@${selected.customer.username}` : 'Customer') : selected.business?.name || 'Creator')}</small></span><span class="inbox-thread-status"><i></i> Private conversation</span></header><div class="inbox-message-list" id="inbox-message-list">${renderMessages(messages, user.id, escapeHTML, initialsFor, counterpart)}</div><form class="inbox-compose" id="conversation-message-form" data-conversation-id="${escapeHTML(selected.id)}"><label class="inbox-sr-only" for="inbox-message-input">Write a message</label><textarea id="inbox-message-input" name="body" rows="1" maxlength="4000" placeholder="Write a message…" required></textarea><div class="inbox-compose-footer"><span>Direct message · Be kind and clear</span><button class="button button-primary" type="submit"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg><span>Send</span></button></div></form>` : `<div class="inbox-select-empty"><span class="inbox-empty-icon">✉</span><b>Select a conversation</b><p>Choose a thread from the list to read and reply.</p></div>`;
    shell.innerHTML = `<aside class="inbox-list-panel"><div class="inbox-list-toolbar"><label class="inbox-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg><input type="search" id="inbox-search" placeholder="Search conversations" aria-label="Search conversations"></label><button class="inbox-refresh" type="button" data-inbox-refresh aria-label="Refresh inbox" title="Refresh"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.6 9A7 7 0 0 1 18 6l2 6M4 12l2 6a7 7 0 0 0 12.4-3"/></svg></button></div><div class="inbox-thread-list">${rowsMarkup}</div></aside><section class="inbox-conversation-panel">${conversationMarkup}</section>`;
    shell.querySelector('#inbox-search')?.addEventListener('input', event => {
      const term = event.target.value.trim().toLocaleLowerCase();
      shell.querySelectorAll('.inbox-thread-row').forEach(row => { row.hidden = !row.textContent.toLocaleLowerCase().includes(term); });
    });
    const messageList = shell.querySelector('#inbox-message-list');
    if (messageList) messageList.scrollTop = messageList.scrollHeight;
    if (realtimeKey !== contextKey) {
      if (realtimeChannel) await supabase.removeChannel(realtimeChannel);
      realtimeKey = contextKey;
      realtimeChannel = supabase.channel(`cohort-inbox:${contextKey}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'creator_messages' }, payload => {
        if (payload.new?.conversation_id && rows.some(row => row.id === payload.new.conversation_id)) {
          clearTimeout(loadCommunicationCenter._refresh);
          loadCommunicationCenter._refresh = setTimeout(() => loadCommunicationCenter(supabase, { business, user, escapeHTML, initialsFor }), 180);
        }
      }).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'creator_conversations' }, () => {
        clearTimeout(loadCommunicationCenter._refresh);
        loadCommunicationCenter._refresh = setTimeout(() => loadCommunicationCenter(supabase, { business, user, escapeHTML, initialsFor }), 180);
      }).subscribe();
    }
  } catch (error) {
    shell.innerHTML = `<div class="inbox-error"><span class="inbox-empty-icon">!</span><b>We couldn’t load messages</b><p>${escapeHTML(error?.message || 'Please refresh and try again.')}</p><button class="inbox-secondary-action" type="button" data-inbox-refresh>Try again</button></div>`;
  }
}

export async function createCustomerConversation(supabase, { businessId, customerId, user }) {
  const existing = await supabase.from('creator_conversations').select('id').eq('business_id', businessId).eq('customer_id', customerId).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) {
    selectedConversationId = existing.data.id;
    return existing.data.id;
  }
  const created = await supabase.from('creator_conversations').insert({ business_id: businessId, creator_id: user.id, customer_id: customerId }).select('id').single();
  if (created.error) {
    if (created.error.code === '23505') {
      const raced = await supabase.from('creator_conversations').select('id').eq('business_id', businessId).eq('customer_id', customerId).single();
      if (!raced.error) { selectedConversationId = raced.data.id; return raced.data.id; }
    }
    throw created.error;
  }
  selectedConversationId = created.data.id;
  return created.data.id;
}

export async function sendInboxMessage(supabase, { conversationId, user, body }) {
  const text = String(body || '').trim();
  if (!text) throw new Error('Write a message before sending.');
  if (text.length > 4000) throw new Error('Keep messages under 4,000 characters.');
  const { error } = await supabase.from('creator_messages').insert({ conversation_id: conversationId, sender_id: user.id, body: text });
  if (error) throw error;
  selectedConversationId = conversationId;
}

export function selectInboxConversation(id) { selectedConversationId = id || null; }

export async function stopCommunicationCenterRealtime(supabase) {
  if (realtimeChannel && supabase) await supabase.removeChannel(realtimeChannel);
  realtimeChannel = null;
  realtimeKey = '';
  clearTimeout(loadCommunicationCenter._refresh);
}
