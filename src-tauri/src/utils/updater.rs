use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

const LATEST_RELEASE_URL: &str =
    "https://api.github.com/repos/jcbl1/frieren-pet/releases/latest";

#[derive(Debug, Deserialize)]
struct ReleaseAssetRaw {
    name: String,
    browser_download_url: String,
}

#[derive(Debug, Deserialize)]
struct ReleaseRaw {
    tag_name: String,
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    body: Option<String>,
    html_url: String,
    #[serde(default)]
    published_at: Option<String>,
    #[serde(default)]
    assets: Vec<ReleaseAssetRaw>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfo {
    pub version: String,
    pub title: String,
    pub notes: Option<String>,
    pub release_url: String,
    pub published_at: Option<String>,
    pub download_url: Option<String>,
}

fn parse_version(version: &str) -> Vec<u64> {
    version
        .split(|ch: char| !ch.is_ascii_digit())
        .filter_map(|part| part.parse::<u64>().ok())
        .collect()
}

fn is_newer(candidate: &str, current: &str) -> bool {
    let candidate_parts = parse_version(candidate);
    let current_parts = parse_version(current);

    for (candidate_part, current_part) in candidate_parts.iter().zip(current_parts.iter()) {
        if candidate_part != current_part {
            return candidate_part > current_part;
        }
    }

    candidate_parts.len() > current_parts.len()
}

fn preferred_extensions() -> &'static [&'static str] {
    #[cfg(target_os = "macos")]
    {
        &["dmg"]
    }

    #[cfg(target_os = "windows")]
    {
        &["msi", "exe"]
    }

    #[cfg(target_os = "linux")]
    {
        &["AppImage", "deb"]
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        &[""]
    }
}

fn arch_hint() -> &'static str {
    if cfg!(target_arch = "aarch64") {
        "aarch64"
    } else if cfg!(target_arch = "x86_64") {
        "x86_64"
    } else {
        "universal"
    }
}

fn pick_asset_with(
    assets: &[ReleaseAssetRaw],
    extensions: &[&str],
    arch: &str,
) -> Option<String> {
    let by_extension = |asset: &ReleaseAssetRaw| {
        let name = asset.name.to_lowercase();

        extensions
            .iter()
            .any(|ext| name.ends_with(&ext.to_lowercase()))
    };

    if let Some(asset) = assets
        .iter()
        .find(|asset| by_extension(asset) && asset.name.to_lowercase().contains(arch))
    {
        return Some(asset.browser_download_url.clone());
    }

    if let Some(asset) = assets
        .iter()
        .find(|asset| by_extension(asset) && asset.name.to_lowercase().contains("universal"))
    {
        return Some(asset.browser_download_url.clone());
    }

    assets
        .iter()
        .find(|asset| by_extension(asset))
        .map(|asset| asset.browser_download_url.clone())
}

fn pick_asset(assets: &[ReleaseAssetRaw]) -> Option<String> {
    pick_asset_with(assets, preferred_extensions(), arch_hint())
}

#[tauri::command]
pub async fn check_for_update(app: AppHandle) -> Result<Option<UpdateInfo>, String> {
    let current = app.package_info().version.to_string();

    let client = reqwest::Client::builder()
        .user_agent(format!("frieren-pet/{current}"))
        .build()
        .map_err(|err| format!("初始化更新检查客户端失败: {err}"))?;

    let response = client
        .get(LATEST_RELEASE_URL)
        .send()
        .await
        .map_err(|err| format!("检查更新失败: {err}"))?;

    if response.status() == reqwest::StatusCode::NOT_FOUND {
        return Ok(None);
    }

    if !response.status().is_success() {
        return Err(format!("检查更新返回异常状态: {}", response.status()));
    }

    let release: ReleaseRaw = response
        .json()
        .await
        .map_err(|err| format!("解析更新信息失败: {err}"))?;

    let latest = release.tag_name.trim_start_matches('v');

    if !is_newer(latest, &current) {
        return Ok(None);
    }

    Ok(Some(UpdateInfo {
        version: latest.to_string(),
        title: release
            .name
            .unwrap_or_else(|| format!("Frieren Pet v{latest}")),
        notes: release.body,
        release_url: release.html_url,
        published_at: release.published_at,
        download_url: pick_asset(&release.assets),
    }))
}

