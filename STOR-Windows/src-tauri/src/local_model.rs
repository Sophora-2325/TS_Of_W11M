use crate::{
    config::{ComputeMode, ConnectionProfile, LocalModelConfig, ServicePreset},
    local_download as files,
};
use serde::Serialize;
use std::{
    collections::VecDeque,
    io::{BufRead, BufReader},
    os::windows::{io::OwnedHandle, process::CommandExt},
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    time::{Duration, Instant},
};
use tauri::{AppHandle, Emitter};
use tokio::sync::{Mutex as AsyncMutex, OwnedMutexGuard};

pub const ENGINE_VERSION: &str = "b11669-vulkan-x64";

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalStatus {
    pub engine: String,
    pub engine_version: String,
    pub bundled_available: bool,
    pub model: String,
    pub message: String,
    pub download_kind: Option<String>,
    pub downloaded: u64,
    pub total: u64,
    pub pid: Option<u32>,
}

struct Worker {
    child: Child,
    _job: OwnedHandle,
    config: LocalModelConfig,
    base_url: String,
}
impl Drop for Worker {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

struct Inner {
    // A lease covers a whole generation. Switching and cloud release wait for it.
    gate: Arc<AsyncMutex<()>>,
    downloads: AsyncMutex<()>,
    worker: Mutex<Option<Worker>>,
    desired: Mutex<Option<LocalModelConfig>>,
    status: Mutex<LocalStatus>,
    root: PathBuf,
    bundled_archive: PathBuf,
    exiting: AtomicBool,
}

#[derive(Clone)]
pub struct LocalModelService(Arc<Inner>);

enum EngineAction {
    Restore,
    Remove,
    Redownload,
}

pub struct LocalLease {
    _guard: OwnedMutexGuard<()>,
    service: LocalModelService,
    pub profile: ConnectionProfile,
    app: Option<AppHandle>,
}
impl Drop for LocalLease {
    fn drop(&mut self) {
        self.service.release_if_changed(self.app.as_ref());
    }
}

impl LocalModelService {
    pub fn new(bundled_archive: PathBuf) -> Self {
        Self::at(files::data_directory(), bundled_archive)
    }

    fn at(root: PathBuf, bundled_archive: PathBuf) -> Self {
        let parent = root.join("engines/llama.cpp");
        let directory = parent.join(ENGINE_VERSION);
        let installed =
            directory.join(".complete").is_file() && directory.join("llama-server.exe").is_file();
        let removed = parent.join(".removed").is_file();
        let bundled_available = bundled_archive.is_file();
        Self(Arc::new(Inner {
            gate: Arc::new(AsyncMutex::new(())),
            downloads: AsyncMutex::new(()),
            worker: Mutex::new(None),
            desired: Mutex::new(None),
            root,
            bundled_archive,
            exiting: AtomicBool::new(false),
            status: Mutex::new(LocalStatus {
                engine: if removed {
                    "removed"
                } else if installed {
                    "ready"
                } else {
                    "missing"
                }
                .into(),
                engine_version: ENGINE_VERSION.into(),
                bundled_available,
                model: "unloaded".into(),
                message: String::new(),
                download_kind: None,
                downloaded: 0,
                total: 0,
                pid: None,
            }),
        }))
    }

    pub fn status(&self) -> LocalStatus {
        self.0.status.lock().unwrap().clone()
    }

    fn update(&self, app: Option<&AppHandle>, f: impl FnOnce(&mut LocalStatus)) {
        let status = {
            let mut status = self.0.status.lock().unwrap();
            f(&mut status);
            status.clone()
        };
        if let Some(app) = app {
            let _ = app.emit("local-model-status", status);
        }
    }

    fn progress(&self, app: Option<&AppHandle>, kind: &str, received: u64, total: u64) {
        self.update(app, |s| {
            s.download_kind = Some(kind.into());
            s.downloaded = received;
            s.total = total;
        });
    }

    pub fn set_desired(&self, profile: &ConnectionProfile) {
        *self.0.desired.lock().unwrap() = if profile.preset == ServicePreset::Local {
            profile.local.clone()
        } else {
            None
        };
    }

