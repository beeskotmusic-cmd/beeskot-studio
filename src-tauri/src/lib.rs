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
    let adr = "127.0.0.1:9931".parse().unwrap();   // le port du pont BEESKOT (9877 est souvent pris par d'autres ponts)
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

// ---------- connexion Google : on attend le retour du navigateur sur ce PC (127.0.0.1) ----------
static ECOUTE: std::sync::Mutex<Option<std::net::TcpListener>> = std::sync::Mutex::new(None);

// ce que BEESKOT Studio consomme sur ce PC (pour l'afficheur du bandeau)
#[tauri::command]
fn ressources() -> Result<String, String> {
    use sysinfo::{Pid, ProcessRefreshKind, ProcessesToUpdate, System};
    use std::sync::Mutex;
    static SYS: Mutex<Option<System>> = Mutex::new(None);
    let mut g = SYS.lock().map_err(|e| e.to_string())?;
    let sys = g.get_or_insert_with(System::new);
    let moi = Pid::from_u32(std::process::id());
    sys.refresh_processes_specifics(ProcessesToUpdate::All, true, ProcessRefreshKind::everything());
    let coeurs = std::thread::available_parallelism().map(|n| n.get() as f32).unwrap_or(1.0);
    let mut cpu = 0.0f32;
    let mut ram: u64 = 0;
    // le processus principal + ceux de la fenêtre (WebView) : tout ce que le logiciel utilise
    let miens: Vec<&sysinfo::Process> = sys
        .processes()
        .values()
        .filter(|p| p.pid() == moi || p.parent() == Some(moi) || p.parent().map(|q| sys.process(q).map(|x| x.parent() == Some(moi)).unwrap_or(false)).unwrap_or(false))
        .collect();
    for p in miens {
        cpu += p.cpu_usage();
        ram += p.memory();
    }
    let total = sys.total_memory().max(1);
    Ok(format!(
        "{{\"cpu\":{:.1},\"ramMo\":{},\"ramPct\":{:.1}}}",
        (cpu / coeurs).min(100.0),
        ram / 1_048_576,
        (ram as f64 / total as f64) * 100.0
    ))
}

#[tauri::command]
fn oauth_port() -> Result<u16, String> {
    let l = std::net::TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
    let port = l.local_addr().map_err(|e| e.to_string())?.port();
    *ECOUTE.lock().unwrap() = Some(l);
    Ok(port)
}

#[tauri::command]
async fn oauth_code() -> Result<String, String> {
    let l = ECOUTE.lock().unwrap().take().ok_or("pas d'écoute")?;
    tauri::async_runtime::spawn_blocking(move || {
        l.set_nonblocking(false).ok();
        let (mut s, _) = l.accept().map_err(|e| e.to_string())?;
        s.set_read_timeout(Some(Duration::from_secs(10))).ok();
        let mut ligne = String::new();
        BufReader::new(s.try_clone().map_err(|e| e.to_string())?).read_line(&mut ligne).map_err(|e| e.to_string())?;
        let page = "<html><body style='background:#1d140e;color:#efe4cc;font-family:sans-serif;text-align:center;padding-top:80px'><h2>BEESKOT Studio est relié au Drive ✅</h2><p>Tu peux fermer cette page.</p></body></html>";
        let _ = s.write_all(format!("HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}", page.len(), page).as_bytes());
        // ligne = "GET /?code=...&scope=... HTTP/1.1"
        let chemin = ligne.split_whitespace().nth(1).unwrap_or("");
        let q = chemin.splitn(2, '?').nth(1).unwrap_or("");
        for kv in q.split('&') {
            let mut it = kv.splitn(2, '=');
            if it.next() == Some("code") { return Ok(it.next().unwrap_or("").to_string()); }
        }
        Err("Google n'a pas donné d'autorisation".to_string())
    }).await.map_err(|e| e.to_string())?
}

// ---------- envoyer un gros fichier (zip…) dans le Drive, par morceaux de 8 Mo, sans tout charger en mémoire ----------
#[tauri::command]
async fn drive_envoyer(chemin: String, nom: String, dossier: String, jeton: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        use std::io::Read;
        let taille = std::fs::metadata(&chemin).map_err(|e| e.to_string())?.len();
        let meta = format!("{{\"name\":{},\"parents\":[\"{}\"]}}", serde_json::to_string(&nom).unwrap(), dossier);
        let r = ureq::post("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,webViewLink")
            .set("Authorization", &format!("Bearer {jeton}"))
            .set("Content-Type", "application/json; charset=UTF-8")
            .set("X-Upload-Content-Length", &taille.to_string())
            .send_string(&meta).map_err(|e| format!("Drive : {e}"))?;
        let url = r.header("Location").ok_or("Drive : pas d'adresse d'envoi")?.to_string();
        let mut f = std::fs::File::open(&chemin).map_err(|e| e.to_string())?;
        const BLOC: usize = 8 * 1024 * 1024;
        let mut buf = vec![0u8; BLOC];
        let mut envoye: u64 = 0;
        loop {
            let mut n = 0;
            while n < BLOC { let k = f.read(&mut buf[n..]).map_err(|e| e.to_string())?; if k == 0 { break; } n += k; }
            if n == 0 && envoye > 0 { break; }
            let fin = envoye + n as u64;
            let plage = if taille == 0 { "bytes */0".to_string() } else { format!("bytes {}-{}/{}", envoye, fin - 1, taille) };
            let rep = ureq::put(&url).set("Content-Range", &plage).send_bytes(&buf[..n]);
            match rep {
                Ok(r) => { return Ok(r.into_string().unwrap_or_default()); }             // 200/201 : terminé
                Err(ureq::Error::Status(308, _)) => { envoye = fin; }                      // morceau reçu, on continue
                Err(e) => return Err(format!("Drive : {e}")),
            }
            std::thread::sleep(Duration::from_millis(20));                                   // laisser respirer le PC
            if envoye >= taille { break; }
        }
        Err("Envoi interrompu".to_string())
    }).await.map_err(|e| e.to_string())?
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
        .invoke_handler(tauri::generate_handler![ableton, zipper, oauth_port, oauth_code, drive_envoyer, ressources])
        .run(tauri::generate_context!())
        .expect("BEESKOT Studio n'a pas pu démarrer");
}
