use std::collections::HashMap;

use serde::Deserialize;
use serde_json::Value;

use crate::{
    infrastructure::{mihomo::MihomoLocalProxy, proxy::types::ProxyPassword},
    services::environment::ProxyConfig,
};

use super::types::EnvironmentProxyLike;

#[derive(Deserialize)]
struct LocalBinding {
    env_uuid: String,
    node_name: String,
}

pub(super) fn resolve_proxy_config(
    env_uuid: &str,
    bindings: Option<Value>,
    local_proxies: Option<Value>,
    remote_proxy: Option<EnvironmentProxyLike>,
) -> Result<Option<ProxyConfig>, String> {
    let bindings: HashMap<String, LocalBinding> = match bindings {
        Some(value) => serde_json::from_value(value)
            .map_err(|_| "本地代理绑定数据损坏，已阻止启动；请重新选择代理".to_string())?,
        None => HashMap::new(),
    };

    if let Some(binding) = bindings.get(env_uuid) {
        if binding.env_uuid != env_uuid || binding.node_name.trim().is_empty() {
            return Err("本地代理绑定无效，已阻止启动".to_string());
        }
        let proxies: Vec<MihomoLocalProxy> =
            serde_json::from_value(local_proxies.ok_or("本地代理列表不存在，已阻止启动")?)
                .map_err(|_| "本地代理列表损坏，已阻止启动".to_string())?;
        let mut matching = proxies.iter().filter(|proxy| proxy.node_name == binding.node_name);
        let proxy = matching.next().ok_or("绑定的本地代理节点已不存在，已阻止启动")?;
        if matching.next().is_some() {
            return Err("本地代理节点名称重复，已阻止启动；请重新绑定".to_string());
        }
        return validated_proxy(
            &proxy.listen_host,
            proxy.listen_port,
            &proxy.proxy_scheme,
            None,
            None,
        )
        .map(Some);
    }

    let Some(proxy) = remote_proxy else {
        // Only absence of both local binding and remote proxy means direct mode.
        return Ok(None);
    };
    validated_proxy(
        proxy.host.as_deref().ok_or("代理地址缺失，已阻止启动")?,
        proxy.port.ok_or("代理端口缺失，已阻止启动")?,
        proxy.proxy_type.as_deref().unwrap_or("http"),
        proxy.username,
        proxy.password.map(ProxyPassword::plain),
    )
    .map(Some)
}

fn validated_proxy(
    host: &str,
    port: u16,
    scheme: &str,
    username: Option<String>,
    password: Option<ProxyPassword>,
) -> Result<ProxyConfig, String> {
    let host = host.trim();
    let scheme = scheme.trim().to_ascii_lowercase();
    if host.is_empty() || port == 0 || !matches!(scheme.as_str(), "http" | "https" | "socks5") {
        return Err("代理地址、端口或协议无效，已阻止启动".to_string());
    }
    Ok(ProxyConfig {
        host: host.to_string(),
        port,
        proxy_type: scheme,
        username,
        password,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn binding() -> Value {
        json!({"env-1": {"env_uuid": "env-1", "node_name": "test-node"}})
    }

    fn remote(host: Option<&str>, port: Option<u16>) -> EnvironmentProxyLike {
        EnvironmentProxyLike {
            host: host.map(str::to_string),
            port,
            proxy_type: Some("http".into()),
            username: None,
            password: None,
        }
    }

    fn local_proxy() -> Value {
        json!({
            "id": "proxy-1", "controller": "http://127.0.0.1:9090", "name": "Test",
            "node_name": "test-node", "listener_name": "test-listener",
            "listen_host": "127.0.0.1", "listen_port": 18080, "listener_type": "mixed",
            "proxy_scheme": "http", "status": "ready", "created_at": "", "updated_at": ""
        })
    }

    #[test]
    fn only_explicitly_unbound_environments_can_use_direct_mode() {
        assert!(resolve_proxy_config("env-1", None, None, None).unwrap().is_none());
        assert!(resolve_proxy_config("env-1", Some(binding()), None, None).is_err());
        assert!(resolve_proxy_config("env-1", Some(binding()), Some(json!([])), None).is_err());
    }

    #[test]
    fn missing_local_node_does_not_fall_back_to_a_remote_proxy() {
        assert!(
            resolve_proxy_config(
                "env-1",
                Some(binding()),
                Some(json!([])),
                Some(remote(Some("proxy.test"), Some(8080)))
            )
            .is_err()
        );
    }

    #[test]
    fn corrupted_bindings_and_incomplete_remote_proxies_fail_closed() {
        assert!(resolve_proxy_config("env-1", Some(json!("invalid")), None, None).is_err());
        for proxy in [
            remote(None, Some(8080)),
            remote(Some(""), Some(8080)),
            remote(Some("proxy.test"), None),
            remote(Some("proxy.test"), Some(0)),
        ] {
            assert!(resolve_proxy_config("env-1", None, None, Some(proxy)).is_err());
        }
    }

    #[test]
    fn valid_remote_proxy_preserves_configuration() {
        let proxy = resolve_proxy_config(
            "env-1",
            None,
            None,
            Some(remote(Some(" proxy.test "), Some(8080))),
        )
        .unwrap()
        .unwrap();
        assert_eq!(proxy.host, "proxy.test");
        assert_eq!(proxy.port, 8080);
        assert_eq!(proxy.proxy_type, "http");
    }

    #[test]
    fn invalid_schemes_are_not_coerced_to_http() {
        assert!(validated_proxy("proxy.test", 8080, "unknown", None, None).is_err());
    }

    #[test]
    fn valid_local_bindings_resolve_and_duplicate_names_fail_closed() {
        let local = local_proxy();
        let proxy =
            resolve_proxy_config("env-1", Some(binding()), Some(json!([local.clone()])), None)
                .unwrap()
                .unwrap();
        assert_eq!(proxy.host, "127.0.0.1");
        assert_eq!(proxy.port, 18080);
        assert!(
            resolve_proxy_config(
                "env-1",
                Some(binding()),
                Some(json!([local.clone(), local])),
                None
            )
            .is_err()
        );
    }

    #[test]
    fn mismatched_binding_identity_is_rejected() {
        let binding = json!({"env-1": {"env_uuid": "other-env", "node_name": "test-node"}});
        assert!(
            resolve_proxy_config("env-1", Some(binding), Some(json!([local_proxy()])), None)
                .is_err()
        );
    }
}
