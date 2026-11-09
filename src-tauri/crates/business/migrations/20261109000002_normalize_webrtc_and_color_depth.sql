-- 'replace' 以前没有实现，内核一直按禁用处理；现在内核实现了它（放行经代理的候选）。
-- 早期环境里存着的 'replace' 不是用户对新行为的选择，统一改成 'disable'，保持它们原来的效果。
UPDATE environment_configs
SET fingerprint_settings = json_set(fingerprint_settings, '$.webrtc', 'disable')
WHERE json_valid(fingerprint_settings)
  AND json_extract(fingerprint_settings, '$.webrtc') = 'replace';

UPDATE templates
SET config_json = json_set(config_json, '$.config.fingerprint_settings.webrtc', 'disable')
WHERE json_valid(config_json)
  AND json_extract(config_json, '$.config.fingerprint_settings.webrtc') = 'replace';

-- Windows 上的 Chrome 恒报 24 位色深，32 在真机上不存在。
UPDATE environment_configs
SET fingerprint_settings = json_set(fingerprint_settings, '$.colorDepth', 24)
WHERE json_valid(fingerprint_settings)
  AND json_extract(fingerprint_settings, '$.colorDepth') = 32;

UPDATE templates
SET config_json = json_set(config_json, '$.config.fingerprint_settings.colorDepth', 24)
WHERE json_valid(config_json)
  AND json_extract(config_json, '$.config.fingerprint_settings.colorDepth') = 32;
