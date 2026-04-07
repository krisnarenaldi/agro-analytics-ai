import { createClient } from "@/utils/supabase/server";
import {
  streamText,
  tool,
  jsonSchema,
  convertToModelMessages,
  stepCountIs,
} from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { RETAIL_TOOLS } from "@/lib/tools";

// Required for Edge/Node streaming depending on your setup
export const maxDuration = 30;

export async function POST(req: Request) {
  const supabase = await createClient();
  // x. setting prompot
  const today = new Date().toISOString().slice(0, 10); // format: YYYY-MM-DD
  const systemPrompt = `Tanggal hari ini adalah ${today}.
Kamu adalah asisten analitik untuk toko retail baju dewasa dan anak.
Kamu punya akses ke data penjualan. Selalu tampilkan angka dalam format Rupiah jika menyebut harga/revenue.

ATURAN PENGGUNAAN TOOL:
1. Jika user bertanya tentang data penjualan, LANGSUNG panggil tool yang sesuai — jangan hanya narasi.
2. Setelah mendapat data dari tool (get_top_products, query_sales_comparison, get_revenue_breakdown),
   SELALU panggil generate_chart_config dengan data tersebut untuk membuat visualisasi chart.
3. Pilih chart_type yang tepat: "bar" untuk perbandingan produk, "line" untuk tren waktu, "pie" untuk proporsi/persentase.
4. Gunakan nama kolom yang BENAR dari data hasil tool untuk x_key dan y_key.

Jika user bertanya di luar lingkup analitik (misal cuaca, ibu kota, dll), jawab: "Maaf, saya hanya bisa membantu dengan data penjualan."`;
  // a. Get user session
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // // user tidak login/ada session
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { messages } = await req.json();

  // b. Cek limit usage

  // // 1. Check Usage Config Limit
  const maxChats = parseInt(process.env.MAX_CHATS_PER_USER || "5", 10);

  // // 2. Query Usage from Supabase (count rows in usage_logs) — hanya hari ini
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { count, error: usageError } = await supabase
    .from("usage_logs")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", todayStart.toISOString());

  const currentChatCount = count || 0;

  if (currentChatCount >= maxChats) {
    return new Response(
      `You have reached your limit of ${maxChats} conversations. Please upgrade your account or contact support.`,
      { status: 403 },
    );
  }

  // 3. Initialize AI SDK Anthropics instance with specific API key handling if needed
  const anthropic = createAnthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  // 4. Record the Usage (Insert into usage_logs)
  const { error: insertError } = await supabase
    .from("usage_logs")
    .insert({ user_id: user.id });

  if (insertError) {
    console.error("Failed to insert usage log", insertError);
    // Log the error but continue
  }

  // 5. Build tools dari RETAIL_TOOLS + executeTool (agentic loop)
  const maxTokens = parseInt(process.env.MAX_OUTPUT_TOKENS || "4096", 10);

  const agentTools = Object.fromEntries(
    RETAIL_TOOLS.map((t) => [
      t.name,
      tool({
        description: t.description,
        inputSchema: jsonSchema(t.input_schema as any),
        execute: async (input: any) => executeTool(t.name, input, supabase),
      }),
    ]),
  );

  const result = streamText({
    model: anthropic("claude-haiku-4-5-20251001"),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    tools: agentTools,
    stopWhen: stepCountIs(5),
    maxOutputTokens: maxTokens,
  });

  // 6. Return UI Message Stream Response
  return result.toUIMessageStreamResponse();
}

async function executeTool(
  name: String,
  input: any,
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  console.log(`[tool] ${name}`, JSON.stringify(input));
  if (name === "get_schema") {
    return {
      tables: ["sales", "products", "inventory", "categories"],
      sales_columns: ["id", "product_id", "quantity", "revenue", "sold_at"],
    };
  }

  if (name === "query_sales_comparison") {
    const {
      current_month,
      previous_month,
      category,
      limit = 10,
      order = "asc",
    } = input;
    const { data, error } = await supabase.rpc("compare_monthly_sales", {
      p_current: current_month,
      p_previous: previous_month,
      p_category: category,
      p_limit: limit,
      p_direction: order,
    });
    if (error) throw new Error(error.message);
    return data;
  }

  if (name === "get_top_products") {
    const { period, category, metric, limit = 10 } = input;

    const { data, error } = await supabase.rpc("get_top_products", {
      p_period: period,
      p_category: category,
      p_metric: metric,
      p_limit: limit,
    });

    if (error) throw new Error(error.message);
    return data;
  }

  if (name === "get_revenue_breakdown") {
    const { period, breakdown, category = "semua" } = input;

    const { data, error } = await supabase.rpc("get_revenue_breakdown", {
      p_period: period,
      p_breakdown: breakdown,
      p_category: category,
    });

    if (error) throw new Error(error.message);
    return data;
  }

  if (name === "generate_chart_config") {
    return { chart_config: input, status: "ready" };
  }
}
