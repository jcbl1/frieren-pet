#[cfg(not(target_os = "macos"))]
mod common;

#[cfg(target_os = "macos")]
mod macos;

use tauri::{
    App, Manager, Wry,
    image::Image,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};

const MAIN_WINDOW_LABEL: &str = "main";

#[cfg(target_os = "macos")]
const TRAY_ICON: &[u8] = include_bytes!("../../assets/tray-mac.png");
#[cfg(not(target_os = "macos"))]
const TRAY_ICON: &[u8] = include_bytes!("../../assets/tray.png");

pub fn default(app: &App<Wry>) -> tauri::Result<()> {
    // 托盘创建失败不阻止应用启动（无托盘主机/无头环境）
    if let Err(error) = setup_tray(app) {
        eprintln!("[frieren-pet] tray init failed: {error}");
    }

    #[cfg(target_os = "macos")]
    macos::setup(app);

    #[cfg(not(target_os = "macos"))]
    common::setup(app);

    Ok(())
}

fn setup_tray(app: &App<Wry>) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "显示", true, None::<&str>)?;
    let hide = MenuItem::with_id(app, "hide", "隐藏", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&show, &hide, &quit])?;

    let icon = Image::from_bytes(TRAY_ICON)?;

    TrayIconBuilder::with_id(MAIN_WINDOW_LABEL)
        .icon(icon)
        .tooltip("Frieren Pet")
        .menu(&menu)
        .icon_as_template(true)
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();

                if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
                    match window.is_visible() {
                        Ok(true) => {
                            let _ = window.hide();
                        }
                        _ => {
                            let _ = window.show();
                        }
                    }
                }
            }
        })
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show" => {
                if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
                    let _ = window.show();
                }
            }
            "hide" => {
                if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
                    let _ = window.hide();
                }
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .build(app)?;

    Ok(())
}
