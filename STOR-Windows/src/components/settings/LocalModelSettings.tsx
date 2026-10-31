import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { LocalModelConfig } from "../../types/config";

interface Asset { id: string; name: string; size: number; fileName: string; url: string }
interface DownloadInfo { catalog: { engine: Asset; models: Asset[] }; directory: string; existing: string[] }
interface Status {
  engine: string; model: string; message: string; downloadKind: string | null;
  downloaded: number; total: number; pid: number | null;
  engineVersion: string; bundledAvailable: boolean;
}
const engineLabels: Record<string, string> = {
  missing: "未安装", removed: "已删除，等待手动恢复", installing: "正在离线部署",
  downloading: "正在重新下载", deleting: "正在删除", ready: "已安装", error: "维护失败",
};
const modelLabels: Record<string, string> = { unloaded: "未加载", loading: "加载中", ready: "运行中", stopping: "停止中", error: "加载失败" };
const size = (bytes: number) => `${(bytes / 1024 ** 3).toFixed(2)} GiB`;

export function LocalModelSettings({ value, onChange, onBusy }: {
  value: LocalModelConfig; onChange: (value: LocalModelConfig) => void; onBusy: (busy: boolean) => void;
}) {
  const [choosing, setChoosing] = useState(!value.modelPath);
  const [downloading, setDownloading] = useState(false);
  const [info, setInfo] = useState<DownloadInfo | null>(null);
  const [modelId, setModelId] = useState("hy-mt2-q8");
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState("");

  useEffect(() => {
    let alive = true;
    const subscription = listen<Status>("local-model-status", ({ payload }) => { if (alive) setStatus(payload); });
    void subscription.then(() => invoke<Status>("get_local_model_status")).then(s => { if (alive) setStatus(s); })
      .catch(err => { if (alive) setError(String(err)); });
    return () => { alive = false; void subscription.then(unlisten => unlisten()); };
  }, []);

  const perform = async (label: string, task: () => Promise<void>) => {
    setError(""); setWorking(label); onBusy(true);
    try { await task(); } catch (err) { setError(String(err)); }
    finally { setWorking(""); onBusy(false); }
  };

  const importModel = () => perform("正在选择模型…", async () => {
    const path = await invoke<string | null>("choose_local_model");
    if (path) { onChange({ ...value, modelPath: path }); setChoosing(false); setDownloading(false); }
  });
  const showDownload = () => perform("正在读取下载信息…", async () => {
    setInfo(await invoke<DownloadInfo>("get_model_download_info")); setDownloading(true);
  });
  const selected = info?.catalog.models.find(model => model.id === modelId);
  const exists = info?.existing.includes(modelId) ?? false;
  const engineBusy = !status || working !== "" || ["installing", "downloading", "deleting"].includes(status.engine);

  return <div className="local-model-settings">
    <p className="hint">STOR 自动运行模型，无需打开 LM Studio。模型文件与推理引擎分别准备。</p>
    {value.modelPath && <div className="local-model-file">
      <span className="field-label">模型文件</span><p>{value.modelPath}</p>
      <button type="button" className="text-action" onClick={() => { setChoosing(!choosing); setDownloading(false); }}>更换模型</button>
    </div>}
    {choosing && <div className="local-model-choice">
      <p className="field-label">选择模型来源</p>
      <div className="profile-actions">
        <button type="button" className="secondary-btn" onClick={() => void importModel()}>使用已有模型（推荐）</button>
        <button type="button" className="secondary-btn" onClick={() => void showDownload()}>下载模型</button>
      </div>
      <p className="hint">可直接选择 LM Studio 已下载的 .gguf，例如 Hy-MT2。只记录路径，不复制、不移动、不重新下载。</p>
    </div>}
    {choosing && downloading && info && <div className="local-model-download">
      <label>推荐模型<select className="select-input" value={modelId} onChange={e => setModelId(e.target.value)}>
        {info.catalog.models.map(model => <option key={model.id} value={model.id}>{model.name} · {size(model.size)}</option>)}
      </select></label>
      <p className="hint">来源：腾讯官方 Hy-MT2 GGUF。翻译专用模型的查词解释效果需单独判断。</p>
      <label>保存目录<input className="text-input" readOnly value={info.directory} /></label>
      <button type="button" className="text-action" onClick={() => void perform("正在选择目录…", async () => {
        const directory = await invoke<string | null>("choose_model_directory");
        if (directory) setInfo(await invoke<DownloadInfo>("get_model_download_info", { directory }));
      })}>更改保存位置</button>
      {selected && <p className="hint local-model-path">{info.directory}\{selected.fileName} · {size(selected.size)}</p>}
      {exists && <p className="hint">此位置已有对应文件，可校验后直接复用，无需下载。文件不符时请更换位置或导入已有模型。</p>}
      <button type="button" className="secondary-btn" onClick={() => {
        if (!selected) return;
        if (!exists && !window.confirm(`下载 ${selected.name}（${size(selected.size)}）到：\n${info.directory}？`)) return;
        void perform(exists ? "正在校验已有模型…" : "正在下载模型…", async () => {
          const path = await invoke<string>("download_local_model", { modelId, directory: info.directory, reuse: exists });
          onChange({ ...value, modelPath: path }); setChoosing(false); setDownloading(false);
        });
      }}>{exists ? "校验并直接复用" : "确认下载模型"}</button>
    </div>}
    <label>运行方式<select className="select-input" value={value.compute} onChange={e => onChange({ ...value, compute: e.target.value as "gpu" | "cpu" })}>
      <option value="gpu">GPU 加速（Vulkan）</option><option value="cpu">仅 CPU</option>
    </select></label>
    <div className="local-model-status" role="status" aria-live="polite">
      <p>推理引擎：{status ? engineLabels[status.engine] ?? status.engine : "读取中…"} · 模型：{status ? modelLabels[status.model] ?? status.model : "读取中…"}</p>
      <p className="hint">引擎版本：{status?.engineVersion ?? "读取中…"}。首次使用从安装包离线部署，无需下载；保存设置不会提前加载模型。</p>
      {status?.engine === "removed" && <p className="hint">本地推理已暂停。请手动恢复内置引擎或重新下载，重启不会自动恢复。</p>}
      {status && !status.bundledAvailable && <p className="hint">内置恢复包不可用，请修复安装包或选择重新下载引擎。</p>}
      {status?.message && <p className="hint">{status.message}</p>}
      {status?.downloadKind && <div>
        <p className="hint">正在下载{status.downloadKind === "engine" ? "推理引擎" : "模型文件"}：{(status.downloaded / 1024 ** 2).toFixed(1)} / {(status.total / 1024 ** 2).toFixed(1)} MiB</p>
        <progress aria-label="下载进度" max={status.total} value={status.downloaded} />
      </div>}
    </div>
    <div className="profile-actions">
      <button type="button" className="secondary-btn" disabled={engineBusy || !status?.bundledAvailable} onClick={() => void perform("正在恢复内置引擎…", async () => {
        await invoke("install_local_engine");
        setStatus(await invoke<Status>("get_local_model_status"));
      })}>恢复内置引擎</button>
      <button type="button" className="text-action danger-action" disabled={engineBusy || status?.engine === "removed"} onClick={() => {
        if (!window.confirm("删除后将暂停本地推理，不会删除模型；安装包内置恢复包仍保留。\n删除后需手动恢复，重启不会自动安装。")) return;
        void perform("正在删除引擎，等待当前本地请求结束…", async () => {
          await invoke("remove_local_engine");
          setStatus(await invoke<Status>("get_local_model_status"));
        });
      }}>删除引擎</button>
      <button type="button" className="text-action" disabled={engineBusy} onClick={() => {
        if (!window.confirm(`将联网重新下载 ${status?.engineVersion} 引擎（约 31 MiB），并安装同一固定版本。\n下载失败将保留旧引擎。是否继续？`)) return;
        void perform("正在重新下载引擎…", async () => {
          await invoke("redownload_local_engine");
          setStatus(await invoke<Status>("get_local_model_status"));
        });
      }}>重新下载</button>
    </div>
    <p className="hint">引擎维护立即生效，无需保存设置；维护会等待当前本地请求结束。删除仅清理运行副本和下载缓存，保留内置恢复包与模型文件。</p>
    {working && <p className="hint" role="status">{working}</p>}
    {error && <p className="profile-result is-error" role="alert">{error}</p>}
  </div>;
}
