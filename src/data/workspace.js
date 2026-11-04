export const workspace = {
  profile: null,
  business: null,
  orders: [],
  entitlements: [],
  purchases: [],
  memberships: [],
  catalog: [],
  accessCodes: [],
  customerRelationships: [],
  customerBlocks: [],
  customerAccess: [],
  customerProgress: [],
  customerActivity: [],
  resourceProgress: [],
  personalBlocks: [],
};

const initialsFor = value => String(value || 'C').trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
export const moneyFromPaise = value => Number(value || 0) / 100;
export const slugify = value => String(value || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 58) || 'creator-offer';

export function fromPrice(row) {
  return {
    id: row.id,
    name: row.name,
    amount: moneyFromPaise(row.amount_paise),
    currency: row.currency,
    cadence: row.cadence,
    stock: row.stock,
    waitlist: row.waitlist,
    hideFromStore: row.hide_from_store,
    autoExpire: !!row.expire_days,
    expireDays: row.expire_days || 30,
    allowMultiple: row.allow_multiple,
    checkoutQuestions: (row.checkout_questions || []).length > 0,
    questions: row.checkout_questions || [],
    internalName: row.name,
    buttonText: row.button_text || 'default',
  };
}

export function fromProduct(row) {
  const business = row.businesses || {};
  const prices = (row.prices || []).filter(price => price.is_active !== false).map(fromPrice);
  return {
    ...row,
    title: row.name,
    creator: business.name || 'Cohort creator',
    handle: business.handle ? `@${business.handle}` : '',
    businessHandle: business.handle || '',
    category: business.category || 'Other',
    visibility: row.status,
    mediaUrl: row.media_url || '',
    kicker: row.headline || row.type,
    art: row.type === 'Course' ? '◉' : ['Membership', 'Community'].includes(row.type) ? '✳' : '▧',
    avatar: initialsFor(business.name || 'Creator'),
    description: row.description || '',
    faqs: row.faqs || [],
    deliverables: row.product_deliverables || [],
    pricingOptions: prices,
    price: prices[0]?.amount || 0,
    billing: prices[0]?.cadence || 'once',
    id: row.id,
    slug: row.slug,
  };
}

