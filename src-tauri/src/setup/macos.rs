use tauri::{App, AppHandle, Manager, Wry};
use tauri_nspanel::{
    CollectionBehavior, PanelLevel, StyleMask, WebviewWindowExt, tauri_panel,
};

const MAIN_WINDOW_LABEL: &str = "main";

tauri_panel! {
    panel!(NsPanel {
        config: {
            is_floating_panel: true,
            can_become_key_window: true,
            can_become_main_window: false
        }
    })
}

pub fn setup(app: &App<Wry>) {
    let _ = app.handle().plugin(tauri_nspanel::init::<Wry>());

    let _ = app
        .handle()
        .set_activation_policy(tauri::ActivationPolicy::Accessory);

    let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) else {
        return;
    };

    let Ok(panel) = window.to_panel::<NsPanel>() else {
        return;
    };

    panel.set_level(PanelLevel::Dock.value());
    panel.set_style_mask(StyleMask::empty().resizable().nonactivating_panel().into());
    panel.set_collection_behavior(
        CollectionBehavior::new()
            .stationary()
            .move_to_active_space()
            .full_screen_auxiliary()
            .into(),
    );
}

pub fn set_preference_visible(app: &AppHandle<Wry>, visible: bool) {
    let _ = app.set_activation_policy(if visible {
        tauri::ActivationPolicy::Regular
    } else {
        tauri::ActivationPolicy::Accessory
    });
}
