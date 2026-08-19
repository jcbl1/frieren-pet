use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

use fs_extra::dir::{copy, CopyOptions};
use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::{AppHandle, Manager};

const PET_CONFIG_FILE: &str = "pet.json";
const PETS_DIR: &str = "pets";
const MANIFEST_PATH: &str = "assets/pets/manifest.json";
const SUPPORTED_FORMATS: &[&str] = &["gif"];

fn is_valid_pet_id(id: &str) -> bool {
    if id.is_empty() || id.len() > 64 {
        return false;
    }

    let mut chars = id.chars();

    match chars.next() {
        Some(first) if first.is_ascii_alphanumeric() => {}
        _ => return false,
    }

    chars.all(|ch| ch.is_ascii_alphanumeric() || ch == '_' || ch == '-')
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct PetStateConfigRaw {
    src: String,
    #[serde(default, rename = "loop")]
    r#loop: bool,
    #[serde(default)]
    duration_ms: Option<u64>,
    #[serde(default)]
    next: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct PetCapabilityRaw {
    state: String,
    #[serde(default)]
    cooldown_ms: Option<u64>,
    #[serde(default)]
    after_ms: Option<u64>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(untagged)]
enum CapabilityTarget {
    State(String),
    Config(PetCapabilityRaw),
}

impl From<&str> for CapabilityTarget {
    fn from(value: &str) -> Self {
        CapabilityTarget::State(value.to_string())
    }
}

fn capability_state(target: &CapabilityTarget) -> &str {
    match target {
        CapabilityTarget::State(state) => state,
        CapabilityTarget::Config(config) => &config.state,
    }
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct PetConfigRaw {
    id: String,
    name: String,
    format: String,
    width: f64,
    height: f64,
    default_state: String,
    #[serde(default)]
    preview: Option<String>,
    #[serde(default)]
    version: Option<String>,
    #[serde(default)]
    capabilities: HashMap<String, CapabilityTarget>,
    states: HashMap<String, PetStateConfigRaw>,
}

#[derive(Deserialize)]
struct ManifestRaw {
    #[serde(default)]
    presets: Vec<String>,
}

fn parse_pet_config(path: &Path) -> Result<PetConfigRaw, String> {
    let content = fs::read_to_string(path).map_err(|err| format!("读取 pet.json 失败: {err}"))?;

    serde_json::from_str(&content).map_err(|err| format!("解析 pet.json 失败: {err}"))
}

fn validate_pet_config(config: &PetConfigRaw, from_dir: &Path) -> Result<(), String> {
    if !is_valid_pet_id(&config.id) {
        return Err(format!(
            "角色 id \"{}\" 不合法（需以字母或数字开头，仅含字母/数字/_-）",
            config.id
        ));
    }

    if config.name.trim().is_empty() {
        return Err("角色缺少 name".into());
    }

    if let Some(version) = &config.version {
        if version.trim().is_empty() {
            return Err("角色 version 不能为空".into());
        }
    }

    if !SUPPORTED_FORMATS.contains(&config.format.as_str()) {
        return Err(format!(
            "暂不支持的角色格式 \"{}\"（当前仅支持 gif）",
            config.format
        ));
    }

    if config.width <= 0.0 || config.height <= 0.0 {
        return Err("width/height 必须大于 0".into());
    }

    if config.states.is_empty() {
        return Err("角色缺少 states".into());
    }

    if !config.states.contains_key(&config.default_state) {
        return Err(format!(
            "defaultState \"{}\" 不在 states 中",
            config.default_state
        ));
    }

    for (state_name, state) in &config.states {
        if state.src.trim().is_empty() {
            return Err(format!("state \"{state_name}\" 缺少 src"));
        }

        if !from_dir.join(&state.src).is_file() {
            return Err(format!(
                "state \"{state_name}\" 的素材 \"{}\" 不存在",
                state.src
            ));
        }

        if let Some(next) = &state.next {
            if !config.states.contains_key(next) {
                return Err(format!(
                    "state \"{state_name}\" 的 next \"{next}\" 不存在"
                ));
            }
        }
    }

    for (cap, target) in &config.capabilities {
        let state = capability_state(target);

        if !config.states.contains_key(state) {
            return Err(format!(
                "capabilities[{cap}] 指向的状态 \"{state}\" 不存在"
            ));
        }
    }

    if let Some(preview) = &config.preview {
        if !from_dir.join(preview).is_file() {
            return Err(format!("preview \"{preview}\" 不存在"));
        }
    }

    Ok(())
}

fn user_pets_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|err| format!("获取应用数据目录失败: {err}"))?
        .join(PETS_DIR);

    fs::create_dir_all(&dir).map_err(|err| format!("创建数据目录失败: {err}"))?;

    Ok(dir)
}

fn preset_ids(app: &AppHandle) -> Result<Vec<String>, String> {
    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|err| format!("获取资源目录失败: {err}"))?;

    let manifest_path = resource_dir.join(MANIFEST_PATH);

    if !manifest_path.is_file() {
        return Ok(Vec::new());
    }

    let content =
        fs::read_to_string(&manifest_path).map_err(|err| format!("读取内置角色清单失败: {err}"))?;

    let manifest: ManifestRaw =
        serde_json::from_str(&content).map_err(|err| format!("解析内置角色清单失败: {err}"))?;

    Ok(manifest.presets)
}

