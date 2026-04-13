"use client";

import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  type DynamicToolUIPart,
  type TextUIPart,
} from "ai";
import { createClient } from "@/utils/supabase/client";
import { useEffect, useState, useRef } from "react";
import { LogOut, Send, Bot, User, Sparkles, AlertCircle, Plus, MessageSquare, Menu, X } from "lucide-react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const CHART_COLORS = [
  "#10b981",
  "#6366f1",
  "#f59e0b",
  "#ef4444",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
];

type ChartConfig = {
  chart_type: "bar" | "line" | "pie";
  data: Record<string, unknown>[];
  title: string;
  x_key: string;
  y_key: string;
};

function RetailChart({ config }: { config: ChartConfig }) {
  const { chart_type, data, title, x_key, y_key } = config;
  if (!data || data.length === 0) return null;

  return (
    <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="mb-3 text-sm font-semibold text-gray-700">{title}</p>
      <ResponsiveContainer width="100%" height={260}>
        {chart_type === "pie" ? (
          <PieChart>
            <Pie
              data={data}
              dataKey={y_key}
              nameKey={x_key}
              cx="50%"
              cy="50%"
              outerRadius={90}
              label={({ name, percent }) =>
                `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
              }
            >
              {data.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        ) : chart_type === "line" ? (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey={x_key}
              tick={{ fontSize: 11 }}
              interval="preserveStartEnd"
            />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey={y_key}
              stroke={CHART_COLORS[0]}
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </LineChart>
        ) : (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey={x_key}
              tick={{ fontSize: 11 }}
              interval={0}
              angle={data.length > 6 ? -30 : 0}
              textAnchor={data.length > 6 ? "end" : "middle"}
              height={data.length > 6 ? 50 : 30}
            />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey={y_key} radius={[4, 4, 0, 0]}>
              {data.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

export default function Chat() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const chatId = searchParams.get("id");
  
  const [limitExceeded, setLimitExceeded] = useState(false);
  const [limitMessage, setLimitMessage] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chats, setChats] = useState<{ id: string; title: string; created_at: string }[]>([]);

  const { messages, sendMessage, status, error, setMessages } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      fetch: async (url, init) => {
        const body = JSON.parse(init?.body as string);
        const response = await fetch(url as string, {
          ...init,
          body: JSON.stringify({ ...body, chatId }),
        });
        if (response.status === 403) {
          const text = await response.clone().text();
          setLimitExceeded(true);
          setLimitMessage(text);
        }
        return response;
      },
    }),
  });

  const isLoading = status === "submitted" || status === "streaming";

  // Fetch chats on mount
  useEffect(() => {
    const fetchChats = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("chats")
        .select("id, title, created_at")
        .order("created_at", { ascending: false });
      if (data) setChats(data);
    };
    fetchChats();
  }, []);

  // Fetch messages if chatId changes
  useEffect(() => {
    if (chatId) {
      const fetchMessages = async () => {
        const supabase = createClient();
        const { data } = await supabase
          .from("messages")
          .select("role, content")
          .eq("chat_id", chatId)
          .order("created_at", { ascending: true });
        
        if (data) {
          setMessages(data.map(m => ({
            id: Math.random().toString(),
            role: m.role as "user" | "assistant",
            parts: m.content as any,
          })));
        }
      };
      fetchMessages();
    } else {
      setMessages([]);
    }
  }, [chatId, setMessages]);

  const handleNewChat = () => {
    router.push("/");
    setMessages([]);
    setSidebarOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
  };

  const handleSubmit = (e?: React.SyntheticEvent) => {
    e?.preventDefault();
    if (!inputValue.trim() || limitExceeded) return;
    sendMessage({ text: inputValue });
    setInputValue("");
  };

  const [user, setUser] = useState<SupabaseUser | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const supabase = createClient();
    const checkUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
      } else {
        router.push("/login");
      }
    };
    checkUser();
  }, [router]);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-[#F9FAFB] text-gray-900 font-sans selection:bg-gray-200 overflow-hidden">
      {/* Sidebar - Desktop */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex flex-col h-full">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <button
              onClick={handleNewChat}
              className="flex items-center space-x-2 w-full px-4 py-2.5 bg-[#00aff0] text-white rounded-xl font-medium text-sm hover:bg-[#009bd4] transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4" />
              <span>New Chat</span>
            </button>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Recent Chats
            </div>
            {chats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => {
                  router.push(`/?id=${chat.id}`);
                  setSidebarOpen(false);
                }}
                className={`flex items-center space-x-3 w-full px-4 py-3 rounded-xl text-left text-sm transition-all group ${chatId === chat.id ? "bg-[#00aff0]/10 text-[#00aff0] font-medium" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"}`}
              >
                <MessageSquare className={`h-4 w-4 shrink-0 ${chatId === chat.id ? "text-[#00aff0]" : "text-gray-400 group-hover:text-gray-600"}`} />
                <span className="truncate">{chat.title || "Untitled Chat"}</span>
              </button>
            ))}
            {chats.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-gray-400 italic">
                No chats yet. Start a new conversation!
              </div>
            )}
          </div>

          <div className="p-4 border-t border-gray-100 space-y-3">
            <div className="flex items-center space-x-3 px-2">
              <div className="h-8 w-8 rounded-full bg-[#00aff0]/10 flex items-center justify-center text-[#00aff0] text-xs font-bold">
                {user.email?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-900 truncate">{user.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 w-full px-4 py-2 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900 rounded-lg transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full relative">
        {/* Header */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b-2 border-b-[#ffff00] bg-white/80 px-4 md:px-6 backdrop-blur-xl z-10 sticky top-0 shadow-sm">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-lg"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white ring-1 ring-gray-200 shadow-sm overflow-hidden">
              <Image
                src="/agro-life.png"
                alt="Agro Life Logo"
                width={44}
                height={44}
                className="object-contain"
              />
            </div>
            <span className="font-medium text-sm text-gray-800">
              Agro Commodities Analytics
            </span>
          </div>
        </header>

        {/* Main Chat Area */}
        <main className="flex-1 overflow-y-auto w-full bg-[#F9FAFB]">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center px-4 space-y-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white ring-1 ring-gray-200 shadow-xl">
                <Sparkles className="h-8 w-8 text-[#00aff0]" />
              </div>
              <div className="space-y-2 max-w-md">
                <h2 className="text-2xl font-semibold text-gray-900">
                  Apa yang bisa saya bantu?
                </h2>
                <p className="text-sm text-gray-500">
                  Note: You are limited to a configured number of interactions
                  based on your usage plan.
                </p>
              </div>

              {/* Quick Start Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg mt-4">
                {[
                  {
                    label: "Analisa Potensi Ekspor",
                    icon: "🌍",
                    prompt: "Berikan analisa kesiapan ekspor untuk semua komoditas",
                  },
                  {
                    label: "Ranking Pendapatan",
                    icon: "📈",
                    prompt: "Tampilkan 5 komoditas dengan potensi pendapatan tertinggi",
                  },
                  {
                    label: "Matrix Harga vs Demand",
                    icon: "📊",
                    prompt: "Tampilkan matrix harga vs demand untuk kategori Food Crop",
                  },
                  {
                    label: "Risiko Pasokan",
                    icon: "⚠️",
                    prompt: "Komoditas apa saja yang memiliki risiko pasokan tinggi?",
                  },
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={() => {
                      setInputValue(item.prompt);
                      sendMessage({ text: item.prompt });
                    }}
                    className="flex items-center space-x-3 p-3.5 text-left bg-white border border-gray-200 rounded-xl hover:border-[#00aff0] hover:bg-[#00aff0]/5 transition-all shadow-sm group"
                  >
                    <span className="text-lg">{item.icon}</span>
                    <span className="text-sm font-medium text-gray-700 group-hover:text-[#00aff0]">
                      {item.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto flex w-full max-w-3xl flex-col pb-24 pt-8">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex w-full px-4 py-6 md:px-0 ${m.role === "user" ? "justify-end" : "justify-start"
                    }`}
                >
                  <div
                    className={`flex max-w-[85%] sm:max-w-2xl gap-4 ${m.role === "user" ? "flex-row-reverse" : "flex-row"
                      }`}
                  >
                    <div className="shrink-0 flex items-start">
                      {m.role === "user" ? (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white ring-1 ring-gray-200 shadow-sm">
                          <User className="h-4 w-4 text-gray-500" />
                        </div>
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#00aff0]/10 ring-1 ring-[#00aff0]/30">
                          <Bot className="h-4 w-4 text-[#00aff0]" />
                        </div>
                      )}
                    </div>
                    <div
                      className={`max-w-none text-[15px] leading-relaxed ${m.role === "user"
                          ? "whitespace-pre-wrap bg-white px-5 py-3.5 rounded-2xl rounded-tr-sm text-gray-800 shadow-sm border border-gray-100"
                          : "text-gray-800 pt-1 prose prose-sm prose-gray max-w-none"
                        }`}
                    >
                      {m.role === "user" ? (
                        m.parts
                          .filter((p): p is TextUIPart => p.type === "text")
                          .map((p) => p.text)
                          .join("")
                      ) : (
                        <>
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              table: ({ children }) => (
                                <div className="overflow-x-auto my-3">
                                  <table className="w-full border-collapse text-sm">
                                    {children}
                                  </table>
                                </div>
                              ),
                              thead: ({ children }) => (
                                <thead className="bg-[#ffff00]/20">
                                  {children}
                                </thead>
                              ),
                              th: ({ children }) => (
                                <th className="px-4 py-2 text-left font-semibold text-gray-700 border border-gray-200 whitespace-nowrap">
                                  {children}
                                </th>
                              ),
                              td: ({ children }) => (
                                <td className="px-4 py-2 text-gray-700 border border-gray-200">
                                  {children}
                                </td>
                              ),
                              tr: ({ children }) => (
                                <tr className="even:bg-gray-50 hover:bg-[#00aff0]/10 transition-colors">
                                  {children}
                                </tr>
                              ),
                            }}
                          >
                            {m.parts
                              .filter((p): p is TextUIPart => p.type === "text")
                              .map((p) => p.text)
                              .join("")}
                          </ReactMarkdown>
                          {(m.parts as DynamicToolUIPart[])
                            .filter(
                              (
                                p,
                              ): p is DynamicToolUIPart & {
                                state: "output-available";
                                output: { chart_config: ChartConfig };
                              } =>
                                p.type === "dynamic-tool" &&
                                p.toolName === "generate_chart_config" &&
                                p.state === "output-available",
                            )
                            .map((p, i) => (
                              <RetailChart
                                key={i}
                                config={p.output.chart_config}
                              />
                            ))}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {limitExceeded && (
                <div className="mx-auto flex w-full max-w-3xl px-4 py-6 md:px-0">
                  <div className="flex items-start space-x-3 rounded-xl bg-amber-50 p-4 border border-amber-200 text-amber-800 shadow-sm">
                    <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-amber-500" />
                    <div className="text-sm leading-relaxed">
                      <p className="font-semibold mb-1">Usage limit reached</p>
                      <p>
                        {limitMessage ||
                          "You have reached your conversation limit. Please contact support to upgrade your plan."}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {error && !limitExceeded && (
                <div className="mx-auto flex w-full max-w-3xl px-4 py-6 md:px-0">
                  <div className="flex items-start space-x-3 rounded-xl bg-[#ff0000]/5 p-4 border border-[#ff0000]/20 text-[#ff0000] shadow-sm">
                    <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-[#ff0000]" />
                    <div className="text-sm leading-relaxed">
                      An error occurred while communicating with the AI. Please
                      try again.
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </main>

        {/* Input Area */}
        <div className="sticky bottom-0 bg-gradient-to-t from-[#F9FAFB] via-[#F9FAFB]/90 to-transparent pb-6 pt-10 px-4">
          <div className="mx-auto w-full max-w-3xl">
            <form
              onSubmit={handleSubmit}
              className="flex relative items-end border border-gray-200 bg-white/80 backdrop-blur-xl rounded-2xl overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)] focus-within:ring-1 focus-within:ring-[#00aff0]/50 focus-within:border-[#00aff0]/50 transition-all"
            >
              <textarea
                className="w-full resize-none scrollbar-hide bg-transparent p-4 pr-16 text-[15px] text-gray-900 placeholder:text-gray-400 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                value={inputValue}
                placeholder={
                  limitExceeded
                    ? "You have reached your usage limit."
                    : "Message AI..."
                }
                onChange={handleInputChange}
                disabled={limitExceeded}
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (inputValue.trim()) handleSubmit();
                  }
                }}
                style={{
                  minHeight: "60px",
                  maxHeight: "200px",
                }}
              />
              <button
                type="submit"
                disabled={isLoading || !inputValue.trim() || limitExceeded}
                className="absolute right-3 bottom-3 flex h-9 w-9 items-center justify-center rounded-xl bg-[#00aff0]/10 text-[#00aff0] ring-1 ring-[#00aff0]/20 transition-all hover:bg-[#00aff0]/20 disabled:opacity-40 disabled:hover:bg-[#00aff0]/10 shadow-sm"
              >
                <Send className="h-4 w-4 ml-0.5" />
              </button>
            </form>
            <div className="mt-3 text-center text-xs text-gray-400">
              AI can make mistakes. Consider verifying important information.
            </div>
          </div>
        </div>
      </div>
      {/* Sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
