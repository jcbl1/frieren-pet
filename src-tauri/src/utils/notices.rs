use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Notice {
    pub id: String,
    pub kind: String,
    pub title: String,
    #[serde(default)]
    pub subtitle: Option<String>,
    pub body: String,
    #[serde(default)]
    pub published_at: Option<String>,
    #[serde(default)]
    pub actions: Vec<NoticeAction>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NoticeAction {
    pub label: String,
    pub kind: String,
    #[serde(default)]
    pub url: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NoticesResponse {
    pub items: Vec<Notice>,
}

#[tauri::command]
pub async fn fetch_notices(base_url: String) -> Result<NoticesResponse, String> {
    let url = format!("{}/notices", base_url.trim_end_matches('/'));

    let response = reqwest::get(&url)
        .await
        .map_err(|err| format!("获取公告列表失败: {err}"))?;

    if !response.status().is_success() {
        return Err(format!("公告列表返回异常状态: {}", response.status()));
    }

    response
        .json()
        .await
        .map_err(|err| format!("解析公告列表失败: {err}"))
}
