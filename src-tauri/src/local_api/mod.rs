//! 进程内调用业务路由（原本地 HTTP 接口留下的部分）。
//! HTTP 服务已经下线，现在只有 MCP 通过这里访问环境、分组、代理等数据。

pub mod client;
pub mod entitys;
