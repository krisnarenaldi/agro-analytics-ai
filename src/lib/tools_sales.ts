// tools.ts
export const RETAIL_TOOLS = [
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
    name: "query_sales_comparison",
    description:
      "Bandingkan penjualan item antara dua periode. Gunakan untuk analisis tren naik/turun.",
    input_schema: {
      type: "object",
      properties: {
        current_month: {
          type: "string",
          description: "Format YYYY-MM, bulan yang dianalisis",
        },
        previous_month: {
          type: "string",
          description: "Format YYYY-MM, bulan pembanding",
        },
        category: {
          type: "string",
          description: "Filter kategori: 'dewasa', 'anak', atau 'semua'",
        },
        limit: { type: "number", description: "Jumlah item yang ditampilkan" },
        order: {
          type: "string",
          enum: ["asc", "desc"],
          description: "asc = penurunan terbesar dulu",
        },
      },
      required: ["current_month", "previous_month"],
    },
  },
  {
    name: "get_top_products",
    description: `Dapatkan daftar item terlaris berdasarkan jumlah terjual atau pendapatan. Gunakan untuk analisis tren naik/turun.
                 Gunakan ketika user tanya:
                 - "produk apa yang paling laku"
                 - "best seller bulan ini"
                 - "produk apa yang paling banyak pendapatannya"
                 - "ranking penjualan"`,
    input_schema: {
      type: "object",
      properties: {
        period: {
          type: "string",
          description:
            "Format YYYY-MM, bulan yang dianalisis, default bulan ini",
        },
        category: {
          type: "string",
          description: "Filter kategori: 'dewasa', 'anak', atau 'semua'",
          enum: ["dewasa", "anak", "semua"],
          default: "semua",
        },
        metric: {
          type: "string",
          description: "Mengurutkan berdasarkan 'quantity' atau 'revenue'",
          enum: ["quantity", "revenue"],
          default: "quantity",
        },
        limit: {
          type: "number",
          description: "Jumlah item yang ditampilkan",
          default: 10,
        },
      },
      required: [],
    },
  },

  {
    name: "get_revenue_breakdown",
    description: `Dapatkan total pendapatan/revenue berdasarkan kategori, produk, atau periode waktu.
Gunakan tool ini ketika user tanya:
- "berapa revenue kategori anak bulan maret"
- "berapa total pendapatan kategori dewasa"
- "Pendapatan kategori apa yang paling tinggi bulan lalu"
- "berapa revenue kaos polo dewasa bulan ini"
- "breakdown revenue per produk bulan ini"
- "revenue per minggu bulan ini"`,
    input_schema: {
      type: "object",
      properties: {
        period: {
          type: "string",
          description:
            "Format YYYY-MM, bulan yang dianalisis, default bulan ini",
        },
        breakdown: {
          type: "string",
          enum: ["kategori", "produk", "minggu"],
          description:
            "Dimensi pengelompokan: 'kategori' = per kategori produk, 'produk' = per nama produk, 'minggu' = per minggu",
        },
        category: {
          type: "string",
          enum: ["dewasa", "anak", "semua"],
          description:
            "Opsional. Filter kategori tertentu: 'anak', 'dewasa', atau 'semua'. Default: 'semua'",
        },
      },
      required: ["breakdown"],
    },
  },
  {
    name: "generate_chart_config",
    description:
      "Buat konfigurasi chart untuk divisualisasikan di frontend. Panggil SETELAH mendapat data.",
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
