// 自动生成，不要手改：python cr-tools/gen-gpu-renderers.py cr-tools/web3dsurvey-gpu.txt <本文件>
// 数据来源：Web3DSurvey 的 NVIDIA / Intel / AMD 厂商页（https://web3dsurvey.com/webgl），2026-11-08 采集。
// 显卡串是真实用户上报的 Windows Chrome（ANGLE/D3D11）原文，含 PCI 设备号；weight = 厂商占比 × 该型号占厂商的比例。
// formFactor / tier 是按型号推断的（笔记本显卡名带 Laptop GPU；档位决定能配的核心数和显示器），不是 Web3DSurvey 的数据。

export interface GpuRenderer {
  vendor: string;
  renderer: string;
  weight: number;
  formFactor: 'laptop' | 'desktop';
  tier: 'low' | 'mid' | 'high';
}

export const GPU_RENDERERS: GpuRenderer[] = [
  // NVIDIA GeForce RTX 3060 (0x00002504)
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 (0x00002504) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.658, formFactor: 'desktop', tier: 'mid' },
  // NVIDIA GeForce RTX 4060 (0x00002882)
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4060 (0x00002882) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.4182, formFactor: 'desktop', tier: 'mid' },
  // NVIDIA GeForce RTX 5060 Ti (0x00002D04)
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 5060 Ti (0x00002D04) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.3248, formFactor: 'desktop', tier: 'mid' },
  // NVIDIA GeForce RTX 5060 (0x00002D05)
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 5060 (0x00002D05) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.3136, formFactor: 'desktop', tier: 'mid' },
  // NVIDIA GeForce RTX 4060 Laptop GPU (0x000028E0)
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4060 Laptop GPU (0x000028E0) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.3123, formFactor: 'laptop', tier: 'mid' },
  // NVIDIA GeForce RTX 5070 (0x00002F04)
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 5070 (0x00002F04) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.3067, formFactor: 'desktop', tier: 'high' },
  // NVIDIA GeForce RTX 5070 Ti (0x00002C05)
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 5070 Ti (0x00002C05) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.2732, formFactor: 'desktop', tier: 'high' },
  // NVIDIA GeForce RTX 4090 (0x00002684)
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4090 (0x00002684) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.2565, formFactor: 'desktop', tier: 'high' },
  // NVIDIA GeForce RTX 3070 (0x00002488)
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 (0x00002488) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.2453, formFactor: 'desktop', tier: 'high' },
  // NVIDIA GeForce RTX 2080 (0x00001E82)
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 2080 (0x00001E82) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.2384, formFactor: 'desktop', tier: 'high' },
  // NVIDIA GeForce RTX 4060 Ti (0x00002803)
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4060 Ti (0x00002803) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.2328, formFactor: 'desktop', tier: 'mid' },
  // NVIDIA GeForce GTX 1050 Ti (0x00001C82)
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1050 Ti (0x00001C82) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.23, formFactor: 'desktop', tier: 'mid' },
  // NVIDIA GeForce GTX 1660 SUPER (0x000021C4)
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 SUPER (0x000021C4) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.2203, formFactor: 'desktop', tier: 'mid' },
  // NVIDIA GeForce RTX 3060 Ti (0x00002489)
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Ti (0x00002489) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.2105, formFactor: 'desktop', tier: 'mid' },
  // NVIDIA GeForce RTX 5080 (0x00002C02)
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 5080 (0x00002C02) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.2007, formFactor: 'desktop', tier: 'high' },
  // NVIDIA GeForce RTX 4070 (0x00002786)
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 (0x00002786) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.191, formFactor: 'desktop', tier: 'high' },
  // NVIDIA GeForce RTX 3050 (0x00002584)
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3050 (0x00002584) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.1631, formFactor: 'desktop', tier: 'mid' },
  // NVIDIA GeForce RTX 4070 SUPER (0x00002783)
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 SUPER (0x00002783) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.1589, formFactor: 'desktop', tier: 'high' },
  // NVIDIA GeForce RTX 2060 (0x00001F08)
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 2060 (0x00001F08) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.1589, formFactor: 'desktop', tier: 'mid' },
  // NVIDIA GeForce RTX 3060 (0x00002487)
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 (0x00002487) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.1561, formFactor: 'desktop', tier: 'mid' },
  // NVIDIA GeForce RTX 3090 (0x00002204)
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3090 (0x00002204) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.1561, formFactor: 'desktop', tier: 'high' },
  // NVIDIA GeForce GTX 1650 (0x00001F82)
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1650 (0x00001F82) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.1492, formFactor: 'desktop', tier: 'mid' },
  // NVIDIA GeForce RTX 4070 Ti (0x00002782)
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Ti (0x00002782) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.1408, formFactor: 'desktop', tier: 'high' },
  // NVIDIA GeForce RTX 4070 Ti SUPER (0x00002705)
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Ti SUPER (0x00002705) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.138, formFactor: 'desktop', tier: 'high' },
  // NVIDIA GeForce RTX 3070 (0x00002484)
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 (0x00002484) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.1366, formFactor: 'desktop', tier: 'high' },
  // NVIDIA GeForce GTX 1060 6GB (0x00001C03)
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1060 6GB (0x00001C03) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.1366, formFactor: 'desktop', tier: 'mid' },
  // NVIDIA GeForce RTX 4060 Laptop GPU (0x000028A0)
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4060 Laptop GPU (0x000028A0) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.1296, formFactor: 'laptop', tier: 'mid' },
  // NVIDIA GeForce RTX 4080 (0x00002704)
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4080 (0x00002704) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.1199, formFactor: 'desktop', tier: 'high' },
  // NVIDIA GeForce RTX 5060 Laptop GPU (0x00002D59)
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 5060 Laptop GPU (0x00002D59) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.1199, formFactor: 'laptop', tier: 'mid' },
  // NVIDIA GeForce RTX 4050 Laptop GPU (0x000028E1)
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4050 Laptop GPU (0x000028E1) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.1199, formFactor: 'laptop', tier: 'mid' },
  // NVIDIA GeForce RTX 3050 Laptop GPU (0x000025A2)
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3050 Laptop GPU (0x000025A2) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.1171, formFactor: 'laptop', tier: 'mid' },
  // NVIDIA GeForce RTX 4080 SUPER (0x00002702)
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4080 SUPER (0x00002702) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.1129, formFactor: 'desktop', tier: 'high' },
  // NVIDIA GeForce RTX 5090 (0x00002B85)
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 5090 (0x00002B85) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.1129, formFactor: 'desktop', tier: 'high' },
  // NVIDIA GeForce RTX 3080 (0x00002216)
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 (0x00002216) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.1129, formFactor: 'desktop', tier: 'high' },
  // NVIDIA GeForce RTX 3060 Laptop GPU (0x00002560)
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Laptop GPU (0x00002560) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.1115, formFactor: 'laptop', tier: 'mid' },
  // NVIDIA GeForce RTX 2060 SUPER (0x00001F06)
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 2060 SUPER (0x00001F06) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.1101, formFactor: 'desktop', tier: 'mid' },
  // NVIDIA GeForce RTX 3070 Ti (0x00002482)
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Ti (0x00002482) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.1059, formFactor: 'desktop', tier: 'high' },
  // NVIDIA GeForce GT 730 (0x00001287)
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GT 730 (0x00001287) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.1046, formFactor: 'desktop', tier: 'low' },
  // NVIDIA GeForce GT 710 (0x0000128B)
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GT 710 (0x0000128B) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.1032, formFactor: 'desktop', tier: 'low' },
  // NVIDIA GeForce GT 1030 (0x00001D01)
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GT 1030 (0x00001D01) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.1004, formFactor: 'desktop', tier: 'low' },
  // NVIDIA GeForce RTX 3060 Laptop GPU (0x00002520)
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Laptop GPU (0x00002520) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.099, formFactor: 'laptop', tier: 'mid' },
  // NVIDIA GeForce RTX 2070 SUPER (0x00001E84)
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 2070 SUPER (0x00001E84) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.0976, formFactor: 'desktop', tier: 'high' },
  // NVIDIA GeForce RTX 3050 (0x00002582)
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3050 (0x00002582) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.0976, formFactor: 'desktop', tier: 'mid' },
  // NVIDIA GeForce RTX 3050 (0x00002507)
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3050 (0x00002507) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.0934, formFactor: 'desktop', tier: 'mid' },
  // NVIDIA GeForce RTX 3080 (0x00002206)
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 (0x00002206) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.0906, formFactor: 'desktop', tier: 'high' },
  // NVIDIA GeForce GTX 1070 (0x00001B81)
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1070 (0x00001B81) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.0906, formFactor: 'desktop', tier: 'high' },
  // NVIDIA GeForce GTX 1660 (0x00002184)
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 (0x00002184) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.0864, formFactor: 'desktop', tier: 'mid' },
  // NVIDIA GeForce RTX 3080 Ti (0x00002208)
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 Ti (0x00002208) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.085, formFactor: 'desktop', tier: 'high' },
  // NVIDIA GeForce GTX 1660 Ti (0x00002182)
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 Ti (0x00002182) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.0725, formFactor: 'desktop', tier: 'mid' },
  // NVIDIA GeForce RTX 2060 (0x00001E89)
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 2060 (0x00001E89) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.0725, formFactor: 'desktop', tier: 'mid' },
  // NVIDIA GeForce RTX 4070 Laptop GPU (0x00002860)
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Laptop GPU (0x00002860) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.0711, formFactor: 'laptop', tier: 'high' },
  // Intel(R) Iris(R) Xe Graphics (0x00009A49)
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) Iris(R) Xe Graphics (0x00009A49) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 1.6915, formFactor: 'laptop', tier: 'mid' },
  // Intel(R) UHD Graphics (0x0000A7A8)
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) UHD Graphics (0x0000A7A8) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.6677, formFactor: 'laptop', tier: 'low' },
  // Intel(R) Iris(R) Xe Graphics (0x000046A6)
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) Iris(R) Xe Graphics (0x000046A6) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.6482, formFactor: 'laptop', tier: 'mid' },
  // Intel(R) Iris(R) Xe Graphics (0x000046A8)
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) Iris(R) Xe Graphics (0x000046A8) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.6148, formFactor: 'laptop', tier: 'mid' },
  // Intel(R) Iris(R) Xe Graphics (0x0000A7A0)
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) Iris(R) Xe Graphics (0x0000A7A0) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.612, formFactor: 'laptop', tier: 'mid' },
  // Intel(R) Iris(R) Xe Graphics (0x0000A7A1)
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) Iris(R) Xe Graphics (0x0000A7A1) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.5898, formFactor: 'laptop', tier: 'mid' },
  // Intel(R) UHD Graphics 620 (0x00005917)
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 620 (0x00005917) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.5814, formFactor: 'laptop', tier: 'low' },
  // Intel(R) UHD Graphics (0x00009B41)
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) UHD Graphics (0x00009B41) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.5481, formFactor: 'laptop', tier: 'low' },
  // Intel(R) Arc(TM) Graphics (0x00007D55)
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) Arc(TM) Graphics (0x00007D55) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.5202, formFactor: 'laptop', tier: 'mid' },
  // Intel(R) UHD Graphics 620 (0x00003EA0)
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 620 (0x00003EA0) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.5063, formFactor: 'laptop', tier: 'low' },
  // Intel(R) UHD Graphics 770 (0x00004680)
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 770 (0x00004680) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.4618, formFactor: 'desktop', tier: 'mid' },
  // Intel(R) UHD Graphics 630 (0x00009BC8)
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 630 (0x00009BC8) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.4396, formFactor: 'desktop', tier: 'low' },
  // Intel(R) Graphics (0x00007D45)
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) Graphics (0x00007D45) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.409, formFactor: 'laptop', tier: 'mid' },
  // Intel(R) UHD Graphics (0x000046A3)
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) UHD Graphics (0x000046A3) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.4006, formFactor: 'laptop', tier: 'low' },
  // Intel(R) UHD Graphics (0x00009BC4)
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) UHD Graphics (0x00009BC4) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.3867, formFactor: 'laptop', tier: 'low' },
  // Intel(R) UHD Graphics 630 (0x00003E9B)
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 630 (0x00003E9B) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.37, formFactor: 'laptop', tier: 'low' },
  // Intel(R) Graphics (0x00007D67)
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) Graphics (0x00007D67) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.3672, formFactor: 'laptop', tier: 'mid' },
  // Intel(R) HD Graphics 520 (0x00001916)
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) HD Graphics 520 (0x00001916) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.3533, formFactor: 'laptop', tier: 'low' },
  // Intel(R) UHD Graphics 630 (0x00003E92)
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 630 (0x00003E92) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.3533, formFactor: 'desktop', tier: 'low' },
  // Intel(R) UHD Graphics (0x0000A788)
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) UHD Graphics (0x0000A788) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.3533, formFactor: 'laptop', tier: 'low' },
  // Intel(R) HD Graphics 620 (0x00005916)
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) HD Graphics 620 (0x00005916) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.3366, formFactor: 'laptop', tier: 'low' },
  // Intel(R) UHD Graphics 730 (0x00004692)
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 730 (0x00004692) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.3171, formFactor: 'desktop', tier: 'mid' },
  // Intel(R) UHD Graphics (0x0000A78B)
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) UHD Graphics (0x0000A78B) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.3032, formFactor: 'laptop', tier: 'low' },
  // Intel(R) HD Graphics 530 (0x00001912)
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) HD Graphics 530 (0x00001912) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.2977, formFactor: 'desktop', tier: 'low' },
  // Intel(R) UHD Graphics (0x00009A60)
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) UHD Graphics (0x00009A60) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.2949, formFactor: 'laptop', tier: 'low' },
  // Intel(R) Graphics (0x00007D41)
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) Graphics (0x00007D41) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.2921, formFactor: 'laptop', tier: 'mid' },
  // Intel(R) UHD Graphics (0x00009A78)
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) UHD Graphics (0x00009A78) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.2893, formFactor: 'laptop', tier: 'low' },
  // Intel(R) UHD Graphics (0x00008A56)
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) UHD Graphics (0x00008A56) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.2838, formFactor: 'laptop', tier: 'low' },
  // Intel(R) UHD Graphics (0x0000A721)
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) UHD Graphics (0x0000A721) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.2699, formFactor: 'laptop', tier: 'low' },
  // Intel(R) Graphics (0x0000A7AC)
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) Graphics (0x0000A7AC) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.2504, formFactor: 'laptop', tier: 'mid' },
  // Intel(R) HD Graphics 4600 (0x00000412)
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) HD Graphics 4600 (0x00000412) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.242, formFactor: 'desktop', tier: 'low' },
  // Intel(R) HD Graphics 630 (0x00005912)
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) HD Graphics 630 (0x00005912) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.2226, formFactor: 'desktop', tier: 'low' },
  // Intel(R) UHD Graphics (0x000046B3)
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) UHD Graphics (0x000046B3) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.2198, formFactor: 'laptop', tier: 'low' },
  // Intel(R) UHD Graphics (0x000046D0)
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) UHD Graphics (0x000046D0) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.2142, formFactor: 'laptop', tier: 'low' },
  // Intel(R) UHD Graphics 770 (0x0000A780)
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 770 (0x0000A780) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.2059, formFactor: 'desktop', tier: 'mid' },
  // Intel(R) UHD Graphics (0x00004628)
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) UHD Graphics (0x00004628) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.1947, formFactor: 'laptop', tier: 'low' },
  // Intel(R) Arc(TM) 140V GPU (16GB) (0x000064A0)
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) Arc(TM) 140V GPU (16GB) (0x000064A0) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.1836, formFactor: 'laptop', tier: 'mid' },
  // Intel(R) UHD Graphics (0x00009A68)
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) UHD Graphics (0x00009A68) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.1808, formFactor: 'laptop', tier: 'low' },
  // Intel(R) UHD Graphics 600 (0x00003185)
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 600 (0x00003185) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.178, formFactor: 'laptop', tier: 'low' },
  // Intel(R) UHD Graphics (0x000046D1)
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) UHD Graphics (0x000046D1) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.178, formFactor: 'laptop', tier: 'low' },
  // Intel(R) Arc(TM) 140T GPU (16GB) (0x00007D51)
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) Arc(TM) 140T GPU (16GB) (0x00007D51) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.1641, formFactor: 'laptop', tier: 'mid' },
  // Intel(R) Graphics (0x0000A7AB)
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) Graphics (0x0000A7AB) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.1502, formFactor: 'laptop', tier: 'mid' },
  // Intel(R) Graphics (0x000046D4)
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) Graphics (0x000046D4) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.1502, formFactor: 'laptop', tier: 'mid' },
  // Intel(R) HD Graphics (0x00000152)
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) HD Graphics (0x00000152) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.1474, formFactor: 'desktop', tier: 'low' },
  // Intel(R) HD Graphics 5500 (0x00001616)
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) HD Graphics 5500 (0x00001616) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.1419, formFactor: 'laptop', tier: 'low' },
  // Intel(R) Arc(TM) Pro Graphics (0x00007D55)
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) Arc(TM) Pro Graphics (0x00007D55) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.1419, formFactor: 'laptop', tier: 'mid' },
  // AMD Radeon(TM) Graphics (0x00001638)
  { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon(TM) Graphics (0x00001638) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.7374, formFactor: 'laptop', tier: 'low' },
  // AMD Radeon (TM) Graphics (0x000015E7)
  { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon (TM) Graphics (0x000015E7) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.5898, formFactor: 'laptop', tier: 'low' },
  // AMD Radeon(TM) Graphics (0x00001681)
  { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon(TM) Graphics (0x00001681) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.4505, formFactor: 'laptop', tier: 'low' },
  // AMD Radeon(TM) Graphics (0x00001636)
  { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon(TM) Graphics (0x00001636) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.3714, formFactor: 'laptop', tier: 'low' },
  // AMD Radeon(TM) Graphics (0x0000164C)
  { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon(TM) Graphics (0x0000164C) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.3371, formFactor: 'laptop', tier: 'low' },
  // AMD Radeon 780M Graphics (0x00001900)
  { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon 780M Graphics (0x00001900) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.2641, formFactor: 'laptop', tier: 'mid' },
  // AMD Radeon(TM) Graphics (0x00001506)
  { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon(TM) Graphics (0x00001506) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.2085, formFactor: 'desktop', tier: 'mid' },
  // AMD Radeon(TM) Vega 8 Graphics (0x000015D8)
  { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon(TM) Vega 8 Graphics (0x000015D8) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.1575, formFactor: 'laptop', tier: 'low' },
  // AMD Radeon RX 9070 XT (0x00007550)
  { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon RX 9070 XT (0x00007550) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.1096, formFactor: 'desktop', tier: 'high' },
  // AMD Radeon 740M Graphics (0x00001901)
  { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon 740M Graphics (0x00001901) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.1081, formFactor: 'laptop', tier: 'mid' },
  // AMD Radeon(TM) Graphics (0x000015D8)
  { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon(TM) Graphics (0x000015D8) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.0982, formFactor: 'laptop', tier: 'low' },
  // AMD Radeon(TM) 860M Graphics (0x00001114)
  { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon(TM) 860M Graphics (0x00001114) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.0974, formFactor: 'laptop', tier: 'mid' },
  // AMD Radeon RX 6600 (0x000073FF)
  { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon RX 6600 (0x000073FF) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.0944, formFactor: 'desktop', tier: 'mid' },
  // AMD Radeon(TM) 610M (0x0000164E)
  { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon(TM) 610M (0x0000164E) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.0807, formFactor: 'desktop', tier: 'mid' },
  // Radeon RX 580 Series (0x000067DF)
  { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, Radeon RX 580 Series (0x000067DF) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.0776, formFactor: 'desktop', tier: 'mid' },
  // AMD Radeon RX 580 2048SP (0x00006FDF)
  { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon RX 580 2048SP (0x00006FDF) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.0776, formFactor: 'desktop', tier: 'mid' },
  // AMD Radeon(TM) 890M Graphics (0x0000150E)
  { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon(TM) 890M Graphics (0x0000150E) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.0753, formFactor: 'laptop', tier: 'mid' },
  // AMD Radeon(TM) Vega 3 Graphics (0x000015D8)
  { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon(TM) Vega 3 Graphics (0x000015D8) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.0708, formFactor: 'laptop', tier: 'low' },
  // AMD Radeon RX 9060 XT (0x00007590)
  { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon RX 9060 XT (0x00007590) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.0677, formFactor: 'desktop', tier: 'mid' },
  // AMD Radeon(TM) Graphics (0x00001900)
  { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon(TM) Graphics (0x00001900) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.0654, formFactor: 'laptop', tier: 'low' },
  // AMD Radeon 780M Graphics (0x000015BF)
  { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon 780M Graphics (0x000015BF) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.0639, formFactor: 'laptop', tier: 'mid' },
  // AMD Radeon(TM) 610M (0x00001506)
  { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon(TM) 610M (0x00001506) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.0616, formFactor: 'desktop', tier: 'mid' },
  // AMD Radeon RX 7600 (0x00007480)
  { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon RX 7600 (0x00007480) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.0586, formFactor: 'desktop', tier: 'mid' },
  // AMD Radeon RX 6700 XT (0x000073DF)
  { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon RX 6700 XT (0x000073DF) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.0525, formFactor: 'desktop', tier: 'high' },
  // AMD Radeon(TM) Graphics (0x0000164E)
  { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon(TM) Graphics (0x0000164E) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.051, formFactor: 'desktop', tier: 'mid' },
  // Radeon RX 570 Series (0x000067DF)
  { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, Radeon RX 570 Series (0x000067DF) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.0487, formFactor: 'desktop', tier: 'mid' },
  // Radeon RX550/550 Series (0x0000699F)
  { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, Radeon RX550/550 Series (0x0000699F) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.0457, formFactor: 'desktop', tier: 'mid' },
  // AMD Radeon(TM) Graphics (0x000013C0)
  { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon(TM) Graphics (0x000013C0) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.0457, formFactor: 'desktop', tier: 'mid' },
  // AMD Radeon(TM) 880M Graphics (0x0000150E)
  { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon(TM) 880M Graphics (0x0000150E) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.0426, formFactor: 'laptop', tier: 'mid' },
  // AMD Radeon(TM) RX Vega 10 Graphics (0x000015D8)
  { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon(TM) RX Vega 10 Graphics (0x000015D8) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.0419, formFactor: 'laptop', tier: 'low' },
  // AMD Radeon(TM) 780M (0x000015BF)
  { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon(TM) 780M (0x000015BF) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.0419, formFactor: 'laptop', tier: 'mid' },
  // AMD Radeon(TM) Graphics (0x000015BF)
  { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon(TM) Graphics (0x000015BF) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.0403, formFactor: 'laptop', tier: 'low' },
  // AMD Radeon(TM) 840M Graphics (0x00001114)
  { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon(TM) 840M Graphics (0x00001114) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.0381, formFactor: 'laptop', tier: 'mid' },
  // AMD Radeon(TM) Vega 8 Graphics (0x000015DD)
  { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon(TM) Vega 8 Graphics (0x000015DD) Direct3D11 vs_5_0 ps_5_0, D3D11)', weight: 0.0381, formFactor: 'laptop', tier: 'low' },
];
