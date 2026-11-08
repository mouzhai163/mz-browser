-- 删除用户、团队、工作空间：M Z指纹浏览器 是本地单人工作台，这些概念不再存在。
--
-- 表重建要求外键检查是关闭的（否则 DROP 父表会触发 ON DELETE CASCADE，把子表数据一起删掉）。
-- sqlx 的 SQLite 迁移总是包在事务里，而事务里无法切换外键开关，所以由 database::migrate()
-- 在执行迁移之前关闭外键、之后重新打开并检查。不要绕过 migrate() 单独执行这个文件。
-- 已有的环境、分组、标签、代理、账号、RPA 任务、模板的数据都原样保留（只去掉归属列）；
-- 多个用户 / 工作空间的数据会合并到一起。

-- ===== 本地 API：设置和密钥不再属于某个用户 =====
-- 多个用户时保留名下环境最多的那个用户的设置和密钥（数量相同取最早的），与应用之前选默认用户的规则一致。
CREATE TEMP TABLE _kept_user AS
SELECT user_uuid FROM (
    SELECT s.user_uuid AS user_uuid,
           (SELECT COUNT(*) FROM environments e WHERE e.user_uuid = s.user_uuid AND e.deleted_at IS NULL) AS env_count,
           s.id AS settings_id
    FROM user_local_api_settings s
    WHERE s.deleted_at IS NULL
)
ORDER BY env_count DESC, settings_id ASC
LIMIT 1;

CREATE TABLE local_api_settings (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL DEFAULT (randomblob(16)) UNIQUE,
    enabled INTEGER NOT NULL DEFAULT FALSE,
    port INTEGER NOT NULL DEFAULT 8080,
    remote_access INTEGER NOT NULL DEFAULT FALSE,
    cors_origins TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT,
    CONSTRAINT chk_local_api_settings_single_row CHECK (id = 1),
    CONSTRAINT chk_local_api_settings_port CHECK (port BETWEEN 1 AND 65535),
    CONSTRAINT chk_local_api_settings_cors_origins CHECK (json_type(cors_origins) = 'array')
);
INSERT INTO local_api_settings (id, uuid, enabled, port, remote_access, cors_origins, created_at, updated_at, deleted_at)
SELECT 1, uuid, enabled, port, remote_access, cors_origins, created_at, updated_at, deleted_at
FROM user_local_api_settings
WHERE user_uuid IN (SELECT user_uuid FROM _kept_user);

CREATE TABLE local_api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT NOT NULL DEFAULT (randomblob(16)) UNIQUE,
    key_prefix VARCHAR(32) NOT NULL,
    key_hash VARCHAR(128) NOT NULL,
    is_active INTEGER NOT NULL DEFAULT TRUE,
    requests_today INTEGER NOT NULL DEFAULT 0,
    daily_limit INTEGER NOT NULL DEFAULT 1000,
    last_reset_date DATE NOT NULL DEFAULT CURRENT_DATE,
    last_used_at TEXT,
    expires_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT,
    api_key TEXT,
    CONSTRAINT chk_local_api_keys_requests_today CHECK (requests_today >= 0),
    CONSTRAINT chk_local_api_keys_daily_limit CHECK (daily_limit >= 0)
);
INSERT INTO local_api_keys (id, uuid, key_prefix, key_hash, is_active, requests_today, daily_limit, last_reset_date,
                            last_used_at, expires_at, created_at, updated_at, deleted_at, api_key)
SELECT id, uuid, key_prefix, key_hash, is_active, requests_today, daily_limit, last_reset_date,
       last_used_at, expires_at, created_at, updated_at, deleted_at, api_key
FROM user_local_api_keys
WHERE user_uuid IN (SELECT user_uuid FROM _kept_user);
CREATE INDEX idx_local_api_keys_key_prefix ON local_api_keys(key_prefix);
CREATE INDEX idx_local_api_keys_key_hash ON local_api_keys(key_hash);
-- 同一时间只允许一把有效密钥
CREATE UNIQUE INDEX idx_local_api_keys_single_active ON local_api_keys(is_active)
    WHERE is_active = TRUE AND deleted_at IS NULL;

