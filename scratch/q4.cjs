const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8').split(/\r?\n/).reduce((a, l) => { const i = l.indexOf('='); if (i > 0) { const k = l.slice(0, i).trim(); a[k] = l.slice(i + 1).trim(); } return a; }, {});
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON);
(async () => {
  const { count, data, error } = await sb.from('sparepart_revenue').select('"Tgl","NoTransaksi","Pelanggan","Qty","HargaSatuan","HargaJual","Discount","Total"', { count: 'exact' }).range(0, 30);
  if (error) { console.log('ERR', error.message); return; }
  console.log('TOTAL COUNT:', count);
  console.log('---SAMPEL---');
  data.forEach(r => console.log([r.Tgl, r.NoTransaksi, r.Pelanggan, r.Qty, r.HargaSatuan, r.HargaJual, r.Discount, r.Total].join(' | ')));
})();
