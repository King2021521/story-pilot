use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[derive(Debug, Deserialize)]
struct StoryPilotCommand {
    command: String,
    #[serde(default)]
    payload: Value,
}

#[derive(Debug, Serialize)]
struct StoryPilotResponse {
    ok: bool,
    data: Value,
}

#[tauri::command]
fn sp_command(input: StoryPilotCommand) -> Result<StoryPilotResponse, String> {
    match input.command.as_str() {
        "app.health" => Ok(StoryPilotResponse {
            ok: true,
            data: json!({
                "service": "story-pilot-desktop",
                "status": "ok",
                "payload": input.payload,
            }),
        }),
        command => Err(format!("Unsupported command: {command}")),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![sp_command])
        .run(tauri::generate_context!())
        .expect("error while running Story Pilot desktop app");
}

