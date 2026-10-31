use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    io::Read,
    path::{Path, PathBuf},
    time::{Duration, Instant},
};
use tokio::io::AsyncWriteExt;

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Asset {
    pub id: String,
    pub name: String,
    pub url: String,
    pub size: u64,
    pub sha256: String,
    #[serde(default)]
    pub file_name: String,
    #[serde(default)]
    pub executable: String,
}

#[derive(Deserialize, Serialize)]
pub struct Catalog {
    pub engine: Asset,
    pub models: Vec<Asset>,
}

pub fn catalog() -> Catalog {
    serde_json::from_str(include_str!("../local-runtime.json"))
        .expect("bundled local runtime manifest")
}

pub fn data_directory() -> PathBuf {
    dirs::data_local_dir()
        .expect("Windows local app data directory")
        .join("STOR")
}

pub fn validate_model(path: &Path) -> Result<(), String> {
    if !path.is_absolute()
        || !path
            .extension()
            .is_some_and(|e| e.eq_ignore_ascii_case("gguf"))
    {
        return Err("请选择完整的 .gguf 模型文件路径".into());
    }
    let mut file = std::fs::File::open(path)
        .map_err(|e| format!("模型文件无法读取，请重新选择：{}（{e}）", path.display()))?;
    let mut magic = [0; 4];
    file.read_exact(&mut magic)
        .map_err(|_| "模型文件不完整，无法读取 GGUF 文件头".to_string())?;
    if &magic != b"GGUF" {
        return Err("所选文件不是 GGUF 模型".into());
    }
    Ok(())
}

pub fn verify_file(path: &Path, asset: &Asset) -> Result<(), String> {
    let mut file = std::fs::File::open(path).map_err(|e| e.to_string())?;
    if file.metadata().map_err(|e| e.to_string())?.len() != asset.size {
        return Err("文件大小与官方模型不符，请选择其他保存位置或导入已有模型".into());
    }
    let mut hash = Sha256::new();
    let mut buffer = [0; 1024 * 1024];
    loop {
        let n = file.read(&mut buffer).map_err(|e| e.to_string())?;
        if n == 0 {
            break;
        }
        hash.update(&buffer[..n]);
    }
    if format!("{:x}", hash.finalize()) != asset.sha256 {
        return Err("SHA-256 校验失败，原文件未改动，请重试或更换保存位置".into());
    }
    Ok(())
}

// Only fixed, bundled assets reach this function. Partial files are never offered as models.
pub async fn download(
    asset: &Asset,
    destination: &Path,
    mut progress: impl FnMut(u64, u64),
) -> Result<(), String> {
    let temporary = destination.with_extension("stor-download");
    let result = async {
        let client = reqwest::Client::builder()
            .connect_timeout(Duration::from_secs(10))
            .read_timeout(Duration::from_secs(60))
            .build()
            .map_err(|e| e.to_string())?;
        let response = client
            .get(&asset.url)
            .send()
            .await
            .map_err(|e| format!("下载无法连接：{e}。请检查网络后重试"))?
            .error_for_status()
            .map_err(|e| format!("下载服务返回错误：{e}"))?;
        let mut file = tokio::fs::File::create(&temporary)
            .await
            .map_err(|e| format!("无法写入下载位置：{e}"))?;
        let mut stream = response.bytes_stream();
        let mut received = 0;
        let mut hash = Sha256::new();
        let mut last = Instant::now();
        progress(0, asset.size);
        while let Some(chunk) = stream.next().await {
            let chunk = chunk.map_err(|e| format!("下载中断：{e}。请重试"))?;
            received += chunk.len() as u64;
            if received > asset.size {
                return Err("下载内容超过清单中的大小，已停止".into());
            }
            hash.update(&chunk);
            file.write_all(&chunk)
                .await
                .map_err(|e| format!("下载写入失败：{e}"))?;
            if last.elapsed() >= Duration::from_millis(200) {
                progress(received, asset.size);
                last = Instant::now();
            }
        }
        file.flush().await.map_err(|e| e.to_string())?;
        drop(file);
        if received != asset.size || format!("{:x}", hash.finalize()) != asset.sha256 {
            return Err("下载文件不完整或 SHA-256 校验失败，请重试".into());
        }
        if destination.exists() {
            return Err("目标文件已存在，请直接复用或更换保存位置".into());
        }
        tokio::fs::rename(&temporary, destination)
            .await
            .map_err(|e| e.to_string())?;
        progress(received, asset.size);
        Ok(())
    }
    .await;
    if result.is_err() {
        let _ = tokio::fs::remove_file(&temporary).await;
    }
    result
}

