mod storage;

pub use storage::{GetDirectorySizesResponse, StoragePathsResponse, StorageService};

use crate::core::error::Result;
use std::fs;
use std::path::PathBuf;

pub struct FileService;

impl FileService {
    /// 读取指定路径的文本文件内容
    pub async fn read_text_file(path: String) -> Result<String> {
        let path_buf = PathBuf::from(&path);

        // 检查文件是否存在
        if !path_buf.exists() {
            return Err(format!("文件不存在: {}", path).into());
        }

        // 读取文件内容
        fs::read_to_string(&path_buf).map_err(|e| e.into())
    }

    /// 将文本内容写入指定路径的文件
    pub async fn write_text_file(path: String, content: String) -> Result<()> {
        let path_buf = PathBuf::from(path);

        // 确保父目录存在
        if let Some(parent) = path_buf.parent() {
            fs::create_dir_all(parent)?;
        }

        // 写入文件
        fs::write(&path_buf, content)?;

        Ok(())
    }
}
