import React, { useEffect, useRef } from 'react';

const spareparts = [
    {
        id: 1,
        name: "Paket Oxygen Booster",
        price: "Tanya Harga",
        benefit: "Paket sirkulasi udara kabin untuk bernafas lebih sehat. Termasuk penggantian A/C Filter, Air Filter, serta Evaporator Cleaner untuk memastikan udara tetap segar, bersih, dan bebas bakteri.",
        color: "bg-red-50",
        accent: "text-red-600",
        border: "border-red-200",
        shadow: "shadow-red-900/10",
        image: "https://images.unsplash.com/photo-1635773127814-1e05d04cc6de?q=80&w=800&auto=format&fit=crop"
    },
    {
        id: 2,
        name: "Paket Spooring Ban",
        price: "Tanya Harga",
        benefit: "Pastikan kenyamanan berkendara dan keamanan maksimal. Servis Spooring Ban berfungsi menjaga keseimbangan rotasi sehingga ban lebih awet dan handling setir tetap stabil.",
        color: "bg-yellow-50",
        accent: "text-yellow-600",
        border: "border-yellow-200",
        shadow: "shadow-yellow-900/10",
        image: "https://images.unsplash.com/photo-1579621970588-a3f5ce5ca0c1?q=80&w=800&auto=format&fit=crop"
    }
];

const PromosiSparepart = () => {
    const elementsRef = useRef([]);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('animate-slide-up', 'opacity-100');
                        entry.target.classList.remove('opacity-0', 'translate-y-20');
                    }
                });
            },
            { threshold: 0.2 }
        );

        elementsRef.current.forEach((el) => {
            if (el) observer.observe(el);
        });

        return () => observer.disconnect();
    }, []);

    return (
        <>
            <div className="min-h-screen bg-white text-zinc-900 pt-24 pb-20 overflow-hidden font-sans">

                {/* Swallowtail Ribbon Banner */}
                <div className="relative max-w-4xl mx-auto mb-20 text-center px-4">
                    <div className="relative inline-block bg-zinc-900 text-white py-6 px-12 md:px-24">
                        {/* Left tail */}
                        <div className="absolute top-0 left-[-40px] border-y-[36px] border-y-zinc-900 border-l-[40px] border-l-transparent h-full w-[40px]"></div>
                        {/* Right tail */}
                        <div className="absolute top-0 right-[-40px] border-y-[36px] border-y-zinc-900 border-r-[40px] border-r-transparent h-full w-[40px]"></div>

                        <h1 className="text-3xl md:text-5xl font-black uppercase tracking-[0.2em] relative z-10 m-0">
                            PAKET PROMOSI
                        </h1>
                    </div>
                    <p className="mt-8 text-zinc-500 font-bold uppercase tracking-widest text-sm md:text-base animate-pulse">
                        Pilihan Paket Perawatan Terbaik Untuk Anda
                    </p>
                </div>

                {/* Zig-Zag List */}
                <div className="max-w-6xl mx-auto px-4 sm:px-8 space-y-24 md:space-y-32">
                    {spareparts.map((item, index) => {
                        const isEven = index % 2 !== 0; // True for index 1 (Kuning)

                        return (
                            <div
                                key={item.id}
                                ref={(el) => (elementsRef.current[index] = el)}
                                className={`flex flex-col md:flex-row items-center gap-8 md:gap-16 opacity-0 translate-y-20 transition-all duration-1000 ease-out ${isEven ? 'md:flex-row-reverse' : ''}`}
                            >

                                {/* Image Section */}
                                <div className="w-full md:w-1/2 relative group">
                                    <div className={`absolute inset-0 translate-x-4 translate-y-4 rounded-3xl -z-10 transition-transform duration-500 group-hover:translate-x-6 group-hover:translate-y-6 ${item.color} border ${item.border}`}></div>
                                    <div className={`overflow-hidden rounded-3xl border-4 border-white shadow-2xl ${item.shadow}`}>
                                        <img
                                            src={item.image}
                                            alt={item.name}
                                            className="w-full h-[300px] md:h-[400px] object-cover transition-transform duration-700 group-hover:scale-110"
                                        />
                                    </div>
                                    {/* Number Badge */}
                                    <div className={`absolute -top-6 -left-6 w-16 h-16 rounded-full flex items-center justify-center text-3xl font-black bg-white shadow-xl text-zinc-900 border-4 border-white z-20`}>
                                        {index + 1}
                                    </div>
                                </div>

                                {/* Text Section */}
                                <div className="w-full md:w-1/2 space-y-6 text-center md:text-left">
                                    <h2 className={`text-4xl md:text-6xl font-black uppercase tracking-tighter leading-none ${item.accent}`}>
                                        {item.name}
                                    </h2>
                                    <div className="inline-block bg-zinc-900 text-white px-6 py-3 rounded-full text-2xl font-black tabular-nums tracking-tight shadow-xl">
                                        {item.price}
                                    </div>
                                    <div className="w-16 h-2 bg-zinc-200 mx-auto md:mx-0 rounded-full"></div>
                                    <p className="text-lg md:text-xl text-zinc-600 font-medium leading-relaxed">
                                        {item.benefit}
                                    </p>
                                    <a
                                        href="https://wa.me/628116017300"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={`inline-block mt-4 px-8 py-4 rounded-xl font-black uppercase tracking-widest text-sm transition-all active:scale-95 shadow-lg border-2 border-transparent hover:bg-white ${item.color} ${item.accent} hover:border-${item.accent.split('-')[1]}-600`}
                                    >
                                        Pesan Sekarang
                                    </a>
                                </div>

                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Floating WA Sparepart */}
            <div className="fixed bottom-20 sm:bottom-6 right-6 z-[100] flex flex-col items-end gap-2">
                <div className="bg-green-100/90 backdrop-blur-sm text-green-800 px-4 py-3 rounded-2xl rounded-br-none shadow-lg border border-green-200 font-bold text-sm animate-bounce max-w-[250px] text-right">
                    Tanya Sparepart lain nya disini yaa
                </div>
                <a
                    href="https://wa.me/6281958514200"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-green-500 p-4 rounded-full text-white shadow-xl shadow-green-500/40 hover:scale-110 transition-transform flex items-center justify-center shrink-0 group"
                    title="Tanya Sparepart"
                >
                    <svg viewBox="0 0 24 24" fill="currentColor" width="36" height="36" className="group-hover:rotate-12 transition-transform">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.808-.72-1.353-1.611-1.511-1.91-.158-.298-.017-.46.132-.609.135-.133.298-.344.446-.516.149-.172.198-.297.298-.496.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413" />
                    </svg>
                </a>
            </div>

            <style>{`
        .animate-slide-up {
          animation: slideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(40px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
        </>
    );
};

export default PromosiSparepart;
