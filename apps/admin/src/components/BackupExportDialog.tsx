import React, { useState } from "react";
import { Download, Database, FileJson, Loader2, CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";
import { api } from "../api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Button } from "./ui/button";

export function BackupExportDialog() {
  const [open, setOpen] = useState(false);
  const [downloadingFormat, setDownloadingFormat] = useState<"json" | "db" | null>(null);
  const [successFormat, setSuccessFormat] = useState<"json" | "db" | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleDownload = async (format: "json" | "db") => {
    setDownloadingFormat(format);
    setErrorMessage(null);
    setSuccessFormat(null);
    try {
      await api.downloadExport(format);
      setSuccessFormat(format);
      setTimeout(() => setSuccessFormat(null), 4000);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Xuất dữ liệu thất bại");
    } finally {
      setDownloadingFormat(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="secondary"
          size="sm"
          className="gap-2 border-indigo-500/30 hover:border-indigo-500/50 hover:bg-indigo-500/10 text-slate-200"
          title="Backup & Export Data"
        >
          <Download size={14} className="text-indigo-400" />
          <span>Backup</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <Download size={18} />
            </div>
            <div>
              <DialogTitle>Backup & Export Data</DialogTitle>
              <DialogDescription className="mt-0.5">
                Download an exact database snapshot or structured JSON data for safekeeping.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {errorMessage && (
          <div className="flex items-center gap-2 p-3 text-sm bg-rose-500/15 border border-rose-500/30 text-rose-300 rounded-xl">
            <AlertTriangle size={16} className="shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 my-2">
          {/* SQLite Card */}
          <div className="flex flex-col justify-between p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] hover:border-emerald-500/30 hover:bg-white/[0.05] transition-all">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                  <Database size={18} />
                </div>
                <span className="text-[11px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  Full Database
                </span>
              </div>
              <h4 className="font-semibold text-white text-sm">SQLite Database Snapshot</h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Complete binary snapshot (<code className="text-emerald-300">.sqlite</code>) captured with flushed WAL. Ideal for full server migration and total recovery.
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-white/[0.06]">
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2 border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-200"
                disabled={downloadingFormat !== null}
                onClick={() => handleDownload("db")}
              >
                {downloadingFormat === "db" ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Exporting...</span>
                  </>
                ) : successFormat === "db" ? (
                  <>
                    <CheckCircle2 size={14} className="text-emerald-400" />
                    <span>Downloaded!</span>
                  </>
                ) : (
                  <>
                    <Download size={14} />
                    <span>Download .sqlite</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* JSON Card */}
          <div className="flex flex-col justify-between p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] hover:border-indigo-500/30 hover:bg-white/[0.05] transition-all">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="w-9 h-9 rounded-lg bg-indigo-500/15 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                  <FileJson size={18} />
                </div>
                <span className="text-[11px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                  Human Readable
                </span>
              </div>
              <h4 className="font-semibold text-white text-sm">Structured JSON Export</h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Structured export (<code className="text-indigo-300">.json</code>) containing channels, events, memories, memory book stories, lists, and lookups.
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-white/[0.06]">
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2 border-indigo-500/30 hover:bg-indigo-500/20 text-indigo-200"
                disabled={downloadingFormat !== null}
                onClick={() => handleDownload("json")}
              >
                {downloadingFormat === "json" ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Exporting...</span>
                  </>
                ) : successFormat === "json" ? (
                  <>
                    <CheckCircle2 size={14} className="text-indigo-400" />
                    <span>Downloaded!</span>
                  </>
                ) : (
                  <>
                    <Download size={14} />
                    <span>Download .json</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.05] text-[11px] text-slate-400">
          <ShieldCheck size={14} className="text-indigo-400 shrink-0" />
          <span>Exports are generated live from the database without downtime or interruption to ongoing bot chats.</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
