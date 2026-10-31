use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader, Write};
use std::os::windows::io::OwnedHandle;
use crate::process::own_process;
use std::os::windows::process::CommandExt;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::{mpsc, Mutex};
use std::time::Duration;

const MODEL: &str = "PP-OCRv6 small";
const START_TIMEOUT: Duration = Duration::from_secs(60);
const OCR_TIMEOUT: Duration = Duration::from_secs(30);
const MAX_REPLY: usize = 512 * 1024;
const MAX_PNG: usize = 32 * 1024 * 1024;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OcrStatus {
    pub model: &'static str,
    pub state: &'static str,
    pub error: Option<String>,
}

pub struct OcrService {
    directory: PathBuf,
    worker: Mutex<Option<Worker>>,
    status: Mutex<OcrStatus>,
}

impl OcrService {
    pub fn new(directory: PathBuf) -> Self {
        Self {
            directory,
            worker: Mutex::new(None),
            status: Mutex::new(OcrStatus { model: MODEL, state: "starting", error: None }),
        }
    }

    pub fn status(&self) -> OcrStatus {
        self.status.lock().unwrap_or_else(|e| e.into_inner()).clone()
    }

    fn set_status(&self, state: &'static str, error: Option<String>) {
        *self.status.lock().unwrap_or_else(|e| e.into_inner()) = OcrStatus { model: MODEL, state, error };
    }

    fn ensure_worker<'a>(&self, slot: &'a mut Option<Worker>) -> Result<&'a mut Worker, String> {
        if slot.is_none() {
            self.set_status("starting", None);
            match Worker::spawn(&self.directory) {
                Ok(worker) => {
                    *slot = Some(worker);
                    self.set_status("ready", None);
                }
                Err(error) => {
                    self.set_status("error", Some(error.clone()));
                    return Err(error);
                }
            }
        }
        Ok(slot.as_mut().expect("worker initialized"))
    }

    pub fn prewarm(&self) -> Result<(), String> {
        let mut slot = self.worker.lock().map_err(|_| "OCR 服务状态异常".to_string())?;
        self.ensure_worker(&mut slot).map(|_| ())
    }

    pub fn recognize(&self, png: &[u8]) -> Result<String, String> {
        if png.is_empty() { return Err("截图数据为空".into()); }
        if png.len() > MAX_PNG { return Err("截图过大，请缩小选区".into()); }
        // Serialize requests so a late reply cannot be consumed by another capture.
        let mut slot = self.worker.lock().map_err(|_| "OCR 服务状态异常".to_string())?;
        let worker = self.ensure_worker(&mut slot)?;
        match worker.recognize(png) {
            Ok(text) => Ok(text),
            Err(WorkerError::Request(error)) => Err(error),
            Err(WorkerError::Transport(error)) => {
                // Drop kills the process; the next capture starts a fresh worker.
                *slot = None;
                self.set_status("error", Some(error.clone()));
                Err(error)
            }
        }
    }

    pub fn shutdown(&self) {
        if let Ok(mut slot) = self.worker.try_lock() { *slot = None; }
        // An in-flight process is also owned by a kill-on-close Windows job.
    }
}

enum WorkerError {
    Request(String),
    Transport(String),
}

struct Worker {
    child: Child,
    _job: OwnedHandle,
    requests: Option<mpsc::SyncSender<Vec<u8>>>,
    replies: mpsc::Receiver<Result<Vec<u8>, String>>,
    next_id: u64,
}

#[derive(Deserialize)]
struct Ready {
    protocol: u32,
    ready: bool,
    model: Option<String>,
    error: Option<String>,
}

#[derive(Deserialize)]
struct Reply {
    id: u64,
    ok: bool,
    text: Option<String>,
    code: Option<String>,
    error: Option<String>,
}

