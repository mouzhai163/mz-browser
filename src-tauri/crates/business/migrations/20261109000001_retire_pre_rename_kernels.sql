-- 软件改名时内核的启动参数、可执行文件名、管道名都改了，改名前的内核不能再被新版启动：
-- 把它们下架，并解除环境与它们的绑定（同时清掉环境配置里记着的旧内核 id）。
-- 应用启动后会按环境配置里的内核名称，把这些环境重新绑定到目录里的新内核。
-- 新内核的类型码都以 MZ_KERNEL_ 开头，其余的都是旧的。
UPDATE environment_configs
SET window_info = json_remove(window_info, '$.kernel_id')
WHERE json_valid(window_info)
  AND environment_uuid IN (
    SELECT binding.environment_uuid
    FROM environment_kernel_bindings binding
    JOIN browser_kernel_artifacts artifact ON artifact.kernel_id = binding.kernel_id
    WHERE artifact.type_code NOT LIKE 'MZ_KERNEL_%'
  );

DELETE FROM environment_kernel_bindings
WHERE kernel_id IN (
    SELECT kernel_id FROM browser_kernel_artifacts WHERE type_code NOT LIKE 'MZ_KERNEL_%'
);

UPDATE browser_kernel_artifacts
SET status = 'retired', updated_at = CURRENT_TIMESTAMP
WHERE type_code NOT LIKE 'MZ_KERNEL_%' AND status <> 'retired';
