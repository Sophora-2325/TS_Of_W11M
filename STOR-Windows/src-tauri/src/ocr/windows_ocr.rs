use std::cell::RefCell;
use std::collections::HashMap;
use windows::{
    Globalization::Language,
    Graphics::Imaging::{BitmapDecoder, SoftwareBitmap},
    Media::Ocr::OcrEngine,
    Storage::Streams::{DataWriter, InMemoryRandomAccessStream},
};

const LANG_EN: &str = "en-US";
const LANG_JA: &str = "ja-JP";
const LANG_ZH: &str = "zh-Hans-CN";

thread_local! {
    static OCR_ENGINES: RefCell<HashMap<String, OcrEngine>> = RefCell::new(HashMap::new());
}

fn png_to_software_bitmap(png_bytes: &[u8]) -> Result<SoftwareBitmap, String> {
    let stream = InMemoryRandomAccessStream::new().map_err(|e| e.to_string())?;
    let writer = DataWriter::CreateDataWriter(&stream).map_err(|e| e.to_string())?;
    writer
        .WriteBytes(png_bytes)
        .map_err(|e| format!("WriteBytes failed: {e}"))?;
    writer
        .StoreAsync()
        .map_err(|e| e.to_string())?
        .join()
        .map_err(|e| e.to_string())?;
    writer
        .FlushAsync()
        .map_err(|e| e.to_string())?
        .join()
        .map_err(|e| e.to_string())?;
    stream.Seek(0).map_err(|e| e.to_string())?;

    let decoder = BitmapDecoder::CreateAsync(&stream)
        .map_err(|e| e.to_string())?
        .join()
        .map_err(|e| e.to_string())?;
    let bitmap = decoder
        .GetSoftwareBitmapAsync()
        .map_err(|e| e.to_string())?
        .join()
        .map_err(|e| e.to_string())?;
    Ok(bitmap)
}

fn ensure_ocr_engine(lang_tag: &str) -> Result<(), String> {
    OCR_ENGINES.with(|cell| {
        let mut engines = cell.borrow_mut();
        if engines.contains_key(lang_tag) {
            return Ok(());
        }
        let language = Language::CreateLanguage(&lang_tag.into()).map_err(|e| e.to_string())?;
        let engine = OcrEngine::TryCreateFromLanguage(&language).map_err(|e| e.to_string())?;
        engines.insert(lang_tag.to_string(), engine);
        Ok(())
    })
}

fn ocr_with_language(png_bytes: &[u8], lang_tag: &str) -> Result<(String, f64), String> {
    let bitmap = png_to_software_bitmap(png_bytes)?;
    ensure_ocr_engine(lang_tag)?;
    OCR_ENGINES.with(|cell| {
        let engines = cell.borrow();
        let engine = engines
            .get(lang_tag)
            .ok_or_else(|| format!("OCR 引擎未初始化: {lang_tag}"))?;
        let result = engine
            .RecognizeAsync(&bitmap)
            .map_err(|e| e.to_string())?
            .join()
            .map_err(|e| e.to_string())?;

        let mut lines = Vec::new();
        if let Ok(lines_result) = result.Lines() {
            let size = lines_result.Size().unwrap_or(0);
            for i in 0..size {
                if let Ok(line) = lines_result.GetAt(i) {
                    if let Ok(text) = line.Text() {
                        let s = text.to_string();
                        if !s.trim().is_empty() {
                            lines.push(s);
                        }
                    }
                }
            }
        }

        let text = lines.join("\n").trim().to_string();
        let confidence = if text.is_empty() { 0.0 } else { 0.8 };
        Ok((text, confidence))
    })
}

pub fn recognize_text(png_bytes: &[u8], ocr_language: &str) -> Result<String, String> {
    if png_bytes.is_empty() {
        return Err("截图数据为空".to_string());
    }

    let languages: Vec<&str> = match ocr_language {
        "en" => vec![LANG_EN],
        "ja" => vec![LANG_JA],
        "zh" => vec![LANG_ZH],
        _ => vec![LANG_EN, LANG_JA, LANG_ZH],
    };

    let mut best_text = String::new();
    let mut best_score = 0.0_f64;

    for lang in languages {
        match ocr_with_language(png_bytes, lang) {
            Ok((text, score)) if score > best_score && !text.is_empty() => {
                best_score = score;
                best_text = text;
            }
            Ok(_) => {}
            Err(_) => {}
        }
    }

    if best_text.is_empty() {
        return Err("未能识别出文字，请尝试扩大选区或手动输入".to_string());
    }

    Ok(best_text)
}

// Keep engines warm on the current thread (call from spawn_blocking during prewarm).
pub fn prewarm_ocr_engines(ocr_language: &str) {
    let languages: Vec<&str> = match ocr_language {
        "en" => vec![LANG_EN],
        "ja" => vec![LANG_JA],
        "zh" => vec![LANG_ZH],
        _ => vec![LANG_EN],
    };
    for lang in languages {
        let _ = ensure_ocr_engine(lang);
    }
}