impl Worker {
    fn spawn(directory: &std::path::Path) -> Result<Self, String> {
        let executable = directory.join("stor-ocr.exe");
        if !executable.is_file() || !directory.join("models/manifest.json").is_file() {
            return Err("PP-OCRv6 small 组件未安装。开发环境请运行 npm run ocr:prepare；安装版请重新安装 STOR".into());
        }
        let mut child = Command::new(executable)
            .arg("--models").arg(directory.join("models"))
            .current_dir(directory)
            .stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::null())
            .creation_flags(0x08000000) // CREATE_NO_WINDOW; retain pipes for JSONL.
            .spawn().map_err(|e| format!("无法启动 PP-OCRv6 small: {e}"))?;
        let job = match own_process(&child) {
            Ok(job) => job,
            Err(error) => { let _ = child.kill(); let _ = child.wait(); return Err(error); }
        };
        let mut stdin = child.stdin.take().ok_or("OCR 输入管道创建失败")?;
        let stdout = child.stdout.take().ok_or("OCR 输出管道创建失败")?;
        let (tx, rx) = mpsc::sync_channel(2);
        let reader_tx = tx.clone();
        std::thread::spawn(move || {
            let mut reader = BufReader::new(stdout);
            loop {
                let packet = read_packet(&mut reader);
                let stop = packet.is_err();
                if reader_tx.send(packet).is_err() || stop { break; }
            }
        });
        let (requests, work) = mpsc::sync_channel::<Vec<u8>>(1);
        std::thread::spawn(move || {
            for packet in work {
                if stdin.write_all(&packet).and_then(|_| stdin.flush()).is_err() {
                    let _ = tx.send(Err("OCR 输入管道已断开".into()));
                    break;
                }
            }
        });
        let worker = Self { child, _job: job, requests: Some(requests), replies: rx, next_id: 1 };
        let packet = worker.receive(START_TIMEOUT)?;
        let ready: Ready = serde_json::from_slice(&packet).map_err(|_| "OCR 启动协议无效".to_string())?;
        if ready.protocol != 1 || !ready.ready || ready.model.as_deref() != Some(MODEL) {
            return Err(ready.error.unwrap_or_else(|| "OCR 组件版本不匹配，请重新安装 STOR".into()));
        }
        Ok(worker)
    }

    fn receive(&self, timeout: Duration) -> Result<Vec<u8>, String> {
        self.replies.recv_timeout(timeout).map_err(|error| match error {
            mpsc::RecvTimeoutError::Timeout => "OCR 响应超时，服务已停止，请重新框选重试".to_string(),
            mpsc::RecvTimeoutError::Disconnected => "OCR 服务已退出，请重新框选重试".to_string(),
        })?
    }

    fn recognize(&mut self, png: &[u8]) -> Result<String, WorkerError> {
        let id = self.next_id;
        self.next_id += 1;
        let mut packet = serde_json::to_vec(&serde_json::json!({ "id": id, "png": STANDARD.encode(png) }))
            .map_err(|_| WorkerError::Transport("OCR 请求编码失败".into()))?;
        packet.push(b'\n');
        self.requests.as_ref().ok_or_else(|| WorkerError::Transport("OCR 服务已停止".into()))?
            .try_send(packet).map_err(|_| WorkerError::Transport("OCR 服务未响应，请重新框选".into()))?;
        let reply = self.receive(OCR_TIMEOUT).map_err(WorkerError::Transport)?;
        decode_reply(&reply, id)
    }
}

