//! 把"打开环境"请求从新启动的进程转交给已经在运行的应用（本机命名管道）。
//!
//! 为什么不用单实例插件：它只在正式版里启用（开发版和已安装版共用同一个应用标识，
//! 一起启用会互相转发）。命名管道的名字由数据根目录（`SIMPRINT_ROOT_DIR`）决定，
//! 开发/隔离运行和正式版互不干扰，两种构建的行为也一致，便于实测。
//!
//! 安全：管道只接受本机连接；消息只有一种格式 `OPEN_ENV <uuid>\n`，UUID 严格校验，
//! 没有任何命令执行能力——最坏的情况是让应用去打开一个已存在的环境。

use super::is_valid_env_uuid;

/// 消息前缀。
const MESSAGE_PREFIX: &str = "OPEN_ENV ";
/// 一条消息的最大字节数（前缀 + 36 位 UUID + 换行远小于它）。
const MAX_MESSAGE_LEN: usize = 128;

/// 管道名。由数据根目录决定：同一份数据的应用共用一个名字，不同根目录互不干扰。
pub fn pipe_name() -> String {
    let root = std::env::var("SIMPRINT_ROOT_DIR").unwrap_or_default();
    format!(r"\\.\pipe\simprint-open-env-{:016x}", fnv1a(root.to_lowercase().as_bytes()))
}

