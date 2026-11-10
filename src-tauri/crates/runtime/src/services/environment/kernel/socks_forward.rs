//! Firefox 环境的本地代理转发。
//!
//! Firefox 不能从偏好项里读代理账号密码（SOCKS5 认证完全不支持，HTTP 代理认证会弹窗），
//! 所以浏览器只连本机的一个无认证 SOCKS5 端口，由这里带上账号密码连到真正的代理。
//! 直连环境也走这里（上游为直连），这样运行中切换代理不需要重启浏览器。
//! 域名由上游代理解析（浏览器开着 `socks_remote_dns`），本机 DNS 不会泄露访问的网站。

use std::sync::Arc;

use base64::Engine;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::RwLock;
use tokio::task::JoinHandle;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Upstream {
    Direct,
    Http { host: String, port: u16, auth: Option<(String, String)> },
    Socks5 { host: String, port: u16, auth: Option<(String, String)> },
}

impl Upstream {
    /// 解析运行时收到的代理配置（server 形如 `socks5://host:port`，账号按 server 存）
    pub fn from_proxy(
        proxy: Option<&super::types::BrowserProxyConfigPayload>,
    ) -> Result<Self, String> {
        let Some(proxy) = proxy else { return Ok(Self::Direct) };
        let (scheme, rest) = proxy
            .server
            .split_once("://")
            .ok_or_else(|| format!("代理地址无效：{}", proxy.server))?;
        let (host, port) = rest
            .rsplit_once(':')
            .ok_or_else(|| format!("代理地址缺少端口：{}", proxy.server))?;
        let host = host.trim_start_matches('[').trim_end_matches(']').to_string();
        let port: u16 = port.parse().map_err(|_| format!("代理端口无效：{}", proxy.server))?;
        let auth = proxy
            .auth
            .as_ref()
            .and_then(|auth| auth.get(&proxy.server))
            .map(|auth| (auth.username.clone(), auth.password.clone()));
        match scheme.to_ascii_lowercase().as_str() {
            "http" => Ok(Self::Http { host, port, auth }),
            "socks5" => Ok(Self::Socks5 { host, port, auth }),
            other => Err(format!("Firefox 内核暂不支持 {other} 代理")),
        }
    }
}

pub struct Forwarder {
    pub port: u16,
    upstream: Arc<RwLock<Upstream>>,
    task: JoinHandle<()>,
}

impl Forwarder {
    pub async fn start(upstream: Upstream) -> Result<Self, String> {
        let listener = TcpListener::bind(("127.0.0.1", 0))
            .await
            .map_err(|error| format!("本地代理端口启动失败：{error}"))?;
        let port = listener.local_addr().map_err(|error| error.to_string())?.port();
        let upstream = Arc::new(RwLock::new(upstream));
        let shared = upstream.clone();
        let task = tokio::spawn(async move {
            loop {
                let Ok((client, _)) = listener.accept().await else { continue };
                let upstream = shared.read().await.clone();
                tokio::spawn(async move {
                    let _ = handle(client, upstream).await;
                });
            }
        });
        Ok(Self { port, upstream, task })
    }

    /// 之后的新连接走新的上游；已经建立的连接不受影响
    pub async fn set_upstream(&self, upstream: Upstream) {
        *self.upstream.write().await = upstream;
    }
}

impl Drop for Forwarder {
    fn drop(&mut self) {
        self.task.abort();
    }
}