fn config_json(root: &Path, config: &PetConfigRaw) -> Result<serde_json::Value, String> {
    let mut value =
        serde_json::to_value(config).map_err(|err| format!("序列化角色配置失败: {err}"))?;

    if let Some(object) = value.as_object_mut() {
        object.insert("resourceDir".into(), json!(root.to_string_lossy()));
    }

    Ok(value)
}

pub(crate) fn install_pet_from_dir(app: &AppHandle, from_dir: &Path) -> Result<serde_json::Value, String> {
    if !from_dir.is_dir() {
        return Err("所选目录不存在".into());
    }

    let config_path = from_dir.join(PET_CONFIG_FILE);

    if !config_path.is_file() {
        return Err("目录中缺少 pet.json".into());
    }

    let config = parse_pet_config(&config_path)?;

    validate_pet_config(&config, from_dir)?;

    let presets = preset_ids(app)?;

    if presets.iter().any(|id| id == &config.id) {
        return Err(format!("角色 id \"{}\" 与内置角色冲突", config.id));
    }

    let root = user_pets_dir(app)?;
    let target = root.join(&config.id);

    if target.is_dir() {
        fs::remove_dir_all(&target).map_err(|err| format!("覆盖旧角色失败: {err}"))?;
    }

    fs::create_dir_all(&target).map_err(|err| format!("创建角色目录失败: {err}"))?;

    let mut options = CopyOptions::new();

    options.content_only = true;

    copy(from_dir, &target, &options).map_err(|err| format!("复制角色目录失败: {err}"))?;

    config_json(&target, &config)
}

#[tauri::command]
pub async fn import_pet(app: AppHandle, from_path: String) -> Result<serde_json::Value, String> {
    log::info!("import pet requested: {from_path}");

    install_pet_from_dir(&app, Path::new(&from_path))
}