fn safe_download_path(dir: &Path, file_name: &str) -> PathBuf {
    let sanitized: String = file_name
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '.' || ch == '-' || ch == '_' {
                ch
            } else {
                '_'
            }
        })
        .collect();

    let mut candidate = dir.join(&sanitized);
    let mut counter = 1;

    while candidate.exists() {
        let (stem, extension) = match sanitized.rsplit_once('.') {
            Some((stem, extension)) => (stem, extension),
            None => (sanitized.as_str(), ""),
        };

        let name = if extension.is_empty() {
            format!("{stem} ({counter})")
        } else {
            format!("{stem} ({counter}).{extension}")
        };

        candidate = dir.join(name);
        counter += 1;
    }

    candidate
}

#[tauri::command]
pub async fn download_release_asset(app: AppHandle, url: String) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .user_agent(format!("frieren-pet/{}", app.package_info().version))
        .build()
        .map_err(|err| format!("初始化下载客户端失败: {err}"))?;

    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|err| format!("下载安装包失败: {err}"))?;

    if !response.status().is_success() {
        return Err(format!("下载安装包返回异常状态: {}", response.status()));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|err| format!("读取下载内容失败: {err}"))?;

    let file_name = url
        .rsplit('/')
        .find(|segment| !segment.is_empty())
        .unwrap_or("frieren-pet-update")
        .to_string();

    let download_dir = app
        .path()
        .download_dir()
        .map_err(|err| format!("获取下载目录失败: {err}"))?;

    let target = safe_download_path(&download_dir, &file_name);

    fs::write(&target, &bytes).map_err(|err| format!("保存安装包失败: {err}"))?;

    Ok(target.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn version_comparison() {
        assert!(is_newer("1.1.0", "1.0.0"));
        assert!(is_newer("1.10.0", "1.9.9"));
        assert!(is_newer("0.1.2", "0.1.1"));
        assert!(is_newer("0.2.0", "0.1.99"));
        assert!(!is_newer("0.1.1", "0.1.1"));
        assert!(!is_newer("0.1.0", "0.1.1"));
        assert!(!is_newer("0.1.1", "0.1.2"));
        assert!(is_newer("1.0.0-beta.2", "1.0.0-beta.1"));
    }

    #[test]
    fn version_comparison_strips_prefix() {
        assert!(is_newer("v1.1.0", "1.0.0"));
        assert!(!is_newer("v1.0.0", "1.0.0"));
    }

    #[test]
    fn asset_selection_prefers_arch() {
        let assets = vec![
            ReleaseAssetRaw {
                name: "FrierenPet_1.0.0_x86_64.dmg".into(),
                browser_download_url: "https://example.com/x86.dmg".into(),
            },
            ReleaseAssetRaw {
                name: "FrierenPet_1.0.0_aarch64.dmg".into(),
                browser_download_url: "https://example.com/arm.dmg".into(),
            },
        ];

        assert_eq!(
            pick_asset_with(&assets, &["dmg"], "aarch64").unwrap(),
            "https://example.com/arm.dmg"
        );
        assert_eq!(
            pick_asset_with(&assets, &["dmg"], "x86_64").unwrap(),
            "https://example.com/x86.dmg"
        );
    }

    #[test]
    fn asset_selection_falls_back_to_extension() {
        let assets = vec![ReleaseAssetRaw {
            name: "FrierenPet_1.0.0_universal.dmg".into(),
            browser_download_url: "https://example.com/universal.dmg".into(),
        }];

        assert_eq!(
            pick_asset_with(&assets, &["dmg"], "x86_64").unwrap(),
            "https://example.com/universal.dmg"
        );
    }

    #[test]
    fn asset_selection_ignores_unrelated_files() {
        let assets = vec![ReleaseAssetRaw {
            name: "checksums.txt".into(),
            browser_download_url: "https://example.com/checksums.txt".into(),
        }];

        assert!(pick_asset_with(&assets, &["dmg", "msi"], "x86_64").is_none());
    }

    #[test]
    fn download_path_avoids_collision() {
        let dir = std::env::temp_dir().join(format!(
            "frieren-pet-updater-test-{}",
            std::process::id()
        ));

        fs::create_dir_all(&dir).unwrap();

        let first = safe_download_path(&dir, "FrierenPet_1.0.0_aarch64.dmg");

        fs::write(&first, b"x").unwrap();

        let second = safe_download_path(&dir, "FrierenPet_1.0.0_aarch64.dmg");

        assert_ne!(first, second);
        assert!(second.ends_with("FrierenPet_1.0.0_aarch64 (1).dmg"));

        let _ = fs::remove_dir_all(&dir);
    }
}