    pub fn reconcile(&self, app: AppHandle, profile: &ConnectionProfile) {
        self.set_desired(profile);
        let service = self.clone();
        tauri::async_runtime::spawn(async move {
            let _guard = service.0.gate.lock().await;
            service.release_if_changed(Some(&app));
        });
    }

    fn stop(&self, app: Option<&AppHandle>) {
        let worker = self.0.worker.lock().unwrap().take();
        if worker.is_some() {
            self.update(app, |s| {
                s.model = "stopping".into();
            });
            drop(worker);
        }
        self.update(app, |s| {
            s.model = "unloaded".into();
            s.pid = None;
        });
    }

    fn release_if_changed(&self, app: Option<&AppHandle>) {
        let desired = self.0.desired.lock().unwrap().clone();
        let same = self
            .0
            .worker
            .lock()
            .unwrap()
            .as_ref()
            .is_none_or(|w| Some(&w.config) == desired.as_ref());
        if !same {
            self.stop(app);
        }
    }

    pub fn shutdown(&self) {
        self.0.exiting.store(true, Ordering::SeqCst);
        self.stop(None);
    }

    fn engine_parent(&self) -> PathBuf {
        self.0.root.join("engines/llama.cpp")
    }

    fn engine_installed(&self) -> bool {
        let directory = self.engine_parent().join(ENGINE_VERSION);
        directory.join(".complete").is_file() && directory.join("llama-server.exe").is_file()
    }

    pub fn check_enabled(&self) -> Result<(), String> {
        if self.engine_parent().join(".removed").exists() {
            return Err("引擎已删除，本地推理已暂停。请在设置中恢复内置引擎或重新下载".into());
        }
        Ok(())
    }

    // Called with the generation lease held. Normal use never falls back to the network.
    async fn ensure_engine(&self, app: Option<&AppHandle>) -> Result<PathBuf, String> {
        self.check_enabled()?;
        if !self.engine_installed() {
            let _downloads = self.0.downloads.lock().await;
            self.update(app, |s| {
                s.engine = "installing".into();
                s.message = "正在从内置包离线部署推理引擎…".into();
            });
            let result = self
                .deploy_engine(app, &files::catalog().engine, false)
                .await;
            self.finish_maintenance(app, &result, "内置引擎已离线部署");
            result?;
        }
        Ok(self
            .engine_parent()
            .join(ENGINE_VERSION)
            .join("llama-server.exe"))
    }

    pub async fn install_engine(&self, app: Option<&AppHandle>) -> Result<PathBuf, String> {
        self.maintain_engine(app, EngineAction::Restore).await?;
        Ok(self
            .engine_parent()
            .join(ENGINE_VERSION)
            .join("llama-server.exe"))
    }

    pub async fn remove_engine(&self, app: Option<&AppHandle>) -> Result<(), String> {
        self.maintain_engine(app, EngineAction::Remove).await
    }

    pub async fn redownload_engine(&self, app: Option<&AppHandle>) -> Result<(), String> {
        self.maintain_engine(app, EngineAction::Redownload).await
    }

    async fn maintain_engine(
        &self,
        app: Option<&AppHandle>,
        action: EngineAction,
    ) -> Result<(), String> {
        let phase = match action {
            EngineAction::Restore => "installing",
            EngineAction::Remove => "deleting",
            EngineAction::Redownload => "downloading",
        };
        self.update(app, |s| {
            s.engine = phase.into();
            s.message = "等待当前本地请求完成后维护引擎…".into();
        });
        // Same ordering as prepare: generation gate, then download gate. No request counters needed.
        let _gate = self.0.gate.lock().await;
        let _downloads = self.0.downloads.lock().await;
        self.update(app, |s| {
            s.engine = phase.into();
        });
        let result = match action {
            EngineAction::Remove => {
                async {
                    let parent = self.engine_parent();
                    tokio::fs::create_dir_all(&parent)
                        .await
                        .map_err(|e| e.to_string())?;
                    // Persist pause before touching files; even a partial deletion must not auto-reinstall.
                    tokio::fs::write(parent.join(".removed"), b"user removed engine\n")
                        .await
                        .map_err(|e| e.to_string())?;
                    self.stop(app);
                    for suffix in [
                        "",
                        ".installing",
                        ".previous",
                        ".zip",
                        ".stor-download",
                        ".redownload.zip",
                        ".redownload.stor-download",
                    ] {
                        let path = parent.join(format!("{ENGINE_VERSION}{suffix}"));
                        if path.is_dir() {
                            tokio::fs::remove_dir_all(path)
                                .await
                                .map_err(|e| format!("引擎文件删除失败，请重试：{e}"))?;
                        } else if path.exists() {
                            tokio::fs::remove_file(path)
                                .await
                                .map_err(|e| format!("引擎缓存删除失败，请重试：{e}"))?;
                        }
                    }
                    Ok(())
                }
                .await
            }
            EngineAction::Restore => {
                self.deploy_engine(app, &files::catalog().engine, false)
                    .await
            }
            EngineAction::Redownload => {
                self.deploy_engine(app, &files::catalog().engine, true)
                    .await
            }
        };
        let message = match action {
            EngineAction::Remove => {
                "运行引擎与下载缓存已删除；内置恢复包和模型文件保留，请手动恢复后再使用"
            }
            EngineAction::Restore => "内置引擎已离线恢复，下次请求时加载模型",
            EngineAction::Redownload => "引擎已重新下载并部署，下次请求时加载模型",
        };
        self.finish_maintenance(app, &result, message);
        result
    }

