use tauri::ipc::Invoke;

pub mod app;
pub mod default_browser;
pub mod environment;
pub mod file_system;
pub mod local_extensions;
pub mod logging;
pub mod mcp;
pub mod mihomo;
pub mod network;
pub mod rpa;
pub mod store;
pub mod window;

pub fn register_handles() -> impl Fn(Invoke<tauri::Wry>) -> bool + Send + Sync + 'static {
    tauri::generate_handler![
        // App commands
        app::main_window_ready,
        app::show_main_window,
        app::get_auto_start_state,
        app::set_auto_start_enabled,
        app::set_updating_state,
        app::get_app_state,
        app::close_program,
        app::get_executable_path,
        app::is_dev,
        // Window commands
        window::get_window_size,
        window::create_syncer_window,
        window::arrange_environments,
        window::calculate_window_layout,
        window::hide_window,
        window::show_window,
        // Default browser commands
        default_browser::get_default_browser_state,
        default_browser::set_default_browser_environment,
        default_browser::clear_default_browser_environment,
        default_browser::open_default_apps_settings,
        // Environment commands
        environment::get_running_environments,
        environment::start_sync,
        environment::stop_sync,
        environment::export_proxies_to_csv,
        environment::ensure_kernel_ready,
        environment::launch_environment,
        environment::start_environment_by_uuid,
        environment::batch_launch_environments,
        environment::batch_start_environments_by_uuid,
        environment::batch_stop_environments,
        environment::stop_environment,
        environment::refresh_environment_proxy,
        environment::get_connected_environments,
        environment::get_environment_cdp_endpoint,
        environment::list_environment_rpa_tabs,
        environment::select_environment_rpa_tab,
        environment::close_environment_rpa_tab,
        environment::get_environment_status,
        environment::get_all_environment_statuses,
        // File system commands
        file_system::read_text_file,
        file_system::write_text_file,
        file_system::get_storage_default_paths,
        file_system::get_directory_sizes,
        // Security commands
        // Network commands
        network::http_post,
        network::test_proxy,
        network::test_direct_ip,
        network::detect_proxy_ip,
        network::download_files,
        rpa::execute_local_rpa_script,
        // Auth commands
        // Core utilities
        crate::core::utils::process::kill_process,
        crate::core::utils::process::find_process,
        // Logging commands
        logging::log_info,
        logging::log_error,
        local_extensions::import_local_extension_crx,
        local_extensions::import_local_extension_store_url,
        local_extensions::list_local_extensions,
        local_extensions::install_local_extension,
        local_extensions::uninstall_local_extension,
        local_extensions::remove_local_extension,
        local_extensions::disable_local_extension,
        local_extensions::enable_local_extension,
        mcp::get_mcp_config,
        mcp::get_mcp_access_token,
        mcp::rotate_mcp_access_token,
        mcp::update_mcp_config,
        mcp::start_mcp_runtime,
        mcp::reload_mcp_runtime,
        mcp::stop_mcp_runtime,
        mihomo::test_and_attach_mihomo,
        mihomo::get_mihomo_status,
        mihomo::get_mihomo_connection_info,
        mihomo::get_mihomo_overview,
        mihomo::test_mihomo_proxy_delay,
        mihomo::test_mihomo_group_delays,
        mihomo::get_mihomo_node_selection,
        mihomo::apply_mihomo_node_selection,
        mihomo::get_local_mihomo_proxies,
        mihomo::ensure_mihomo_local_proxy_listeners,
        mihomo::update_local_mihomo_proxy,
        // Store commands
        store::get_store_key,
        store::set_store_key,
    ]
}
