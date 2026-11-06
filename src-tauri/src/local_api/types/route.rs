#[derive(Debug, Clone, Copy)]
pub struct LocalApiRoute {
    pub method: &'static str,
    pub local_path: &'static str,
    pub server_path: &'static str,
    pub permission_code: &'static str,
}
