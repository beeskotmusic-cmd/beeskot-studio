// =====================================================================
// BEESKOT Studio — le moteur (très petit) : il ouvre la fenêtre et donne
// à l'interface le droit de lire/écrire des fichiers, choisir un dossier,
// ouvrir un projet Ableton, lire l'agenda Google, se relancer et se mettre à jour.
// Tout le reste du logiciel vit dans le dossier « ui ».
// =====================================================================
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .run(tauri::generate_context!())
        .expect("BEESKOT Studio n'a pas pu démarrer");
}
