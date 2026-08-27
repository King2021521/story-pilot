fn main() {
    ensure_sidecar_runner();
    tauri_build::build()
}

fn ensure_sidecar_runner() {
    let manifest_dir = std::path::PathBuf::from(
        std::env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR must be set"),
    );
    let target = std::env::var("TARGET").expect("TARGET must be set");
    let extension = if target.contains("windows") {
        ".exe"
    } else {
        ""
    };
    let binaries_dir = manifest_dir.join("binaries");
    let template_path = binaries_dir.join("story-pilot-sidecar.template.sh");
    let runner_path = binaries_dir.join(format!("story-pilot-sidecar-{target}{extension}"));
    let template = std::fs::read(&template_path).expect("read Story Pilot sidecar runner template");

    std::fs::create_dir_all(&binaries_dir).expect("create Story Pilot sidecar binaries directory");
    if std::fs::read(&runner_path).map_or(true, |existing| existing != template) {
        std::fs::write(&runner_path, template).expect("write Story Pilot sidecar runner");
    }

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;

        let mut permissions = std::fs::metadata(&runner_path)
            .expect("read Story Pilot sidecar runner metadata")
            .permissions();
        permissions.set_mode(0o755);
        std::fs::set_permissions(&runner_path, permissions)
            .expect("mark Story Pilot sidecar runner executable");
    }

    println!("cargo:rerun-if-changed={}", template_path.display());
    println!("cargo:rerun-if-env-changed=TARGET");
}