    fn finish_maintenance(
        &self,
        app: Option<&AppHandle>,
        result: &Result<(), String>,
        success: &str,
    ) {
        let removed = self.engine_parent().join(".removed").is_file();
        let installed = self.engine_installed();
        self.update(app, |s| {
            s.download_kind = None;
            s.bundled_available = self.0.bundled_archive.is_file();
            s.engine = if result.is_err() {
                if installed && !removed {
                    "ready"
                } else {
                    "error"
                }
            } else if removed {
                "removed"
            } else {
                "ready"
            }
            .into();
            s.message = result
                .as_ref()
                .err()
                .cloned()
                .unwrap_or_else(|| success.into());
        });
    }

    // The engine asset comes from the bundled manifest (tests supply a loopback fixture).
    // Caller holds both gates, so a running EXE/DLL is stopped only after its replacement is ready.
    async fn deploy_engine(
        &self,
        app: Option<&AppHandle>,
        asset: &files::Asset,
        network: bool,
    ) -> Result<(), String> {
        let parent = self.engine_parent();
        tokio::fs::create_dir_all(&parent)
            .await
            .map_err(|e| e.to_string())?;
        let downloaded = parent.join(format!("{ENGINE_VERSION}.redownload.zip"));
        let result = async {
            let archive = if network {
                if downloaded.exists() {
                    tokio::fs::remove_file(&downloaded)
                        .await
                        .map_err(|e| e.to_string())?;
                }
                self.update(app, |s| {
                    s.message = "正在联网重新下载固定版本引擎；失败时保留旧引擎".into();
                });
                files::download(asset, &downloaded, |n, total| {
                    self.progress(app, "engine", n, total)
                })
                .await?;
                downloaded.clone()
            } else {
                let path = self.0.bundled_archive.clone();
                let expected = asset.clone();
                tokio::task::spawn_blocking(move || files::verify_file(&path, &expected))
                    .await
                    .map_err(|e| e.to_string())?
                    .map_err(|e| {
                        format!("内置引擎包缺失或校验失败，请修复安装或手动重新下载：{e}")
                    })?;
                self.0.bundled_archive.clone()
            };
            self.update(app, |s| {
                s.engine = "installing".into();
                s.download_kind = None;
                s.message = "正在解压并部署引擎…".into();
            });
            let staging = parent.join(format!("{ENGINE_VERSION}.installing"));
            if staging.exists() {
                tokio::fs::remove_dir_all(&staging)
                    .await
                    .map_err(|e| e.to_string())?;
            }
            let output = staging.clone();
            tokio::task::spawn_blocking(move || files::extract_engine(&archive, &output))
                .await
                .map_err(|e| e.to_string())??;
            if !staging.join(&asset.executable).is_file() {
                return Err("压缩包缺少 llama-server.exe，旧引擎未更改".into());
            }
            tokio::fs::write(staging.join(".complete"), &asset.sha256)
                .await
                .map_err(|e| e.to_string())?;
            self.stop(app);
            let directory = parent.join(ENGINE_VERSION);
            let backup = parent.join(format!("{ENGINE_VERSION}.previous"));
            if backup.exists() {
                tokio::fs::remove_dir_all(&backup)
                    .await
                    .map_err(|e| e.to_string())?;
            }
            let previous = directory.exists();
            if previous {
                tokio::fs::rename(&directory, &backup)
                    .await
                    .map_err(|e| format!("无法替换正在占用的引擎：{e}"))?;
            }
            if let Err(error) = tokio::fs::rename(&staging, &directory).await {
                if previous {
                    tokio::fs::rename(&backup, &directory)
                        .await
                        .map_err(|restore| {
                            format!(
                                "引擎部署失败：{error}；原引擎保留在 {}，恢复失败：{restore}",
                                backup.display()
                            )
                        })?;
                }
                return Err(format!("引擎部署失败，已保留原引擎：{error}"));
            }
            if parent.join(".removed").exists() {
                tokio::fs::remove_file(parent.join(".removed"))
                    .await
                    .map_err(|e| e.to_string())?;
            }
            if previous {
                tokio::fs::remove_dir_all(backup)
                    .await
                    .map_err(|e| format!("引擎已安装，但旧副本清理失败：{e}"))?;
            }
            Ok(())
        }
        .await;
        if network {
            let _ = tokio::fs::remove_file(downloaded).await;
        }
        result
    }

