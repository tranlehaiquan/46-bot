import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Bot,
  Key,
  Globe,
  Save,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Cpu,
  RefreshCw,
  RotateCcw,
  Zap,
  Image as ImageIcon,
} from "lucide-react";
import { Button, Badge, TextField, Select, Callout } from "@radix-ui/themes";
import { toast } from "sonner";
import { ConfirmDialog } from "./ConfirmDialog";
import {
  useSettings,
  useUpdateSettings,
  useTestSettings,
  useTestCrawl4Ai,
  useTestZipline,
} from "../hooks/useAdminQueries";

const GEMINI_MODELS = [
  { value: "gemini-3.8-flash", label: "gemini-3.8-flash (Khuyên dùng)" },
  { value: "gemini-2.5-flash", label: "gemini-2.5-flash" },
  { value: "gemini-2.5-pro", label: "gemini-2.5-pro" },
  { value: "gemini-1.5-flash", label: "gemini-1.5-flash" },
];

const GEMINI_IMAGE_MODELS = [
  { value: "imagen-3.0-generate-002", label: "imagen-3.0-generate-002 (Imagen 3, Khuyên dùng)" },
  { value: "imagen-3.0-fast-generate-001", label: "imagen-3.0-fast-generate-001 (Imagen 3 Fast)" },
];

const DEEPSEEK_MODELS = [
  { value: "deepseek-chat", label: "deepseek-chat (DeepSeek-V3, Khuyên dùng)" },
  { value: "deepseek-reasoner", label: "deepseek-reasoner (DeepSeek-R1)" },
];