impl Drop for Worker {
    fn drop(&mut self) {
        self.requests.take();
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

fn decode_reply(packet: &[u8], id: u64) -> Result<String, WorkerError> {
    let reply: Reply = serde_json::from_slice(packet)
        .map_err(|_| WorkerError::Transport("OCR 返回的数据无效".into()))?;
    if reply.id != id { return Err(WorkerError::Transport("OCR 请求编号不匹配".into())); }
    if !reply.ok {
        let error = reply.error.unwrap_or_else(|| "OCR 识别失败".into());
        return Err(if matches!(reply.code.as_deref(), Some("inference_failed")) {
            WorkerError::Transport(error)
        } else { WorkerError::Request(error) });
    }
    reply.text.filter(|text| !text.trim().is_empty())
        .ok_or_else(|| WorkerError::Transport("OCR 返回了空结果".into()))
}

fn read_packet(reader: &mut impl BufRead) -> Result<Vec<u8>, String> {
    let mut packet = Vec::new();
    loop {
        let available = reader.fill_buf().map_err(|_| "OCR 输出读取失败".to_string())?;
        if available.is_empty() { return Err("OCR 服务已退出，请重新框选重试".into()); }
        let newline = available.iter().position(|&byte| byte == b'\n');
        let count = newline.map_or(available.len(), |n| n + 1);
        if packet.len() + count > MAX_REPLY { return Err("OCR 返回的数据过大".into()); }
        packet.extend_from_slice(&available[..count]);
        reader.consume(count);
        if newline.is_some() { return Ok(packet); }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn replies_must_match_capture_and_contain_text() {
        assert_eq!(decode_reply(br#"{"id":7,"ok":true,"text":"hello"}"#, 7).ok(), Some("hello".into()));
        assert!(matches!(decode_reply(br#"{"id":6,"ok":true,"text":"old"}"#, 7), Err(WorkerError::Transport(_))));
        assert!(matches!(decode_reply(br#"{"id":7,"ok":true,"text":" "}"#, 7), Err(WorkerError::Transport(_))));
        assert!(matches!(decode_reply(b"not json", 7), Err(WorkerError::Transport(_))));
    }

    #[test]
    fn blank_image_keeps_worker_but_inference_failure_restarts_it() {
        assert!(matches!(decode_reply(br#"{"id":1,"ok":false,"code":"no_text","error":"empty"}"#, 1), Err(WorkerError::Request(_))));
        assert!(matches!(decode_reply(br#"{"id":1,"ok":false,"code":"inference_failed","error":"failed"}"#, 1), Err(WorkerError::Transport(_))));
    }

    #[test]
    fn pipe_reader_bounds_memory_and_rejects_partial_reply() {
        let mut input = std::io::Cursor::new(b"first\nsecond\n");
        assert_eq!(read_packet(&mut input).unwrap(), b"first\n");
        assert_eq!(read_packet(&mut input).unwrap(), b"second\n");
        assert!(read_packet(&mut std::io::Cursor::new(b"partial")).is_err());
        assert!(read_packet(&mut std::io::Cursor::new(vec![b'x'; MAX_REPLY + 1])).is_err());
    }

    #[test]
    fn missing_runtime_is_visible_and_retryable() {
        let service = OcrService::new(PathBuf::from("missing-stor-ocr-runtime"));
        assert!(service.prewarm().is_err());
        assert_eq!(service.status().state, "error");
        assert!(service.recognize(b"png").is_err());
        assert!(service.recognize(&[]).is_err());
    }

    #[test]
    #[ignore = "requires npm run ocr:prepare; performs real offline model inference"]
    fn packaged_worker_recognizes_en_zh_ja_and_restarts_after_exit() {
        let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let service = OcrService::new(root.join("resources/ocr"));
        service.prewarm().unwrap();
        assert_eq!(service.status().state, "ready");
        for (lang, expected) in [("en", "HelloadventurerQuestcomplete"), ("zh", "冒险者你好请接受新的任务"), ("ja", "冒険者よ新しい世界へ")] {
            let png = std::fs::read(root.join(format!("../audit/evidence/ocr-{lang}.png"))).unwrap();
            let text = service.recognize(&png).unwrap();
            assert_eq!(text.split_whitespace().collect::<String>(), expected, "fixture={lang}");
        }
        assert!(service.recognize(b"bad image").is_err());
        assert_eq!(service.status().state, "ready");
        // Simulate an unexpected worker crash; never consume its replies after restart.
        let first_pid = {
            let mut slot = service.worker.lock().unwrap();
            let worker = slot.as_mut().unwrap();
            let pid = worker.child.id();
            worker.child.kill().unwrap();
            worker.child.wait().unwrap();
            pid
        };
        let png = std::fs::read(root.join("../audit/evidence/ocr-en.png")).unwrap();
        assert!(service.recognize(&png).is_err());
        assert_eq!(service.status().state, "error");
        assert_eq!(service.recognize(&png).unwrap().split_whitespace().collect::<String>(), "HelloadventurerQuestcomplete");
        assert_ne!(service.worker.lock().unwrap().as_ref().unwrap().child.id(), first_pid);
        assert_eq!(service.status().state, "ready");
        service.shutdown();
        service.prewarm().unwrap();
        assert_eq!(service.status().state, "ready");
        service.shutdown();
    }
}