#[tauri::command]
pub async fn delete_pet(app: AppHandle, id: String) -> Result<(), String> {
    log::info!("delete pet requested: {id}");

    if !is_valid_pet_id(&id) {
        return Err("非法的角色 id".into());
    }

    let presets = preset_ids(&app)?;

    if presets.iter().any(|preset| preset == &id) {
        return Err(format!("角色 \"{id}\" 为内置角色，无法删除"));
    }

    let root = user_pets_dir(&app)?;
    let target = root.join(&id);

    if !target.is_dir() {
        return Err(format!("角色 \"{id}\" 不存在"));
    }

    fs::remove_dir_all(&target).map_err(|err| format!("删除角色失败: {err}"))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn valid_pet_ids() {
        for id in ["frieren", "fern", "a1", "pet_1", "Pet-Name", "0123456789"] {
            assert!(is_valid_pet_id(id), "should accept {id:?}");
        }
    }

    #[test]
    fn invalid_pet_ids() {
        for id in ["", "-lead", "_lead", "has space", "中文", "a/b", "a\0b", "x".repeat(65).as_str()] {
            assert!(!is_valid_pet_id(id), "should reject {id:?}");
        }
    }

    #[test]
    fn validation_accepts_minimal_config() {
        let from_dir = tempfile_dir();
        fs::write(from_dir.join("sleep.gif"), b"gif").unwrap();

        let config = PetConfigRaw {
            id: "newpet".into(),
            name: "New Pet".into(),
            format: "gif".into(),
            width: 100.0,
            height: 100.0,
            default_state: "sleep".into(),
            preview: None,
            version: None,
            capabilities: HashMap::new(),
            states: HashMap::from([(
                "sleep".into(),
                PetStateConfigRaw {
                    src: "sleep.gif".into(),
                    r#loop: true,
                    duration_ms: None,
                    next: None,
                },
            )]),
        };

        assert!(validate_pet_config(&config, &from_dir).is_ok());
    }

    #[test]
    fn validation_accepts_huge_dimensions() {
        let from_dir = tempfile_dir();
        fs::write(from_dir.join("sleep.gif"), b"gif").unwrap();

        let config = PetConfigRaw {
            id: "bigpet".into(),
            name: "Big Pet".into(),
            format: "gif".into(),
            width: 20_000_000_000.0,
            height: 20_000_000_000.0,
            default_state: "sleep".into(),
            preview: None,
            version: None,
            capabilities: HashMap::new(),
            states: HashMap::from([(
                "sleep".into(),
                PetStateConfigRaw {
                    src: "sleep.gif".into(),
                    r#loop: true,
                    duration_ms: None,
                    next: None,
                },
            )]),
        };

        assert!(validate_pet_config(&config, &from_dir).is_ok());
    }

    #[test]
    fn validation_rejects_missing_default_state() {
        let from_dir = tempfile_dir();
        fs::write(from_dir.join("sleep.gif"), b"gif").unwrap();

        let config = PetConfigRaw {
            id: "newpet".into(),
            name: "New Pet".into(),
            format: "gif".into(),
            width: 100.0,
            height: 100.0,
            default_state: "idle".into(),
            preview: None,
            version: None,
            capabilities: HashMap::new(),
            states: HashMap::from([(
                "sleep".into(),
                PetStateConfigRaw {
                    src: "sleep.gif".into(),
                    r#loop: true,
                    duration_ms: None,
                    next: None,
                },
            )]),
        };

        let result = validate_pet_config(&config, &from_dir);

        assert!(result.is_err());
    }

    #[test]
    fn validation_rejects_missing_media() {
        let from_dir = tempfile_dir();

        let config = PetConfigRaw {
            id: "newpet".into(),
            name: "New Pet".into(),
            format: "gif".into(),
            width: 100.0,
            height: 100.0,
            default_state: "sleep".into(),
            preview: None,
            version: None,
            capabilities: HashMap::new(),
            states: HashMap::from([(
                "sleep".into(),
                PetStateConfigRaw {
                    src: "missing.gif".into(),
                    r#loop: true,
                    duration_ms: None,
                    next: None,
                },
            )]),
        };

        let result = validate_pet_config(&config, &from_dir);

        assert!(result.is_err());
    }

    #[test]
    fn validation_rejects_bad_capability_target() {
        let from_dir = tempfile_dir();
        fs::write(from_dir.join("sleep.gif"), b"gif").unwrap();

        let config = PetConfigRaw {
            id: "newpet".into(),
            name: "New Pet".into(),
            format: "gif".into(),
            width: 100.0,
            height: 100.0,
            default_state: "sleep".into(),
            preview: None,
            version: None,
            capabilities: HashMap::from([("click".into(), "nope".into())]),
            states: HashMap::from([(
                "sleep".into(),
                PetStateConfigRaw {
                    src: "sleep.gif".into(),
                    r#loop: true,
                    duration_ms: None,
                    next: None,
                },
            )]),
        };

        let result = validate_pet_config(&config, &from_dir);

        assert!(result.is_err());
    }

    #[test]
    fn validation_accepts_object_capability() {
        let from_dir = tempfile_dir();
        fs::write(from_dir.join("sleep.gif"), b"gif").unwrap();

        let config = PetConfigRaw {
            id: "newpet".into(),
            name: "New Pet".into(),
            format: "gif".into(),
            width: 100.0,
            height: 100.0,
            default_state: "sleep".into(),
            preview: None,
            version: None,
            capabilities: HashMap::from([(
                "click".into(),
                CapabilityTarget::Config(PetCapabilityRaw {
                    state: "sleep".into(),
                    cooldown_ms: Some(500),
                    after_ms: None,
                }),
            )]),
            states: HashMap::from([(
                "sleep".into(),
                PetStateConfigRaw {
                    src: "sleep.gif".into(),
                    r#loop: true,
                    duration_ms: None,
                    next: None,
                },
            )]),
        };

        assert!(validate_pet_config(&config, &from_dir).is_ok());
    }

    #[test]
    fn validation_rejects_object_capability_missing_state() {
        let from_dir = tempfile_dir();
        fs::write(from_dir.join("sleep.gif"), b"gif").unwrap();

        let config = PetConfigRaw {
            id: "newpet".into(),
            name: "New Pet".into(),
            format: "gif".into(),
            width: 100.0,
            height: 100.0,
            default_state: "sleep".into(),
            preview: None,
            version: None,
            capabilities: HashMap::from([(
                "click".into(),
                CapabilityTarget::Config(PetCapabilityRaw {
                    state: "nope".into(),
                    cooldown_ms: None,
                    after_ms: None,
                }),
            )]),
            states: HashMap::from([(
                "sleep".into(),
                PetStateConfigRaw {
                    src: "sleep.gif".into(),
                    r#loop: true,
                    duration_ms: None,
                    next: None,
                },
            )]),
        };

        let result = validate_pet_config(&config, &from_dir);

        assert!(result.is_err());
    }

    #[test]
    fn config_roundtrip_serializes_object_capability() {
        let config = PetConfigRaw {
            id: "newpet".into(),
            name: "New Pet".into(),
            format: "gif".into(),
            width: 100.0,
            height: 100.0,
            default_state: "sleep".into(),
            preview: None,
            version: None,
            capabilities: HashMap::from([(
                "click".into(),
                CapabilityTarget::Config(PetCapabilityRaw {
                    state: "sleep".into(),
                    cooldown_ms: Some(500),
                    after_ms: Some(30000),
                }),
            )]),
            states: HashMap::from([(
                "sleep".into(),
                PetStateConfigRaw {
                    src: "sleep.gif".into(),
                    r#loop: true,
                    duration_ms: None,
                    next: None,
                },
            )]),
        };

        let value = serde_json::to_value(&config).unwrap();

        assert_eq!(value["capabilities"]["click"]["state"], "sleep");
        assert_eq!(value["capabilities"]["click"]["cooldownMs"], 500);
        assert_eq!(value["capabilities"]["click"]["afterMs"], 30000);
    }

    #[test]
    fn config_roundtrip_serializes_version() {
        let config = PetConfigRaw {
            id: "newpet".into(),
            name: "New Pet".into(),
            format: "gif".into(),
            width: 100.0,
            height: 100.0,
            default_state: "sleep".into(),
            preview: None,
            version: Some("1.2.0".into()),
            capabilities: HashMap::new(),
            states: HashMap::from([(
                "sleep".into(),
                PetStateConfigRaw {
                    src: "sleep.gif".into(),
                    r#loop: true,
                    duration_ms: None,
                    next: None,
                },
            )]),
        };

        let value = serde_json::to_value(&config).unwrap();

        assert_eq!(value["version"], "1.2.0");

        let back: PetConfigRaw = serde_json::from_value(value).unwrap();

        assert_eq!(back.version.as_deref(), Some("1.2.0"));
    }

    #[test]
    fn validation_rejects_empty_version() {
        let from_dir = tempfile_dir();
        fs::write(from_dir.join("sleep.gif"), b"gif").unwrap();

        let config = PetConfigRaw {
            id: "newpet".into(),
            name: "New Pet".into(),
            format: "gif".into(),
            width: 100.0,
            height: 100.0,
            default_state: "sleep".into(),
            preview: None,
            version: Some("  ".into()),
            capabilities: HashMap::new(),
            states: HashMap::from([(
                "sleep".into(),
                PetStateConfigRaw {
                    src: "sleep.gif".into(),
                    r#loop: true,
                    duration_ms: None,
                    next: None,
                },
            )]),
        };

        let result = validate_pet_config(&config, &from_dir);

        assert!(result.is_err());
    }

    fn tempfile_dir() -> PathBuf {
        static COUNTER: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(0);

        let dir = std::env::temp_dir().join(format!(
            "frieren-pet-test-{}-{}",
            std::process::id(),
            COUNTER.fetch_add(1, std::sync::atomic::Ordering::SeqCst)
        ));

        fs::create_dir_all(&dir).unwrap();

        dir
    }
}
