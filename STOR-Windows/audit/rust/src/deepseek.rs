use crate::translate::Lang;
use futures_util::StreamExt;
use reqwest::Client;
use serde::{Deserialize, Serialize};

const DEEPSEEK_BASE_URL: &str = "http://127.0.0.1:19273";

#[derive(Clone)]
pub struct DeepSeekTranslator {
    client: Client,
    api_key: String,
    model: String,
}

#[derive(Serialize)]
struct ChatRequest {
    model: String,
    messages: Vec<ChatMessage>,
    stream: bool,
    temperature: f32,
}

#[derive(Serialize)]
struct ChatMessage {
    role: String,
    content: String,
}

#[derive(Deserialize)]
struct ChatResponse {
    choices: Vec<ChatChoice>,
}

#[derive(Deserialize)]
struct ChatChoice {
    message: ChatMessageResponse,
}

#[derive(Deserialize)]
struct ChatMessageResponse {
    content: String,
}

#[derive(Deserialize)]
struct StreamChunk {
    choices: Vec<StreamChoice>,
}

#[derive(Deserialize)]
struct StreamChoice {
    delta: StreamDelta,
}

#[derive(Deserialize)]
struct StreamDelta {
    content: Option<String>,
}

#[derive(Default)]
struct SseLines {
    buffer: Vec<u8>,
}

impl SseLines {
    fn push(&mut self, chunk: &[u8]) -> Result<Vec<String>, String> {
        self.buffer.extend_from_slice(chunk);
        let mut lines = Vec::new();
        let mut start = 0;
        for (end, byte) in self.buffer.iter().enumerate() {
            if *byte == b'\n' {
                let line = std::str::from_utf8(&self.buffer[start..end])
                    .map_err(|e| format!("流式响应包含无效的 UTF-8 字符: {e}"))?;
                lines.push(line.trim().to_string());
                start = end + 1;
            }
        }
        self.buffer.drain(..start);
        Ok(lines)
    }

    fn finish(&self) -> Result<(), String> {
        std::str::from_utf8(&self.buffer).map(|_| ())
            .map_err(|e| format!("流式响应末尾包含不完整或无效的 UTF-8 字符: {e}"))
    }
}

impl DeepSeekTranslator {
    pub fn new(api_key: String, model: String) -> Self {
        Self {
            client: Client::new(),
            api_key,
            model,
        }
    }

    fn build_messages(text: &str, target: Lang) -> Vec<ChatMessage> {
        vec![
            ChatMessage {
                role: "system".to_string(),
                content: "You are a game localization translator. Translate game UI/dialog text accurately and concisely. Preserve proper nouns. Output ONLY the translation, no explanation.".to_string(),
            },
            ChatMessage {
                role: "user".to_string(),
                content: format!(
                    "Translate the following text to {}:\n{}",
                    target.prompt_name(),
                    text
                ),
            },
        ]
    }

    fn build_lookup_messages(sentence: &str, word: &str, explain_lang: Lang) -> Vec<ChatMessage> {
        vec![
            ChatMessage {
                role: "system".to_string(),
                content: format!(
                    "You are a language tutor for game players. Explain the given word/phrase IN CONTEXT of the full sentence. Cover: contextual meaning, tone/register, and game-specific usage if any. Output ONLY the explanation in {}. Keep it concise (2-4 sentences).",
                    explain_lang.prompt_name()
                ),
            },
            ChatMessage {
                role: "user".to_string(),
                content: format!(
                    "Sentence: \"{sentence}\"\nWord/phrase: \"{word}\""
                ),
            },
        ]
    }

    async fn stream_chat<F>(
        &self,
        messages: Vec<ChatMessage>,
        temperature: f32,
        empty_error: &str,
        mut on_chunk: F,
    ) -> Result<String, String>
    where
        F: FnMut(String),
    {
        let request = ChatRequest {
            model: self.model.clone(),
            messages,
            stream: true,
            temperature,
        };

        let response = self
            .client
            .post(format!("{DEEPSEEK_BASE_URL}/chat/completions"))
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await
            .map_err(|e| format!("网络请求失败: {e}"))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(format!("DeepSeek API 错误 ({status}): {body}"));
        }

        let mut stream = response.bytes_stream();
        let mut full = String::new();
        let mut lines = SseLines::default();

