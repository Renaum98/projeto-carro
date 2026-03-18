// ============================================================
//  Dados estáticos: tipos de serviço, validades e ícones
// ============================================================

export const VALIDITY = {
  oleo: { label: "A cada 5.000–10.000 km ou 6–12 meses", km: 7500, months: 9 },
  filtro_oleo: { label: "A cada 10.000 km ou 12 meses", km: 10000, months: 12 },
  filtro_ar: {
    label: "A cada 15.000–20.000 km ou 12 meses",
    km: 17500,
    months: 12,
  },
  filtro_combustivel: {
    label: "A cada 20.000–40.000 km ou 24 meses",
    km: 30000,
    months: 24,
  },
  pastilha: { label: "A cada 20.000–40.000 km", km: 30000, months: 36 },
  disco_freio: { label: "A cada 40.000–80.000 km", km: 60000, months: 60 },
  velas: {
    label: "A cada 20.000–40.000 km ou 24 meses",
    km: 30000,
    months: 24,
  },
  correia: {
    label: "A cada 60.000–100.000 km ou 4 anos",
    km: 80000,
    months: 48,
  },
  fluido_freio: { label: "A cada 2 anos ou 30.000 km", km: 30000, months: 24 },
  fluido_arrefecimento: {
    label: "A cada 2–3 anos ou 40.000 km",
    km: 40000,
    months: 30,
  },
  alinhamento: { label: "A cada 10.000 km ou 12 meses", km: 10000, months: 12 },
  pneu: { label: "A cada 40.000–60.000 km ou 5–6 anos", km: 50000, months: 60 },
  bateria: { label: "A cada 3–5 anos", km: null, months: 48 },
  ar_cond: { label: "Anualmente ou a cada 20.000 km", km: 20000, months: 12 },
  revisao_geral: {
    label: "Anualmente ou a cada 10.000–15.000 km",
    km: 12500,
    months: 12,
  },
  outro: {
    label: "Defina a próxima revisão manualmente",
    km: null,
    months: null,
  },
};

export const TYPE_ICONS = {
  oleo: "oil_barrel",
  filtro_oleo: "settings",
  filtro_ar: "air",
  filtro_combustivel: "local_gas_station",
  pastilha: "emergency_heat",
  disco_freio: "settings_input_component",
  velas: "bolt",
  correia: "link",
  fluido_freio: "water_drop",
  fluido_arrefecimento: "thermostat",
  alinhamento: "tire_repair",
  pneu: "tire_repair",
  bateria: "battery_charging_full",
  ar_cond: "ac_unit",
  revisao_geral: "build_circle",
  outro: "handyman",
};

export const TYPE_LABELS = {
  oleo: "Troca de óleo",
  filtro_oleo: "Filtro de óleo",
  filtro_ar: "Filtro de ar",
  filtro_combustivel: "Filtro de combustível",
  pastilha: "Pastilha de freio",
  disco_freio: "Disco de freio",
  velas: "Troca de velas",
  correia: "Correia dentada",
  fluido_freio: "Fluido de freio",
  fluido_arrefecimento: "Fluido de arrefecimento",
  alinhamento: "Alinhamento",
  pneu: "Pneu",
  bateria: "Bateria",
  ar_cond: "Ar-condicionado",
  revisao_geral: "Revisão geral",
  outro: "Outro",
};
