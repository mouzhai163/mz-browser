pub mod bridge;
pub(crate) mod browser;
pub mod cdp;
mod cdp_act;
pub mod config;
pub mod error;
pub mod manager;
mod security;
pub mod server;
pub mod tools;

pub use manager::McpManager;