CREATE TABLE local_api_key_permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT NOT NULL DEFAULT (randomblob(16)) UNIQUE,
    api_key_id INTEGER NOT NULL,
    permission_code VARCHAR(128) NOT NULL,
    is_enabled INTEGER NOT NULL DEFAULT TRUE,
    rate_limit_per_minute INTEGER NOT NULL DEFAULT 60,
    rate_limit_per_hour INTEGER NOT NULL DEFAULT 1000,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT,
    CONSTRAINT fk_local_api_key_permissions_key FOREIGN KEY (api_key_id) REFERENCES local_api_keys(id) ON DELETE CASCADE,
    CONSTRAINT uq_local_api_key_permissions UNIQUE (api_key_id, permission_code),
    CONSTRAINT chk_local_api_key_permissions_minute CHECK (rate_limit_per_minute >= 0),
    CONSTRAINT chk_local_api_key_permissions_hour CHECK (rate_limit_per_hour >= 0)
);
INSERT INTO local_api_key_permissions (id, uuid, api_key_id, permission_code, is_enabled, rate_limit_per_minute,
                                       rate_limit_per_hour, created_at, updated_at, deleted_at)
SELECT id, uuid, api_key_id, permission_code, is_enabled, rate_limit_per_minute,
       rate_limit_per_hour, created_at, updated_at, deleted_at
FROM user_local_api_key_permissions
WHERE api_key_id IN (SELECT id FROM local_api_keys);
CREATE INDEX idx_local_api_key_permissions_key ON local_api_key_permissions(api_key_id);
CREATE INDEX idx_local_api_key_permissions_code ON local_api_key_permissions(permission_code);

CREATE TABLE local_api_request_counters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    api_key_id INTEGER NOT NULL,
    permission_code VARCHAR(128) NOT NULL,
    window_type VARCHAR(16) NOT NULL,
    window_start TEXT NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_local_api_request_counters_key FOREIGN KEY (api_key_id) REFERENCES local_api_keys(id) ON DELETE CASCADE,
    CONSTRAINT uq_local_api_request_counters UNIQUE (api_key_id, permission_code, window_type, window_start),
    CONSTRAINT chk_local_api_request_counters_window_type CHECK (window_type IN ('minute', 'hour', 'day')),
    CONSTRAINT chk_local_api_request_counters_request_count CHECK (request_count >= 0)
);
INSERT INTO local_api_request_counters (id, api_key_id, permission_code, window_type, window_start, request_count, updated_at)
SELECT id, api_key_id, permission_code, window_type, window_start, request_count, updated_at
FROM user_local_api_request_counters
WHERE api_key_id IN (SELECT id FROM local_api_keys);
CREATE INDEX idx_local_api_request_counters_key ON local_api_request_counters(api_key_id);

DROP TABLE user_local_api_request_counters;
DROP TABLE user_local_api_key_permissions;
DROP TABLE user_local_api_keys;
DROP TABLE user_local_api_settings;
DROP TABLE _kept_user;

-- 工作空间相关的接口权限已经没有对应的接口
DELETE FROM local_api_key_permissions WHERE permission_code LIKE 'workspaces.%';
DELETE FROM local_api_permission_definitions WHERE permission_code LIKE 'workspaces.%';

