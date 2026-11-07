export const followUpOutcomes = {
  awaiting_reply: 'Awaiting reply',
  resolved: 'Resolved',
  needs_follow_up: 'Needs another follow-up',
};

export function followUpComposer(task, escapeHTML) {
  if (!task) return '';
  return `<div class="inbox-followup-context"><div><small>LINKED FOLLOW-UP</small><b>${escapeHTML(task.title)}</b></div><label>After sending<select name="follow_up_outcome" required>${Object.entries(followUpOutcomes).map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}</select></label><p>Awaiting reply pauses this reminder. Resolved closes it. Needs another follow-up keeps it in your queue.</p></div>`;
}

export function followUpHistory(task, escapeHTML) {
  const events = [...(task.events || [])].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  if (!events.length) return '';
  return `<details class="followup-history"><summary>${escapeHTML(followUpOutcomes[events[0].outcome] || 'Contact recorded')} · ${events.length} linked ${events.length === 1 ? 'reply' : 'replies'}</summary>${events.map(event => `<article><header><b>${escapeHTML(followUpOutcomes[event.outcome] || 'Contact recorded')}</b><time>${escapeHTML(new Date(event.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }))}</time></header><p>${escapeHTML(event.message?.body || 'Message unavailable')}</p>${event.message?.conversation_id ? `<button type="button" class="portal-action" data-follow-up-conversation="${escapeHTML(event.message.conversation_id)}">Open conversation</button>` : ''}</article>`).join('')}</details>`;
}
