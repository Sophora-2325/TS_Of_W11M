#![allow(dead_code)]
mod cache { include!(concat!(env!("CARGO_MANIFEST_DIR"), "/../../src-tauri/src/cache.rs")); }
mod capture {
pub mod preprocess { include!(concat!(env!("CARGO_MANIFEST_DIR"), "/../../src-tauri/src/capture/preprocess.rs")); }
pub mod screen {
include!(concat!(env!("CARGO_MANIFEST_DIR"), "/../../src-tauri/src/capture/screen.rs"));
#[test] fn fresh_snapshot_crop() { let c=MonitorSnapshotCache::new(); c.store(MonitorBounds{x:0,y:0,width:20,height:20},20,20,vec![255;1600]); assert!(c.try_crop(&CaptureRect{x:2,y:2,width:5,height:5}).is_some()); }
#[test] fn freeze_frame_jpeg_should_encode() { let c=MonitorSnapshotCache::new(); c.store(MonitorBounds{x:0,y:0,width:20,height:20},20,20,vec![255;1600]); assert!(encode_freeze_frame_jpeg(&c).is_ok(),"RGBA screenshot cannot be encoded as JPEG"); }
#[test] fn frozen_snapshot_should_survive_slow_selection() { let c=MonitorSnapshotCache::new(); c.store(MonitorBounds{x:0,y:0,width:20,height:20},20,20,vec![255;1600]); c.0.lock().unwrap().as_mut().unwrap().captured_at = Instant::now()-Duration::from_secs(4); assert!(c.try_crop(&CaptureRect{x:2,y:2,width:5,height:5}).is_some(),"frozen image expires after 3 seconds although still displayed"); }
#[test] fn snapshot_from_other_monitor_should_not_be_reused() { let c=MonitorSnapshotCache::new(); c.store(MonitorBounds{x:1920,y:0,width:20,height:20},20,20,vec![255;1600]); assert!(c.try_crop(&CaptureRect{x:2,y:2,width:5,height:5}).is_none(),"negative relative coordinate clamped to zero, wrong monitor reused"); }
}}
mod translate {
#[derive(Clone,Copy)] pub enum Lang { Zh, En, Ja }
impl Lang { pub fn prompt_name(&self)->&'static str { match self {Self::Zh=>"Simplified Chinese",Self::En=>"English",Self::Ja=>"Japanese"} } }
pub mod deepseek { include!(concat!(env!("CARGO_MANIFEST_DIR"), "/src/deepseek.rs")); }
}
fn main() {}
#[cfg(test)] mod tests {
use super::*;
use std::{io::{Read,Write},net::TcpListener,thread,time::Duration};
fn fixture(chunks: Vec<Vec<u8>>) -> thread::JoinHandle<()> {
 let listener=TcpListener::bind("127.0.0.1:19273").unwrap();
 thread::spawn(move|| { let(mut socket,_)=listener.accept().unwrap();socket.set_read_timeout(Some(Duration::from_secs(5))).unwrap();let mut request=Vec::new(); let mut buf=[0;8192]; loop { let n=socket.read(&mut buf).unwrap(); if n==0 {break;} request.extend_from_slice(&buf[..n]); if let Some(end)=request.windows(4).position(|w|w==b"\r\n\r\n") {let headers=String::from_utf8_lossy(&request[..end]);let len=headers.lines().find_map(|l|l.to_lowercase().strip_prefix("content-length:").and_then(|n|n.trim().parse::<usize>().ok())).unwrap_or(0);if request.len()>=end+4+len {break;}} }socket.write_all(b"HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\n").unwrap();for chunk in chunks {write!(socket,"{:x}\r\n",chunk.len()).unwrap();socket.write_all(&chunk).unwrap();socket.write_all(b"\r\n").unwrap();socket.flush().unwrap();thread::sleep(Duration::from_millis(80));}socket.write_all(b"0\r\n\r\n").unwrap(); })
}
async fn run(chunks: Vec<Vec<u8>>) -> Result<String,String> { let server=fixture(chunks);let t=translate::deepseek::DeepSeekTranslator::new("AUDIT-FAKE-KEY".into(),"audit".into());let r=t.translate_stream("hello",translate::Lang::Zh, |_|{}).await;server.join().unwrap();r }
#[tokio::test] async fn normal_stream() {let r=run(vec!["data: {\"choices\":[{\"delta\":{\"content\":\"你好\"}}]}\n\ndata: [DONE]\n\n".as_bytes().to_vec()]).await; assert_eq!(r.unwrap(),"你好");}
#[tokio::test] async fn utf8_split_should_preserve_text() {let s="data: {\"choices\":[{\"delta\":{\"content\":\"你好\"}}]}\n\ndata: [DONE]\n\n";let split=s.find('你').unwrap()+1;let r=run(vec![s.as_bytes()[..split].to_vec(),s.as_bytes()[split..].to_vec()]).await;assert_eq!(r.unwrap(),"你好");}
#[tokio::test] async fn stream_without_done_should_fail() {let r=run(vec![b"data: {\"choices\":[{\"delta\":{\"content\":\"partial\"}}]}\n\n".to_vec()]).await;assert!(r.is_err(),"truncated response accepted as successful, cacheable translation: {:?}",r);}
#[test] fn translation_cache_roundtrip() {let c=cache::TranslationCache::new(2);c.put(cache::TranslationCache::cache_key("hi","zh"),"hello".into());assert_eq!(c.get(&cache::TranslationCache::cache_key("hi","zh")),Some("hello".into()));assert!(c.get(&cache::TranslationCache::cache_key("hi","ja")).is_none());}
#[test] fn lookup_cache_should_not_collide() {assert_ne!(cache::TranslationCache::lookup_cache_key("a::b","c","zh"),cache::TranslationCache::lookup_cache_key("a","b::c","zh"));}
}

mod ocr {
include!(concat!(env!("CARGO_MANIFEST_DIR"), "/../../src-tauri/src/ocr/windows_ocr.rs"));
#[test] fn installed_ocr_and_recognition_diagnostic() {
 let langs=OcrEngine::AvailableRecognizerLanguages().unwrap();
 let mut tags=Vec::new(); for i in 0..langs.Size().unwrap() {tags.push(langs.GetAt(i).unwrap().LanguageTag().unwrap().to_string());}
 eprintln!("Available OCR languages: {:?}; max image dimension {:?}",tags,OcrEngine::MaxImageDimension());
 for (lang,tag) in [("en",LANG_EN),("zh",LANG_ZH),("ja",LANG_JA)] {
   let path=format!("{}/../evidence/ocr-{}.png",env!("CARGO_MANIFEST_DIR"),lang);
   let png=std::fs::read(path).unwrap();
   eprintln!("fixture={lang}; engine={:?}; selected={:?}; auto={:?}",ocr_with_language(&png,tag),recognize_text(&png,lang),recognize_text(&png,"auto"));
 }
}
}