export function SettingsPage() {
  const { data: settings, isLoading, isError, refetch } = useSettings();
  const updateSettingsMutation = useUpdateSettings();
  const testSettingsMutation = useTestSettings();
  const testCrawl4AiMutation = useTestCrawl4Ai();
  const testZiplineMutation = useTestZipline();

  const [provider, setProvider] = useState<"gemini" | "deepseek">("gemini");
  const [geminiModel, setGeminiModel] = useState("gemini-3.8-flash");
  const [geminiImageModel, setGeminiImageModel] = useState("imagen-3.0-generate-002");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [showGeminiKey, setShowGeminiKey] = useState(false);

  const [deepseekModel, setDeepseekModel] = useState("deepseek-chat");
  const [deepseekApiKey, setDeepseekApiKey] = useState("");
  const [showDeepseekKey, setShowDeepseekKey] = useState(false);

  const [tavilyApiKey, setTavilyApiKey] = useState("");
  const [showTavilyKey, setShowTavilyKey] = useState(false);

  const [crawl4aiApiToken, setCrawl4aiApiToken] = useState("");
  const [showCrawl4aiToken, setShowCrawl4aiToken] = useState(false);

  const [ziplineUrl, setZiplineUrl] = useState("");
  const [ziplineToken, setZiplineToken] = useState("");
  const [showZiplineToken, setShowZiplineToken] = useState(false);

  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [resetKeyTarget, setResetKeyTarget] = useState<
    "geminiApiKey" | "deepseekApiKey" | "tavilyApiKey" | "crawl4aiApiKey" | "ziplineToken" | null
  >(null);

  const [testingTarget, setTestingTarget] = useState<"gemini" | "deepseek" | "tavily" | "crawl4ai" | "zipline" | null>(null);
  const [testResult, setTestResult] = useState<{
    target: "gemini" | "deepseek" | "tavily" | "crawl4ai" | "zipline";
    ok: boolean;
    message: string;
    detail?: string;
  } | null>(null);

  // Sync state when data loads or updates
  useEffect(() => {
    if (settings) {
      setProvider(settings.llmProvider);
      setGeminiModel(settings.geminiModel || "gemini-3.8-flash");
      setGeminiImageModel(settings.geminiImageModel || "imagen-3.0-generate-002");
      setDeepseekModel(settings.deepseekModel || "deepseek-chat");
      setZiplineUrl(settings.ziplineUrl || "");
    }
  }, [settings]);

  const handleSave = async () => {
    setStatusMessage(null);
    try {
      const updates: Parameters<typeof updateSettingsMutation.mutateAsync>[0] = {
        llmProvider: provider,
        geminiModel,
        geminiImageModel,
        deepseekModel,
        ziplineUrl: ziplineUrl.trim(),
      };

      if (geminiApiKey.trim()) {
        updates.geminiApiKey = geminiApiKey.trim();
      }
      if (deepseekApiKey.trim()) {
        updates.deepseekApiKey = deepseekApiKey.trim();
      }
      if (tavilyApiKey.trim()) {
        updates.tavilyApiKey = tavilyApiKey.trim();
      }
      if (crawl4aiApiToken.trim()) {
        updates.crawl4aiApiKey = crawl4aiApiToken.trim();
      }
      if (ziplineToken.trim()) {
        updates.ziplineToken = ziplineToken.trim();
      }

      await updateSettingsMutation.mutateAsync(updates);
      setGeminiApiKey("");
      setDeepseekApiKey("");
      setTavilyApiKey("");
      setCrawl4aiApiToken("");
      setZiplineToken("");
      const successText = "Đã lưu cài đặt thành công! Cấu hình mới được áp dụng ngay lập tức.";
      setStatusMessage({
        type: "success",
        text: successText,
      });
      toast.success(successText);
      setTimeout(() => setStatusMessage(null), 5000);
    } catch (err) {
      const text = err instanceof Error ? err.message : "Lỗi khi lưu cài đặt";
      setStatusMessage({ type: "error", text });
      toast.error(text);
    }
  };

  const executeResetKey = async () => {
    if (!resetKeyTarget) return;
    setStatusMessage(null);
    try {
      await updateSettingsMutation.mutateAsync({
        [resetKeyTarget]: "",
      });
      const successText = "Đã khôi phục cài đặt API Key về mặc định từ file .env.";
      setStatusMessage({
        type: "success",
        text: successText,
      });
      toast.success(successText);
    } catch (err) {
      const text = err instanceof Error ? err.message : "Lỗi khi khôi phục";
      setStatusMessage({ type: "error", text });
      toast.error(text);
    } finally {
      setResetKeyTarget(null);
    }
  };

  const handleTestConnection = async (target: "gemini" | "deepseek" | "tavily" | "crawl4ai" | "zipline") => {
    setTestingTarget(target);
    setTestResult(null);
    try {
      if (target === "zipline") {
        const candidateUrl = ziplineUrl.trim() || undefined;
        const candidateToken = ziplineToken.trim() || undefined;
        const res = await testZiplineMutation.mutateAsync({ url: candidateUrl, token: candidateToken });
        setTestResult({
          target: "zipline",
          ok: res.ok,
          message: res.message || "Kết nối Zipline thành công!",
        });
      } else if (target === "crawl4ai") {
        const candidate = crawl4aiApiToken.trim() || undefined;
        const res = await testCrawl4AiMutation.mutateAsync(candidate);
        setTestResult({
          target: "crawl4ai",
          ok: res.ok,
          message: res.message || "Kết nối Crawl4AI Cloud thành công!",
        });
      } else if (target === "tavily") {
        const res = await testSettingsMutation.mutateAsync({
          testType: "tavily",
          tavilyApiKey: tavilyApiKey.trim() || undefined,
        });
        setTestResult({
          target: "tavily",
          ok: res.ok,
          message: res.message || "Tavily search OK",
          detail: res.reply,
        });
      } else {
        const activeKey =
          target === "gemini"
            ? (geminiApiKey.trim() || undefined)
            : (deepseekApiKey.trim() || undefined);
        const activeModel = target === "gemini" ? geminiModel : deepseekModel;

        const res = await testSettingsMutation.mutateAsync({
          testType: "llm",
          provider: target,
          apiKey: activeKey,
          model: activeModel,
        });
        setTestResult({
          target,
          ok: res.ok,
          message: res.message || "Kết nối thành công",
          detail: res.reply ? `Phản hồi: "${res.reply}"` : undefined,
        });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Kiểm tra kết nối thất bại";
      setTestResult({
        target,
        ok: false,
        message: errorMsg,
      });
    } finally {
      setTestingTarget(null);
    }
  };

  if (isLoading) {
    return (
      <div className="glass-panel p-12 flex flex-col items-center justify-center text-slate-400 gap-3">
        <RefreshCw className="animate-spin text-indigo-400" size={32} />
        <p className="text-sm">Đang tải thông tin cấu hình...</p>
      </div>
    );
  }

  if (isError || !settings) {
    return (
      <div className="glass-panel p-8 text-center text-slate-400 space-y-4">
        <AlertCircle size={40} className="text-rose-400 mx-auto" />
        <h3 className="text-lg font-semibold text-white">Không thể tải cài đặt</h3>
        <p className="text-sm text-slate-400 max-w-md mx-auto">
          Đã xảy ra lỗi khi nạp thông tin cấu hình từ hệ thống.
        </p>
        <Button variant="soft" color="gray" onClick={() => refetch()} className="cursor-pointer">
          Thử lại
        </Button>
      </div>
    );
  }

  const renderKeySourceBadge = (source: "db" | "env" | "none") => {
    switch (source) {
      case "db":
        return (
          <Badge color="indigo" variant="soft" title="Được ghi đè và lưu trong cơ sở dữ liệu">
            Database Override
          </Badge>
        );
      case "env":
        return (
          <Badge color="gray" variant="soft" title="Đang dùng giá trị mặc định từ file .env">
            Mặc định từ .env
          </Badge>
        );
      case "none":
        return (
          <Badge color="red" variant="soft" title="Chưa có API Key">
            Chưa thiết lập
          </Badge>
        );
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="glass-panel p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="text-indigo-400" size={22} />
            <h1 className="text-xl font-bold text-white tracking-tight">
              Cấu hình AI & Tìm kiếm (LLM Settings)
            </h1>
          </div>
          <p className="text-sm text-slate-400">
            Tùy chỉnh LLM Provider hoạt động, cập nhật API Key, chọn model và cấu hình công cụ tìm kiếm trực tiếp trên dashboard.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            id="btn-save-settings"
            onClick={handleSave}
            loading={updateSettingsMutation.isPending}
            size="2"
            className="cursor-pointer shadow-lg shadow-indigo-600/30"
          >
            <Save size={16} />
            <span>Lưu thay đổi</span>
          </Button>
        </div>
      </div>

      {/* Status banner */}
      {statusMessage && (
        <Callout.Root color={statusMessage.type === "success" ? "green" : "red"} size="1">
          <Callout.Icon>
            {statusMessage.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          </Callout.Icon>
          <Callout.Text>{statusMessage.text}</Callout.Text>
        </Callout.Root>
      )}

      {/* Active Provider Selector */}
      <div className="glass-panel p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Bot size={18} className="text-indigo-400" />
              Chọn LLM Provider hoạt động
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Provider này sẽ trực tiếp xử lý tất cả tin nhắn và câu hỏi từ người dùng trong nhóm chat.
            </p>
          </div>
          <Badge color="indigo" variant="solid">Đang áp dụng: {provider.toUpperCase()}</Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Gemini Card */}
          <div
            id="provider-card-gemini"
            onClick={() => setProvider("gemini")}
            className={`p-5 rounded-xl border transition-all cursor-pointer relative flex flex-col justify-between ${
              provider === "gemini"
                ? "bg-indigo-600/10 border-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.2)]"
                : "bg-white/[0.02] border-white/10 hover:border-white/20 hover:bg-white/[0.04]"
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-white flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse" />
                  Google Gemini
                </span>
                {provider === "gemini" ? (
                  <Badge color="indigo" variant="solid">Đang chọn</Badge>
                ) : (
                  <span className="text-xs text-slate-400">Nhấn để chọn</span>
                )}
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Hỗ trợ phân tích ảnh trực tiếp (Vision/OCR), tốc độ phản hồi cực nhanh và chi phí tối ưu qua Google AI SDK.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-slate-400">
              <span>Model: <code className="text-indigo-300 font-mono">{geminiModel}</code></span>
              {renderKeySourceBadge(settings.geminiApiKeySource)}
            </div>
          </div>

          {/* DeepSeek Card */}
          <div
            id="provider-card-deepseek"
            onClick={() => setProvider("deepseek")}
            className={`p-5 rounded-xl border transition-all cursor-pointer relative flex flex-col justify-between ${
              provider === "deepseek"
                ? "bg-indigo-600/10 border-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.2)]"
                : "bg-white/[0.02] border-white/10 hover:border-white/20 hover:bg-white/[0.04]"
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-white flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
                  DeepSeek
                </span>
                {provider === "deepseek" ? (
                  <Badge color="indigo" variant="solid">Đang chọn</Badge>
                ) : (
                  <span className="text-xs text-slate-400">Nhấn để chọn</span>
                )}
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Khả năng suy luận và sinh văn bản tự nhiên, hỗ trợ DeepSeek-V3 và DeepSeek-R1 (Reasoner).
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-slate-400">
              <span>Model: <code className="text-indigo-300 font-mono">{deepseekModel}</code></span>
              {renderKeySourceBadge(settings.deepseekApiKeySource)}
            </div>
          </div>
        </div>
      </div>

      {/* Gemini Configuration */}
      <div className="glass-panel p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Cpu size={18} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Cấu hình Google Gemini</h2>
              <p className="text-xs text-slate-400">Thiết lập Model ID và Gemini API Key</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="soft"
              color="gray"
              size="1"
              loading={testingTarget === "gemini"}
              onClick={() => handleTestConnection("gemini")}
              className="cursor-pointer"
            >
              <Zap size={14} className="text-amber-400" />
              <span>Kiểm tra kết nối</span>
            </Button>
          </div>
        </div>

        {testResult && testResult.target === "gemini" && (
          <Callout.Root color={testResult.ok ? "green" : "red"} size="1">
            <Callout.Icon>
              {testResult.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            </Callout.Icon>
            <Callout.Text>
              <div className="space-y-1">
                <div className="font-medium">{testResult.message}</div>
                {testResult.detail && <div className="text-slate-300">{testResult.detail}</div>}
              </div>
            </Callout.Text>
          </Callout.Root>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Gemini Model */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
              <span>Model Gemini</span>
              <span className="text-[11px] text-slate-500">Mặc định: gemini-3.8-flash</span>
            </label>
            <div className="space-y-2">
              <Select.Root
                value={GEMINI_MODELS.some((m) => m.value === geminiModel) ? geminiModel : "custom"}
                onValueChange={(val) => {
                  if (val !== "custom") {
                    setGeminiModel(val);
                  }
                }}
              >
                <Select.Trigger className="w-full" id="select-gemini-model" />
                <Select.Content position="popper">
                  {GEMINI_MODELS.map((m) => (
                    <Select.Item key={m.value} value={m.value}>
                      {m.label}
                    </Select.Item>
                  ))}
                  <Select.Item value="custom">Tùy chỉnh model ID khác...</Select.Item>
                </Select.Content>
              </Select.Root>

              <TextField.Root
                id="input-gemini-model"
                placeholder="Nhập tên model (ví dụ: gemini-3.8-flash)"
                value={geminiModel}
                onChange={(e) => setGeminiModel(e.target.value)}
              />
            </div>
          </div>

          {/* Gemini API Key */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <Key size={13} className="text-indigo-400" />
                <span>Gemini API Key</span>
              </label>
              <div className="flex items-center gap-2">
                {renderKeySourceBadge(settings.geminiApiKeySource)}
                {settings.geminiApiKeySource === "db" && (
                  <button
                    onClick={() => setResetKeyTarget("geminiApiKey")}
                    className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                    title="Khôi phục về key từ .env"
                  >
                    <RotateCcw size={11} />
                    <span>Đặt lại</span>
                  </button>
                )}
              </div>
            </div>

            <TextField.Root
              id="input-gemini-key"
              type={showGeminiKey ? "text" : "password"}
              placeholder={
                settings.geminiApiKeyMasked
                  ? `Hiện tại: ${settings.geminiApiKeyMasked} (để trống nếu không đổi)`
                  : "Nhập Gemini API Key (AQ....)"
              }
              value={geminiApiKey}
              onChange={(e) => setGeminiApiKey(e.target.value)}
              className="font-mono"
            >
              <TextField.Slot side="right">
                <button
                  type="button"
                  onClick={() => setShowGeminiKey(!showGeminiKey)}
                  className="text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  {showGeminiKey ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </TextField.Slot>
            </TextField.Root>
            <p className="text-[11px] text-slate-400">
              Khóa API bắt đầu bằng <code className="text-indigo-300 font-mono">AQ...</code> từ Google AI Studio.
            </p>
          </div>

          {/* Gemini Image Model */}
          <div className="space-y-2 md:col-span-2 border-t border-white/5 pt-4">
            <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <ImageIcon size={13} className="text-indigo-400" />
                <span>Model tạo hình ảnh (Gemini Imagen)</span>
              </span>
              <span className="text-[11px] text-slate-500">Mặc định: imagen-3.0-generate-002</span>
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Select.Root
                value={GEMINI_IMAGE_MODELS.some((m) => m.value === geminiImageModel) ? geminiImageModel : "custom"}
                onValueChange={(val) => {
                  if (val !== "custom") {
                    setGeminiImageModel(val);
                  }
                }}
              >
                <Select.Trigger className="w-full" id="select-gemini-image-model" />
                <Select.Content position="popper">
                  {GEMINI_IMAGE_MODELS.map((m) => (
                    <Select.Item key={m.value} value={m.value}>
                      {m.label}
                    </Select.Item>
                  ))}
                  <Select.Item value="custom">Tùy chỉnh model ID khác...</Select.Item>
                </Select.Content>
              </Select.Root>

              <TextField.Root
                id="input-gemini-image-model"
                placeholder="Nhập tên model (ví dụ: imagen-3.0-generate-002)"
                value={geminiImageModel}
                onChange={(e) => setGeminiImageModel(e.target.value)}
              />
            </div>
            <p className="text-[11px] text-slate-400">
              Model được dùng khi người dùng yêu cầu chatbot vẽ tranh, tạo hình ảnh trong hội thoại.
            </p>
          </div>
        </div>
      </div>

      {/* DeepSeek Configuration */}
      <div className="glass-panel p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Cpu size={18} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Cấu hình DeepSeek</h2>
              <p className="text-xs text-slate-400">Thiết lập Model ID và DeepSeek API Key</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="soft"
              color="gray"
              size="1"
              loading={testingTarget === "deepseek"}
              onClick={() => handleTestConnection("deepseek")}
              className="cursor-pointer"
            >
              <Zap size={14} className="text-amber-400" />
              <span>Kiểm tra kết nối</span>
            </Button>
          </div>
        </div>

        {testResult && testResult.target === "deepseek" && (
          <Callout.Root color={testResult.ok ? "green" : "red"} size="1">
            <Callout.Icon>
              {testResult.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            </Callout.Icon>
            <Callout.Text>
              <div className="space-y-1">
                <div className="font-medium">{testResult.message}</div>
                {testResult.detail && <div className="text-slate-300">{testResult.detail}</div>}
              </div>
            </Callout.Text>
          </Callout.Root>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* DeepSeek Model */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
              <span>Model DeepSeek</span>
              <span className="text-[11px] text-slate-500">Mặc định: deepseek-chat</span>
            </label>
            <div className="space-y-2">
              <Select.Root
                value={DEEPSEEK_MODELS.some((m) => m.value === deepseekModel) ? deepseekModel : "custom"}
                onValueChange={(val) => {
                  if (val !== "custom") {
                    setDeepseekModel(val);
                  }
                }}
              >
                <Select.Trigger className="w-full" id="select-deepseek-model" />
                <Select.Content position="popper">
                  {DEEPSEEK_MODELS.map((m) => (
                    <Select.Item key={m.value} value={m.value}>
                      {m.label}
                    </Select.Item>
                  ))}
                  <Select.Item value="custom">Tùy chỉnh model ID khác...</Select.Item>
                </Select.Content>
              </Select.Root>

              <TextField.Root
                id="input-deepseek-model"
                placeholder="Nhập tên model (ví dụ: deepseek-chat)"
                value={deepseekModel}
                onChange={(e) => setDeepseekModel(e.target.value)}
              />
            </div>
          </div>

          {/* DeepSeek API Key */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <Key size={13} className="text-indigo-400" />
                <span>DeepSeek API Key</span>
              </label>
              <div className="flex items-center gap-2">
                {renderKeySourceBadge(settings.deepseekApiKeySource)}
                {settings.deepseekApiKeySource === "db" && (
                  <button
                    onClick={() => setResetKeyTarget("deepseekApiKey")}
                    className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                    title="Khôi phục về key từ .env"
                  >
                    <RotateCcw size={11} />
                    <span>Đặt lại</span>
                  </button>
                )}
              </div>
            </div>

            <TextField.Root
              id="input-deepseek-key"
              type={showDeepseekKey ? "text" : "password"}
              placeholder={
                settings.deepseekApiKeyMasked
                  ? `Hiện tại: ${settings.deepseekApiKeyMasked} (để trống nếu không đổi)`
                  : "Nhập DeepSeek API Key (sk-...)"
              }
              value={deepseekApiKey}
              onChange={(e) => setDeepseekApiKey(e.target.value)}
              className="font-mono"
            >
              <TextField.Slot side="right">
                <button
                  type="button"
                  onClick={() => setShowDeepseekKey(!showDeepseekKey)}
                  className="text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  {showDeepseekKey ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </TextField.Slot>
            </TextField.Root>
            <p className="text-[11px] text-slate-400">
              Khóa API bắt đầu bằng <code className="text-indigo-300 font-mono">sk-...</code> từ nền tảng DeepSeek Open Platform.
            </p>
          </div>
        </div>
      </div>

      {/* Tavily Web Search Configuration */}
      <div className="glass-panel p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Globe size={18} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Tavily Web Search (Tìm kiếm thời gian thực)</h2>
              <p className="text-xs text-slate-400">Cung cấp dữ liệu trực tuyến về tin tức, thời sự, giá cả thị trường</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="soft"
              color="gray"
              size="1"
              loading={testingTarget === "tavily"}
              onClick={() => handleTestConnection("tavily")}
              className="cursor-pointer"
            >
              <Zap size={14} className="text-amber-400" />
              <span>Kiểm tra tìm kiếm</span>
            </Button>
          </div>
        </div>

        {testResult && testResult.target === "tavily" && (
          <Callout.Root color={testResult.ok ? "green" : "red"} size="1">
            <Callout.Icon>
              {testResult.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            </Callout.Icon>
            <Callout.Text>
              <div className="space-y-1">
                <div className="font-medium">{testResult.message}</div>
                {testResult.detail && <div className="text-slate-300">{testResult.detail}</div>}
              </div>
            </Callout.Text>
          </Callout.Root>
        )}

        <div className="space-y-2 max-w-xl">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <Key size={13} className="text-indigo-400" />
              <span>Tavily API Key</span>
            </label>
            <div className="flex items-center gap-2">
              {renderKeySourceBadge(settings.tavilyApiKeySource)}
              {settings.tavilyApiKeySource === "db" && (
                <button
                  onClick={() => setResetKeyTarget("tavilyApiKey")}
                  className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                  title="Khôi phục về key từ .env"
                >
                  <RotateCcw size={11} />
                  <span>Đặt lại</span>
                </button>
              )}
            </div>
          </div>

          <TextField.Root
            id="input-tavily-key"
            type={showTavilyKey ? "text" : "password"}
            placeholder={
              settings.tavilyApiKeyMasked
                ? `Hiện tại: ${settings.tavilyApiKeyMasked} (để trống nếu không đổi)`
                : "Nhập Tavily API Key (tvly-...)"
            }
            value={tavilyApiKey}
            onChange={(e) => setTavilyApiKey(e.target.value)}
            className="font-mono"
          >
            <TextField.Slot side="right">
              <button
                type="button"
                onClick={() => setShowTavilyKey(!showTavilyKey)}
                className="text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                {showTavilyKey ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </TextField.Slot>
          </TextField.Root>
          <p className="text-[11px] text-slate-400">
            Khóa API bắt đầu bằng <code className="text-indigo-300 font-mono">tvly-...</code> từ Tavily AI Search API.
          </p>
        </div>
      </div>

      {/* Crawl4AI Web Scraping & Crawling Configuration */}
      <div className="glass-panel p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Globe size={18} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Crawl4AI Cloud (Đọc & trích xuất nội dung web)</h2>
              <p className="text-xs text-slate-400">Đọc nội dung chi tiết bài viết, trang web và trích xuất Markdown cho LLM</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="soft"
              color="gray"
              size="1"
              loading={testingTarget === "crawl4ai"}
              onClick={() => handleTestConnection("crawl4ai")}
              className="cursor-pointer"
            >
              <Zap size={14} className="text-amber-400" />
              <span>Kiểm tra kết nối</span>
            </Button>
          </div>
        </div>

        {testResult && testResult.target === "crawl4ai" && (
          <Callout.Root color={testResult.ok ? "green" : "red"} size="1">
            <Callout.Icon>
              {testResult.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            </Callout.Icon>
            <Callout.Text>
              <div className="space-y-1">
                <div className="font-medium">{testResult.message}</div>
                {testResult.detail && <div className="text-slate-300">{testResult.detail}</div>}
              </div>
            </Callout.Text>
          </Callout.Root>
        )}

        <div className="space-y-2 max-w-xl">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <Key size={13} className="text-cyan-400" />
              <span>Crawl4AI API Token</span>
            </label>
            <div className="flex items-center gap-2">
              {renderKeySourceBadge(settings.crawl4aiApiTokenSource)}
              {settings.crawl4aiApiTokenSource === "db" && (
                <button
                  onClick={() => setResetKeyTarget("crawl4aiApiKey")}
                  className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                  title="Khôi phục về token từ .env"
                >
                  <RotateCcw size={11} />
                  <span>Đặt lại</span>
                </button>
              )}
            </div>
          </div>

          <TextField.Root
            id="input-crawl4ai-token"
            type={showCrawl4aiToken ? "text" : "password"}
            placeholder={
              settings.crawl4aiApiTokenMasked
                ? `Hiện tại: ${settings.crawl4aiApiTokenMasked} (để trống nếu không đổi)`
                : "Nhập Crawl4AI API Token"
            }
            value={crawl4aiApiToken}
            onChange={(e) => setCrawl4aiApiToken(e.target.value)}
            className="font-mono"
          >
            <TextField.Slot side="right">
              <button
                type="button"
                onClick={() => setShowCrawl4aiToken(!showCrawl4aiToken)}
                className="text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                {showCrawl4aiToken ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </TextField.Slot>
          </TextField.Root>
          <p className="text-[11px] text-slate-400">
            Lấy API Token tại bảng điều khiển{" "}
            <a
              href="https://crawl4ai.com/dashboard/"
              target="_blank"
              rel="noreferrer"
              className="text-cyan-400 hover:underline"
            >
              crawl4ai.com/dashboard
            </a>
            .
          </p>
        </div>
      </div>

      {/* Zipline Image Storage Configuration */}
      <div className="glass-panel p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <ImageIcon size={18} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Zipline (Lưu trữ ảnh sự kiện & lịch)</h2>
              <p className="text-xs text-slate-400">Dịch vụ lưu trữ ảnh tự lưu (self-hosted) để tải lên và chia sẻ ảnh lịch qua Zalo</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="soft"
              color="gray"
              size="1"
              loading={testingTarget === "zipline"}
              onClick={() => handleTestConnection("zipline")}
              className="cursor-pointer"
            >
              <Zap size={14} className="text-amber-400" />
              <span>Kiểm tra kết nối</span>
            </Button>
          </div>
        </div>

        {testResult && testResult.target === "zipline" && (
          <Callout.Root color={testResult.ok ? "green" : "red"} size="1">
            <Callout.Icon>
              {testResult.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            </Callout.Icon>
            <Callout.Text>
              <div className="space-y-1">
                <div className="font-medium">{testResult.message}</div>
                {testResult.detail && <div className="text-slate-300">{testResult.detail}</div>}
              </div>
            </Callout.Text>
          </Callout.Root>
        )}

        <div className="space-y-4 max-w-xl">
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <Globe size={13} className="text-purple-400" />
              <span>Zipline URL</span>
            </label>
            <TextField.Root
              id="input-zipline-url"
              type="text"
              placeholder="https://zipline.example.com"
              value={ziplineUrl}
              onChange={(e) => setZiplineUrl(e.target.value)}
              className="font-mono"
            />
            <p className="text-[11px] text-slate-400">
              Địa chỉ máy chủ Zipline công khai của bạn (ví dụ: https://zipline.domain.com).
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <Key size={13} className="text-purple-400" />
                <span>Zipline API Token</span>
              </label>
              <div className="flex items-center gap-2">
                {renderKeySourceBadge(settings.ziplineTokenSource)}
                {settings.ziplineTokenSource === "db" && (
                  <button
                    onClick={() => setResetKeyTarget("ziplineToken")}
                    className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                    title="Khôi phục về token từ .env"
                  >
                    <RotateCcw size={11} />
                    <span>Đặt lại</span>
                  </button>
                )}
              </div>
            </div>

            <TextField.Root
              id="input-zipline-token"
              type={showZiplineToken ? "text" : "password"}
              placeholder={
                settings.ziplineTokenMasked
                  ? `Hiện tại: ${settings.ziplineTokenMasked} (để trống nếu không đổi)`
                  : "Nhập Zipline API Token"
              }
              value={ziplineToken}
              onChange={(e) => setZiplineToken(e.target.value)}
              className="font-mono"
            >
              <TextField.Slot side="right">
                <button
                  type="button"
                  onClick={() => setShowZiplineToken(!showZiplineToken)}
                  className="text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  {showZiplineToken ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </TextField.Slot>
            </TextField.Root>
            <p className="text-[11px] text-slate-400">
              Tạo Authorization Token trong mục User Profile / Tokens trên giao diện web Zipline của bạn.
            </p>
          </div>
        </div>
      </div>

      {/* Confirm Reset Key Dialog */}
      <ConfirmDialog
        open={resetKeyTarget !== null}
        onOpenChange={(open) => !open && setResetKeyTarget(null)}
        title="Khôi phục API Key về mặc định"
        description="Bạn có chắc muốn xóa ghi đè database cho API Key này để quay về giá trị mặc định trong file .env?"
        confirmText="Đặt lại"
        cancelText="Hủy"
        variant="destructive"
        loading={updateSettingsMutation.isPending}
        onConfirm={executeResetKey}
      />
    </div>
  );
}
