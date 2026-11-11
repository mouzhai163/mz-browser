-- 运行记录按环境记录，并区分手动和定时触发
ALTER TABLE rpa_task_runs ADD COLUMN environment_uuid TEXT;
ALTER TABLE rpa_task_runs ADD COLUMN environment_name TEXT;
ALTER TABLE rpa_task_runs ADD COLUMN trigger_source VARCHAR(20) NOT NULL DEFAULT 'manual';
