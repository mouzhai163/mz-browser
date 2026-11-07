-- 本地 API 默认开启：软件没有登录步骤，打开就直接可用。
-- 新建用户已经按开启创建（见 services/local_users.rs）；这里把已有用户里还是旧默认值（关闭）的一并打开，
-- 之后用户仍然可以在界面里随时关闭。
UPDATE user_local_api_settings
SET enabled = TRUE
WHERE enabled = FALSE;
