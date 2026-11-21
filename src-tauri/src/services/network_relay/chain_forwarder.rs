//! 本地链式代理转发器
//!
//! 链路：客户端（浏览器 / 代理测速）-> 本地端口 -> 前置代理（中转节点 / 系统代理）-> 目标代理 IP -> 目标网站
//!
//! 本地端口同时兼容 HTTP CONNECT 和 SOCKS5 协议（按首字节自动识别），
//! 因此 Chromium、Gecko 以及 reqwest 均可直接使用 `http://127.0.0.1:<port>` 接入。

use std::collections::HashMap;
use std::io;
use std::sync::Arc;

use base64::Engine;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::Mutex;
use tokio::task::JoinHandle;
use tokio_socks::tcp::Socks5Stream;

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum PreProxy {
    Http { host: String, port: u16 },
    Socks5 { host: String, port: u16 },
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct TargetProxy {
    pub scheme: String, // http | https | socks5
    pub host: String,
    pub port: u16,
    pub username: Option<String>,
    pub password: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
struct ForwardKey {
    pre: PreProxy,
    target: TargetProxy,
}

struct RunningForwarder {
    port: u16,
    task: JoinHandle<()>,
}

impl Drop for RunningForwarder {
    fn drop(&mut self) {
        self.task.abort();
    }
}

pub struct ChainForwarderManager {
    active: Mutex<HashMap<ForwardKey, RunningForwarder>>,
}

impl ChainForwarderManager {
    pub fn new() -> Self {
        Self {
            active: Mutex::new(HashMap::new()),
        }
    }

    /// 获取或启动一条 `pre -> target` 的本地链式代理监听端口
    pub async fn ensure_chain_port(
        &self,
        pre: PreProxy,
        target: TargetProxy,
    ) -> Result<u16, String> {
        let key = ForwardKey {
            pre: pre.clone(),
            target: target.clone(),
        };

        let mut guard = self.active.lock().await;
        if let Some(existing) = guard.get(&key) {
            if !existing.task.is_finished() {
                return Ok(existing.port);
            }
        }

        let listener = TcpListener::bind(("127.0.0.1", 0))
            .await
            .map_err(|e| format!("链式代理本地监听失败: {e}"))?;
        let port = listener
            .local_addr()
            .map_err(|e| format!("获取链式代理监听端口失败: {e}"))?
            .port();

        let pre_arc = Arc::new(pre);
        let target_arc = Arc::new(target);

        let task = tokio::spawn(async move {
            loop {
                let Ok((client, _)) = listener.accept().await else {
                    continue;
                };
                let pre = pre_arc.clone();
                let target = target_arc.clone();
                tokio::spawn(async move {
                    if let Err(err) = handle_client(client, &pre, &target).await {
                        log::debug!("chain forwarder connection closed: {err}");
                    }
                });
            }
        });

        guard.insert(key, RunningForwarder { port, task });
        Ok(port)
    }

    /// 停止并清理所有链式代理转发端口
    pub async fn stop_all(&self) {
        let mut guard = self.active.lock().await;
        guard.clear();
    }
}

impl Default for ChainForwarderManager {
    fn default() -> Self {
        Self::new()
    }
}

async fn handle_client(
    mut client: TcpStream,
    pre: &PreProxy,
    target: &TargetProxy,
) -> io::Result<()> {
    let mut first = [0u8; 1];
    client.read_exact(&mut first).await?;

    if first[0] == 0x05 {
        handle_socks5_client(client, pre, target).await
    } else {
        handle_http_client(client, first[0], pre, target).await
    }
}

async fn handle_socks5_client(
    mut client: TcpStream,
    pre: &PreProxy,
    target: &TargetProxy,
) -> io::Result<()> {
    let mut nmethods = [0u8; 1];
    client.read_exact(&mut nmethods).await?;
    let mut methods = vec![0u8; nmethods[0] as usize];
    client.read_exact(&mut methods).await?;
    if !methods.contains(&0) {
        client.write_all(&[5, 0xff]).await?;
        return Ok(());
    }
    client.write_all(&[5, 0]).await?;

    let mut req = [0u8; 4];
    client.read_exact(&mut req).await?;
    if req[1] != 1 {
        client.write_all(&[5, 7, 0, 1, 0, 0, 0, 0, 0, 0]).await?;
        return Ok(());
    }

    let dest_host = match req[3] {
        1 => {
            let mut ip = [0u8; 4];
            client.read_exact(&mut ip).await?;
            std::net::Ipv4Addr::from(ip).to_string()
        }
        3 => {
            let mut len = [0u8; 1];
            client.read_exact(&mut len).await?;
            let mut domain = vec![0u8; len[0] as usize];
            client.read_exact(&mut domain).await?;
            String::from_utf8_lossy(&domain).into_owned()
        }
        4 => {
            let mut ip = [0u8; 16];
            client.read_exact(&mut ip).await?;
            std::net::Ipv6Addr::from(ip).to_string()
        }
        _ => {
            client.write_all(&[5, 8, 0, 1, 0, 0, 0, 0, 0, 0]).await?;
            return Ok(());
        }
    };
    let mut port_buf = [0u8; 2];
    client.read_exact(&mut port_buf).await?;
    let dest_port = u16::from_be_bytes(port_buf);

    let mut remote = match connect_chained(pre, target, &dest_host, dest_port).await {
        Ok(stream) => stream,
        Err(err) => {
            log::debug!("chain socks5 connect failed ({dest_host}:{dest_port}): {err}");
            client.write_all(&[5, 1, 0, 1, 0, 0, 0, 0, 0, 0]).await?;
            return Ok(());
        }
    };

    client.write_all(&[5, 0, 0, 1, 0, 0, 0, 0, 0, 0]).await?;
    let _ = tokio::io::copy_bidirectional(&mut client, &mut remote).await;
    Ok(())
}

async fn handle_http_client(
    mut client: TcpStream,
    first_byte: u8,
    pre: &PreProxy,
    target: &TargetProxy,
) -> io::Result<()> {
    let mut header_buf = vec![first_byte];
    let mut byte = [0u8; 1];
    while header_buf.len() < 32 * 1024 {
        client.read_exact(&mut byte).await?;
        header_buf.push(byte[0]);
        if header_buf.ends_with(b"\r\n\r\n") {
            break;
        }
    }

    let header_text = String::from_utf8_lossy(&header_buf);
    let first_line = header_text.lines().next().unwrap_or("");
    let mut parts = first_line.split_whitespace();
    let method = parts.next().unwrap_or("");
    let target_uri = parts.next().unwrap_or("");

    if method.eq_ignore_ascii_case("CONNECT") {
        let (dest_host, dest_port) = parse_connect_authority(target_uri).ok_or_else(|| {
            io::Error::new(io::ErrorKind::InvalidInput, "invalid CONNECT authority")
        })?;

        let mut remote = match connect_chained(pre, target, &dest_host, dest_port).await {
            Ok(stream) => stream,
            Err(err) => {
                log::debug!("chain HTTP CONNECT failed ({dest_host}:{dest_port}): {err}");
                let _ = client
                    .write_all(b"HTTP/1.1 502 Bad Gateway\r\nContent-Length: 0\r\n\r\n")
                    .await;
                return Ok(());
            }
        };

        client.write_all(b"HTTP/1.1 200 Connection Established\r\n\r\n").await?;
        let _ = tokio::io::copy_bidirectional(&mut client, &mut remote).await;
        Ok(())
    } else {
        // 明文 HTTP 代理请求：解析目标主机并建立链式隧道，重写请求行后转发
        let (dest_host, dest_port, rewritten_path) =
            parse_plain_http_target(target_uri, &header_text).ok_or_else(|| {
                io::Error::new(io::ErrorKind::InvalidInput, "invalid HTTP proxy request")
            })?;

        let mut remote = match connect_chained(pre, target, &dest_host, dest_port).await {
            Ok(stream) => stream,
            Err(err) => {
                log::debug!("chain plain HTTP failed ({dest_host}:{dest_port}): {err}");
                let _ = client
                    .write_all(b"HTTP/1.1 502 Bad Gateway\r\nContent-Length: 0\r\n\r\n")
                    .await;
                return Ok(());
            }
        };

        let version = parts.next().unwrap_or("HTTP/1.1");
        let mut rebuilt = format!("{method} {rewritten_path} {version}\r\n");
        for line in header_text.lines().skip(1) {
            if line.is_empty() {
                continue;
            }
            let lower = line.to_ascii_lowercase();
            if lower.starts_with("proxy-connection:") || lower.starts_with("proxy-authorization:") {
                continue;
            }
            rebuilt.push_str(line);
            rebuilt.push_str("\r\n");
        }
        rebuilt.push_str("\r\n");

        remote.write_all(rebuilt.as_bytes()).await?;
        let _ = tokio::io::copy_bidirectional(&mut client, &mut remote).await;
        Ok(())
    }
}

/// 核心链式建连：`本地 -> pre -> target -> (dest_host, dest_port)`
async fn connect_chained(
    pre: &PreProxy,
    target: &TargetProxy,
    dest_host: &str,
    dest_port: u16,
) -> io::Result<TcpStream> {
    // 第一跳：通过前置代理连接到目标代理 IP
    let mut tunnel = match pre {
        PreProxy::Socks5 { host, port } => {
            let proxy_addr = format!("{host}:{port}");
            let stream =
                Socks5Stream::connect(proxy_addr.as_str(), (target.host.as_str(), target.port))
                    .await
                    .map_err(|e| io::Error::other(format!("前置 SOCKS5 连接目标代理失败: {e}")))?;
            stream.into_inner()
        }
        PreProxy::Http { host, port } => {
            let mut stream = TcpStream::connect((host.as_str(), *port)).await?;
            http_connect_handshake(&mut stream, &target.host, target.port, None, None).await?;
            stream
        }
    };

    // 第二跳：在已建立的隧道上完成目标代理 IP 的握手，连到最终目标网站
    match target.scheme.to_ascii_lowercase().as_str() {
        "socks5" => {
            socks5_handshake(
                &mut tunnel,
                dest_host,
                dest_port,
                target.username.as_deref(),
                target.password.as_deref(),
            )
            .await?;
        }
        _ => {
            http_connect_handshake(
                &mut tunnel,
                dest_host,
                dest_port,
                target.username.as_deref(),
                target.password.as_deref(),
            )
            .await?;
        }
    }

    Ok(tunnel)
}

async fn http_connect_handshake(
    stream: &mut TcpStream,
    host: &str,
    port: u16,
    username: Option<&str>,
    password: Option<&str>,
) -> io::Result<()> {
    let authority = if host.contains(':') && !host.starts_with('[') {
        format!("[{host}]:{port}")
    } else {
        format!("{host}:{port}")
    };

    let mut req = format!("CONNECT {authority} HTTP/1.1\r\nHost: {authority}\r\n");
    if let Some(user) = username.filter(|s| !s.is_empty()) {
        let pass = password.unwrap_or("");
        let token = base64::engine::general_purpose::STANDARD.encode(format!("{user}:{pass}"));
        req.push_str(&format!("Proxy-Authorization: Basic {token}\r\n"));
    }
    req.push_str("\r\n");
    stream.write_all(req.as_bytes()).await?;

    let mut resp = Vec::with_capacity(256);
    let mut byte = [0u8; 1];
    while resp.len() < 8192 {
        stream.read_exact(&mut byte).await?;
        resp.push(byte[0]);
        if resp.ends_with(b"\r\n\r\n") {
            break;
        }
    }

    let text = String::from_utf8_lossy(&resp);
    let status_line = text.lines().next().unwrap_or("");
    let ok = status_line.split_whitespace().nth(1).is_some_and(|code| code.starts_with('2'));
    if !ok {
        return Err(io::Error::other(format!(
            "HTTP CONNECT 代理握手失败: {status_line}"
        )));
    }
    Ok(())
}

async fn socks5_handshake(
    stream: &mut TcpStream,
    dest_host: &str,
    dest_port: u16,
    username: Option<&str>,
    password: Option<&str>,
) -> io::Result<()> {
    let has_auth = username.is_some_and(|u| !u.is_empty());
    if has_auth {
        stream.write_all(&[5, 2, 0, 2]).await?;
    } else {
        stream.write_all(&[5, 1, 0]).await?;
    }

    let mut greeting = [0u8; 2];
    stream.read_exact(&mut greeting).await?;
    if greeting[0] != 5 {
        return Err(io::Error::other("目标 SOCKS5 协议版本无效"));
    }

    match greeting[1] {
        0 => {}
        2 => {
            let user = username.unwrap_or("").as_bytes();
            let pass = password.unwrap_or("").as_bytes();
            if user.len() > 255 || pass.len() > 255 {
                return Err(io::Error::new(
                    io::ErrorKind::InvalidInput,
                    "SOCKS5 认证信息过长",
                ));
            }
            let mut auth_req = Vec::with_capacity(3 + user.len() + pass.len());
            auth_req.push(1);
            auth_req.push(user.len() as u8);
            auth_req.extend_from_slice(user);
            auth_req.push(pass.len() as u8);
            auth_req.extend_from_slice(pass);
            stream.write_all(&auth_req).await?;

            let mut auth_resp = [0u8; 2];
            stream.read_exact(&mut auth_resp).await?;
            if auth_resp[1] != 0 {
                return Err(io::Error::other("目标 SOCKS5 代理认证失败"));
            }
        }
        _ => return Err(io::Error::other("目标 SOCKS5 代理不支持当前认证方式")),
    }

    // 发送 CONNECT 请求（使用域名或 IP）
    let mut connect_req = vec![5, 1, 0];
    if let Ok(ipv4) = dest_host.parse::<std::net::Ipv4Addr>() {
        connect_req.push(1);
        connect_req.extend_from_slice(&ipv4.octets());
    } else if let Ok(ipv6) = dest_host.parse::<std::net::Ipv6Addr>() {
        connect_req.push(4);
        connect_req.extend_from_slice(&ipv6.octets());
    } else {
        let domain = dest_host.as_bytes();
        if domain.len() > 255 {
            return Err(io::Error::new(io::ErrorKind::InvalidInput, "目标域名过长"));
        }
        connect_req.push(3);
        connect_req.push(domain.len() as u8);
        connect_req.extend_from_slice(domain);
    }
    connect_req.extend_from_slice(&dest_port.to_be_bytes());
    stream.write_all(&connect_req).await?;

    let mut head = [0u8; 4];
    stream.read_exact(&mut head).await?;
    if head[0] != 5 || head[1] != 0 {
        return Err(io::Error::other(format!(
            "目标 SOCKS5 CONNECT 失败，状态码: {}",
            head[1]
        )));
    }

    match head[3] {
        1 => {
            let mut skip = [0u8; 6];
            stream.read_exact(&mut skip).await?;
        }
        3 => {
            let mut len = [0u8; 1];
            stream.read_exact(&mut len).await?;
            let mut skip = vec![0u8; len[0] as usize + 2];
            stream.read_exact(&mut skip).await?;
        }
        4 => {
            let mut skip = [0u8; 18];
            stream.read_exact(&mut skip).await?;
        }
        _ => return Err(io::Error::other("目标 SOCKS5 返回未知地址类型")),
    }

    Ok(())
}

fn parse_connect_authority(authority: &str) -> Option<(String, u16)> {
    let trimmed = authority.trim();
    if trimmed.starts_with('[') {
        let (h, p) = trimmed.rsplit_once("]:")?;
        Some((h.trim_start_matches('[').to_string(), p.parse().ok()?))
    } else {
        let (h, p) = trimmed.rsplit_once(':')?;
        Some((h.to_string(), p.parse().ok()?))
    }
}

fn parse_plain_http_target(uri: &str, headers: &str) -> Option<(String, u16, String)> {
    if let Some(rest) = uri.strip_prefix("http://") {
        let (authority, path) = match rest.find('/') {
            Some(idx) => (&rest[..idx], &rest[idx..]),
            None => (rest, "/"),
        };
        let (host, port) = if let Some((h, p)) = authority.rsplit_once(':') {
            (h.to_string(), p.parse::<u16>().ok()?)
        } else {
            (authority.to_string(), 80)
        };
        return Some((host, port, path.to_string()));
    }

    for line in headers.lines().skip(1) {
        if let Some((k, v)) = line.split_once(':') {
            if k.trim().eq_ignore_ascii_case("host") {
                let authority = v.trim();
                let (host, port) = if let Some((h, p)) = authority.rsplit_once(':') {
                    (h.to_string(), p.parse::<u16>().ok()?)
                } else {
                    (authority.to_string(), 80)
                };
                return Some((host, port, uri.to_string()));
            }
        }
    }

    None
}