    pub async fn download_model(
        &self,
        app: Option<&AppHandle>,
        id: String,
        directory: String,
        reuse: bool,
    ) -> Result<String, String> {
        let asset = files::catalog()
            .models
            .into_iter()
            .find(|a| a.id == id)
            .ok_or("推荐模型不存在")?;
        let directory = PathBuf::from(directory);
        if !directory.is_absolute() {
            return Err("请选择完整的模型保存目录".into());
        }
        let _guard = self.0.downloads.lock().await;
        let destination = directory.join(&asset.file_name);
        let result = async {
            if destination.exists() {
                if !reuse {
                    return Err("目标文件已存在，请选择直接复用，或更换保存位置".into());
                }
                self.update(app, |s| {
                    s.message = "正在校验已有模型，不会重新下载".into();
                });
                let path = destination.clone();
                let expected = asset.clone();
                tokio::task::spawn_blocking(move || files::verify_file(&path, &expected))
                    .await
                    .map_err(|e| e.to_string())??;
            } else {
                if reuse {
                    return Err("目标文件已不存在，请重新检查保存位置".into());
                }
                tokio::fs::create_dir_all(&directory)
                    .await
                    .map_err(|e| e.to_string())?;
                files::download(&asset, &destination, |n, total| {
                    self.progress(app, "model", n, total)
                })
                .await?;
            }
            Ok(destination.to_string_lossy().into_owned())
        }
        .await;
        self.update(app, |s| {
            s.download_kind = None;
            s.message = result
                .as_ref()
                .err()
                .cloned()
                .unwrap_or_else(|| "模型已准备好，保存设置后生效".into());
        });
        result
    }

    pub async fn acquire(
        &self,
        app: Option<&AppHandle>,
        mut profile: ConnectionProfile,
    ) -> Result<LocalLease, String> {
        let guard = self.0.gate.clone().lock_owned().await;
        let config = profile
            .local
            .clone()
            .expect("local profile validated at ingress");
        let result = self.prepare(app, &config).await;
        match result {
            Ok(base_url) => {
                profile.base_url = base_url;
                Ok(LocalLease {
                    _guard: guard,
                    service: self.clone(),
                    profile,
                    app: app.cloned(),
                })
            }
            Err(error) => {
                self.stop(app);
                self.update(app, |s| {
                    s.model = "error".into();
                    s.message = error.clone();
                });
                Err(error)
            }
        }
    }

