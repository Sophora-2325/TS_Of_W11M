use crate::config::{AuthMode, ConnectionProfile};
use crate::translate::Lang;
use futures_util::StreamExt;
use reqwest::{Client, RequestBuilder};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::time::{Duration, Instant};

pub struct CompatClient {
    client: Client,
    profile: ConnectionProfile,
    key: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerationTest { pub text: String, pub latency_ms: u128 }

#[derive(Deserialize)]
struct ModelList { data: Vec<ModelId> }
#[derive(Deserialize)]
struct ModelId { id: String }

#[derive(Default)]
struct SseDecoder {
    buffer: Vec<u8>,
    data: Vec<String>,
    event: String,
}

impl SseDecoder {
    fn push(&mut self, bytes: &[u8], eof: bool) -> Result<Vec<(String, String)>, String> {
        self.buffer.extend_from_slice(bytes);
        let mut events = Vec::new();
        while let Some(end) = self.buffer.iter().position(|b| *b == b'\n') {
            let line = self.buffer.drain(..=end).collect::<Vec<_>>();
            let line = std::str::from_utf8(&line).map_err(|_| "流式响应包含无效 UTF-8 字符")?;
            self.line(line.trim_end_matches(['\r', '\n']), &mut events);
        }
        if eof {
            let tail = std::mem::take(&mut self.buffer);
            let line = std::str::from_utf8(&tail).map_err(|_| "流式响应末尾包含不完整 UTF-8 字符")?;
            if !line.is_empty() { self.line(line.trim_end_matches('\r'), &mut events); }
            self.line("", &mut events);
        }
        Ok(events)
    }

    fn line(&mut self, line: &str, events: &mut Vec<(String, String)>) {
        if line.is_empty() {
            if !self.data.is_empty() || self.event == "error" {
                events.push((std::mem::take(&mut self.event), self.data.join("\n")));
            }
            self.data.clear();
            self.event.clear();
        } else if let Some(data) = line.strip_prefix("data:") {
            self.data.push(data.strip_prefix(' ').unwrap_or(data).to_string());
        } else if let Some(event) = line.strip_prefix("event:") {
            self.event = event.trim().to_string();
        }
    }
}

#[derive(Default)]
struct Completion {
    text: String,
    done: bool,
    reasoning: bool,
}

impl Completion {
    fn consume(&mut self, event: &str, data: &str, on_chunk: &mut impl FnMut(String)) -> Result<(), String> {
        if event == "error" { return Err("服务返回流式错误".into()); }
        if data.trim() == "[DONE]" { self.done = true; return Ok(()); }
        let value: Value = serde_json::from_str(data).map_err(|_| "流式响应 JSON 无法解析")?;
        if value.get("error").is_some() { return Err("服务返回错误，请检查模型和服务日志".into()); }
        let Some(choice) = value.get("choices").and_then(Value::as_array).and_then(|v| v.first()) else { return Ok(()); };
        check_finish(choice)?;
        if choice.get("finish_reason").and_then(Value::as_str).is_some_and(|s| !s.is_empty()) { self.done = true; }
        if let Some(delta) = choice.get("delta") {
            self.reasoning |= delta.get("reasoning_content").and_then(Value::as_str).is_some_and(|s| !s.is_empty());
            if let Some(text) = delta.get("content").and_then(Value::as_str) {
                self.text.push_str(text);
                on_chunk(text.to_string());
            }
        }
        Ok(())
    }

