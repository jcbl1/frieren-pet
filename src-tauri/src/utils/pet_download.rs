use std::fs;
use std::io::Cursor;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use zip::ZipArchive;

use crate::utils::pet_import::install_pet_from_dir;

const PET_CONFIG_FILE: &str = "pet.json";

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShopItem {
    pub id: String,
    pub name: String,
    pub description: String,
    pub author: String,
    pub version: String,
    #[serde(default)]
    pub size: Option<u64>,
    pub preview_url: String,
    pub download_url: String,
    #[serde(default)]
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShopCatalog {
    pub items: Vec<ShopItem>,
}

fn catalog_url(base_url: &str) -> String {
    format!("{}/catalog", base_url.trim_end_matches('/'))
}

#[tauri::command]
pub async fn fetch_shop_catalog(base_url: String) -> Result<ShopCatalog, String> {
    let response = reqwest::get(catalog_url(&base_url))
        .await
        .map_err(|err| format!("请求商店目录失败: {err}"))?;

    if !response.status().is_success() {
        return Err(format!("商店目录返回异常状态: {}", response.status()));
    }

    response
        .json()
        .await
        .map_err(|err| format!("解析商店目录失败: {err}"))
}

fn extract_zip(bytes: &[u8], dest: &Path) -> Result<(), String> {
    let cursor = Cursor::new(bytes);
    let mut archive =
        ZipArchive::new(cursor).map_err(|err| format!("解压角色包失败: {err}"))?;

    for index in 0..archive.len() {
        let mut entry = archive
            .by_index(index)
            .map_err(|err| format!("读取压缩条目失败: {err}"))?;

        let Some(name) = entry.enclosed_name() else {
            return Err("角色包包含非法路径".into());
        };

        let out_path = dest.join(name);

        if entry.is_dir() {
            fs::create_dir_all(&out_path).map_err(|err| format!("创建目录失败: {err}"))?;

            continue;
        }

        if let Some(parent) = out_path.parent() {
            fs::create_dir_all(parent).map_err(|err| format!("创建目录失败: {err}"))?;
        }

        let mut file =
            fs::File::create(&out_path).map_err(|err| format!("创建文件失败: {err}"))?;

        std::io::copy(&mut entry, &mut file).map_err(|err| format!("解压文件失败: {err}"))?;
    }

    Ok(())
}

fn package_root(dir: &Path) -> Result<PathBuf, String> {
    if dir.join(PET_CONFIG_FILE).is_file() {
        return Ok(dir.to_path_buf());
    }

    let entries = fs::read_dir(dir).map_err(|err| format!("读取临时目录失败: {err}"))?;

    let mut subdirs = entries
        .filter_map(|entry| entry.ok().map(|entry| entry.path()))
        .filter(|path| path.is_dir());

    if let Some(first) = subdirs.next() {
        if subdirs.next().is_none() && first.join(PET_CONFIG_FILE).is_file() {
            return Ok(first);
        }
    }

    Err("解压内容缺少 pet.json".into())
}

fn temp_extract_dir() -> Result<(PathBuf, PathBuf), String> {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|err| format!("获取时间戳失败: {err}"))?
        .as_nanos();

    let root = std::env::temp_dir().join(format!("frieren-pet-dl-{}-{nanos}", std::process::id()));
    let extract_to = root.join("pkg");

    fs::create_dir_all(&extract_to).map_err(|err| format!("创建临时目录失败: {err}"))?;

    Ok((root, extract_to))
}

#[tauri::command]
pub async fn install_pet_from_url(app: AppHandle, url: String) -> Result<serde_json::Value, String> {
    let response = reqwest::get(&url)
        .await
        .map_err(|err| format!("下载角色包失败: {err}"))?;

    if !response.status().is_success() {
        return Err(format!("下载角色包返回异常状态: {}", response.status()));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|err| format!("读取下载内容失败: {err}"))?;

    let (temp_root, extract_to) = temp_extract_dir()?;

    let result = extract_zip(&bytes, &extract_to)
        .and_then(|_| package_root(&extract_to))
        .and_then(|root| install_pet_from_dir(&app, &root));

    let _ = fs::remove_dir_all(&temp_root);

    result
}
