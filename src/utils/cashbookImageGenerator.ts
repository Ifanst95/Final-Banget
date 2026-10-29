import { formatRupiah, formatDateDDMMYYYY } from './helpers';

export interface CashbookImageParams {
  brandName: string;
  periodLabel: string;
  prevMonthSummary: {
    prevMonthLabel: string;
    kasUtama: number;
    wifiCashback: number;
    sampahCashback: number;
    total: number;
  };
  rekapIuranRow: {
    no: string | number;
    date: string;
    description: string;
    masuk: number;
    keluar: number;
    runningBalance: number;
    effectiveTotalIuran: number;
    effectiveTotalDenda: number;
    effectiveTotalTunggakan: number;
  } | null;
  cashbookRows: Array<{
    no: number | string;
    date: string;
    description: string;
    subCategoryLabel: string;
    pool: string;
    isMasuk: boolean;
    amount: number;
    runningBalance: number;
  }>;
  tableTotals: {
    sumMasukKasUtama: number;
    sumMasukCashback: number;
    sumKeluarKasUtama: number;
    sumKeluarCashback: number;
    finalKasUtama: number;
    finalWifi: number;
    finalSampah: number;
    finalCashback: number;
    finalSaldo: number;
    netKasUtama: number;
  };
}

/**
 * Utility to draw a rounded rectangle on a CanvasRenderingContext2D
 */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number | number[]
) {
  let tl = 0, tr = 0, br = 0, bl = 0;
  if (typeof radius === 'number') {
    tl = tr = br = bl = radius;
  } else if (Array.isArray(radius)) {
    [tl, tr = tl, br = tl, bl = tr] = radius;
  }
  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + tr);
  ctx.lineTo(x + w, y + h - br);
  ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
  ctx.lineTo(x + bl, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - bl);
  ctx.lineTo(x, y + tl);
  ctx.quadraticCurveTo(x, y, x + tl, y);
  ctx.closePath();
}

/**
 * Truncate or wrap text to fit within a specified max width
 */
function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let truncated = text;
  while (truncated.length > 4 && ctx.measureText(truncated + '...').width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + '...';
}

/**
 * Generates an ultra-crisp, high-fidelity PNG image of the Buku Kas Keluar Masuk table
 * from the top of the table all the way down to the bottom total remaining balance.
 */