    fn finish(self) -> Result<String, String> {
        if !self.done { return Err("流式响应未正常结束，结果未缓存；可关闭流式后重试".into()); }
        nonempty(self.text, self.reasoning)
    }
}

fn check_finish(choice: &Value) -> Result<(), String> {
    match choice.get("finish_reason").and_then(Value::as_str) {
        Some("length") => Err("模型输出被长度限制截断，结果未缓存".into()),
        Some("content_filter") => Err("服务过滤了本次输出".into()),
        _ => Ok(()),
    }
}

fn nonempty(text: String, reasoning: bool) -> Result<String, String> {
    if !text.trim().is_empty() { Ok(text.trim().to_string()) }
    else if reasoning { Err("模型只返回推理内容，没有正文".into()) }
    else { Err("服务返回空内容".into()) }
}

fn parse_response(value: Value) -> Result<String, String> {
    if value.get("error").is_some() { return Err("服务返回错误，请检查模型和服务日志".into()); }
    let choice = value.get("choices").and_then(Value::as_array).and_then(|v| v.first()).ok_or("响应缺少 choices")?;
    check_finish(choice)?;
    let message = choice.get("message").ok_or("响应缺少 message")?;
    nonempty(message.get("content").and_then(Value::as_str).unwrap_or("").to_string(),
        message.get("reasoning_content").and_then(Value::as_str).is_some_and(|s| !s.is_empty()))
}

impl CompatClient {
    // Callers validate unknown configuration at their command boundary before constructing this client.
    pub fn new(profile: ConnectionProfile, key: Option<String>) -> Result<Self, String> {
        if profile.auth_mode == AuthMode::Bearer && key.is_none() {
            return Err(format!("方案「{}」尚未配置 Bearer API Key", profile.name));
        }
        let url = reqwest::Url::parse(&profile.base_url).map_err(|_| "服务地址无效")?;
        let mut builder = Client::builder().connect_timeout(Duration::from_secs(5))
            .timeout(Duration::from_secs(profile.request_timeout_secs));
        if is_loopback(&url) { builder = builder.no_proxy(); }
        let client = builder.build().map_err(|_| "无法创建 HTTP 客户端")?;
        Ok(Self { client, profile, key })
    }

    fn request(&self, method: reqwest::Method, suffix: &str) -> RequestBuilder {
        let request = self.client.request(method, format!("{}{suffix}", self.profile.base_url));
        if self.profile.auth_mode == AuthMode::Bearer {
            request.bearer_auth(self.key.as_deref().unwrap_or_default())
        } else { request }
    }

    fn error(&self, error: impl std::fmt::Display) -> String {
        let local = matches!(self.profile.preset, crate::config::ServicePreset::Lmstudio | crate::config::ServicePreset::Ollama)
            || reqwest::Url::parse(&self.profile.base_url).is_ok_and(|u| is_loopback(&u));
        let detail = error.to_string();
        let detail = if let Some(key) = self.key.as_deref().filter(|s| !s.is_empty()) { detail.replace(key, "[密钥已隐藏]") } else { detail };
        format!("方案「{}」({})：{}{}", self.profile.name, self.profile.base_url, detail,
            if local { "；请检查本地服务是否启动、模型是否可用" } else { "" })
    }

    fn network_error(&self, error: reqwest::Error) -> String {
        self.error(if error.is_timeout() { format!("请求超时（{} 秒）", self.profile.request_timeout_secs) }
            else { "无法连接服务或读取响应，请检查地址、端口及网络".into() })
    }

    async fn checked(&self, response: reqwest::Response) -> Result<reqwest::Response, String> {
        let status = response.status();
        if status.is_success() { return Ok(response); }
        // Never echo arbitrary server bodies: proxies can include request headers or API keys.
        let body = response.text().await.unwrap_or_default().to_lowercase();
        let model_error = ["model not found", "model not loaded", "unknown model", "does not exist"].iter().any(|s| body.contains(s));
        let message = if model_error { "模型不可用，请检查模型标识并在服务中加载模型" } else {
            match status.as_u16() {
                401 | 403 => "认证或权限失败，请检查认证方式和 API Key",
                402 => "服务账户余额或额度不足",
                404 => "接口不存在，请检查基础地址及 /v1 路径",
                429 => "服务限流或额度不足，请稍后重试",
                500..=599 => "服务端错误，请检查服务日志",
                _ => "服务拒绝请求，请检查模型及参数",
            }
        };
        Err(self.error(format!("HTTP {status}：{message}")))
    }

    pub async fn list_models(&self) -> Result<Vec<String>, String> {
        let response = self.request(reqwest::Method::GET, "/models").send().await.map_err(|e| self.network_error(e))?;
        let response = self.checked(response).await?;
        let list: ModelList = response.json().await.map_err(|_| self.error("模型列表格式无法解析"))?;
        let mut models = Vec::new();
        for item in list.data { if !models.contains(&item.id) { models.push(item.id); } }
        Ok(models)
    }

