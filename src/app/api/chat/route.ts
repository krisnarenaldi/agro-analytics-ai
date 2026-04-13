import { createClient } from "@/utils/supabase/server";
import {
  streamText,
  tool,
  jsonSchema,
  convertToModelMessages,
  stepCountIs,
} from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { ANALYTIC_TOOLS } from "@/lib/tools";

// Required for Edge/Node streaming depending on your setup
export const maxDuration = 30;

export async function POST(req: Request) {
  const supabase = await createClient();
  // x. setting prompot
  const today = new Date().toISOString().slice(0, 10); // format: YYYY-MM-DD
  const systemPrompt = `Tanggal hari ini adalah ${today}.
Anda adalah analis agribisnis Indonesia yang membantu pengguna memahami data komoditas pertanian.

Gunakan tools yang tersedia untuk menjawab pertanyaan analitik. Pilih tool yang paling relevan berdasarkan konteks pertanyaan, lalu interpretasikan hasilnya dalam bahasa yang mudah dipahami.

Panduan pemilihan tool:
- Posisi harga vs permintaan pasar → analyze_price_demand_matrix
- Kesenjangan produksi vs kebutuhan industri → analyze_supply_demand_gap
- Ranking potensi pendapatan komoditas → analyze_revenue_index
- Ketidakselarasan industrial vs market demand → analyze_dual_demand_misalignment
- Kesiapan ekspor komoditas → analyze_export_readiness
- Jika belum tahu struktur data → get_schema

Jika pertanyaan di luar lingkup analitik agribisnis, jawab: "Maaf, saya hanya bisa membantu dengan analisis data komoditas pertanian."`;
  // a. Get user session
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // // user tidak login/ada session
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { messages, chatId } = await req.json();

  let activeChatId = chatId;

  const maxChats = parseInt(process.env.MAX_CHATS_PER_USER || "5", 10);

  // 2. Query Usage from Supabase (count rows in usage_logs) — hanya hari ini
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

  // Record usage and create/update chat
  if (!activeChatId) {
    const { data: chatData, error: chatError } = await supabase
      .from("chats")
      .insert({
        user_id: user.id,
        title: messages[messages.length - 1].content.slice(0, 50) || "New Chat",
      })
      .select()
      .single();
    
    if (chatData) activeChatId = chatData.id;
  }

  // Save user message
  const userMessage = messages[messages.length - 1];
  await supabase.from("messages").insert({
    chat_id: activeChatId,
    role: userMessage.role,
    content: userMessage.content,
  });

  // 3. Initialize AI SDK Anthropics instance with specific API key handling if needed
  const anthropic = createAnthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  // 4. Record the Usage (Insert into usage_logs)
  await supabase.from("usage_logs").insert({ user_id: user.id });

  // 5. Build tools dari RETAIL_TOOLS + executeTool (agentic loop)
  const maxTokens = parseInt(process.env.MAX_OUTPUT_TOKENS || "4096", 10);

  const agentTools = Object.fromEntries(
    ANALYTIC_TOOLS.map((t) => [
      t.name,
      tool({
        description: t.description,
        inputSchema: jsonSchema(t.input_schema as any),
        execute: async (input: any) => executeTool(t.name, input, supabase),
      }),
    ]),
  );

  const result = streamText({
    model: anthropic("claude-haiku-4-5"),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    tools: agentTools,
    stopWhen: stepCountIs(5),
    maxOutputTokens: maxTokens,
    onFinish: async ({ text, toolResults }) => {
      // Save assistant message and tool results
      await supabase.from("messages").insert({
        chat_id: activeChatId,
        role: "assistant",
        content: text || "", // Simplified for now, should handle parts correctly
      });
    },
  });

  // 6. Return UI Message Stream Response
  return result.toUIMessageStreamResponse();
}

async function executeTool(
  name: string,
  input: any,
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  console.log(`[tool] ${name}`, JSON.stringify(input));
  if (name === "get_schema") {
    return {
      tables: ["commodities"],
      commodities_columns: [
        "id",
        "commodity_name",
        "category",
        "production_volume_tons",
        "industrial_demand",
        "market_demand",
        "avg_price_idr_per_kg",
        "primary_target_sector",
      ],
    };
  }

  if (name === "analyze_price_demand_matrix") {
    const { category } = input;
    const { data, error } = await supabase.rpc("analyze_price_demand_matrix", {
      p_category: category,
    });
    if (error) throw new Error(error.message);
    return data;
  }

  if (name === "analyze_supply_demand_gap") {
    const { risk_level } = input;

    const { data, error } = await supabase.rpc("analyze_supply_demand_gap", {
      p_risk_level: risk_level,
    });

    if (error) throw new Error(error.message);
    return data;
  }

  if (name === "analyze_revenue_index") {
    const { top_n, category } = input;

    const { data, error } = await supabase.rpc("analyze_revenue_index", {
      p_top_n: top_n,
      p_category: category,
    });

    if (error) throw new Error(error.message);
    return data;
  }

  if (name === "analyze_dual_demand_misalignment") {
    const { min_gap } = input;

    const { data, error } = await supabase.rpc(
      "analyze_dual_demand_misalignment",
      {
        p_min_gap: min_gap,
      },
    );

    if (error) throw new Error(error.message);
    return data;
  }

  if (name === "analyze_export_readiness") {
    const { min_score, sector_only } = input;

    const { data, error } = await supabase.rpc("analyze_export_readiness", {
      p_min_score: min_score,
      p_sector_only: sector_only,
    });

    if (error) throw new Error(error.message);
    return data;
  }

  if (name === "generate_chart_config") {
    return { chart_config: input, status: "ready" };
  }
}