export async function generateCashbookImage(
  params: CashbookImageParams
): Promise<{ dataUrl: string; blob: Blob }> {
  const {
    brandName,
    periodLabel,
    prevMonthSummary,
    rekapIuranRow,
    cashbookRows,
    tableTotals,
  } = params;

  // Geometry measurements (Logical CSS pixels)
  const canvasWidth = 1200;
  const marginX = 40;
  const contentWidth = canvasWidth - marginX * 2; // 1120px

  // Column widths (Total = 1120px)
  const colW = {
    no: 45,
    date: 100,
    desc: 465,
    masuk: 170,
    keluar: 170,
    saldo: 170,
  };
  const colX = {
    no: marginX,
    date: marginX + colW.no,
    desc: marginX + colW.no + colW.date,
    masuk: marginX + colW.no + colW.date + colW.desc,
    keluar: marginX + colW.no + colW.date + colW.desc + colW.masuk,
    saldo: marginX + colW.no + colW.date + colW.desc + colW.masuk + colW.keluar,
  };

  // Row heights
  const headerBannerH = 150;
  const thRowH = 46;
  const prevMonthRowH = 58;
  const rekapRowH = rekapIuranRow ? 58 : 0;
  const itemRowH = 50;
  const tfRowH = 54;
  const cardsGap = 20;
  const cardsH = 220;
  const grandBannerH = 125;
  const footerH = 65;

  const totalRowsCount = cashbookRows.length;
  const totalTableH =
    thRowH +
    prevMonthRowH +
    rekapRowH +
    totalRowsCount * itemRowH +
    tfRowH;

  const canvasHeight =
    marginX +
    headerBannerH +
    20 + // gap between banner and table
    totalTableH +
    cardsGap +
    cardsH +
    cardsGap +
    grandBannerH +
    20 +
    footerH +
    marginX;

  // Canvas setup with 2x DPR for ultra-crisp display and printing
  const dpr = 2;
  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth * dpr;
  canvas.height = canvasHeight * dpr;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context not supported');
  }

  ctx.scale(dpr, dpr);

  // Background - Soft subtle slate/mint tint
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Container Card with shadow
  ctx.save();
  ctx.shadowColor = 'rgba(15, 23, 42, 0.08)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, marginX - 10, marginX - 10, contentWidth + 20, canvasHeight - marginX * 2 + 20, 24);
  ctx.fill();
  ctx.restore();

  let curY = marginX;

  // ==========================================
  // 1. TOP HEADER BANNER
  // ==========================================
  ctx.save();
  const bannerGrad = ctx.createLinearGradient(marginX, curY, marginX + contentWidth, curY + headerBannerH);
  bannerGrad.addColorStop(0, '#064e3b'); // dark emerald
  bannerGrad.addColorStop(0.55, '#0f766e'); // teal
  bannerGrad.addColorStop(1, '#0f172a'); // slate-950
  ctx.fillStyle = bannerGrad;
  roundRect(ctx, marginX, curY, contentWidth, headerBannerH, 18);
  ctx.fill();

  // Decorative glow
  ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.beginPath();
  ctx.arc(marginX + contentWidth - 60, curY + 30, 90, 0, Math.PI * 2);
  ctx.fill();

  // Brand Name Pill
  ctx.fillStyle = '#fef08a'; // amber-200
  ctx.font = 'bold 12px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText((brandName || 'WARGA GANG MANDOR').toUpperCase(), marginX + 28, curY + 36);

  // Title
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 24px "Outfit", "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText('LAPORAN BUKU KAS KELUAR & MASUK', marginX + 28, curY + 70);

  // Subtitle / Period
  ctx.fillStyle = '#a7f3d0'; // emerald-200
  ctx.font = '600 13px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(
    `Periode: ${periodLabel || 'Bulan Berjalan'}  •  Laporan Pembukuan Kas Terpadu & Transparan`,
    marginX + 28,
    curY + 98
  );

  // Date Printed & Badge on the right
  const dateFormatted = formatDateDDMMYYYY(new Date().toISOString().slice(0, 10));
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  roundRect(ctx, marginX + contentWidth - 220, curY + 50, 192, 44, 12);
  ctx.fill();
  ctx.fillStyle = '#fef3c7';
  ctx.font = 'bold 11px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText('Dicetak Resmi:', marginX + contentWidth - 205, curY + 68);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px "JetBrains Mono", monospace';
  ctx.fillText(dateFormatted, marginX + contentWidth - 205, curY + 86);
  ctx.restore();

  curY += headerBannerH + 20;

  // ==========================================
  // 2. BUKU KAS TABLE
  // ==========================================
  const tableStartY = curY;

  // 2.1 Table Header (TH)
  ctx.save();
  ctx.fillStyle = '#0f766e'; // teal-700
  roundRect(ctx, marginX, curY, contentWidth, thRowH, [12, 12, 0, 0]);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px "Plus Jakarta Sans", system-ui, sans-serif';

  // No
  ctx.textAlign = 'center';
  ctx.fillText('No', colX.no + colW.no / 2, curY + 28);
  // Tanggal
  ctx.fillText('Tanggal', colX.date + colW.date / 2, curY + 28);
  // Uraian
  ctx.textAlign = 'left';
  ctx.fillText('Uraian Transaksi Kas Gang', colX.desc + 16, curY + 28);
  // Masuk
  ctx.textAlign = 'right';
  ctx.fillText('PEMASUKAN (+)', colX.masuk + colW.masuk - 16, curY + 28);
  // Keluar
  ctx.fillText('PENGELUARAN (-)', colX.keluar + colW.keluar - 16, curY + 28);
  // Saldo
  ctx.fillText('Saldo Berjalan', colX.saldo + colW.saldo - 16, curY + 28);
  ctx.restore();

  curY += thRowH;

  // Helper to draw horizontal borders
  const drawRowBorder = (y: number) => {
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(marginX, y);
    ctx.lineTo(marginX + contentWidth, y);
    ctx.stroke();
  };

  // 2.2 Row: Saldo Bulan Sebelumnya
  ctx.save();
  ctx.fillStyle = '#fef3c7'; // amber-100
  ctx.fillRect(marginX, curY, contentWidth, prevMonthRowH);

  // Border bottom
  ctx.strokeStyle = '#fcd34d'; // amber-300
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(marginX, curY + prevMonthRowH);
  ctx.lineTo(marginX + contentWidth, curY + prevMonthRowH);
  ctx.stroke();

  // No
  ctx.fillStyle = '#78350f';
  ctx.font = 'bold 12px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('-', colX.no + colW.no / 2, curY + 34);

  // Tanggal
  ctx.fillText('Awal Bulan', colX.date + colW.date / 2, curY + 34);

  // Uraian
  ctx.textAlign = 'left';
  ctx.font = 'bold 13px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(
    `Saldo Bulan Sebelumnya (${prevMonthSummary.prevMonthLabel})`,
    colX.desc + 16,
    curY + 25
  );
  ctx.font = '500 10.5px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillStyle = '#92400e';
  ctx.fillText(
    `Kas Utama: ${formatRupiah(prevMonthSummary.kasUtama)}  |  WiFi: ${formatRupiah(prevMonthSummary.wifiCashback)}  |  Sampah: ${formatRupiah(prevMonthSummary.sampahCashback)}`,
    colX.desc + 16,
    curY + 44
  );

  // Masuk & Keluar
  ctx.textAlign = 'right';
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 12px "JetBrains Mono", monospace';
  ctx.fillText('-', colX.masuk + colW.masuk - 16, curY + 34);
  ctx.fillText('-', colX.keluar + colW.keluar - 16, curY + 34);

  // Saldo
  ctx.fillStyle = '#78350f';
  ctx.font = 'bold 13px "JetBrains Mono", monospace';
  ctx.fillText(formatRupiah(prevMonthSummary.total), colX.saldo + colW.saldo - 16, curY + 34);
  ctx.restore();

  curY += prevMonthRowH;

  // 2.3 Row: Total Penerimaan Kas Warga (Rekap Iuran KK, Denda, Tunggakan)
  if (rekapIuranRow) {
    ctx.save();
    ctx.fillStyle = '#ecfdf5'; // emerald-50
    ctx.fillRect(marginX, curY, contentWidth, rekapRowH);

    ctx.strokeStyle = '#a7f3d0'; // emerald-200
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(marginX, curY + rekapRowH);
    ctx.lineTo(marginX + contentWidth, curY + rekapRowH);
    ctx.stroke();

    // No
    ctx.fillStyle = '#065f46';
    ctx.font = 'bold 12px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(String(rekapIuranRow.no), colX.no + colW.no / 2, curY + 34);

    // Tanggal
    ctx.font = '500 11.5px "JetBrains Mono", monospace';
    ctx.fillText(rekapIuranRow.date, colX.date + colW.date / 2, curY + 34);

    // Uraian
    ctx.textAlign = 'left';
    ctx.font = 'bold 13px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(rekapIuranRow.description, colX.desc + 16, curY + 25);

    ctx.font = '500 10.5px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillStyle = '#047857';
    const subParts = [];
    if (rekapIuranRow.effectiveTotalIuran > 0) {
      subParts.push(`Iuran: ${formatRupiah(rekapIuranRow.effectiveTotalIuran)}`);
    }
    if (rekapIuranRow.effectiveTotalDenda > 0) {
      subParts.push(`Denda: ${formatRupiah(rekapIuranRow.effectiveTotalDenda)}`);
    }
    if (rekapIuranRow.effectiveTotalTunggakan > 0) {
      subParts.push(`Tunggakan: ${formatRupiah(rekapIuranRow.effectiveTotalTunggakan)}`);
    }
    ctx.fillText(subParts.join('  |  ') || 'Penerimaan Kas Warga', colX.desc + 16, curY + 44);

    // Masuk (+)
    ctx.textAlign = 'right';
    ctx.fillStyle = '#059669'; // emerald-600
    ctx.font = 'bold 13px "JetBrains Mono", monospace';
    ctx.fillText(`+${formatRupiah(rekapIuranRow.masuk)}`, colX.masuk + colW.masuk - 16, curY + 34);

    // Keluar (-)
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('-', colX.keluar + colW.keluar - 16, curY + 34);

    // Saldo
    ctx.fillStyle = '#0f172a';
    ctx.fillText(formatRupiah(rekapIuranRow.runningBalance), colX.saldo + colW.saldo - 16, curY + 34);
    ctx.restore();

    curY += rekapRowH;
  }

  // 2.4 Transaction Rows
  cashbookRows.forEach((row, idx) => {
    ctx.save();
    // Alternating rows
    ctx.fillStyle = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
    ctx.fillRect(marginX, curY, contentWidth, itemRowH);

    drawRowBorder(curY + itemRowH);

    // No
    ctx.fillStyle = '#64748b';
    ctx.font = '500 12px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(String(row.no), colX.no + colW.no / 2, curY + 30);

    // Tanggal
    ctx.fillStyle = '#334155';
    ctx.fillText(row.date, colX.date + colW.date / 2, curY + 30);

    // Uraian
    ctx.textAlign = 'left';
    ctx.fillStyle = '#0f172a';
    ctx.font = '600 12px "Plus Jakarta Sans", system-ui, sans-serif';
    const fittedDesc = fitText(ctx, row.description, colW.desc - 130);
    ctx.fillText(fittedDesc, colX.desc + 16, curY + 24);

    // Small category tag
    ctx.font = '500 10px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillStyle = row.isMasuk ? '#0284c7' : '#e11d48';
    ctx.fillText(`[${row.subCategoryLabel || row.pool}]`, colX.desc + 16, curY + 40);

    // Masuk (+)
    ctx.textAlign = 'right';
    ctx.font = 'bold 12.5px "JetBrains Mono", monospace';
    if (row.isMasuk) {
      ctx.fillStyle = '#059669';
      ctx.fillText(`+${formatRupiah(row.amount)}`, colX.masuk + colW.masuk - 16, curY + 30);
    } else {
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText('-', colX.masuk + colW.masuk - 16, curY + 30);
    }

    // Keluar (-)
    if (!row.isMasuk) {
      ctx.fillStyle = '#e11d48';
      ctx.fillText(`-${formatRupiah(row.amount)}`, colX.keluar + colW.keluar - 16, curY + 30);
    } else {
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText('-', colX.keluar + colW.keluar - 16, curY + 30);
    }

    // Saldo
    ctx.fillStyle = '#0f172a';
    ctx.fillText(formatRupiah(row.runningBalance), colX.saldo + colW.saldo - 16, curY + 30);
    ctx.restore();

    curY += itemRowH;
  });

  // 2.5 Table Footer (TF)
  ctx.save();
  ctx.fillStyle = '#ccfbf1'; // teal-100
  roundRect(ctx, marginX, curY, contentWidth, tfRowH, [0, 0, 12, 12]);
  ctx.fill();

  ctx.strokeStyle = '#14b8a6'; // teal-500
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(marginX, curY);
  ctx.lineTo(marginX + contentWidth, curY);
  ctx.stroke();

  // No & Tanggal
  ctx.fillStyle = '#0f766e';
  ctx.font = 'bold 12px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('-', colX.no + colW.no / 2, curY + 32);
  ctx.fillText('Akhir Bulan', colX.date + colW.date / 2, curY + 32);

  // Title
  ctx.textAlign = 'left';
  ctx.font = '900 12.5px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillStyle = '#0f172a';
  ctx.fillText('TOTAL MUTASI & SALDO AKHIR', colX.desc + 16, curY + 32);

  // Total Masuk
  const totalMasukAll = tableTotals.sumMasukKasUtama + tableTotals.sumMasukCashback;
  const totalKeluarAll = tableTotals.sumKeluarKasUtama + tableTotals.sumKeluarCashback;

  ctx.textAlign = 'right';
  ctx.font = 'bold 13px "JetBrains Mono", monospace';
  ctx.fillStyle = '#047857';
  ctx.fillText(`+${formatRupiah(totalMasukAll)}`, colX.masuk + colW.masuk - 16, curY + 32);

  // Total Keluar
  ctx.fillStyle = '#be123c';
  ctx.fillText(`-${formatRupiah(totalKeluarAll)}`, colX.keluar + colW.keluar - 16, curY + 32);

  // Final Saldo
  ctx.fillStyle = '#042f2e';
  ctx.font = '900 14px "JetBrains Mono", monospace';
  ctx.fillText(formatRupiah(tableTotals.finalSaldo), colX.saldo + colW.saldo - 16, curY + 32);
  ctx.restore();

  // Outer Table Border
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  roundRect(ctx, marginX, tableStartY, contentWidth, curY + tfRowH - tableStartY, 12);
  ctx.stroke();

  curY += tfRowH + cardsGap;

  // ==========================================
  // 3. 3 SUMMARY CARDS UNDERNEATH TABLE
  // ==========================================
  const cardW = (contentWidth - 24) / 3; // 3 cards with 12px gap

  // Helper for small key-value row
  const drawKvRow = (
    label: string,
    val: string,
    x: number,
    y: number,
    w: number,
    valColor: string = '#0f172a',
    bg: string = '#ffffff'
  ) => {
    ctx.save();
    ctx.fillStyle = bg;
    roundRect(ctx, x, y, w, 28, 8);
    ctx.fill();
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#475569';
    ctx.font = '600 11px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(label, x + 10, y + 18);

    ctx.fillStyle = valColor;
    ctx.font = 'bold 11.5px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(val, x + w - 10, y + 18);
    ctx.restore();
  };

  // ------------------------------------------
  // CARD 1: Saldo Bulan Sebelumnya
  // ------------------------------------------
  const c1X = marginX;
  ctx.save();
  ctx.fillStyle = '#fffbeb'; // amber-50
  roundRect(ctx, c1X, curY, cardW, cardsH, 16);
  ctx.fill();
  ctx.strokeStyle = '#fcd34d'; // amber-300
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#92400e';
  ctx.font = 'bold 12px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('1. SALDO BULAN SEBELUMNYA', c1X + cardW / 2, curY + 28);
  ctx.font = '500 10.5px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(`Periode: ${prevMonthSummary.prevMonthLabel}`, c1X + cardW / 2, curY + 44);

  drawKvRow('Saldo Kas Utama:', formatRupiah(prevMonthSummary.kasUtama), c1X + 12, curY + 54, cardW - 24, '#047857');
  drawKvRow('Saldo Cashback WiFi:', formatRupiah(prevMonthSummary.wifiCashback), c1X + 12, curY + 88, cardW - 24, '#1d4ed8');
  drawKvRow('Saldo Cashback Sampah:', formatRupiah(prevMonthSummary.sampahCashback), c1X + 12, curY + 122, cardW - 24, '#0f766e');

  // Total bottom strip
  ctx.fillStyle = '#d97706'; // amber-600
  roundRect(ctx, c1X + 12, curY + 160, cardW - 24, 46, 10);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 10px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText('TOTAL SALDO AWAL BULAN', c1X + cardW / 2, curY + 178);
  ctx.font = 'bold 14px "JetBrains Mono", monospace';
  ctx.fillStyle = '#fef3c7';
  ctx.fillText(formatRupiah(prevMonthSummary.total), c1X + cardW / 2, curY + 196);
  ctx.restore();

  // ------------------------------------------
  // CARD 2: Kas Utama Periode Ini
  // ------------------------------------------
  const c2X = c1X + cardW + 12;
  ctx.save();
  ctx.fillStyle = '#ecfdf5'; // emerald-50
  roundRect(ctx, c2X, curY, cardW, cardsH, 16);
  ctx.fill();
  ctx.strokeStyle = '#6ee7b7'; // emerald-300
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#065f46';
  ctx.font = 'bold 12px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('2. KAS UTAMA PERIODE INI', c2X + cardW / 2, curY + 28);
  ctx.font = '500 10.5px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText('Penerimaan & Pengeluaran Gang', c2X + cardW / 2, curY + 44);

  drawKvRow('Penerimaan Kas (+):', `+${formatRupiah(tableTotals.sumMasukKasUtama)}`, c2X + 12, curY + 54, cardW - 24, '#047857');
  drawKvRow('Pengeluaran Kas (-):', `-${formatRupiah(tableTotals.sumKeluarKasUtama)}`, c2X + 12, curY + 88, cardW - 24, '#be123c');
  drawKvRow(
    'Arus Kas Bersih:',
    `${tableTotals.netKasUtama >= 0 ? '+' : ''}${formatRupiah(tableTotals.netKasUtama)}`,
    c2X + 12,
    curY + 122,
    cardW - 24,
    tableTotals.netKasUtama >= 0 ? '#047857' : '#be123c',
    '#f0fdf4'
  );

  // Total bottom strip
  ctx.fillStyle = '#059669'; // emerald-600
  roundRect(ctx, c2X + 12, curY + 160, cardW - 24, 46, 10);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 10px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText('SISA SALDO KAS UTAMA', c2X + cardW / 2, curY + 178);
  ctx.font = 'bold 14px "JetBrains Mono", monospace';
  ctx.fillStyle = '#fef08a';
  ctx.fillText(formatRupiah(tableTotals.finalKasUtama), c2X + cardW / 2, curY + 196);
  ctx.restore();

  // ------------------------------------------
  // CARD 3: Saldo Cashback (WiFi & Sampah)
  // ------------------------------------------
  const c3X = c2X + cardW + 12;
  ctx.save();
  ctx.fillStyle = '#f0f9ff'; // sky-50
  roundRect(ctx, c3X, curY, cardW, cardsH, 16);
  ctx.fill();
  ctx.strokeStyle = '#7dd3fc'; // sky-300
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#0369a1';
  ctx.font = 'bold 12px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('3. CASHBACK (WIFI & SAMPAH)', c3X + cardW / 2, curY + 28);
  ctx.font = '500 10.5px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText('Akumulasi & Sisa Saldo', c3X + cardW / 2, curY + 44);

  drawKvRow('Sisa Akhir WiFi:', formatRupiah(tableTotals.finalWifi), c3X + 12, curY + 54, cardW - 24, '#1d4ed8');
  drawKvRow('Sisa Akhir Sampah:', formatRupiah(tableTotals.finalSampah), c3X + 12, curY + 88, cardW - 24, '#0f766e');
  drawKvRow(
    'Mutasi Masuk/Keluar:',
    `+${formatRupiah(tableTotals.sumMasukCashback)} / -${formatRupiah(tableTotals.sumKeluarCashback)}`,
    c3X + 12,
    curY + 122,
    cardW - 24,
    '#475569'
  );

  // Total bottom strip
  ctx.fillStyle = '#0284c7'; // sky-600
  roundRect(ctx, c3X + 12, curY + 160, cardW - 24, 46, 10);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 10px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText('TOTAL SALDO CASHBACK', c3X + cardW / 2, curY + 178);
  ctx.font = 'bold 14px "JetBrains Mono", monospace';
  ctx.fillStyle = '#fef08a';
  ctx.fillText(formatRupiah(tableTotals.finalCashback), c3X + cardW / 2, curY + 196);
  ctx.restore();

  curY += cardsH + cardsGap;

  // ==========================================================
  // 4. PALING BAWAH: TOTAL SISA SALDO KESELURUHAN KEUANGAN GANG
  // ==========================================================
  ctx.save();
  const grandGrad = ctx.createLinearGradient(marginX, curY, marginX + contentWidth, curY + grandBannerH);
  grandGrad.addColorStop(0, '#022c22'); // very dark emerald
  grandGrad.addColorStop(0.5, '#064e3b'); // dark emerald
  grandGrad.addColorStop(1, '#0f172a'); // slate-950
  ctx.fillStyle = grandGrad;
  roundRect(ctx, marginX, curY, contentWidth, grandBannerH, 20);
  ctx.fill();

  ctx.strokeStyle = '#34d399'; // emerald-400
  ctx.lineWidth = 2.5;
  roundRect(ctx, marginX, curY, contentWidth, grandBannerH, 20);
  ctx.stroke();

  // Title
  ctx.fillStyle = '#a7f3d0'; // emerald-200
  ctx.font = '900 13px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('TOTAL SISA SALDO KESELURUHAN KEUANGAN GANG', marginX + contentWidth / 2, curY + 34);

  // Big Amount
  ctx.fillStyle = '#fde047'; // amber-300
  ctx.font = '900 32px "JetBrains Mono", monospace';
  ctx.fillText(formatRupiah(tableTotals.finalSaldo), marginX + contentWidth / 2, curY + 76);

  // Subtitle Breakdown
  ctx.fillStyle = '#d1fae5';
  ctx.font = '600 12px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(
    `(Kas Utama: ${formatRupiah(tableTotals.finalKasUtama)}  +  Cashback WiFi & Sampah: ${formatRupiah(tableTotals.finalCashback)})`,
    marginX + contentWidth / 2,
    curY + 104
  );
  ctx.restore();

  curY += grandBannerH + 20;

  // ==========================================
  // 5. FOOTER & TANDA TANGAN PENGURUS
  // ==========================================
  ctx.save();
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(marginX, curY);
  ctx.lineTo(marginX + contentWidth, curY);
  ctx.stroke();

  ctx.fillStyle = '#64748b';
  ctx.font = '500 11px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(
    `✓ Laporan Kas Sah & Akuntabel  •  ${brandName || 'Gang Mandor Blok K2/25 - K3/24'}  •  Transparansi Bersama`,
    marginX,
    curY + 28
  );

  ctx.textAlign = 'right';
  ctx.font = 'bold 11px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillStyle = '#0f766e';
  ctx.fillText('Pengurus & Bendahara Gang Mandor', marginX + contentWidth, curY + 28);
  ctx.restore();

  // Return dataUrl & Blob
  const dataUrl = canvas.toDataURL('image/png');
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error('Canvas toBlob failed'));
    }, 'image/png');
  });

  return { dataUrl, blob };
}