    async fn prepare(
        &self,
        app: Option<&AppHandle>,
        config: &LocalModelConfig,
    ) -> Result<String, String> {
        {
            let mut worker = self.0.worker.lock().unwrap();
            if let Some(w) = worker.as_mut() {
                if w.config == *config && w.child.try_wait().map_err(|e| e.to_string())?.is_none() {
                    return Ok(w.base_url.clone());
                }
            }
        }
        self.stop(app);
        files::validate_model(std::path::Path::new(&config.model_path))?;
        let executable = self.ensure_engine(app).await?;
        let listener = std::net::TcpListener::bind(("127.0.0.1", 0)).map_err(|e| e.to_string())?;
        let port = listener.local_addr().map_err(|e| e.to_string())?.port();
        drop(listener);
        let logs = Arc::new(Mutex::new(VecDeque::<String>::new()));
        let base_url = format!("http://127.0.0.1:{port}/v1");
        {
            let mut worker = self.0.worker.lock().unwrap();
            if self.0.exiting.load(Ordering::SeqCst) {
                return Err("STOR 正在退出".into());
            }
            let mut child = Command::new(&executable)
                .args([
                    "--host",
                    "127.0.0.1",
                    "--port",
                    &port.to_string(),
                    "--alias",
                    "stor-local",
                    "--ctx-size",
                    &config.context_length.to_string(),
                    "--gpu-layers",
                    if config.compute == ComputeMode::Gpu {
                        "99"
                    } else {
                        "0"
                    },
                ])
                .arg("--model")
                .arg(&config.model_path)
                .current_dir(executable.parent().unwrap())
                .stdin(Stdio::null())
                .stdout(Stdio::null())
                .stderr(Stdio::piped())
                .creation_flags(0x08000000)
                .spawn()
                .map_err(|e| format!("推理引擎无法启动：{e}。请重新安装引擎或检查系统运行库"))?;
            let job = match crate::process::own_process(&child) {
                Ok(job) => job,
                Err(error) => {
                    let _ = child.kill();
                    let _ = child.wait();
                    return Err(error);
                }
            };
            let stderr = child.stderr.take().unwrap();
            let log_sink = logs.clone();
            std::thread::spawn(move || {
                for line in BufReader::new(stderr).lines().map_while(Result::ok) {
                    let mut logs = log_sink.lock().unwrap();
                    if logs.len() == 12 {
                        logs.pop_front();
                    }
                    logs.push_back(line.chars().take(500).collect());
                }
            });
            let pid = child.id();
            *worker = Some(Worker {
                child,
                _job: job,
                config: config.clone(),
                base_url: base_url.clone(),
            });
            self.update(app, |s| {
                s.model = "loading".into();
                s.pid = Some(pid);
                s.message = "正在加载模型…".into();
            });
        }
        let client = reqwest::Client::builder()
            .no_proxy()
            .timeout(Duration::from_secs(2))
            .build()
            .map_err(|e| e.to_string())?;
        let start = Instant::now();
        loop {
            let exited = self
                .0
                .worker
                .lock()
                .unwrap()
                .as_mut()
                .and_then(|w| w.child.try_wait().ok())
                .flatten();
            if exited.is_some() || self.0.exiting.load(Ordering::SeqCst) {
                return Err(format!("模型加载失败或进程已退出。请检查模型是否受支持；GPU 模式可改为仅 CPU 后重试。\n{}", logs.lock().unwrap().iter().cloned().collect::<Vec<_>>().join("\n")));
            }
            if start.elapsed() >= Duration::from_secs(120) {
                return Err(
                    "模型加载超过 120 秒，请检查模型大小及可用内存，或尝试仅 CPU 模式".into(),
                );
            }
            if client
                .get(format!("http://127.0.0.1:{port}/health"))
                .send()
                .await
                .is_ok_and(|r| r.status().is_success())
            {
                break;
            }
            tokio::time::sleep(Duration::from_millis(200)).await;
        }
        self.update(app, |s| {
            s.model = "ready".into();
            s.message = "本地模型已就绪".into();
        });
        Ok(base_url)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        config::tests::TestDirectory,
        translate::{CompatClient, Lang},
    };

    fn profile(path: String) -> ConnectionProfile {
        let mut p = ConnectionProfile {
            preset: ServicePreset::Local,
            local: Some(LocalModelConfig {
                model_path: path,
                compute: ComputeMode::Gpu,
                context_length: 4096,
            }),
            ..Default::default()
        };
        p.normalize(true).unwrap();
        p
    }

