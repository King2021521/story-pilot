use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::net::TcpListener;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{Manager, State};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;
use uuid::Uuid;

const MANAGED_SIDECAR_BINARY: &str = "binaries/story-pilot-sidecar";
const MANAGED_SIDECAR_HOST: &str = "127.0.0.1";
const SIDECAR_RPC_RETRY_ATTEMPTS: usize = 30;
const SIDECAR_RPC_RETRY_DELAY: Duration = Duration::from_millis(100);

#[derive(Clone, Debug, Deserialize, Serialize)]
struct StoryPilotRpcRequest {
    id: String,
    command: String,
    #[serde(default)]
    payload: Value,
}

#[tauri::command]
async fn story_pilot_rpc(
    state: State<'_, SidecarBridgeState>,
    request: StoryPilotRpcRequest,
) -> Result<Value, String> {
    story_pilot_rpc_to_url(
        &state.connection.base_url,
        state.connection.bridge_token.as_deref(),
        request,
    )
    .await
}

async fn story_pilot_rpc_to_url(
    sidecar_base_url: &str,
    bridge_token: Option<&str>,
    request: StoryPilotRpcRequest,
) -> Result<Value, String> {
    story_pilot_rpc_to_url_with_retry(
        sidecar_base_url,
        bridge_token,
        request,
        SIDECAR_RPC_RETRY_ATTEMPTS,
        SIDECAR_RPC_RETRY_DELAY,
    )
    .await
}

async fn story_pilot_rpc_to_url_with_retry(
    sidecar_base_url: &str,
    bridge_token: Option<&str>,
    request: StoryPilotRpcRequest,
    attempts: usize,
    retry_delay: Duration,
) -> Result<Value, String> {
    let attempts = attempts.max(1);
    let mut last_error = None;

    for attempt in 0..attempts {
        match story_pilot_rpc_to_url_once(sidecar_base_url, bridge_token, request.clone()).await {
            Ok(response) => return Ok(response),
            Err(error) if is_retryable_sidecar_error(&error) && attempt + 1 < attempts => {
                last_error = Some(error);
                std::thread::sleep(retry_delay);
            }
            Err(error) => return Err(error),
        }
    }

    Err(last_error.unwrap_or_else(|| "SIDECAR_RPC_REQUEST_FAILED".to_string()))
}

