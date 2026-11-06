use crate::core::error::Result;
use std::fs;

/// 代理导出数据项
#[derive(serde::Deserialize)]
pub struct ProxyExportItem {
    pub name: String,
    pub host: String,
    pub port: u16,
    pub proxy_type: String,
    pub username: Option<String>,
    pub password: Option<String>,
}

/// 转义 CSV 值
/// 如果包含逗号、换行符或引号，需要用引号包裹并转义内部引号
fn escape_csv(value: &str) -> String {
    if value.is_empty() {
        return String::new();
    }

    if value.contains(',') || value.contains('\n') || value.contains('"') {
        format!("\"{}\"", value.replace('"', "\"\""))
    } else {
        value.to_string()
    }
}

pub struct ProxyExportService;

impl ProxyExportService {
    /// 导出代理到 CSV 文件
    ///
    /// # 参数
    /// - `path`: 文件保存路径
    /// - `proxies`: 代理列表
    /// - `export_plain_password`: 是否导出密码列（当前始终导出明文密码）
    pub async fn export_proxies_to_csv(
        path: String,
        proxies: Vec<ProxyExportItem>,
        _export_plain_password: bool,
    ) -> Result<()> {
        let path_buf = std::path::PathBuf::from(&path);

        // 确保父目录存在
        if let Some(parent) = path_buf.parent() {
            fs::create_dir_all(parent)?;
        }

        // 生成 CSV 内容
        let mut csv_content = String::from("name,host,port,type,username,password\n");

        for proxy in proxies {
            let password = proxy.password.unwrap_or_default();

            // 转义 CSV 值
            let name = escape_csv(&proxy.name);
            let host = escape_csv(&proxy.host);
            let port = proxy.port.to_string();
            let proxy_type = escape_csv(&proxy.proxy_type);
            let username = escape_csv(&proxy.username.unwrap_or_default());
            let password = escape_csv(&password);

            csv_content.push_str(&format!(
                "{},{},{},{},{},{}\n",
                name, host, port, proxy_type, username, password
            ));
        }

        // 写入文件
        fs::write(&path_buf, csv_content)?;

        Ok(())
    }
}