    async fn chat(&self, body: Value, mut on_chunk: impl FnMut(String)) -> Result<String, String> {
        let response = self.request(reqwest::Method::POST, "/chat/completions").json(&body).send().await.map_err(|e| self.network_error(e))?;
        let response = self.checked(response).await?;
        let is_json = response.headers().get(reqwest::header::CONTENT_TYPE).and_then(|v| v.to_str().ok()).is_some_and(|v| v.contains("application/json"));
        if body["stream"] == false || is_json {
            let value = response.json().await.map_err(|_| self.error("响应 JSON 无法解析"))?;
            let text = parse_response(value).map_err(|e| self.error(e))?;
            on_chunk(text.clone());
            return Ok(text);
        }
        let mut stream = response.bytes_stream();
        let mut decoder = SseDecoder::default();
        let mut completion = Completion::default();
        while let Some(chunk) = stream.next().await {
            let chunk = chunk.map_err(|e| self.network_error(e))?;
            for (event, data) in decoder.push(&chunk, false).map_err(|e| self.error(e))? {
                completion.consume(&event, &data, &mut on_chunk).map_err(|e| self.error(e))?;
                if data.trim() == "[DONE]" { return completion.finish().map_err(|e| self.error(e)); }
            }
        }
        for (event, data) in decoder.push(&[], true).map_err(|e| self.error(e))? {
            completion.consume(&event, &data, &mut on_chunk).map_err(|e| self.error(e))?;
        }
        completion.finish().map_err(|e| self.error(e))
    }

    pub async fn translate_stream(&self, text: &str, target: Lang, on_chunk: impl FnMut(String)) -> Result<String, String> {
        self.chat(json!({"model": self.profile.model, "stream": self.profile.stream, "temperature": 0.3,
            "messages": [{"role":"system", "content":self.profile.translation_prompt.replace("{{language}}", target.prompt_name())},
                {"role":"user", "content":format!("Translate the following text to {}:\n{text}", target.prompt_name())}]}), on_chunk).await
    }

    pub async fn explain_word_in_context_stream(&self, sentence: &str, word: &str, language: Lang, on_chunk: impl FnMut(String)) -> Result<String, String> {
        self.chat(json!({"model":self.profile.model, "stream":self.profile.stream, "temperature":0.4,
            "messages":[{"role":"system", "content":self.profile.lookup_prompt.replace("{{language}}", language.prompt_name())},
                {"role":"user", "content":format!("Sentence: \"{sentence}\"\nWord/phrase: \"{word}\"")}]}), on_chunk).await
    }