async fn story_pilot_rpc_to_url_once(
    sidecar_base_url: &str,
    bridge_token: Option<&str>,
    request: StoryPilotRpcRequest,
) -> Result<Value, String> {
    let endpoint = build_rpc_endpoint(sidecar_base_url)?;
    let mut request_builder = reqwest::Client::new().post(endpoint).json(&request);
    if let Some(token) = bridge_token.filter(|token| !token.is_empty()) {
        request_builder = request_builder.header("x-story-pilot-bridge-token", token);
    }

    let response = request_builder
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

fn is_retryable_sidecar_error(error: &str) -> bool {
    error.starts_with("SIDECAR_RPC_REQUEST_FAILED")
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct SidecarConnection {
    base_url: String,
    bridge_token: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct ManagedSidecarPlan {
    connection: SidecarConnection,
    env: Vec<(String, String)>,
}

struct SidecarBridgeState {
    connection: SidecarConnection,
    child: Mutex<Option<CommandChild>>,
}

impl SidecarBridgeState {
    fn new(connection: SidecarConnection, child: Option<CommandChild>) -> Self {
        Self {
            connection,
            child: Mutex::new(child),
        }
    }
}

impl Drop for SidecarBridgeState {
    fn drop(&mut self) {
        if let Ok(mut child) = self.child.lock() {
            if let Some(child) = child.take() {
                let _ = child.kill();
            }
        }
    }
}

fn resolve_external_sidecar_connection<F>(get_env: F) -> Option<SidecarConnection>
where
    F: Fn(&str) -> Option<String>,
{
    let bridge_token = optional_env(&get_env, "STORY_PILOT_SIDECAR_TOKEN");

    if let Some(url) = optional_env(&get_env, "STORY_PILOT_SIDECAR_URL") {
        return Some(SidecarConnection {
            base_url: url,
            bridge_token,
        });
    }

    let port = optional_env(&get_env, "STORY_PILOT_SIDECAR_PORT")?;
    let host = optional_env(&get_env, "STORY_PILOT_SIDECAR_HOST")
        .unwrap_or_else(|| MANAGED_SIDECAR_HOST.to_string());

    Some(SidecarConnection {
        base_url: format!("http://{host}:{port}"),
        bridge_token,
    })
}

fn optional_env<F>(get_env: &F, key: &str) -> Option<String>
where
    F: Fn(&str) -> Option<String>,
{
    get_env(key).filter(|value| !value.is_empty())
}

fn build_managed_sidecar_plan(port: u16, bridge_token: String) -> ManagedSidecarPlan {
    build_managed_sidecar_plan_with_repo_root(port, bridge_token, default_repo_root())
}

fn build_managed_sidecar_plan_with_repo_root(
    port: u16,
    bridge_token: String,
    repo_root: PathBuf,
) -> ManagedSidecarPlan {
    ManagedSidecarPlan {
        connection: SidecarConnection {
            base_url: format!("http://{MANAGED_SIDECAR_HOST}:{port}"),
            bridge_token: Some(bridge_token.clone()),
        },
        env: vec![
            (
                "STORY_PILOT_SIDECAR_HOST".to_string(),
                MANAGED_SIDECAR_HOST.to_string(),
            ),
            ("STORY_PILOT_SIDECAR_PORT".to_string(), port.to_string()),
            ("STORY_PILOT_SIDECAR_TOKEN".to_string(), bridge_token),
            (
                "STORY_PILOT_REPO_ROOT".to_string(),
                repo_root.to_string_lossy().into_owned(),
            ),
        ],
    }
}

fn default_repo_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../..")
        .canonicalize()
        .unwrap_or_else(|_| Path::new(env!("CARGO_MANIFEST_DIR")).join("../../.."))
}

fn allocate_loopback_port() -> Result<u16, String> {
    let listener = TcpListener::bind((MANAGED_SIDECAR_HOST, 0))
        .map_err(|error| format!("SIDECAR_PORT_ALLOC_FAILED: {error}"))?;
    let port = listener
        .local_addr()
        .map_err(|error| format!("SIDECAR_PORT_READ_FAILED: {error}"))?
        .port();
    drop(listener);
    Ok(port)
}

fn generate_bridge_token() -> String {
    Uuid::new_v4().to_string()
}

fn initialize_sidecar<R: tauri::Runtime>(
    app: &tauri::App<R>,
) -> Result<SidecarBridgeState, String> {
    if let Some(connection) = resolve_external_sidecar_connection(|key| std::env::var(key).ok()) {
        return Ok(SidecarBridgeState::new(connection, None));
    }

    let plan = build_managed_sidecar_plan(allocate_loopback_port()?, generate_bridge_token());
    let mut command = app
        .shell()
        .sidecar(MANAGED_SIDECAR_BINARY)
        .map_err(|error| format!("SIDECAR_COMMAND_CREATE_FAILED: {error}"))?;

    for (key, value) in &plan.env {
        command = command.env(key, value);
    }

    let (mut events, child) = command
        .spawn()
        .map_err(|error| format!("SIDECAR_SPAWN_FAILED: {error}"))?;

    tauri::async_runtime::spawn(async move {
        while let Some(event) = events.recv().await {
            match event {
                CommandEvent::Stderr(line) => {
                    eprintln!(
                        "Story Pilot sidecar stderr: {}",
                        String::from_utf8_lossy(&line)
                    );
                }
                CommandEvent::Error(message) => {
                    eprintln!("Story Pilot sidecar error: {message}");
                }
                CommandEvent::Terminated(payload) => {
                    eprintln!(
                        "Story Pilot sidecar terminated: code={:?} signal={:?}",
                        payload.code, payload.signal
                    );
                }
                CommandEvent::Stdout(_) => {}
                _ => {}
            }
        }
    });

    Ok(SidecarBridgeState::new(plan.connection, Some(child)))
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
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let state = initialize_sidecar(app).map_err(|message| {
                Box::<dyn std::error::Error>::from(std::io::Error::new(
                    std::io::ErrorKind::Other,
                    message,
                ))
            })?;
            app.manage(state);
            Ok(())
        })
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
    use std::time::Duration;

    #[test]
    fn resolves_external_sidecar_url_before_managed_sidecar() {
        let connection = resolve_external_sidecar_connection(|key| match key {
            "STORY_PILOT_SIDECAR_URL" => Some("http://127.0.0.1:39100".to_string()),
            "STORY_PILOT_SIDECAR_TOKEN" => Some("external-token".to_string()),
            _ => None,
        })
        .expect("external sidecar connection");

        assert_eq!(connection.base_url, "http://127.0.0.1:39100");
        assert_eq!(connection.bridge_token.as_deref(), Some("external-token"));
    }

    #[test]
    fn builds_managed_sidecar_plan_with_loopback_port_and_token() {
        let plan = build_managed_sidecar_plan_with_repo_root(
            49152,
            "managed-token".to_string(),
            PathBuf::from("/workspace/story-pilot"),
        );

        assert_eq!(plan.connection.base_url, "http://127.0.0.1:49152");
        assert_eq!(
            plan.connection.bridge_token.as_deref(),
            Some("managed-token")
        );
        assert_eq!(
            plan.env,
            vec![
                (
                    "STORY_PILOT_SIDECAR_HOST".to_string(),
                    "127.0.0.1".to_string()
                ),
                ("STORY_PILOT_SIDECAR_PORT".to_string(), "49152".to_string()),
                (
                    "STORY_PILOT_SIDECAR_TOKEN".to_string(),
                    "managed-token".to_string()
                ),
                (
                    "STORY_PILOT_REPO_ROOT".to_string(),
                    "/workspace/story-pilot".to_string(),
                ),
            ],
        );
    }

    #[test]
    fn story_pilot_rpc_forwards_rpc_envelope_to_sidecar() {
        let (url_tx, url_rx) = mpsc::channel();
        let (request_tx, request_rx) = mpsc::channel();

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
            request_tx
                .send(request_text)
                .expect("send raw test request");

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
        let response = tauri::async_runtime::block_on(story_pilot_rpc_to_url(
            &url,
            Some("bridge-token"),
            request,
        ))
        .expect("forward rpc");
        let raw_request = request_rx.recv().expect("raw request");

        assert_eq!(response["ok"], true);
        assert_eq!(response["data"]["status"], "ok");
        assert!(
            raw_request
                .to_lowercase()
                .contains("x-story-pilot-bridge-token: bridge-token"),
            "missing sidecar bridge token header in request: {raw_request}",
        );
        assert_eq!(
            serde_json::from_str::<Value>(request_body(&raw_request)).expect("json body"),
            json!({
                "command": "app.health",
                "id": "req_1",
                "payload": { "source": "rust-test" }
            })
        );
        server.join().expect("server thread");
    }

    #[test]
    fn story_pilot_rpc_retries_until_managed_sidecar_is_ready() {
        let listener = TcpListener::bind("127.0.0.1:0").expect("reserve delayed sidecar port");
        let addr = listener.local_addr().expect("reserved sidecar addr");
        drop(listener);
        let (request_tx, request_rx) = mpsc::channel();

        let server = thread::spawn(move || {
            thread::sleep(Duration::from_millis(50));
            let listener = TcpListener::bind(addr).expect("bind delayed sidecar");
            accept_rpc_request(listener, request_tx);
        });

        let request = StoryPilotRpcRequest {
            command: "app.health".to_string(),
            id: "req_retry".to_string(),
            payload: json!({}),
        };
        let response = tauri::async_runtime::block_on(story_pilot_rpc_to_url_with_retry(
            &format!("http://{addr}"),
            Some("bridge-token"),
            request,
            10,
            Duration::from_millis(25),
        ))
        .expect("forward rpc after delayed sidecar startup");
        let raw_request = request_rx.recv().expect("raw request");

        assert_eq!(response["ok"], true);
        assert!(raw_request.contains(r#""id":"req_retry""#));
        server.join().expect("server thread");
    }

    fn accept_rpc_request(listener: TcpListener, request_tx: mpsc::Sender<String>) {
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
                    let body_start = request_text.find("\r\n\r\n").expect("header terminator") + 4;
                    if request_bytes.len() >= body_start + content_length {
                        break;
                    }
                }
            }
        }

        let request_text = String::from_utf8(request_bytes).expect("request is utf8");
        request_tx
            .send(request_text)
            .expect("send raw test request");

        let response_body = r#"{"id":"req_test","ok":true,"data":{"status":"ok"}}"#;
        let response = format!(
            "HTTP/1.1 200 OK\r\ncontent-type: application/json\r\ncontent-length: {}\r\n\r\n{}",
            response_body.len(),
            response_body
        );
        stream
            .write_all(response.as_bytes())
            .expect("write response");
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

    fn request_body(request_text: &str) -> &str {
        let body_start = request_text.find("\r\n\r\n").expect("header terminator") + 4;

        &request_text[body_start..]
    }
}
