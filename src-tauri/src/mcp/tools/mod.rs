mod act;
mod agent;
pub mod browser_kernels;
pub mod environments;
pub mod environments_extras;
pub mod groups;
pub mod proxies;
pub mod tags;

use rmcp::handler::server::router::tool::ToolRoute;

use crate::mcp::{config::McpConfig, server::McpServer};

/// The tools offered for the current access policy. The read-only base is always present;
/// page tools, page actions and management are separate opt-in tiers.
pub fn routes(access: &McpConfig) -> Vec<ToolRoute<McpServer>> {
    let mut routes = agent::routes(access.page_tools_enabled);
    if access.act_tools_enabled && access.page_tools_enabled {
        routes.extend(act::routes());
    }
    if access.manage_tools_enabled {
        routes.extend(manage_routes());
    }
    routes
}

fn manage_routes() -> Vec<ToolRoute<McpServer>> {
    let mut routes = Vec::new();
    routes.extend(browser_kernels::routes());
    routes.extend(environments::routes());
    routes.extend(environments_extras::routes());
    routes.extend(groups::routes());
    routes.extend(proxies::routes());
    routes.extend(tags::routes());
    routes
}

#[cfg(test)]
mod tests {
    use super::*;

    fn names(access: &McpConfig) -> Vec<String> {
        routes(access).iter().map(|route| route.attr.name.to_string()).collect()
    }

    #[test]
    fn each_tier_adds_its_own_tools_and_the_default_is_read_only() {
        let mut access = McpConfig::default();
        let base = names(&access);
        assert_eq!(base.len(), 2);
        assert!(base.iter().all(|n| n.contains("authorized")));

        access.page_tools_enabled = true;
        assert_eq!(names(&access).len(), 4);
        access.act_tools_enabled = true;
        let act = names(&access);
        assert_eq!(act.len(), 9);
        assert!(act.contains(&"mz_browser_click".to_string()));
        assert!(!act.iter().any(|n| n.starts_with("mz_create") || n.starts_with("mz_delete")));

        // an act flag without page reading never exposes act tools
        let orphan = McpConfig { act_tools_enabled: true, ..McpConfig::default() };
        assert_eq!(names(&orphan).len(), 2);

        let manage = McpConfig { manage_tools_enabled: true, ..McpConfig::default() };
        let manage_names = names(&manage);
        assert!(manage_names.len() > 30);
        assert!(manage_names.contains(&"mz_create_environment".to_string()));
        assert!(!manage_names.contains(&"mz_browser_click".to_string()));
    }

    #[test]
    fn tool_names_are_unique_with_every_tier_on() {
        let all = McpConfig {
            page_tools_enabled: true,
            act_tools_enabled: true,
            manage_tools_enabled: true,
            ..McpConfig::default()
        };
        let mut seen = names(&all);
        let total = seen.len();
        seen.sort();
        seen.dedup();
        assert_eq!(seen.len(), total, "duplicate tool names");
    }
}