fn fnv1a(bytes: &[u8]) -> u64 {
    let mut hash: u64 = 0xcbf29ce484222325;
    for byte in bytes {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    hash
}

/// 解析一条管道消息，返回合法的环境 ID。
pub fn parse_message(raw: &[u8]) -> Option<String> {
    if raw.len() > MAX_MESSAGE_LEN {
        return None;
    }
    let text = std::str::from_utf8(raw).ok()?;
    let uuid = text.trim_end_matches(['\r', '\n']).strip_prefix(MESSAGE_PREFIX)?;
    is_valid_env_uuid(uuid).then(|| uuid.to_string())
}

fn encode_message(env_uuid: &str) -> String {
    format!("{MESSAGE_PREFIX}{env_uuid}\n")
}

/// 新启动的进程调用：如果已有应用在运行，把请求交给它并返回 true（调用方随即退出）。
/// 没有应用在运行返回 false，由当前进程自己完成启动。
#[cfg(windows)]
pub fn try_forward(env_uuid: &str) -> bool {
    try_forward_to(&pipe_name(), env_uuid)
}

#[cfg(windows)]
fn try_forward_to(name: &str, env_uuid: &str) -> bool {
    use std::io::Write;
    use std::time::Duration;

    // ERROR_PIPE_BUSY：服务端的所有管道实例正好都有人在连，稍等再试。
    const ERROR_PIPE_BUSY: i32 = 231;

    if !is_valid_env_uuid(env_uuid) {
        return false;
    }
    for _ in 0..20 {
        match std::fs::OpenOptions::new().write(true).open(name) {
            Ok(mut pipe) => return pipe.write_all(encode_message(env_uuid).as_bytes()).is_ok(),
            Err(error) if error.raw_os_error() == Some(ERROR_PIPE_BUSY) => {
                std::thread::sleep(Duration::from_millis(100));
            }
            // 找不到管道 = 没有应用在运行
            Err(_) => return false,
        }
    }
    false
}

#[cfg(not(windows))]
pub fn try_forward(_env_uuid: &str) -> bool {
    false
}

/// 应用启动后调用：监听管道，把收到的合法请求交给 `handler`。
/// 同名管道已经存在（另一个同数据目录的应用在运行）时直接返回，不抢占。
#[cfg(windows)]
pub async fn serve<F>(handler: F)
where
    F: Fn(String) + Send + Sync + 'static,
{
    serve_on(pipe_name(), handler).await
}

#[cfg(windows)]
async fn serve_on<F>(name: String, handler: F)
where
    F: Fn(String) + Send + Sync + 'static,
{
    use std::sync::Arc;
    use std::time::Duration;
    use tokio::io::AsyncReadExt;
    use tokio::net::windows::named_pipe::ServerOptions;

    let handler = Arc::new(handler);
    let mut server = match ServerOptions::new()
        .first_pipe_instance(true)
        .reject_remote_clients(true)
        .create(&name)
    {
        Ok(server) => server,
        Err(error) => {
            log::warn!("open-environment pipe not started ({name}): {error}");
            return;
        }
    };

    loop {
        if let Err(error) = server.connect().await {
            log::warn!("open-environment pipe connect failed: {error}");
            tokio::time::sleep(Duration::from_secs(1)).await;
        }
        let mut connected = server;
        server = match ServerOptions::new().reject_remote_clients(true).create(&name) {
            Ok(next) => next,
            Err(error) => {
                log::error!("open-environment pipe stopped: {error}");
                return;
            }
        };

        let handler = handler.clone();
        tokio::spawn(async move {
            let mut buffer = vec![0u8; MAX_MESSAGE_LEN + 1];
            let read = tokio::time::timeout(Duration::from_secs(2), connected.read(&mut buffer)).await;
            let Ok(Ok(length)) = read else { return };
            match parse_message(&buffer[..length]) {
                Some(env_uuid) => handler(env_uuid),
                None => log::warn!("ignored a malformed open-environment message"),
            }
        });
    }
}

#[cfg(not(windows))]
pub async fn serve<F>(_handler: F)
where
    F: Fn(String) + Send + Sync + 'static,
{
}

#[cfg(test)]
mod tests {
    use super::*;

    const UUID: &str = "c85aac79-2b43-3d15-d8ce-15e7a511a15b";

    #[test]
    fn messages_round_trip_and_reject_anything_else() {
        assert_eq!(parse_message(encode_message(UUID).as_bytes()).as_deref(), Some(UUID));
        assert_eq!(parse_message(format!("OPEN_ENV {UUID}\r\n").as_bytes()).as_deref(), Some(UUID));
        for bad in [
            "".to_string(),
            "OPEN_ENV \n".to_string(),
            format!("OPEN_ENV {UUID} extra\n"),
            format!("open_env {UUID}\n"),
            format!("RUN {UUID}\n"),
            "OPEN_ENV ../../Windows\n".to_string(),
            format!("OPEN_ENV {}\n", "a".repeat(MAX_MESSAGE_LEN)),
        ] {
            assert_eq!(parse_message(bad.as_bytes()), None, "{bad:?}");
        }
        assert_eq!(parse_message(&[0xff, 0xfe, 0x00]), None);
    }

    #[test]
    fn pipe_name_depends_on_the_data_root_only() {
        let first = pipe_name();
        assert!(first.starts_with(r"\\.\pipe\simprint-open-env-"));
        assert_eq!(first, pipe_name());
        assert_ne!(fnv1a(b"c:\\a"), fnv1a(b"c:\\b"));
    }

    #[cfg(windows)]
    #[test]
    fn forwarding_reaches_a_running_server_and_fails_cleanly_without_one() {
        let name = format!(r"\\.\pipe\simprint-open-env-test-{}", std::process::id());
        // 没有服务端：返回 false，让调用方自己启动
        assert!(!try_forward_to(&name, UUID));
        // 非法 ID 永远不会被转发
        assert!(!try_forward_to(&name, "not-a-uuid"));

        let runtime = tokio::runtime::Builder::new_multi_thread().enable_all().build().unwrap();
        let (sender, receiver) = std::sync::mpsc::channel::<String>();
        let server_name = name.clone();
        runtime.spawn(async move {
            serve_on(server_name, move |env_uuid| {
                let _ = sender.send(env_uuid);
            })
            .await
        });
        // 等管道建立
        for _ in 0..50 {
            if std::fs::OpenOptions::new().write(true).open(&name).is_ok() {
                break;
            }
            std::thread::sleep(std::time::Duration::from_millis(50));
        }
        // 上面探测的那次连接什么都没发，服务端会因读取超时忽略它；真正的转发应该送达
        assert!(try_forward_to(&name, UUID));
        let received = receiver.recv_timeout(std::time::Duration::from_secs(5)).unwrap();
        assert_eq!(received, UUID);
    }
}
