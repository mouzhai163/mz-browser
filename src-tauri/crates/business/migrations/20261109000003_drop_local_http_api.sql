-- 本地 HTTP 接口已经下线（MCP 是唯一的外部控制方式），删除它的设置、密钥、权限和计数表。
-- 先删引用别的表的子表。
DROP TABLE IF EXISTS local_api_request_counters;
DROP TABLE IF EXISTS local_api_key_permissions;
DROP TABLE IF EXISTS local_api_keys;
DROP TABLE IF EXISTS local_api_settings;
DROP TABLE IF EXISTS local_api_permission_definitions;
