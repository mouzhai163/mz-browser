-- 本地 API 现在默认开启，所以默认只允许本机访问：关闭"允许远程访问"（监听 127.0.0.1 而不是 0.0.0.0）。
-- 需要从其他设备访问的用户可以在设置里重新打开这一项。
UPDATE user_local_api_settings
SET remote_access = FALSE
WHERE remote_access = TRUE;