    #[tokio::test]
    async fn invalid_model_fails_before_engine_download_and_keeps_existing_file() {
        let folder = TestDirectory::new();
        let service = LocalModelService::at(folder.0.join("runtime"), folder.0.join("missing.zip"));
        let p = profile(folder.0.join("missing.gguf").to_string_lossy().into());
        assert!(service.acquire(None, p).await.is_err());
        assert!(!folder.0.join("runtime").exists());
        assert_eq!(service.status().engine, "missing");
        let asset = files::catalog().models.remove(0);
        let existing = folder.0.join(&asset.file_name);
        std::fs::write(&existing, b"GGUFexisting").unwrap();
        for reuse in [false, true] {
            assert!(service
                .download_model(
                    None,
                    asset.id.clone(),
                    folder.0.to_string_lossy().into(),
                    reuse
                )
                .await
                .is_err());
            assert_eq!(std::fs::read(&existing).unwrap(), b"GGUFexisting");
        }
    }

    #[tokio::test]
    async fn model_switch_waits_for_request_lease_and_stops_owned_worker() {
        let folder = TestDirectory::new();
        let service = LocalModelService::at(folder.0.clone(), folder.0.join("missing.zip"));
        let p = profile(folder.0.join("existing.gguf").to_string_lossy().into());
        let config = p.local.clone().unwrap();
        let mut child = Command::new("powershell.exe")
            .args(["-NoProfile", "-Command", "Start-Sleep -Seconds 30"])
            .creation_flags(0x08000000)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .unwrap();
        let job = match crate::process::own_process(&child) {
            Ok(job) => job,
            Err(e) => {
                let _ = child.kill();
                panic!("{e}");
            }
        };
        *service.0.worker.lock().unwrap() = Some(Worker {
            child,
            _job: job,
            config,
            base_url: "http://127.0.0.1:1/v1".into(),
        });
        service.set_desired(&p);
        let lease = service.acquire(None, p).await.unwrap();
        service.set_desired(&ConnectionProfile::default());
        assert!(
            tokio::time::timeout(Duration::from_millis(20), service.0.gate.lock())
                .await
                .is_err()
        );
        assert!(service.0.worker.lock().unwrap().is_some());
        drop(lease);
        assert!(service.0.worker.lock().unwrap().is_none());
        assert!(
            tokio::time::timeout(Duration::from_secs(1), service.0.gate.lock())
                .await
                .is_ok()
        );
    }

    #[tokio::test]
    async fn bundled_engine_is_offline_reused_removed_and_restored() {
        let folder = TestDirectory::new();
        let bundled = folder.0.join("bundled.zip");
        std::fs::copy(
            PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("resources/llama.cpp/b11669-vulkan-x64.zip"),
            &bundled,
        )
        .unwrap();
        let root = folder.0.join("runtime");
        let service = LocalModelService::at(root.clone(), bundled.clone());
        let model = root.join("models/existing.gguf");
        std::fs::create_dir_all(model.parent().unwrap()).unwrap();
        std::fs::write(&model, b"GGUFexisting-model").unwrap();
        let exe = service.install_engine(None).await.unwrap();
        assert!(exe.is_file());
        assert_eq!(service.status().engine, "ready");
        assert_eq!(service.status().downloaded, 0);
        // The already-deployed engine must work even if its bundled source is temporarily absent.
        let hidden = bundled.with_extension("hidden");
        std::fs::rename(&bundled, &hidden).unwrap();
        assert_eq!(service.ensure_engine(None).await.unwrap(), exe);
        std::fs::rename(hidden, &bundled).unwrap();
        let cache = service
            .engine_parent()
            .join(format!("{ENGINE_VERSION}.zip"));
        std::fs::write(&cache, b"obsolete cache").unwrap();
        service.remove_engine(None).await.unwrap();
        assert!(!exe.exists());
        assert!(!cache.exists());
        assert!(bundled.exists());
        assert_eq!(std::fs::read(&model).unwrap(), b"GGUFexisting-model");
        let restarted = LocalModelService::at(root, bundled.clone());
        assert_eq!(restarted.status().engine, "removed");
        assert!(restarted
            .ensure_engine(None)
            .await
            .unwrap_err()
            .contains("引擎已删除"));
        restarted.install_engine(None).await.unwrap();
        assert_eq!(restarted.status().engine, "ready");
        assert!(!restarted.engine_parent().join(".removed").exists());
        files::verify_file(&bundled, &files::catalog().engine).unwrap();
    }