    pub async fn test_generation(&self) -> Result<GenerationTest, String> {
        let start = Instant::now();
        let text = self.chat(json!({"model":self.profile.model, "stream":false, "max_tokens":256,
            "messages":[{"role":"user", "content":"Translate this short English sentence into Chinese. Output only the translation: Hello, adventurer!"}]}), |_| {}).await?;
        Ok(GenerationTest { text, latency_ms: start.elapsed().as_millis() })
    }
}

fn is_loopback(url: &reqwest::Url) -> bool {
    let host = url.host_str().unwrap_or_default().trim_matches(['[', ']']);
    host.eq_ignore_ascii_case("localhost") || host.parse::<std::net::IpAddr>().is_ok_and(|ip| ip.is_loopback())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn compatible_http_models_auth_plain_and_streaming() {
        use std::io::{Read, Write};
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let server = std::thread::spawn(move || {
            let mut requests = Vec::new();
            for i in 0..5 {
                let (mut socket, _) = listener.accept().unwrap();
                socket.set_read_timeout(Some(Duration::from_secs(5))).unwrap();
                let mut bytes = Vec::new();
                let mut chunk = [0u8; 2048];
                loop {
                    let count = socket.read(&mut chunk).unwrap();
                    assert!(count > 0);
                    bytes.extend_from_slice(&chunk[..count]);
                    if let Some(end) = bytes.windows(4).position(|w| w == b"\r\n\r\n") {
                        let header = String::from_utf8_lossy(&bytes[..end]).to_lowercase();
                        let length = header.lines().find_map(|l| l.strip_prefix("content-length: ")).and_then(|v| v.parse::<usize>().ok()).unwrap_or(0);
                        if bytes.len() >= end + 4 + length { break; }
                    }
                }
                requests.push(String::from_utf8(bytes).unwrap());
                let (kind, body) = match i {
                    0 => ("application/json", r#"{"data":[{"id":"local"},{"id":"local"}]}"#),
                    1 | 3 => ("application/json", r#"{"choices":[{"message":{"content":"你好"},"finish_reason":"stop"}]}"#),
                    4 => ("application/json", r#"{"error":{"message":"invalid fake-key"}}"#),
                    _ => ("text/event-stream", "data: {\"choices\":[{\"delta\":{\"content\":\"冒険者\"}}]}\n\ndata: {\"choices\":[{\"delta\":{},\"finish_reason\":\"stop\"}]}\n\ndata: [DONE]\n\n"),
                };
                let status = if i == 4 { "401 Unauthorized" } else { "200 OK" };
                write!(socket, "HTTP/1.1 {status}\r\nContent-Type: {kind}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}", body.len()).unwrap();
            }
            requests
        });
        let mut profile = ConnectionProfile { base_url: format!("http://{address}/custom/v1"), auth_mode: AuthMode::None, model:"local".into(), ..Default::default() };
        let client = CompatClient::new(profile.clone(), None).unwrap();
        assert_eq!(client.list_models().await.unwrap(), vec!["local"]);
        assert_eq!(client.test_generation().await.unwrap().text, "你好");
        profile.auth_mode = AuthMode::Bearer;
        assert!(CompatClient::new(profile.clone(), None).is_err());
        let client = CompatClient::new(profile.clone(), Some("fake-key".into())).unwrap();
        let mut chunks = String::new();
        assert_eq!(client.translate_stream("adventurer", Lang::Zh, |s| chunks.push_str(&s)).await.unwrap(), "冒険者");
        assert_eq!(chunks, "冒険者");
        profile.stream = false;
        let client = CompatClient::new(profile, Some("fake-key".into())).unwrap();
        assert_eq!(client.translate_stream("hello", Lang::Zh, |_| {}).await.unwrap(), "你好");
        let error = client.list_models().await.unwrap_err();
        assert!(error.contains("认证"));
        assert!(!error.contains("fake-key"));
        let requests = server.join().unwrap();
        assert!(requests[0].starts_with("GET /custom/v1/models"));
        assert!(!requests[0].to_lowercase().contains("authorization:"));
        assert!(!requests[1].to_lowercase().contains("authorization:"));
        assert!(requests[2].to_lowercase().contains("authorization: bearer fake-key"));
        assert!(requests[2].starts_with("POST /custom/v1/chat/completions"));
        assert!(requests[3].contains("\"stream\":false"));
    }

    #[test]
    fn sse_preserves_every_utf8_boundary_and_requires_completion() {
        let event = "data:{\"choices\":[{\"delta\":{\"content\":\"你好、冒険者\"}}]}\r\n\r\ndata: [DONE]\n\n";
        for split in 0..=event.len() {
            let mut decoder = SseDecoder::default();
            let mut completion = Completion::default();
            for bytes in [&event.as_bytes()[..split], &event.as_bytes()[split..]] {
                for (kind, data) in decoder.push(bytes, false).unwrap() {
                    completion.consume(&kind, &data, &mut |_| {}).unwrap();
                }
            }
            assert_eq!(completion.finish().unwrap(), "你好、冒険者");
        }
        assert!(Completion { text:"partial".into(), ..Default::default() }.finish().is_err());
        assert!(SseDecoder::default().push(b"data: \xff\n", false).is_err());
        assert!(SseDecoder::default().push(&[0xe4], true).is_err());
    }

    #[test]
    fn sse_tail_multiline_heartbeat_and_errors() {
        let events = SseDecoder::default().push(b":heartbeat\n\nevent: message\ndata: {\ndata: \"choices\": []}\n\ndata:[DONE]", true).unwrap();
        assert_eq!(events[0], ("message".into(), "{\n\"choices\": []}".into()));
        assert_eq!(events[1].1, "[DONE]");
        let mut completion = Completion::default();
        assert!(completion.consume("error", "oops", &mut |_| {}).is_err());
        assert!(completion.consume("", "not-json", &mut |_| {}).is_err());
        assert!(completion.consume("", r#"{"choices":[{"finish_reason":"length"}]}"#, &mut |_| {}).is_err());
        assert!(parse_response(json!({"choices":[{"message":{"content":null,"reasoning_content":"think"}}]})).is_err());
    }
}
