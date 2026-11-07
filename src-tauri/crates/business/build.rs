// `sqlx::migrate!` 在编译时把 migrations 目录嵌进程序，但 cargo 不知道新增的迁移文件也算输入：
// 只新增文件不改 Rust 代码时，增量编译会继续用旧的迁移列表，新迁移就不会在用户的数据库上执行。
fn main() {
    println!("cargo:rerun-if-changed=migrations");
}
