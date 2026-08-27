use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Deserialize, Serialize)]
struct StoryPilotRpcRequest {
    id: String,
    command: String,
    #[serde(default)]
    payload: Value,
}

#[tauri::command]
async fn story_pilot_rpc(request: StoryPilotRpcRequest) -> Result<Value, String> {
    let sidecar_url = resolve_sidecar_base_url()?;

    story_pilot_rpc_to_url(&sidecar_url, request).await
}

async fn story_pilot_rpc_to_url(
    sidecar_base_url: &str,
    request: StoryPilotRpcRequest,
) -> Result<Value, String> {
    let endpoint = build_rpc_endpoint(sidecar_base_url)?;
    let response = reqwest::Client::new()
        .post(endpoint)
        .json(&request)
        .send()
        .await
        .map_err(|error| format!("SIDECAR_RPC_REQUEST_FAILED: {error}"))?;
    let status = response.status();
    let body = response
        .json::<Value>()
        .await
        .map_err(|error| format!("SIDECAR_RPC_RESPONSE_PARSE_FAILED: {error}"))?;

    if !status.is_success() {
        return Err(format!("SIDECAR_RPC_HTTP_ERROR: {status}"));
    }

    Ok(body)
}

fn resolve_sidecar_base_url() -> Result<String, String> {
    if let Ok(url) = std::env::var("STORY_PILOT_SIDECAR_URL") {
        return Ok(url);
    }

    let host =
        std::env::var("STORY_PILOT_SIDECAR_HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let port = std::env::var("STORY_PILOT_SIDECAR_PORT").map_err(|_| {
        "STORY_PILOT_SIDECAR_URL or STORY_PILOT_SIDECAR_PORT must be set".to_string()
    })?;

    Ok(format!("http://{host}:{port}"))
}

fn build_rpc_endpoint(sidecar_base_url: &str) -> Result<reqwest::Url, String> {
    let base_url = reqwest::Url::parse(sidecar_base_url)
        .map_err(|error| format!("SIDECAR_URL_INVALID: {error}"))?;

    base_url
        .join("rpc")
        .map_err(|error| format!("SIDECAR_RPC_URL_INVALID: {error}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![story_pilot_rpc])
        .run(tauri::generate_context!())
        .expect("error while running Story Pilot desktop app");
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::io::{Read, Write};
    use std::net::TcpListener;
    use std::sync::mpsc;
    use std::thread;

    #[test]
    fn story_pilot_rpc_forwards_rpc_envelope_to_sidecar() {
        let (url_tx, url_rx) = mpsc::channel();
        let (body_tx, body_rx) = mpsc::channel();

        let server = thread::spawn(move || {
            let listener = TcpListener::bind("127.0.0.1:0").expect("bind test sidecar");
            url_tx
                .send(format!(
                    "http://{}",
                    listener.local_addr().expect("local addr")
                ))
                .expect("send test sidecar url");

            let (mut stream, _) = listener.accept().expect("accept test request");
            let mut request_bytes = Vec::new();
            let mut buffer = [0_u8; 1024];

            loop {
                let bytes_read = stream.read(&mut buffer).expect("read request");
                if bytes_read == 0 {
                    break;
                }
                request_bytes.extend_from_slice(&buffer[..bytes_read]);
                if request_bytes.windows(4).any(|window| window == b"\r\n\r\n") {
                    let request_text = String::from_utf8_lossy(&request_bytes);
                    if let Some(content_length) = content_length(&request_text) {
                        let body_start =
                            request_text.find("\r\n\r\n").expect("header terminator") + 4;
                        if request_bytes.len() >= body_start + content_length {
                            break;
                        }
                    }
                }
            }

            let request_text = String::from_utf8(request_bytes).expect("request is utf8");
            let body_start = request_text.find("\r\n\r\n").expect("header terminator") + 4;
            body_tx
                .send(request_text[body_start..].to_string())
                .expect("send request body");

            let response_body = r#"{"id":"req_1","ok":true,"data":{"status":"ok"}}"#;
            let response = format!(
                "HTTP/1.1 200 OK\r\ncontent-type: application/json\r\ncontent-length: {}\r\n\r\n{}",
                response_body.len(),
                response_body
            );
            stream
                .write_all(response.as_bytes())
                .expect("write response");
        });

        let url = url_rx.recv().expect("test sidecar url");
        let request = StoryPilotRpcRequest {
            command: "app.health".to_string(),
            id: "req_1".to_string(),
            payload: json!({ "source": "rust-test" }),
        };
        let response = tauri::async_runtime::block_on(story_pilot_rpc_to_url(&url, request))
            .expect("forward rpc");

        assert_eq!(response["ok"], true);
        assert_eq!(response["data"]["status"], "ok");
        assert_eq!(
            serde_json::from_str::<Value>(&body_rx.recv().expect("request body"))
                .expect("json body"),
            json!({
                "command": "app.health",
                "id": "req_1",
                "payload": { "source": "rust-test" }
            })
        );
        server.join().expect("server thread");
    }

    fn content_length(request_text: &str) -> Option<usize> {
        request_text.lines().find_map(|line| {
            let (name, value) = line.split_once(':')?;
            if name.eq_ignore_ascii_case("content-length") {
                value.trim().parse().ok()
            } else {
                None
            }
        })
    }
}
