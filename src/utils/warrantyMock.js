// Mock data untuk development local — tidak dipakai saat production
const STATUSES = ['open', 'estimasi', 'approved', 'progress', 'checker', 'selesai', 'closed'];
const VEHICLES = ['Tiggo 5x', 'Tiggo 7', 'Tiggo 8 Pro', 'Omoda 5', 'Tiggo Cross', 'Omoda EV', 'Tiggo 8'];
const MECHANICS = ['Zulham', 'Oky', 'Hutabarat', 'Wira', 'Angga', 'Solihin'];
const LEADERS = ['Budi', 'Andi', 'Rudi'];
const CUSTOMERS = ['Budi Santoso', 'Andi Wijaya', 'Siti Rahayu', 'Doni Pratama', 'Rina Kusuma', 'Hendra Gunawan', 'Maya Sari', 'Fajar Nugroho'];

function rnd(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function rndDate(daysAgo = 30) {
  const d = new Date();
  d.setDate(d.getDate() - Math.floor(Math.random() * daysAgo));
  d.setHours(Math.floor(Math.random() * 10) + 8, Math.floor(Math.random() * 60));
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

export function generateMockWorkOrders(count = 50) {
  return Array.from({ length: count }, (_, i) => {
    const status = rnd(STATUSES);
    const masuk = rndDate(60);
    return {
      no_wo: `WO-MOS-${String(1000 + i).padStart(4, '0')}`,
      no_wo_dms: `DMS${String(2000 + i).padStart(5, '0')}`,
      status,
      nama_pelanggan: rnd(CUSTOMERS),
      no_polisi: `BK ${1000 + Math.floor(Math.random() * 9000)} ${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`,
      no_chassis: `LVVDB21B${String(100000 + i)}`,
      nama_kendaraan: rnd(VEHICLES),
      waktu_masuk: masuk,
      waktu_simpan_estimasi: status !== 'open' ? rndDate(50) : '0000-00-00 00:00:00',
      waktu_setujui_estimasi: ['approved', 'progress', 'checker', 'selesai', 'closed'].includes(status) ? rndDate(45) : '0000-00-00 00:00:00',
      waktu_mulai: ['progress', 'checker', 'selesai', 'closed'].includes(status) ? rndDate(40) : '0000-00-00 00:00:00',
      waktu_checker: ['checker', 'selesai', 'closed'].includes(status) ? rndDate(30) : '0000-00-00 00:00:00',
      waktu_selesai: ['selesai', 'closed'].includes(status) ? rndDate(20) : '0000-00-00 00:00:00',
      nama_pembawa: rnd(CUSTOMERS),
      id_karyawan: `EMP${100 + Math.floor(Math.random() * 20)}`,
      nama_mekanik1: rnd(MECHANICS),
      nama_leader1: rnd(LEADERS),
      last_update: rndDate(5),
    };
  });
}

export function getMockResponse(start = 0, length = 25, search = '', status = '') {
  let data = generateMockWorkOrders(120);

  if (search) {
    const q = search.toLowerCase();
    data = data.filter(r =>
      r.no_wo.toLowerCase().includes(q) ||
      r.nama_pelanggan.toLowerCase().includes(q) ||
      r.no_polisi.toLowerCase().includes(q) ||
      r.no_chassis.toLowerCase().includes(q)
    );
  }

  if (status) {
    data = data.filter(r => r.status.toLowerCase() === status.toLowerCase());
  }

  const total = data.length;
  const sliced = data.slice(start, start + length);

  return {
    draw: 1,
    recordsTotal: total,
    recordsFiltered: total,
    data: sliced,
  };
}