pub fn extract_engine(archive: &Path, directory: &Path) -> Result<(), String> {
    let file = std::fs::File::open(archive).map_err(|e| e.to_string())?;
    let mut zip = zip::ZipArchive::new(file).map_err(|e| format!("引擎压缩包无法读取：{e}"))?;
    for i in 0..zip.len() {
        let mut item = zip.by_index(i).map_err(|e| e.to_string())?;
        let relative = item.enclosed_name().ok_or("引擎压缩包包含无效路径")?;
        if item.is_symlink() {
            return Err("引擎压缩包不应包含符号链接".into());
        }
        let target = directory.join(relative);
        if item.is_dir() {
            std::fs::create_dir_all(&target).map_err(|e| e.to_string())?;
        } else {
            if let Some(parent) = target.parent() {
                std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            let mut output = std::fs::File::create(target).map_err(|e| e.to_string())?;
            std::io::copy(&mut item, &mut output).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::tests::TestDirectory;
    use std::io::Write;

    #[test]
    fn imports_read_header_without_changing_or_copying_model() {
        let folder = TestDirectory::new();
        let path = folder.0.join("existing.gguf");
        std::fs::write(&path, b"GGUFtest-data").unwrap();
        validate_model(&path).unwrap();
        assert_eq!(std::fs::read(&path).unwrap(), b"GGUFtest-data");
        assert_eq!(std::fs::read_dir(&folder.0).unwrap().count(), 1);
        std::fs::write(&path, b"html").unwrap();
        assert!(validate_model(&path).is_err());
        assert!(validate_model(&folder.0.join("missing.gguf")).is_err());
    }

    #[test]
    fn engine_zip_extraction_rejects_parent_paths() {
        let folder = TestDirectory::new();
        let archive = folder.0.join("bad.zip");
        let mut zip = zip::ZipWriter::new(std::fs::File::create(&archive).unwrap());
        zip.start_file("../escape.exe", zip::write::SimpleFileOptions::default())
            .unwrap();
        zip.write_all(b"bad").unwrap();
        zip.finish().unwrap();
        assert!(extract_engine(&archive, &folder.0.join("engine")).is_err());
        assert!(!folder.0.join("escape.exe").exists());
    }

    #[tokio::test]
    async fn downloads_verify_hash_and_do_not_publish_partial_files() {
        let folder = TestDirectory::new();
        for bad_hash in [false, true] {
            let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
            let address = listener.local_addr().unwrap();
            let server = std::thread::spawn(move || {
                let (mut socket, _) = listener.accept().unwrap();
                let mut request = [0; 4096];
                let _ = socket.read(&mut request);
                socket.write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 8\r\nConnection: close\r\n\r\nGGUFtest").unwrap();
            });
            let asset = Asset {
                id: "mock".into(),
                name: "mock".into(),
                url: format!("http://{address}"),
                size: 8,
                sha256: if bad_hash {
                    "bad".into()
                } else {
                    format!("{:x}", Sha256::digest(b"GGUFtest"))
                },
                file_name: "test.gguf".into(),
                executable: String::new(),
            };
            let destination = folder
                .0
                .join(if bad_hash { "bad.gguf" } else { "good.gguf" });
            let mut received = 0;
            let result = download(&asset, &destination, |n, _| received = n).await;
            assert_eq!(result.is_err(), bad_hash);
            assert_eq!(destination.exists(), !bad_hash);
            assert!(!destination.with_extension("stor-download").exists());
            if !bad_hash {
                assert_eq!(received, 8);
                verify_file(&destination, &asset).unwrap();
            }
            server.join().unwrap();
        }
    }
}
