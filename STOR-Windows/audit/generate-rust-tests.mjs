import fs from 'node:fs';
const root = new URL('../', import.meta.url);
const read = p => fs.readFileSync(new URL(p, root), 'utf8');
const write = (p,s) => fs.writeFileSync(new URL(p, root), s);
// Isolated harness: production sources are copied unchanged except the API URL,
// which targets a loopback SSE fixture. No real credentials or API are used.
let manifest = read('src-tauri/Cargo.toml');
manifest = manifest.slice(manifest.indexOf('[dependencies]'));
manifest = manifest.replace(/^tauri.*\n/gm, '');
write('audit/rust/Cargo.toml', '[package]\nname="stor-audit"\nversion="0.0.0"\nedition="2021"\n'+manifest);
fs.copyFileSync(new URL('src-tauri/Cargo.lock',root), new URL('audit/rust/Cargo.lock',root));
write('audit/rust/src/deepseek.rs',read('src-tauri/src/translate/deepseek.rs').replace('https://api.deepseek.com','http://127.0.0.1:19273'));
write('audit/rust/src/main.rs', `#![allow(dead_code)]
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
pub mod deepseek;
}
fn main() {}
#[cfg(test)] mod tests {
use super::*;
use std::{io::{Read,Write},net::TcpListener,thread,time::Duration};
fn fixture(chunks: Vec<Vec<u8>>) -> thread::JoinHandle<()> {
 let listener=TcpListener::bind("127.0.0.1:19273").unwrap();
 thread::spawn(move|| { let(mut socket,_)=listener.accept().unwrap();socket.set_read_timeout(Some(Duration::from_secs(5))).unwrap();let mut req=[0;8192];let _=socket.read(&mut req);socket.write_all(b"HTTP/1.1 200 OK\\r\\nContent-Type: text/event-stream\\r\\nTransfer-Encoding: chunked\\r\\nConnection: close\\r\\n\\r\\n").unwrap();for chunk in chunks {write!(socket,"{:x}\\r\\n",chunk.len()).unwrap();socket.write_all(&chunk).unwrap();socket.write_all(b"\\r\\n").unwrap();socket.flush().unwrap();thread::sleep(Duration::from_millis(80));}socket.write_all(b"0\\r\\n\\r\\n").unwrap(); })
}
async fn run(chunks: Vec<Vec<u8>>) -> Result<String,String> { let server=fixture(chunks);let t=translate::deepseek::DeepSeekTranslator::new("AUDIT-FAKE-KEY".into(),"audit".into());let r=t.translate_stream("hello",translate::Lang::Zh, |_|{}).await;server.join().unwrap();r }
#[tokio::test] async fn normal_stream() {let r=run(vec!["data: {\\"choices\\":[{\\"delta\\":{\\"content\\":\\"你好\\"}}]}\\n\\ndata: [DONE]\\n\\n".as_bytes().to_vec()]).await; assert_eq!(r.unwrap(),"你好");}
#[tokio::test] async fn utf8_split_should_preserve_text() {let s="data: {\\"choices\\":[{\\"delta\\":{\\"content\\":\\"你好\\"}}]}\\n\\ndata: [DONE]\\n\\n";let split=s.find('你').unwrap()+1;let r=run(vec![s.as_bytes()[..split].to_vec(),s.as_bytes()[split..].to_vec()]).await;assert_eq!(r.unwrap(),"你好");}
#[tokio::test] async fn stream_without_done_should_fail() {let r=run(vec![b"data: {\\"choices\\":[{\\"delta\\":{\\"content\\":\\"partial\\"}}]}\\n\\n".to_vec()]).await;assert!(r.is_err(),"truncated response accepted as successful, cacheable translation: {:?}",r);}
#[test] fn translation_cache_roundtrip() {let c=cache::TranslationCache::new(2);c.put(cache::TranslationCache::cache_key("hi","zh"),"hello".into());assert_eq!(c.get(&cache::TranslationCache::cache_key("hi","zh")),Some("hello".into()));assert!(c.get(&cache::TranslationCache::cache_key("hi","ja")).is_none());}
#[test] fn lookup_cache_should_not_collide() {assert_ne!(cache::TranslationCache::lookup_cache_key("a::b","c","zh"),cache::TranslationCache::lookup_cache_key("a","b::c","zh"));}
}
`.replace('pub mod deepseek;', '#[path="../deepseek.rs"] pub mod deepseek;'));
// Inline the fixture copy to avoid path ambiguity in nested modules.
let main=read('audit/rust/src/main.rs');
main=main.replace('#[path="../deepseek.rs"] pub mod deepseek;', 'pub mod deepseek { include!(concat!(env!("CARGO_MANIFEST_DIR"), "/src/deepseek.rs")); }');
write('audit/rust/src/main.rs', main);
main=read('audit/rust/src/main.rs').replace('let mut req=[0;8192];let _=socket.read(&mut req);', `let mut request=Vec::new(); let mut buf=[0;8192]; loop { let n=socket.read(&mut buf).unwrap(); if n==0 {break;} request.extend_from_slice(&buf[..n]); if let Some(end)=request.windows(4).position(|w|w==b"\\r\\n\\r\\n") {let headers=String::from_utf8_lossy(&request[..end]);let len=headers.lines().find_map(|l|l.to_lowercase().strip_prefix("content-length:").and_then(|n|n.trim().parse::<usize>().ok())).unwrap_or(0);if request.len()>=end+4+len {break;}} }`);
write('audit/rust/src/main.rs', main);
write('audit/rust/src/main.rs', main+'\n'+read('audit/ocr-tests.rs'));
console.log('Generated isolated Rust audit harness. Production sources unchanged.');