    #[tokio::test]
    async fn corrupt_bundle_and_failed_redownload_preserve_old_deployment() {
        use std::io::{Read, Write};
        let folder = TestDirectory::new();
        let bundle = folder.0.join("corrupt.zip");
        std::fs::write(&bundle, b"corrupt").unwrap();
        let service = LocalModelService::at(folder.0.join("runtime"), bundle);
        let directory = service.engine_parent().join(ENGINE_VERSION);
        std::fs::create_dir_all(&directory).unwrap();
        let exe = directory.join("llama-server.exe");
        std::fs::write(&exe, b"working-old-engine").unwrap();
        std::fs::write(directory.join(".complete"), b"old").unwrap();
        assert!(service.install_engine(None).await.is_err());
        assert_eq!(std::fs::read(&exe).unwrap(), b"working-old-engine");
        assert_eq!(service.status().engine, "ready");
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let server = std::thread::spawn(move || {
            for _ in 0..2 {
                let (mut socket, _) = listener.accept().unwrap();
                let mut request = [0; 4096];
                let _ = socket.read(&mut request);
                socket
                    .write_all(
                        b"HTTP/1.1 200 OK\r\nContent-Length: 3\r\nConnection: close\r\n\r\nbad",
                    )
                    .unwrap();
            }
        });
        let mut asset = files::catalog().engine;
        asset.url = format!("http://{address}");
        // First fail verification; then pass verification but fail ZIP extraction.
        for verified in [false, true] {
            if verified {
                use sha2::Digest;
                asset.size = 3;
                asset.sha256 = format!("{:x}", sha2::Sha256::digest(b"bad"));
            }
            let result = service.deploy_engine(None, &asset, true).await;
            assert!(result.is_err());
            assert_eq!(std::fs::read(&exe).unwrap(), b"working-old-engine");
            assert!(!service
                .engine_parent()
                .join(format!("{ENGINE_VERSION}.redownload.zip"))
                .exists());
        }
        server.join().unwrap();
    }

    #[tokio::test]
    async fn deletion_waits_for_generation_lease() {
        let folder = TestDirectory::new();
        let service = LocalModelService::at(folder.0.join("runtime"), folder.0.join("missing.zip"));
        let lease = service.0.gate.clone().lock_owned().await;
        let other = service.clone();
        let deletion = tokio::spawn(async move { other.remove_engine(None).await });
        tokio::time::sleep(Duration::from_millis(20)).await;
        assert!(!deletion.is_finished());
        assert!(!service.engine_parent().join(".removed").exists());
        drop(lease);
        deletion.await.unwrap().unwrap();
        assert_eq!(service.status().engine, "removed");
    }

    #[tokio::test]
    #[ignore = "Explicit real-model smoke; fresh offline bundled deployment, no model download"]
    async fn real_gguf_smoke() {
        let model = std::env::var("STOR_SMOKE_MODEL")
            .expect("STOR_SMOKE_MODEL must point to an existing GGUF");
        let folder = TestDirectory::new();
        let service = LocalModelService::at(
            folder.0.join("runtime"),
            PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("resources/llama.cpp/b11669-vulkan-x64.zip"),
        );
        let p = profile(model);
        service.set_desired(&p);
        let lease = service.acquire(None, p.clone()).await.unwrap();
        let pid = service.status().pid.unwrap();
        let client = CompatClient::new(lease.profile.clone(), None).unwrap();
        let translation = client
            .translate_stream("Hello, adventurer!", Lang::Zh, |_| {})
            .await
            .unwrap();
        assert!(!translation.trim().is_empty());
        assert_eq!(service.status().downloaded, 0);
        println!("OFFLINE bundled engine PID {pid}; translation: {translation}");
        drop(lease);
        service.remove_engine(None).await.unwrap();
        assert!(service.0.worker.lock().unwrap().is_none());
        assert_eq!(service.status().engine, "removed");
        assert!(service.acquire(None, p).await.is_err());
        service.install_engine(None).await.unwrap();
        assert_eq!(service.status().engine, "ready");
        println!(
            "REAL active engine removed; automatic restore rejected; offline manual restore passed"
        );
    }
}
