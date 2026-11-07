-- 个人自用版本：放开原商业版遗留的环境数量上限（默认 8）。
-- 新建工作空间的默认值已改为 99999（见 utils/config.rs），这里把已存在的工作空间一并提升。
UPDATE workspace_quotas
SET max_environments = 99999
WHERE max_environments < 99999;
