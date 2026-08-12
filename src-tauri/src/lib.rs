mod setup;
mod utils;

use tauri::Manager;

use utils::pet_download::{fetch_shop_catalog, install_pet_from_url};
use utils::pet_import::{delete_pet, import_pet};

#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            setup::default(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            quit_app,
            import_pet,
            delete_pet,
            fetch_shop_catalog,
            install_pet_from_url
        ])
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_pinia::init())
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(window) = app.get_webview_window("preference") {
                let _ = window.show();
                let _ = window.set_focus();
            } else if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                setup::refresh_tray_menu(app);
            }
        }))
        .on_window_event(|window, event| match event {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                let _ = window.hide();

                api.prevent_close();

                if window.label() == "main" {
                    setup::refresh_tray_menu(window.app_handle());
                }
            }
            _ => {}
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app_handle, _event| {});
}
