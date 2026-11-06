use crate::core::error::Result;

pub struct RuntimeInfo;

impl RuntimeInfo {
    /// 判断是否是开发环境还是生产环境
    pub fn is_dev() -> bool {
        cfg!(debug_assertions)
    }

    /// 当前可执行程序的位置
    pub fn get_executable_path() -> Result<String> {
        Ok(std::env::current_exe()?.to_string_lossy().to_string())
    }
}
