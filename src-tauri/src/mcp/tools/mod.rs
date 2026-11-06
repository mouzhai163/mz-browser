mod agent;
pub mod browser_kernels;
pub mod environments;
pub mod environments_extras;
pub mod groups;
pub mod proxies;
pub mod tags;
pub mod workspaces;

use rmcp::handler::server::router::tool::ToolRoute;

use crate::mcp::server::McpServer;

pub fn agent_routes(pages: bool) -> Vec<ToolRoute<McpServer>> {
    agent::routes(pages)
}

pub fn all_routes() -> Vec<ToolRoute<McpServer>> {
    let mut routes = Vec::new();
    routes.extend(browser_kernels::routes());
    routes.extend(environments::routes());
    routes.extend(environments_extras::routes());
    routes.extend(groups::routes());
    routes.extend(proxies::routes());
    routes.extend(tags::routes());
    routes.extend(workspaces::routes());
    routes
}