/** Fetch the authenticated owner workspace and RLS-filtered public catalog. */
export async function loadWorkspaceData(supabase, user) {
  if (!supabase) {
    Object.assign(workspace, { profile: null, business: null, orders: [], entitlements: [], purchases: [], memberships: [], catalog: [], accessCodes: [], customerRelationships: [], customerBlocks: [], customerAccess: [], customerProgress: [], customerActivity: [], resourceProgress: [], personalBlocks: [] });
    return workspace;
  }
  if (!user) Object.assign(workspace, { profile: null, business: null, orders: [], entitlements: [], purchases: [], memberships: [], accessCodes: [], customerRelationships: [], customerBlocks: [], customerAccess: [], customerProgress: [], customerActivity: [], resourceProgress: [], personalBlocks: [] });

  if (user) {
  const [{ data: profile }, { data: business, error: businessError }, { data: purchases, error: purchasesError }, { data: memberships, error: membershipsError }, { data: accessOverrides, error: accessOverridesError }, { data: personalBlocks, error: personalBlocksError }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    supabase.from('businesses').select('*, products(*, prices(*), product_deliverables(*))').eq('owner_id', user.id).maybeSingle(),
    supabase.from('orders').select('id,order_number,amount_paise,currency,status,created_at,paid_at,is_demo,products(name,slug),businesses(name,handle)').eq('buyer_id', user.id).order('created_at', { ascending: false }),
    supabase.from('entitlements').select('id,business_id,product_id,status,starts_at,ends_at,products(name,slug,type,headline,product_deliverables(id,title,kind,storage_path,url)),businesses(name,handle)').eq('buyer_id', user.id).order('created_at', { ascending: false }),
    supabase.from('customer_product_access').select('id,business_id,product_id,resource_id,effect,products(name,slug,type,headline,product_deliverables(id,title,kind,storage_path,url)),businesses(name,handle)').eq('customer_id', user.id).eq('effect', 'grant'),
    supabase.from('business_customer_blocks').select('id,business_id,reason,created_at').eq('customer_id', user.id),
  ]);
  if (businessError) throw businessError;
  if (purchasesError) throw purchasesError;
  if (membershipsError) throw membershipsError;
  if (accessOverridesError) throw accessOverridesError;
  if (personalBlocksError) throw personalBlocksError;
  workspace.profile = profile || null;
  workspace.business = business ? { ...business, products: (business.products || []).map(fromProduct), website: business.website || '' } : null;
  workspace.purchases = purchases || [];
  const grantedProducts = new Map();
  for (const row of accessOverrides || []) {
    const product = row.products || {};
    const existing = grantedProducts.get(row.product_id);
    if (!existing || !row.resource_id) grantedProducts.set(row.product_id, {
      id: `access-${row.id}`, business_id: row.business_id, product_id: row.product_id, status: 'active', starts_at: null, ends_at: null,
      access_override: true, products: product, businesses: row.businesses || {},
    });
  }
  const overrideMemberships = [...grantedProducts.values()];
  workspace.personalBlocks = personalBlocks || [];
  const businessBlocks = new Set(workspace.personalBlocks.map(row => row.business_id));
  workspace.memberships = [...(memberships || []), ...overrideMemberships.filter(override => !(memberships || []).some(item => item.product_id === override.product_id && item.status === 'active'))]
    .map(item => businessBlocks.has(item.business_id) ? { ...item, status: 'blocked' } : item);

  if (workspace.business) {
    const [{ data: orders, error }, { data: entitlements, error: entitlementsError }, { data: accessCodes, error: accessCodesError }, { data: customerRelationships, error: customerRelationshipsError }, { data: customerBlocks, error: customerBlocksError }, { data: customerAccess, error: customerAccessError }, { data: customerProgress, error: customerProgressError }, { data: customerActivity, error: customerActivityError }, { data: resourceProgress, error: resourceProgressError }] = await Promise.all([
      supabase.from('orders').select('id,order_number,buyer_id,business_id,product_id,amount_paise,currency,status,created_at,paid_at,is_demo,answers,products(name,slug)').eq('business_id', workspace.business.id).order('created_at', { ascending: false }),
      supabase.from('entitlements').select('id,buyer_id,business_id,product_id,status,starts_at,ends_at,products(name,prices(amount_paise,cadence))').eq('business_id', workspace.business.id).order('created_at', { ascending: false }),
      supabase.from('product_access_codes').select('id,product_id,business_id,label,code_hint,max_redemptions,redemption_count,access_days,expires_at,disabled_at,created_at,products(name)').eq('business_id', workspace.business.id).order('created_at', { ascending: false }),
      supabase.from('customer_relationships').select('business_id,customer_id,tags,note,updated_at').eq('business_id', workspace.business.id),
      supabase.from('business_customer_blocks').select('id,business_id,customer_id,reason,created_at').eq('business_id', workspace.business.id),
      supabase.from('customer_product_access').select('id,business_id,customer_id,product_id,resource_id,effect,reason,created_at,updated_at').eq('business_id', workspace.business.id),
      supabase.from('member_resource_progress').select('id,business_id,customer_id,product_id,resource_id,completed_at,updated_at').eq('business_id', workspace.business.id),
      supabase.from('community_comments').select('id,author_id,body,created_at,community_posts!inner(product_id,products!inner(name,business_id))').eq('community_posts.products.business_id', workspace.business.id).order('created_at', { ascending: false }).limit(500),
      supabase.from('member_resource_progress').select('id,business_id,customer_id,product_id,resource_id,completed_at,updated_at').eq('customer_id', user.id),
    ]);
    if (error) throw error;
    if (entitlementsError) throw entitlementsError;
    if (accessCodesError) throw accessCodesError;
    if (customerRelationshipsError) throw customerRelationshipsError;
    if (customerBlocksError) throw customerBlocksError;
    if (customerAccessError) throw customerAccessError;
    if (customerProgressError) throw customerProgressError;
    if (customerActivityError) throw customerActivityError;
    if (resourceProgressError) throw resourceProgressError;
    workspace.orders = orders || [];
    workspace.entitlements = entitlements || [];
    workspace.accessCodes = accessCodes || [];
    workspace.customerRelationships = customerRelationships || [];
    workspace.customerBlocks = customerBlocks || [];
    workspace.customerAccess = customerAccess || [];
    workspace.customerProgress = customerProgress || [];
    workspace.customerActivity = customerActivity || [];
    workspace.resourceProgress = resourceProgress || [];
  } else {
    workspace.orders = [];
    workspace.entitlements = [];
    workspace.accessCodes = [];
    workspace.customerRelationships = [];
    workspace.customerBlocks = [];
    workspace.customerAccess = [];
    workspace.customerProgress = [];
    workspace.customerActivity = [];
    workspace.resourceProgress = [];
  }
  }

  await loadPublicCatalog(supabase);
  return workspace;
}

async function loadPublicCatalog(supabase) {
  const { data: catalog, error } = await supabase.from('products')
    .select('id,slug,name,headline,description,type,status,listed,media_url,faqs,created_at,businesses(name,handle,category),prices(*)')
    .eq('status', 'visible').order('created_at', { ascending: false });
  if (error) throw error;
  workspace.catalog = (catalog || []).map(fromProduct)
    .filter(product => product.listed && product.pricingOptions.some(price => price && price.amount >= 0 && !price.hideFromStore));
  window.cohortMarketProducts = workspace.catalog;
  window.dispatchEvent(new CustomEvent('cohort:catalog-ready'));
}