async fn handle(mut client: TcpStream, upstream: Upstream) -> std::io::Result<()> {
    // 问候：只接受“无需认证”
    let mut head = [0u8; 2];
    client.read_exact(&mut head).await?;
    if head[0] != 5 {
        return Ok(());
    }
    let mut methods = vec![0u8; head[1] as usize];
    client.read_exact(&mut methods).await?;
    if !methods.contains(&0) {
        client.write_all(&[5, 0xff]).await?;
        return Ok(());
    }
    client.write_all(&[5, 0]).await?;

    // 请求：只支持 CONNECT
    let mut request = [0u8; 4];
    client.read_exact(&mut request).await?;
    if request[1] != 1 {
        client.write_all(&[5, 7, 0, 1, 0, 0, 0, 0, 0, 0]).await?;
        return Ok(());
    }
    let host = match request[3] {
        1 => {
            let mut ip = [0u8; 4];
            client.read_exact(&mut ip).await?;
            std::net::Ipv4Addr::from(ip).to_string()
        }
        3 => {
            let mut len = [0u8; 1];
            client.read_exact(&mut len).await?;
            let mut name = vec![0u8; len[0] as usize];
            client.read_exact(&mut name).await?;
            String::from_utf8_lossy(&name).into_owned()
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
    let mut port = [0u8; 2];
    client.read_exact(&mut port).await?;
    let port = u16::from_be_bytes(port);

    let mut remote = match connect_upstream(&upstream, &host, port).await {
        Ok(remote) => remote,
        Err(_) => {
            // 上游连不上就失败，绝不改用直连
            client.write_all(&[5, 1, 0, 1, 0, 0, 0, 0, 0, 0]).await?;
            return Ok(());
        }
    };
    client.write_all(&[5, 0, 0, 1, 0, 0, 0, 0, 0, 0]).await?;
    tokio::io::copy_bidirectional(&mut client, &mut remote).await?;
    Ok(())
}

fn authority(host: &str, port: u16) -> String {
    if host.contains(':') { format!("[{host}]:{port}") } else { format!("{host}:{port}") }
}

async fn connect_upstream(upstream: &Upstream, host: &str, port: u16) -> std::io::Result<TcpStream> {
    match upstream {
        Upstream::Direct => TcpStream::connect(authority(host, port)).await,
        Upstream::Http { host: proxy_host, port: proxy_port, auth } => {
            let mut stream = TcpStream::connect(authority(proxy_host, *proxy_port)).await?;
            let target = authority(host, port);
            let mut request = format!("CONNECT {target} HTTP/1.1\r\nHost: {target}\r\n");
            if let Some((username, password)) = auth {
                let token = base64::engine::general_purpose::STANDARD
                    .encode(format!("{username}:{password}"));
                request.push_str(&format!("Proxy-Authorization: Basic {token}\r\n"));
            }
            request.push_str("\r\n");
            stream.write_all(request.as_bytes()).await?;
            // 读到响应头结束为止；代理在 200 之后、我们发数据之前不会再发别的
            let mut response = Vec::with_capacity(256);
            let mut byte = [0u8; 1];
            while !response.ends_with(b"\r\n\r\n") {
                if response.len() > 16 * 1024 || stream.read(&mut byte).await? == 0 {
                    return Err(std::io::Error::other("代理响应无效"));
                }
                response.push(byte[0]);
            }
            let status_line = String::from_utf8_lossy(&response);
            let ok = status_line
                .split_whitespace()
                .nth(1)
                .is_some_and(|code| code == "200");
            if ok { Ok(stream) } else { Err(std::io::Error::other("代理拒绝了连接")) }
        }
        Upstream::Socks5 { host: proxy_host, port: proxy_port, auth } => {
            let mut stream = TcpStream::connect(authority(proxy_host, *proxy_port)).await?;
            if auth.is_some() {
                stream.write_all(&[5, 2, 0, 2]).await?;
            } else {
                stream.write_all(&[5, 1, 0]).await?;
            }
            let mut choice = [0u8; 2];
            stream.read_exact(&mut choice).await?;
            match (choice[1], auth) {
                (0, _) => {}
                (2, Some((username, password))) => {
                    let mut message = vec![1, username.len() as u8];
                    message.extend_from_slice(username.as_bytes());
                    message.push(password.len() as u8);
                    message.extend_from_slice(password.as_bytes());
                    stream.write_all(&message).await?;
                    let mut status = [0u8; 2];
                    stream.read_exact(&mut status).await?;
                    if status[1] != 0 {
                        return Err(std::io::Error::other("SOCKS5 代理认证失败"));
                    }
                }
                _ => return Err(std::io::Error::other("SOCKS5 代理不接受认证方式")),
            }
            let mut request = vec![5, 1, 0, 3, host.len() as u8];
            request.extend_from_slice(host.as_bytes());
            request.extend_from_slice(&port.to_be_bytes());
            stream.write_all(&request).await?;
            let mut reply = [0u8; 4];
            stream.read_exact(&mut reply).await?;
            if reply[1] != 0 {
                return Err(std::io::Error::other("SOCKS5 代理拒绝了连接"));
            }
            let skip = match reply[3] {
                1 => 4 + 2,
                4 => 16 + 2,
                3 => {
                    let mut len = [0u8; 1];
                    stream.read_exact(&mut len).await?;
                    len[0] as usize + 2
                }
                _ => return Err(std::io::Error::other("SOCKS5 代理响应无效")),
            };
            let mut rest = vec![0u8; skip];
            stream.read_exact(&mut rest).await?;
            Ok(stream)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::environment::kernel::types::{BrowserProxyAuthPayload, BrowserProxyConfigPayload};

    async fn socks_connect(port: u16, host: &str, target_port: u16) -> TcpStream {
        let mut stream = TcpStream::connect(("127.0.0.1", port)).await.unwrap();
        stream.write_all(&[5, 1, 0]).await.unwrap();
        let mut reply = [0u8; 2];
        stream.read_exact(&mut reply).await.unwrap();
        assert_eq!(reply, [5, 0]);
        let mut request = vec![5, 1, 0, 3, host.len() as u8];
        request.extend_from_slice(host.as_bytes());
        request.extend_from_slice(&target_port.to_be_bytes());
        stream.write_all(&request).await.unwrap();
        let mut reply = [0u8; 10];
        stream.read_exact(&mut reply).await.unwrap();
        assert_eq!(reply[1], 0, "SOCKS5 reply code");
        stream
    }

    #[tokio::test]
    async fn direct_upstream_relays_bytes() {
        let echo = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let echo_port = echo.local_addr().unwrap().port();
        tokio::spawn(async move {
            let (mut socket, _) = echo.accept().await.unwrap();
            let mut buf = [0u8; 5];
            socket.read_exact(&mut buf).await.unwrap();
            socket.write_all(&buf).await.unwrap();
        });
        let forwarder = Forwarder::start(Upstream::Direct).await.unwrap();
        let mut stream = socks_connect(forwarder.port, "127.0.0.1", echo_port).await;
        stream.write_all(b"hello").await.unwrap();
        let mut buf = [0u8; 5];
        stream.read_exact(&mut buf).await.unwrap();
        assert_eq!(&buf, b"hello");
    }

    #[tokio::test]
    async fn http_upstream_sends_connect_with_basic_auth() {
        let proxy = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let proxy_port = proxy.local_addr().unwrap().port();
        let seen = tokio::spawn(async move {
            let (mut socket, _) = proxy.accept().await.unwrap();
            let mut head = Vec::new();
            let mut byte = [0u8; 1];
            while !head.ends_with(b"\r\n\r\n") {
                socket.read_exact(&mut byte).await.unwrap();
                head.push(byte[0]);
            }
            socket.write_all(b"HTTP/1.1 200 Connection established\r\n\r\n").await.unwrap();
            let mut buf = [0u8; 2];
            socket.read_exact(&mut buf).await.unwrap();
            socket.write_all(b"ok").await.unwrap();
            String::from_utf8(head).unwrap()
        });
        let upstream = Upstream::Http {
            host: "127.0.0.1".into(),
            port: proxy_port,
            auth: Some(("user".into(), "pa:ss".into())),
        };
        let forwarder = Forwarder::start(upstream).await.unwrap();
        let mut stream = socks_connect(forwarder.port, "example.com", 443).await;
        stream.write_all(b"hi").await.unwrap();
        let mut buf = [0u8; 2];
        stream.read_exact(&mut buf).await.unwrap();
        assert_eq!(&buf, b"ok");
        let head = seen.await.unwrap();
        assert!(head.starts_with("CONNECT example.com:443 HTTP/1.1\r\n"));
        // base64("user:pa:ss")
        assert!(head.contains("Proxy-Authorization: Basic dXNlcjpwYTpzcw==\r\n"));
    }

    #[tokio::test]
    async fn a_dead_upstream_fails_instead_of_going_direct() {
        let unused = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let dead_port = unused.local_addr().unwrap().port();
        drop(unused);
        let forwarder = Forwarder::start(Upstream::Socks5 { host: "127.0.0.1".into(), port: dead_port, auth: None })
            .await
            .unwrap();
        let mut stream = TcpStream::connect(("127.0.0.1", forwarder.port)).await.unwrap();
        stream.write_all(&[5, 1, 0]).await.unwrap();
        let mut reply = [0u8; 2];
        stream.read_exact(&mut reply).await.unwrap();
        stream.write_all(&[5, 1, 0, 3, 11]).await.unwrap();
        stream.write_all(b"example.com").await.unwrap();
        stream.write_all(&443u16.to_be_bytes()).await.unwrap();
        let mut reply = [0u8; 10];
        stream.read_exact(&mut reply).await.unwrap();
        assert_eq!(reply[1], 1);
    }

    #[test]
    fn proxy_payloads_become_upstreams() {
        let payload = BrowserProxyConfigPayload {
            mode: "fixed_servers".into(),
            server: "socks5://1.2.3.4:1080".into(),
            bypass_list: None,
            auth: Some(std::collections::HashMap::from([(
                "socks5://1.2.3.4:1080".to_string(),
                BrowserProxyAuthPayload { username: "u".into(), password: "p".into() },
            )])),
        };
        assert_eq!(
            Upstream::from_proxy(Some(&payload)).unwrap(),
            Upstream::Socks5 { host: "1.2.3.4".into(), port: 1080, auth: Some(("u".into(), "p".into())) }
        );
        assert_eq!(Upstream::from_proxy(None).unwrap(), Upstream::Direct);
        let https = BrowserProxyConfigPayload { server: "https://h:1".into(), auth: None, ..payload };
        assert!(Upstream::from_proxy(Some(&https)).is_err());
    }
}
