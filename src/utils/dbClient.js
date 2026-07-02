const API = '/api/db';

async function request({ table, action, data, filters }) {
  let authUsername = '';
  let authSessionId = '';
  try {
    const savedUser = sessionStorage.getItem('chery_auth_user');
    if (savedUser) {
      const userObj = JSON.parse(savedUser);
      authUsername = userObj.username || '';
    }
    authSessionId = sessionStorage.getItem('chery_session_id') || '';
  } catch (e) {
    console.warn('Gagal membaca sesi dari localStorage:', e);
  }

  const res = await fetch(API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Auth-Username': authUsername,
      'X-Auth-Session-Id': authSessionId
    },
    body: JSON.stringify({ table, action, data, filters })
  });
  const json = await res.json();
  if (!res.ok) {
    const err = new Error(json?.error || 'DB request failed');
    err.code = json?.code || null;
    err.details = json?.details || null;
    err.status = res.status;
    return { data: null, error: err, count: null };
  }
  return { data: json.data ?? null, error: null, count: json.count ?? null };
}

function f(op, column, value) {
  return { op, column, value };
}

export const db = {
  select(table, opts = {}) {
    const filters = [];
    if (opts.eq) {
      for (const [col, val] of Object.entries(opts.eq)) {
        filters.push(f('eq', col, val));
      }
    }
    if (opts.neq) {
      for (const [col, val] of Object.entries(opts.neq)) {
        filters.push(f('neq', col, val));
      }
    }
    if (opts.in) {
      for (const [col, vals] of Object.entries(opts.in)) {
        filters.push({ op: 'in', column: col, values: vals });
      }
    }
    if (opts.gte) {
      for (const [col, val] of Object.entries(opts.gte)) {
        filters.push(f('gte', col, val));
      }
    }
    if (opts.lte) {
      for (const [col, val] of Object.entries(opts.lte)) {
        filters.push(f('lte', col, val));
      }
    }
    if (opts.gt) {
      for (const [col, val] of Object.entries(opts.gt)) {
        filters.push(f('gt', col, val));
      }
    }
    if (opts.lt) {
      for (const [col, val] of Object.entries(opts.lt)) {
        filters.push(f('lt', col, val));
      }
    }
    if (opts.like) {
      for (const [col, val] of Object.entries(opts.like)) {
        filters.push(f('like', col, val));
      }
    }
    if (opts.ilike) {
      for (const [col, val] of Object.entries(opts.ilike)) {
        filters.push(f('ilike', col, val));
      }
    }
    if (opts.is) {
      for (const [col, val] of Object.entries(opts.is)) {
        filters.push(f('is', col, val));
      }
    }
    if (opts.order) {
      filters.push({ op: 'order', column: opts.order.column || opts.order, ascending: opts.order.ascending ?? true });
    }
    if (opts.limit) filters.push({ op: 'limit', value: opts.limit });
    if (opts.range) filters.push({ op: 'range', from: opts.range.from, to: opts.range.to });
    if (opts.or) {
      filters.push({ op: 'or', conditions: opts.or });
    }

    return request({
      table,
      action: 'select',
      data: { select: opts.select || '*', single: opts.single ?? false, maybeSingle: opts.maybeSingle ?? false, head: opts.head ?? false },
      filters: filters.length > 0 ? filters : undefined
    });
  },

  insert(table, values) {
    return request({ table, action: 'insert', data: { values } });
  },

  update(table, values, filters) {
    const filterArr = [];
    if (filters) {
      for (const [op, conditions] of Object.entries(filters)) {
        if (op === 'eq' || op === 'neq') {
          for (const [col, val] of Object.entries(conditions)) {
            filterArr.push(f(op, col, val));
          }
        }
      }
    }
    return request({
      table,
      action: 'update',
      data: { values, select: true },
      filters: filterArr.length > 0 ? filterArr : undefined
    });
  },

  delete(table, filters) {
    const filterArr = [];
    if (filters) {
      for (const [op, conditions] of Object.entries(filters)) {
        if (op === 'eq' || op === 'neq') {
          for (const [col, val] of Object.entries(conditions)) {
            filterArr.push(f(op, col, val));
          }
        }
      }
    }
    return request({
      table,
      action: 'delete',
      filters: filterArr.length > 0 ? filterArr : undefined
    });
  },

  upsert(table, values, upsertOptions) {
    return request({ table, action: 'upsert', data: { values, upsertOptions } });
  }
};
