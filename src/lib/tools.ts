// tools.ts
export const ANALYTIC_TOOLS = [
  {
    name: "get_schema",
    description:
      "Ambil struktur tabel database untuk memahami kolom yang tersedia",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },

  {
    name: "analyze_price_demand_matrix",
    description:
      "Memetakan komoditas ke kuadran harga vs demand pasar. Gunakan untuk: matrix positioning, identifikasi Premium Opportunity vs Commodity Trap, strategi pricing.",
    input_schema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          enum: [
            "Food Crop",
            "Estate Crop",
            "Horticulture (Fruit)",
            "Horticulture (Veg)",
            "Medicinal/Biopharm",
            "Floriculture",
          ],
          description: "Filter per kategori, null = semua kategori",
        }
      },
      required: [],
    },
  },

  {
    name: "analyze_supply_demand_gap",
    description:
      "Menganalisa kesenjangan produksi vs kebutuhan industri dan flag risiko pasokan. Gunakan untuk: supply risk assessment, procurement planning, identifikasi komoditas kritis.",
    input_schema: {
      type: "object",
      properties: {
        risk_level: {
          type: "string",
          enum: [
            "Critical", "High", "Moderate", "Low"
          ],
          description: "Filter per kategori, null = semua kategori",
        }
      },
      required: [],
    },
  },

  {
    name: "analyze_revenue_index",
    description:
      "Ranking komoditas berdasarkan potensi pendapatan (harga × volume). Gunakan untuk: revenue prioritization, portfolio analysis, identifikasi Star commodity.",
    input_schema: {
      type: "object",
      properties: {
        top_n: {
          type: "string",
          description: "Batasi N teratas, null = semua",
        },
        category: {
          type: "string",
          description: "Filter per kategori, null = semua kategori",
        }
      },
      required: [],
    },
  },

  {
    name: "analyze_dual_demand_misalignment",
    description:
      "Mendeteksi komoditas dengan industrial demand dan market demand yang berlawanan. Gunakan untuk: risk detection, arbitrage opportunities, structural analysis.",
    input_schema: {
      type: "object",
      properties: {
        min_gap: {
          type: "number",
          default: 1,
          description: "Minimum gap score (1-3), default 1",
        },
      },
      required: [],
    }
  },

  {
    name: "analyze_export_readiness",
    description:
      "Menilai kesiapan ekspor komoditas dengan scoring berbasis demand, harga, dan volume. Gunakan untuk: export strategy, shortlisting komoditas ekspor, investment targeting.",
    input_schema: {
      type: "object",
      properties: {
        min_score: {
          type: "number",
          default: 0,
          description: "Minimum gap score (1-3), default 1",
        },
        sector_only: {
          type: "boolean",
          default: true,
          description: "true = hanya tampilkan komoditas target Export/Processing Industry",
        },
      },
      required: [],
    }
  },

  {
    name: "generate_chart_config",
    description:
      "Buat konfigurasi chart untuk divisualisasikan di frontend. Panggil SETELAH mendapat data analitik.",
    input_schema: {
      type: "object",
      properties: {
        chart_type: { type: "string", enum: ["bar", "line", "pie"] },
        data: {
          type: "array",
          description: "Array data dari query sebelumnya.",
        },
        title: { type: "string" },
        x_key: { type: "string" },
        y_key: { type: "string" },
      },
      required: ["chart_type", "data", "title"],
    },
  },
];