-- ===== 业务表：去掉归属列（用户 / 团队 / 工作空间），数据原样保留 =====
-- groups
CREATE TABLE groups_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT NOT NULL DEFAULT (randomblob(16)) UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    sort_order INT DEFAULT 0,
    environments_count INT DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT
);
INSERT INTO groups_new (id, uuid, name, description, sort_order, environments_count, created_at, updated_at, deleted_at)
SELECT id, uuid, name, description, sort_order, environments_count, created_at, updated_at, deleted_at FROM groups;
DROP TABLE groups;
ALTER TABLE groups_new RENAME TO groups;
CREATE INDEX idx_groups_deleted_at ON groups(deleted_at);
-- tags
CREATE TABLE tags_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT NOT NULL DEFAULT (randomblob(16)) UNIQUE,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(50) DEFAULT 'gray',
    sort_order INT DEFAULT 0,
    environments_count INT DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT
);
INSERT INTO tags_new (id, uuid, name, color, sort_order, environments_count, created_at, updated_at, deleted_at)
SELECT id, uuid, name, color, sort_order, environments_count, created_at, updated_at, deleted_at FROM tags;
DROP TABLE tags;
ALTER TABLE tags_new RENAME TO tags;
CREATE INDEX idx_tags_deleted_at ON tags(deleted_at);
-- proxies
CREATE TABLE proxies_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT NOT NULL DEFAULT (randomblob(16)) UNIQUE,
    name VARCHAR(255) NOT NULL,
    host VARCHAR(255) NOT NULL,
    port INT NOT NULL,
    proxy_type VARCHAR(50) NOT NULL DEFAULT 'http',
    username VARCHAR(255),
    password TEXT,
    ssh_key_encrypted TEXT,
    ssh_passphrase_encrypted TEXT,
    country VARCHAR(100),
    city VARCHAR(100),
    status VARCHAR(50) NOT NULL DEFAULT 'unknown',
    latency INT,
    last_check_ip VARCHAR(45),
    last_checked_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT
);
INSERT INTO proxies_new (id, uuid, name, host, port, proxy_type, username, password, ssh_key_encrypted, ssh_passphrase_encrypted, country, city, status, latency, last_check_ip, last_checked_at, created_at, updated_at, deleted_at)
SELECT id, uuid, name, host, port, proxy_type, username, password, ssh_key_encrypted, ssh_passphrase_encrypted, country, city, status, latency, last_check_ip, last_checked_at, created_at, updated_at, deleted_at FROM proxies;
DROP TABLE proxies;
ALTER TABLE proxies_new RENAME TO proxies;
CREATE INDEX idx_proxies_proxy_type ON proxies(proxy_type);
CREATE INDEX idx_proxies_status ON proxies(status);
CREATE INDEX idx_proxies_deleted_at ON proxies(deleted_at);
-- environments
CREATE TABLE environments_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT NOT NULL DEFAULT (randomblob(16)) UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'ready',
    group_uuid TEXT,
    proxy_uuid TEXT,
    system_info VARCHAR(100),
    kernel_info VARCHAR(100),
    fingerprint_summary VARCHAR(255),
    last_opened_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT,
    CONSTRAINT fk_environments_group FOREIGN KEY (group_uuid) REFERENCES groups(uuid) ON DELETE SET NULL,
    CONSTRAINT fk_environments_proxy FOREIGN KEY (proxy_uuid) REFERENCES proxies(uuid) ON DELETE SET NULL
);
INSERT INTO environments_new (id, uuid, name, description, status, group_uuid, proxy_uuid, system_info, kernel_info, fingerprint_summary, last_opened_at, created_at, updated_at, deleted_at)
SELECT id, uuid, name, description, status, group_uuid, proxy_uuid, system_info, kernel_info, fingerprint_summary, last_opened_at, created_at, updated_at, deleted_at FROM environments;
DROP TABLE environments;
ALTER TABLE environments_new RENAME TO environments;
CREATE INDEX idx_environments_group_uuid ON environments(group_uuid);
CREATE INDEX idx_environments_proxy_uuid ON environments(proxy_uuid);
CREATE INDEX idx_environments_status ON environments(status);
CREATE INDEX idx_environments_deleted_at ON environments(deleted_at);
CREATE INDEX idx_environments_name ON environments(name);
-- platform_accounts
CREATE TABLE platform_accounts_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT NOT NULL DEFAULT (randomblob(16)) UNIQUE,
    platform_url VARCHAR(512) NOT NULL,
    platform_name VARCHAR(100),
    account VARCHAR(255) NOT NULL,
    password TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    remark TEXT,
    usage_count INT DEFAULT 0,
    last_used_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT
);
INSERT INTO platform_accounts_new (id, uuid, platform_url, platform_name, account, password, status, remark, usage_count, last_used_at, created_at, updated_at, deleted_at)
SELECT id, uuid, platform_url, platform_name, account, password, status, remark, usage_count, last_used_at, created_at, updated_at, deleted_at FROM platform_accounts;
DROP TABLE platform_accounts;
ALTER TABLE platform_accounts_new RENAME TO platform_accounts;
CREATE INDEX idx_platform_accounts_platform_name ON platform_accounts(platform_name);
CREATE INDEX idx_platform_accounts_status ON platform_accounts(status);
CREATE INDEX idx_platform_accounts_deleted_at ON platform_accounts(deleted_at);
-- rpa_tasks
CREATE TABLE rpa_tasks_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT NOT NULL DEFAULT (randomblob(16)) UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    tags TEXT DEFAULT '[]',
    trigger_type VARCHAR(50) NOT NULL DEFAULT 'manual',
    schedule VARCHAR(50),
    cron_expression VARCHAR(100),
    run_mode VARCHAR(50) NOT NULL DEFAULT 'sequential',
    retry_count INT DEFAULT 0,
    retry_interval INT DEFAULT 5,
    timeout INT DEFAULT 300,
    concurrency INT DEFAULT 1,
    stop_on_error INTEGER DEFAULT TRUE,
    notify_on_complete INTEGER DEFAULT FALSE,
    notify_on_error INTEGER DEFAULT TRUE,
    status VARCHAR(50) NOT NULL DEFAULT 'idle',
    run_count INT DEFAULT 0,
    success_count INT DEFAULT 0,
    last_run_at TEXT,
    next_run_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT
);
INSERT INTO rpa_tasks_new (id, uuid, name, description, tags, trigger_type, schedule, cron_expression, run_mode, retry_count, retry_interval, timeout, concurrency, stop_on_error, notify_on_complete, notify_on_error, status, run_count, success_count, last_run_at, next_run_at, created_at, updated_at, deleted_at)
SELECT id, uuid, name, description, tags, trigger_type, schedule, cron_expression, run_mode, retry_count, retry_interval, timeout, concurrency, stop_on_error, notify_on_complete, notify_on_error, status, run_count, success_count, last_run_at, next_run_at, created_at, updated_at, deleted_at FROM rpa_tasks;
DROP TABLE rpa_tasks;
ALTER TABLE rpa_tasks_new RENAME TO rpa_tasks;
CREATE INDEX idx_rpa_tasks_trigger_type ON rpa_tasks(trigger_type);
CREATE INDEX idx_rpa_tasks_status ON rpa_tasks(status);
CREATE INDEX idx_rpa_tasks_next_run_at ON rpa_tasks(next_run_at);
CREATE INDEX idx_rpa_tasks_deleted_at ON rpa_tasks(deleted_at);
-- templates
CREATE TABLE templates_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT NOT NULL DEFAULT (randomblob(16)) UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_public INTEGER DEFAULT FALSE,
    system_info VARCHAR(100),
    kernel_info VARCHAR(100),
    config_json TEXT NOT NULL DEFAULT '{}',
    usage_count INT DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT
);
INSERT INTO templates_new (id, uuid, name, description, is_public, system_info, kernel_info, config_json, usage_count, created_at, updated_at, deleted_at)
SELECT id, uuid, name, description, is_public, system_info, kernel_info, config_json, usage_count, created_at, updated_at, deleted_at FROM templates;
DROP TABLE templates;
ALTER TABLE templates_new RENAME TO templates;
CREATE INDEX idx_templates_is_public ON templates(is_public);
CREATE INDEX idx_templates_deleted_at ON templates(deleted_at);
-- ===== 删除已经没有用的表 =====
DROP TABLE IF EXISTS proxy_visible_teams;
DROP TABLE IF EXISTS group_member_permissions;
DROP TABLE IF EXISTS team_invitations;
DROP TABLE IF EXISTS team_members;
DROP TABLE IF EXISTS teams;
DROP TABLE IF EXISTS workspace_quotas;
DROP TABLE IF EXISTS workspaces;
DROP TABLE IF EXISTS user_messages;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS user_preferences;
DROP TABLE IF EXISTS local_user_auth;
DROP TABLE IF EXISTS user_infos;
DROP TABLE IF EXISTS users;
