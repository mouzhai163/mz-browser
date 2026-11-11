mod storage;

pub use storage::{GetDirectorySizesResponse, StoragePathsResponse, StorageService};

use crate::core::error::Result;
use std::fs;
use std::path::PathBuf;

pub struct FileService;

/// 导入导出只用这几种文本文件。限制后缀后，界面即使被攻破也写不了可执行文件、读不了数据库
const ALLOWED_TEXT_EXTENSIONS: [&str; 3] = ["txt", "csv", "json"];

fn check_text_file(path: &std::path::Path) -> Result<()> {
    let allowed = path
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| ALLOWED_TEXT_EXTENSIONS.contains(&extension.to_ascii_lowercase().as_str()));
    if allowed {
        Ok(())
    } else {
        Err(format!("只支持读写 txt、csv、json 文件: {}", path.display()).into())
    }
}

impl FileService {
    /// 读取指定路径的文本文件内容
    pub async fn read_text_file(path: String) -> Result<String> {
        let path_buf = PathBuf::from(&path);
        check_text_file(&path_buf)?;

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
        check_text_file(&path_buf)?;

        // 确保父目录存在
        if let Some(parent) = path_buf.parent() {
            fs::create_dir_all(parent)?;
        }

        // 写入文件
        fs::write(&path_buf, content)?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::check_text_file;
    use std::path::Path;

    #[test]
    fn only_text_exports_are_allowed() {
        for ok in ["a.json", "b.CSV", "C:/x/c.txt"] {
            assert!(check_text_file(Path::new(ok)).is_ok(), "{ok}");
        }
        for refused in ["mz.db", "a.exe", "b.bat", "store", "c.json.lnk"] {
            assert!(check_text_file(Path::new(refused)).is_err(), "{refused}");
        }
    }
}
