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
} from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import {
  useSettings,
  useUpdateSettings,
  useTestSettings,
} from "../hooks/useAdminQueries";
import type { AdminSettings } from "../api";

const GEMINI_MODELS = [
  { value: "gemini-3.8-flash", label: "gemini-3.8-flash (Khuyên dùng)" },
  { value: "gemini-2.5-flash", label: "gemini-2.5-flash" },
  { value: "gemini-2.5-pro", label: "gemini-2.5-pro" },
  { value: "gemini-1.5-flash", label: "gemini-1.5-flash" },
];

const DEEPSEEK_MODELS = [
  { value: "deepseek-chat", label: "deepseek-chat (DeepSeek-V3, Khuyên dùng)" },
  { value: "deepseek-reasoner", label: "deepseek-reasoner (DeepSeek-R1)" },
];

export function SettingsPage() {
  const { data: settings, isLoading, isError, refetch } = useSettings();
  const updateSettingsMutation = useUpdateSettings();
  const testSettingsMutation = useTestSettings();

  const [provider, setProvider] = useState<"gemini" | "deepseek">("gemini");
  const [geminiModel, setGeminiModel] = useState("gemini-3.8-flash");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [showGeminiKey, setShowGeminiKey] = useState(false);

  const [deepseekModel, setDeepseekModel] = useState("deepseek-chat");
  const [deepseekApiKey, setDeepseekApiKey] = useState("");
  const [showDeepseekKey, setShowDeepseekKey] = useState(false);

  const [tavilyApiKey, setTavilyApiKey] = useState("");
  const [showTavilyKey, setShowTavilyKey] = useState(false);

  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [testingTarget, setTestingTarget] = useState<"gemini" | "deepseek" | "tavily" | null>(null);
  const [testResult, setTestResult] = useState<{
    target: "gemini" | "deepseek" | "tavily";
    ok: boolean;
    message: string;
    detail?: string;
  } | null>(null);

  // Sync state when data loads or updates
  useEffect(() => {
    if (settings) {
      setProvider(settings.llmProvider);
      setGeminiModel(settings.geminiModel || "gemini-3.8-flash");
      setDeepseekModel(settings.deepseekModel || "deepseek-chat");
    }
  }, [settings]);

  const handleSave = async () => {
    setStatusMessage(null);
    try {
      const updates: Parameters<typeof updateSettingsMutation.mutateAsync>[0] = {
        llmProvider: provider,
        geminiModel,
        deepseekModel,
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

      await updateSettingsMutation.mutateAsync(updates);
      setGeminiApiKey("");
      setDeepseekApiKey("");
      setTavilyApiKey("");
      setStatusMessage({
        type: "success",
        text: "Đã lưu cài đặt thành công! Cấu hình mới được áp dụng ngay lập tức.",
      });
      setTimeout(() => setStatusMessage(null), 5000);
    } catch (err) {
      const text = err instanceof Error ? err.message : "Lỗi khi lưu cài đặt";
      setStatusMessage({ type: "error", text });
    }
  };

  const handleResetKey = async (keyName: "geminiApiKey" | "deepseekApiKey" | "tavilyApiKey") => {
    if (!confirm("Bạn có chắc muốn xóa ghi đè database cho API Key này để quay về giá trị mặc định trong file .env?")) {
      return;
    }
    setStatusMessage(null);
    try {
      await updateSettingsMutation.mutateAsync({
        [keyName]: "",
      });
      setStatusMessage({
        type: "success",
        text: "Đã khôi phục cài đặt API Key về mặc định từ file .env.",
      });
    } catch (err) {
      const text = err instanceof Error ? err.message : "Lỗi khi khôi phục";
      setStatusMessage({ type: "error", text });
    }
  };

  const handleTestConnection = async (target: "gemini" | "deepseek" | "tavily") => {
    setTestingTarget(target);
    setTestResult(null);
    try {
      if (target === "tavily") {
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
        <Button variant="secondary" onClick={() => refetch()}>
          Thử lại
        </Button>
      </div>
    );
  }

  const renderKeySourceBadge = (source: "db" | "env" | "none") => {
    switch (source) {
      case "db":
        return (
          <Badge variant="indigo" title="Được ghi đè và lưu trong cơ sở dữ liệu">
            Database Override
          </Badge>
        );
      case "env":
        return (
          <Badge variant="default" title="Đang dùng giá trị mặc định từ file .env">
            Mặc định từ .env
          </Badge>
        );
      case "none":
        return (
          <Badge variant="disabled" title="Chưa có API Key">
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
            className="shadow-lg shadow-indigo-600/30"
          >
            <Save size={16} />
            <span>Lưu thay đổi</span>
          </Button>
        </div>
      </div>

      {/* Status banner */}
      {statusMessage && (
        <div
          className={`p-4 rounded-xl flex items-center gap-3 text-sm transition-all ${
            statusMessage.type === "success"
              ? "bg-emerald-500/10 border border-emerald-500/25 text-emerald-300"
              : "bg-rose-500/10 border border-rose-500/25 text-rose-300"
          }`}
        >
          {statusMessage.type === "success" ? (
            <CheckCircle2 size={18} className="shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle size={18} className="shrink-0 text-rose-400" />
          )}
          <span>{statusMessage.text}</span>
        </div>
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
          <Badge variant="active">Đang áp dụng: {provider.toUpperCase()}</Badge>
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
                  <Badge variant="indigo">Đang chọn</Badge>
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
                  <Badge variant="indigo">Đang chọn</Badge>
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
              variant="secondary"
              size="sm"
              loading={testingTarget === "gemini"}
              onClick={() => handleTestConnection("gemini")}
            >
              <Zap size={14} className="text-amber-400" />
              <span>Kiểm tra kết nối</span>
            </Button>
          </div>
        </div>

        {testResult && testResult.target === "gemini" && (
          <div
            className={`p-3.5 rounded-lg text-xs flex items-start gap-2.5 ${
              testResult.ok
                ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"
                : "bg-rose-500/10 border border-rose-500/20 text-rose-300"
            }`}
          >
            {testResult.ok ? (
              <CheckCircle2 size={16} className="shrink-0 text-emerald-400 mt-0.5" />
            ) : (
              <AlertCircle size={16} className="shrink-0 text-rose-400 mt-0.5" />
            )}
            <div className="space-y-1">
              <div className="font-medium">{testResult.message}</div>
              {testResult.detail && <div className="text-slate-300">{testResult.detail}</div>}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Gemini Model */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
              <span>Model Gemini</span>
              <span className="text-[11px] text-slate-500">Mặc định: gemini-3.8-flash</span>
            </label>
            <div className="space-y-2">
              <select
                id="select-gemini-model"
                value={GEMINI_MODELS.some((m) => m.value === geminiModel) ? geminiModel : "custom"}
                onChange={(e) => {
                  if (e.target.value !== "custom") {
                    setGeminiModel(e.target.value);
                  }
                }}
                className="w-full rounded-lg border border-white/10 bg-[#0a0d14] px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-500"
              >
                {GEMINI_MODELS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
                <option value="custom">Tùy chỉnh model ID khác...</option>
              </select>

              <Input
                id="input-gemini-model"
                type="text"
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
                    onClick={() => handleResetKey("geminiApiKey")}
                    className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1"
                    title="Khôi phục về key từ .env"
                  >
                    <RotateCcw size={11} />
                    <span>Đặt lại</span>
                  </button>
                )}
              </div>
            </div>

            <div className="relative">
              <Input
                id="input-gemini-key"
                type={showGeminiKey ? "text" : "password"}
                placeholder={
                  settings.geminiApiKeyMasked
                    ? `Hiện tại: ${settings.geminiApiKeyMasked} (để trống nếu không đổi)`
                    : "Nhập Gemini API Key (AQ....)"
                }
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
                className="pr-10 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowGeminiKey(!showGeminiKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                {showGeminiKey ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              Khóa API bắt đầu bằng <code className="text-indigo-300 font-mono">AQ...</code> từ Google AI Studio.
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
              variant="secondary"
              size="sm"
              loading={testingTarget === "deepseek"}
              onClick={() => handleTestConnection("deepseek")}
            >
              <Zap size={14} className="text-amber-400" />
              <span>Kiểm tra kết nối</span>
            </Button>
          </div>
        </div>

        {testResult && testResult.target === "deepseek" && (
          <div
            className={`p-3.5 rounded-lg text-xs flex items-start gap-2.5 ${
              testResult.ok
                ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"
                : "bg-rose-500/10 border border-rose-500/20 text-rose-300"
            }`}
          >
            {testResult.ok ? (
              <CheckCircle2 size={16} className="shrink-0 text-emerald-400 mt-0.5" />
            ) : (
              <AlertCircle size={16} className="shrink-0 text-rose-400 mt-0.5" />
            )}
            <div className="space-y-1">
              <div className="font-medium">{testResult.message}</div>
              {testResult.detail && <div className="text-slate-300">{testResult.detail}</div>}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* DeepSeek Model */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
              <span>Model DeepSeek</span>
              <span className="text-[11px] text-slate-500">Mặc định: deepseek-chat</span>
            </label>
            <div className="space-y-2">
              <select
                id="select-deepseek-model"
                value={DEEPSEEK_MODELS.some((m) => m.value === deepseekModel) ? deepseekModel : "custom"}
                onChange={(e) => {
                  if (e.target.value !== "custom") {
                    setDeepseekModel(e.target.value);
                  }
                }}
                className="w-full rounded-lg border border-white/10 bg-[#0a0d14] px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-500"
              >
                {DEEPSEEK_MODELS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
                <option value="custom">Tùy chỉnh model ID khác...</option>
              </select>

              <Input
                id="input-deepseek-model"
                type="text"
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
                    onClick={() => handleResetKey("deepseekApiKey")}
                    className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1"
                    title="Khôi phục về key từ .env"
                  >
                    <RotateCcw size={11} />
                    <span>Đặt lại</span>
                  </button>
                )}
              </div>
            </div>

            <div className="relative">
              <Input
                id="input-deepseek-key"
                type={showDeepseekKey ? "text" : "password"}
                placeholder={
                  settings.deepseekApiKeyMasked
                    ? `Hiện tại: ${settings.deepseekApiKeyMasked} (để trống nếu không đổi)`
                    : "Nhập DeepSeek API Key (sk-...)"
                }
                value={deepseekApiKey}
                onChange={(e) => setDeepseekApiKey(e.target.value)}
                className="pr-10 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowDeepseekKey(!showDeepseekKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                {showDeepseekKey ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
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
              variant="secondary"
              size="sm"
              loading={testingTarget === "tavily"}
              onClick={() => handleTestConnection("tavily")}
            >
              <Zap size={14} className="text-amber-400" />
              <span>Kiểm tra tìm kiếm</span>
            </Button>
          </div>
        </div>

        {testResult && testResult.target === "tavily" && (
          <div
            className={`p-3.5 rounded-lg text-xs flex items-start gap-2.5 ${
              testResult.ok
                ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"
                : "bg-rose-500/10 border border-rose-500/20 text-rose-300"
            }`}
          >
            {testResult.ok ? (
              <CheckCircle2 size={16} className="shrink-0 text-emerald-400 mt-0.5" />
            ) : (
              <AlertCircle size={16} className="shrink-0 text-rose-400 mt-0.5" />
            )}
            <div className="space-y-1">
              <div className="font-medium">{testResult.message}</div>
              {testResult.detail && <div className="text-slate-300">{testResult.detail}</div>}
            </div>
          </div>
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
                  onClick={() => handleResetKey("tavilyApiKey")}
                  className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1"
                  title="Khôi phục về key từ .env"
                >
                  <RotateCcw size={11} />
                  <span>Đặt lại</span>
                </button>
              )}
            </div>
          </div>

          <div className="relative">
            <Input
              id="input-tavily-key"
              type={showTavilyKey ? "text" : "password"}
              placeholder={
                settings.tavilyApiKeyMasked
                  ? `Hiện tại: ${settings.tavilyApiKeyMasked} (để trống nếu không đổi)`
                  : "Nhập Tavily API Key (tvly-...)"
              }
              value={tavilyApiKey}
              onChange={(e) => setTavilyApiKey(e.target.value)}
              className="pr-10 font-mono"
            />
            <button
              type="button"
              onClick={() => setShowTavilyKey(!showTavilyKey)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
            >
              {showTavilyKey ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          <p className="text-[11px] text-slate-400">
            Khóa API bắt đầu bằng <code className="text-indigo-300 font-mono">tvly-...</code> từ Tavily AI Search API.
          </p>
        </div>
      </div>
    </div>
  );
}
