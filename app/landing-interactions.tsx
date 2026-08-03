"use client";

import { useEffect } from "react";

const productIds = ["management", "sales", "orders"] as const;

const salesTemplate = `<div class="screen-content sales-screen">
  <div class="mock-topline"><div><span class="eyebrow">Analitik penjualan</span><h3>Yang laku, yang tumbuh, yang perlu dibenahi.</h3></div><span class="date-pill">7 hari terakhir</span></div>
  <div class="sales-layout">
    <div class="sales-chart-card"><div class="donut"><div><strong>68%</strong><span>makan di tempat</span></div></div><div class="legend-list"><p><i class="dot green"></i>Makan di tempat <b>Rp51,8 jt</b></p><p><i class="dot orange"></i>Bawa pulang <b>Rp16,2 jt</b></p><p><i class="dot cream"></i>Delivery <b>Rp8,1 jt</b></p></div></div>
    <div class="menu-rank-card"><div class="rank-head"><b>Menu terlaris</b><span>Omzet</span></div><div class="menu-row"><img src="/landing/pempek.webp" alt="Pempek"><div><b>Pempek Kapal Selam</b><span>241 terjual</span></div><strong>Rp9,4 jt</strong></div><div class="menu-row"><img src="/landing/es-kacang-merah.webp" alt="Es kacang merah"><div><b>Es Kacang Merah</b><span>198 terjual</span></div><strong>Rp5,8 jt</strong></div><div class="menu-row no-image"><span>3</span><div><b>Paket Keluarga</b><span>96 terjual</span></div><strong>Rp5,1 jt</strong></div></div>
  </div>
</div>`;

const ordersTemplate = `<div class="screen-content orders-screen">
  <div class="mock-topline"><div><span class="eyebrow">Pesanan langsung</span><h3>Semua pesanan, satu alur yang jelas.</h3></div><span class="live-pill"><i></i> Live</span></div>
  <div class="order-summary"><span><b>12</b> Baru masuk</span><span><b>8</b> Di dapur</span><span><b>5</b> Siap diantar</span></div>
  <div class="order-table">
    <div class="order-row"><strong>A-027</strong><span>Meja 12</span><span>4 item</span><span class="status status-di-dapur">Di dapur</span><b>Rp284.000</b></div>
    <div class="order-row"><strong>A-028</strong><span>Meja 05</span><span>3 item</span><span class="status status-siap-diantar">Siap diantar</span><b>Rp176.000</b></div>
    <div class="order-row"><strong>A-029</strong><span>Takeaway</span><span>2 item</span><span class="status status-baru-masuk">Baru masuk</span><b>Rp98.000</b></div>
    <div class="order-row"><strong>A-030</strong><span>Meja 08</span><span>5 item</span><span class="status status-di-dapur">Di dapur</span><b>Rp327.000</b></div>
  </div>
</div>`;

const aiContent = [
  {
    question: "Kenapa penjualan minggu ini turun?",
    answer:
      "Penjualan turun 11% dibanding minggu lalu. Penurunan terbesar terjadi saat makan siang karena dua menu terlaris beberapa kali tidak tersedia.",
    action: "Siapkan stok dua menu tersebut sebelum pukul 11.00.",
  },
  {
    question: "Menu mana yang perlu saya perhatikan?",
    answer:
      "Ayam Bakar tetap ramai, tetapi marginnya turun 6% karena kenaikan biaya bahan. Es Kacang Merah justru tumbuh paling cepat minggu ini.",
    action: "Tinjau porsi Ayam Bakar dan dorong paket dengan Es Kacang Merah.",
  },
  {
    question: "Kapan antrean paling lama?",
    answer:
      "Waktu tunggu tertinggi terjadi pada Jumat pukul 19.00–20.30. Rata-rata pesanan selesai 9 menit lebih lama dari target.",
    action: "Tambah satu staf dapur dan mulai persiapan 30 menit lebih awal.",
  },
];

export function LandingInteractions() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>("#solusisaji-landing");

    if (!root) return;

    const cleanups: Array<() => void> = [];
    const menuButton = root.querySelector<HTMLButtonElement>(".menu-toggle");
    const nav = root.querySelector<HTMLElement>(".site-header nav");

    if (menuButton && nav) {
      const toggleMenu = () => {
        const isOpen = nav.classList.toggle("nav-open");
        menuButton.setAttribute("aria-expanded", String(isOpen));
      };

      menuButton.addEventListener("click", toggleMenu);
      cleanups.push(() => menuButton.removeEventListener("click", toggleMenu));

      nav.querySelectorAll("a").forEach((link) => {
        const closeMenu = () => {
          nav.classList.remove("nav-open");
          menuButton.setAttribute("aria-expanded", "false");
        };

        link.addEventListener("click", closeMenu);
        cleanups.push(() => link.removeEventListener("click", closeMenu));
      });
    }

    const productButtons = Array.from(
      root.querySelectorAll<HTMLButtonElement>(".tab-list button"),
    );
    const initialScreen = root.querySelector<HTMLElement>(
      ".product-frame .screen-content",
    );
    const productTemplates = {
      management: initialScreen?.outerHTML ?? "",
      sales: salesTemplate,
      orders: ordersTemplate,
    };

    productButtons.forEach((button, index) => {
      const selectProduct = () => {
        productButtons.forEach((item) => {
          item.classList.remove("active");
          item.setAttribute("aria-selected", "false");
        });
        button.classList.add("active");
        button.setAttribute("aria-selected", "true");

        const screen = root.querySelector<HTMLElement>(
          ".product-frame .screen-content",
        );
        const productId = productIds[index];

        if (screen && productId) {
          screen.outerHTML = productTemplates[productId];
        }
      };

      button.addEventListener("click", selectProduct);
      cleanups.push(() => button.removeEventListener("click", selectProduct));
    });

    const aiButtons = Array.from(
      root.querySelectorAll<HTMLButtonElement>(".ai-tabs button"),
    );

    aiButtons.forEach((button, index) => {
      const selectQuestion = () => {
        aiButtons.forEach((item) => item.classList.remove("active"));
        button.classList.add("active");

        const content = aiContent[index];
        const question = root.querySelector<HTMLElement>(".user-message");
        const answer = root.querySelector<HTMLElement>(".ai-message p");
        const action = root.querySelector<HTMLElement>(".suggested-action");

        if (!content) return;
        if (question) question.textContent = content.question;
        if (answer) answer.textContent = content.answer;
        if (action) {
          action.replaceChildren();
          const label = document.createElement("small");
          label.textContent = "SARAN TINDAKAN";
          action.append(label, content.action);
        }
      };

      button.addEventListener("click", selectQuestion);
      cleanups.push(() => button.removeEventListener("click", selectQuestion));
    });

    return () => cleanups.forEach((cleanup) => cleanup());
  }, []);

  return null;
}
