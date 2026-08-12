#[cfg(not(target_os = "macos"))]
mod common;

#[cfg(target_os = "macos")]
mod macos;

use tauri::{
    App, AppHandle, Emitter, Manager, Wry,
    image::Image,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};

const MAIN_WINDOW_LABEL: &str = "main";
const PREFERENCE_WINDOW_LABEL: &str = "preference";

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

pub fn refresh_tray_menu(app: &AppHandle<Wry>) {
    let Some(tray) = app.tray_by_id(MAIN_WINDOW_LABEL) else {
        return;
    };

    let visible = app
        .get_webview_window(MAIN_WINDOW_LABEL)
        .and_then(|window| window.is_visible().ok())
        .unwrap_or(false);

    let label = if visible { "隐藏" } else { "显示" };

    let Ok(settings) = MenuItem::with_id(app, "settings", "设置", true, None::<&str>) else {
        return;
    };
    let Ok(shop) = MenuItem::with_id(app, "shop", "商店", true, None::<&str>) else {
        return;
    };
    let Ok(toggle) = MenuItem::with_id(app, "toggle", label, true, None::<&str>) else {
        return;
    };
    let Ok(quit) = MenuItem::with_id(app, "quit", "退出", true, None::<&str>) else {
        return;
    };
    let Ok(menu) = Menu::with_items(app, &[&settings, &shop, &toggle, &quit]) else {
        return;
    };

    let _ = tray.set_menu(Some(menu));
}

fn setup_tray(app: &App<Wry>) -> tauri::Result<()> {
    let icon = Image::from_bytes(TRAY_ICON)?;

    TrayIconBuilder::with_id(MAIN_WINDOW_LABEL)
        .icon(icon)
        .tooltip("Frieren Pet")
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
                    refresh_tray_menu(app);
                }
            }
        })
        .on_menu_event(|app, event| match event.id().as_ref() {
            "settings" => {
                if let Some(window) = app.get_webview_window(PREFERENCE_WINDOW_LABEL) {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "shop" => {
                if let Some(window) = app.get_webview_window(PREFERENCE_WINDOW_LABEL) {
                    let _ = window.emit("open-shop-tab", ());
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "toggle" => {
                if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
                    match window.is_visible() {
                        Ok(true) => {
                            let _ = window.hide();
                        }
                        _ => {
                            let _ = window.show();
                        }
                    }
                    refresh_tray_menu(app);
                }
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .build(app)?;

    refresh_tray_menu(app.handle());

    Ok(())
}
