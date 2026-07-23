// Shared warranty config — status colors, field helpers

export const STATUS_COLORS = {
  'open':            { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200',   dot: 'bg-blue-500',   label: 'Open' },
  'ready':           { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', dot: 'bg-yellow-500', label: 'Ready' },
  'in progress':     { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500', label: 'In Progress' },
  'checker':         { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', dot: 'bg-indigo-500', label: 'Checker' },
  'selesai':         { bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200',  dot: 'bg-green-500',  label: 'Selesai' },
  'closed':          { bg: 'bg-zinc-100',  text: 'text-zinc-500',   border: 'border-zinc-200',   dot: 'bg-zinc-400',   label: 'Closed' },
  'cancelled':       { bg: 'bg-red-50',    text: 'text-red-600',    border: 'border-red-200',    dot: 'bg-red-400',    label: 'Cancelled' },
  'pre-cancelled':   { bg: 'bg-red-50',    text: 'text-red-500',    border: 'border-red-200',    dot: 'bg-red-300',    label: 'Pre-Cancelled' },
};

export const KATEGORI_COLORS = {
  'IFS': { bg: 'bg-sky-50',    text: 'text-sky-700',    border: 'border-sky-200',    label: 'IFS' },
  'IKC': { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', label: 'IKC' },
  'EUR': { bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200',  label: 'EUR' },
};

export function getStatusStyle(status) {
  const key = (status || '').toLowerCase();
  return STATUS_COLORS[key] || { bg: 'bg-zinc-100', text: 'text-zinc-600', border: 'border-zinc-200', dot: 'bg-zinc-400', label: status || '-' };
}

export function getKategoriStyle(kategori) {
  return KATEGORI_COLORS[kategori] || { bg: 'bg-zinc-100', text: 'text-zinc-600', border: 'border-zinc-200', label: kategori || '-' };
}

export function formatDate(val) {
  if (!val || val === '0000-00-00 00:00:00' || val === '') return '-';
  try {
    const d = new Date(val);
    if (isNaN(d)) return val;
    return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return val; }
}

export function formatKm(val) {
  if (!val && val !== 0) return '-';
  return Number(val).toLocaleString('id-ID') + ' km';
}

export function formatRp(val) {
  if (val === null || val === undefined || isNaN(val)) return 'Rp. 0';
  return 'Rp. ' + Math.round(Number(val)).toLocaleString('id-ID');
}

export async function fetchWarrantyAPI(params) {
  // Redirect warranty calls to chery_dms endpoint (merged to stay within Vercel function limit)
  const newParams = new URLSearchParams(params.toString());
  newParams.set('endpoint', 'warranty-wo');
  const res = await fetch(`/api/chery_dms?${newParams}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json;
}
