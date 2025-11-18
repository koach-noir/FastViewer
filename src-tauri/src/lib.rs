mod scene;
mod image_loader;
mod commands;

use commands::{
    AppState, load_scene_collection, get_scene_info, get_image,
    next_page, prev_page, get_scene_list, next_scene, prev_scene,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_state = AppState::new();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            load_scene_collection,
            get_scene_info,
            get_image,
            next_page,
            prev_page,
            get_scene_list,
            next_scene,
            prev_scene,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}