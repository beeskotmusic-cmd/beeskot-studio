// =====================================================================
// BEESKOT Studio — le moteur (très petit) : il ouvre la fenêtre et donne
// à l'interface le droit de lire/écrire des fichiers, choisir un dossier,
// ouvrir un projet Ableton, lire l'agenda Google, se relancer et se mettre à jour.
// En plus : 2 petites commandes maison
//   - ableton : parler au pont BEESKOT installé dans Ableton (sur ce PC seulement)
//   - zipper  : mettre un dossier de projet dans un .zip, doucement, sans bloquer le PC
// Tout le reste du logiciel vit dans le dossier « ui ».
// =====================================================================
use std::io::{BufRead, BufReader, Write};
use std::net::TcpStream;
use std::time::Duration;

#[tauri::command]
fn ableton(requete: String) -> Result<String, String> {
    let adr = "127.0.0.1:9877".parse().unwrap();
    let mut s = TcpStream::connect_timeout(&adr, Duration::from_millis(400))
        .map_err(|_| "Ableton n'est pas relié (ouvert avec le pont BEESKOT ?)".to_string())?;
    s.set_read_timeout(Some(Duration::from_secs(8))).ok();
    s.write_all(format!("{}\n", requete).as_bytes()).map_err(|e| e.to_string())?;
    let mut ligne = String::new();
    BufReader::new(s).read_line(&mut ligne).map_err(|_| "Ableton ne répond pas".to_string())?;
    Ok(ligne)
}

fn zip_dossier(dossier: &str, destination: &str) -> Result<u64, String> {
    use zip::write::SimpleFileOptions;
    use zip::CompressionMethod;
    let racine = std::path::Path::new(dossier);
    let parent = racine.parent().unwrap_or(racine);
    let f = std::fs::File::create(destination).map_err(|e| format!("Impossible de créer le zip : {e}"))?;
    let mut z = zip::ZipWriter::new(std::io::BufWriter::new(f));
    let mut total: u64 = 0;
    for (n, e) in walkdir::WalkDir::new(racine).into_iter().filter_map(|e| e.ok()).enumerate() {
        let p = e.path();
        let nom = p.strip_prefix(parent).unwrap_or(p).to_string_lossy().replace('\\', "/");
        if e.file_type().is_dir() {
            z.add_directory(nom, SimpleFileOptions::default()).ok();
            continue;
        }
        let taille = e.metadata().map(|m| m.len()).unwrap_or(0);
        let audio = matches!(p.extension().and_then(|x| x.to_str()).map(|x| x.to_lowercase()).as_deref(),
            Some("wav" | "aif" | "aiff" | "mp3" | "flac" | "ogg" | "m4a"));
        // l'audio se compresse mal : on le range tel quel (rapide et léger pour le PC)
        let opt = SimpleFileOptions::default()
            .compression_method(if audio { CompressionMethod::Stored } else { CompressionMethod::Deflated })
            .compression_level(Some(1))
            .large_file(taille > 0xFFFF_0000);
        z.start_file(nom, opt).map_err(|e| e.to_string())?;
        let mut src = std::fs::File::open(p).map_err(|e| e.to_string())?;
        total += std::io::copy(&mut src, &mut z).map_err(|e| e.to_string())?;
        if n % 20 == 0 { std::thread::sleep(Duration::from_millis(5)); }   // laisser respirer l'ordinateur
    }
    z.finish().map_err(|e| e.to_string())?;
    Ok(total)
}

#[tauri::command]
async fn zipper(dossier: String, destination: String) -> Result<u64, String> {
    tauri::async_runtime::spawn_blocking(move || zip_dossier(&dossier, &destination))
        .await
        .map_err(|e| e.to_string())?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![ableton, zipper])
        .run(tauri::generate_context!())
        .expect("BEESKOT Studio n'a pas pu démarrer");
}