        while let Some(chunk) = stream.next().await {
            let chunk = chunk.map_err(|e| format!("流读取失败: {e}"))?;
            for line in lines.push(&chunk)? {
                if !line.starts_with("data: ") {
                    continue;
                }
                let data = line.trim_start_matches("data: ").trim();
                if data == "[DONE]" {
                    continue;
                }
                if let Ok(parsed) = serde_json::from_str::<StreamChunk>(data) {
                    if let Some(content) = parsed
                        .choices
                        .first()
                        .and_then(|c| c.delta.content.clone())
                    {
                        full.push_str(&content);
                        on_chunk(content);
                    }
                }
            }
        }

        lines.finish()?;

        if full.trim().is_empty() {
            return Err(empty_error.to_string());
        }

        Ok(full.trim().to_string())
    }

    pub async fn translate(&self, text: &str, target: Lang) -> Result<String, String> {
        let request = ChatRequest {
            model: self.model.clone(),
            messages: Self::build_messages(text, target),
            stream: false,
            temperature: 0.3,
        };

        let response = self
            .client
            .post(format!("{DEEPSEEK_BASE_URL}/chat/completions"))
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await
            .map_err(|e| format!("网络请求失败: {e}"))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(format!("DeepSeek API 错误 ({status}): {body}"));
        }

        let data: ChatResponse = response
            .json()
            .await
            .map_err(|e| format!("解析响应失败: {e}"))?;

        data.choices
            .first()
            .map(|c| c.message.content.trim().to_string())
            .filter(|s| !s.is_empty())
            .ok_or_else(|| "API 返回空译文".to_string())
    }

    pub async fn translate_stream<F>(&self, text: &str, target: Lang, on_chunk: F) -> Result<String, String>
    where
        F: FnMut(String),
    {
        self.stream_chat(
            Self::build_messages(text, target),
            0.3,
            "API 返回空译文",
            on_chunk,
        )
        .await
    }

    pub async fn explain_word_in_context_stream<F>(
        &self,
        sentence: &str,
        word: &str,
        explain_lang: Lang,
        on_chunk: F,
    ) -> Result<String, String>
    where
        F: FnMut(String),
    {
        self.stream_chat(
            Self::build_lookup_messages(sentence, word, explain_lang),
            0.4,
            "API 返回空释义",
            on_chunk,
        )
        .await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn decode(chunks: &[&[u8]]) -> Result<Vec<String>, String> {
        let mut decoder=SseLines::default();let mut lines=Vec::new();
        for chunk in chunks {lines.extend(decoder.push(chunk)?);}
        decoder.finish()?;Ok(lines)
    }

    #[test] fn stream_utf8_complete_text_and_multiple_events() {
        let text="data: 你好\n\ndata: 日本語\r\n\r\n";
        assert_eq!(decode(&[text.as_bytes()]).unwrap(),vec!["data: 你好","","data: 日本語",""]);
    }
    #[test] fn stream_utf8_every_byte_boundary_preserves_chinese_and_japanese() {
        let event="data: {\"choices\":[{\"delta\":{\"content\":\"你好、冒険者\"}}]}\r\n\r\n";
        for split in 0..=event.len() {
            let lines=decode(&[&event.as_bytes()[..split],&event.as_bytes()[split..]]).unwrap();
            assert_eq!(lines[0],event.trim(),"byte split {split}");
        }
    }
    #[test] fn stream_utf8_one_byte_chunks_keep_json_and_newlines() {
        let event="data: {\"choices\":[{\"delta\":{\"content\":\"中文と日本語\"}}]}\n\n";
        let chunks=event.as_bytes().chunks(1).collect::<Vec<_>>();
        assert_eq!(decode(&chunks).unwrap(),vec![event.trim(),""]);
    }
    #[test] fn stream_utf8_incomplete_character_at_eof_is_error() {
        let bytes="data: 你".as_bytes();
        assert!(decode(&[&bytes[..bytes.len()-1]]).unwrap_err().contains("UTF-8"));
    }
    #[test] fn stream_utf8_invalid_complete_line_is_error() {
        assert!(decode(&[b"data: \xff\n"]).unwrap_err().contains("UTF-8"));
    }
}
