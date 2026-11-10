use serde::{Serialize, de::DeserializeOwned};
use serde_json::{Value, json};

use crate::{entitys::*, services, svc_ctx::SvcCtx};

fn payload<T: DeserializeOwned>(data: &Value) -> Result<T, String> {
    serde_json::from_value(data.clone())
        .map_err(|error| format!("Invalid request payload: {error}"))
}

fn value<T: Serialize>(data: T) -> Result<Value, String> {
    serde_json::to_value(data).map_err(|error| format!("Failed to serialize response: {error}"))
}

/// Dispatch a migrated business POST route locally.
///
/// `None` means the route does not belong to the embedded business service.
pub async fn dispatch_post(
    context: &SvcCtx,
    route: &str,
    data: &Value,
) -> Option<Result<Value, String>> {
    let result = match route.trim_start_matches('/') {
        "browser-kernels/list" => {
            async {
                let platform = data.get("platform").and_then(Value::as_str).unwrap_or("windows");
                let type_code = data
                    .get("type_code")
                    .and_then(Value::as_str)
                    .unwrap_or("MZ_KERNEL_CHROMIUM");
                value(
                    services::browser_kernels::list_browser_kernels(
                        &context.db,
                        Some(platform),
                        Some(type_code),
                    )
                    .await?,
                )
            }
            .await
        }
        "groups/list" => {
            async {
                value(
                    services::groups::get_groups_service(
                        context,
                        1,
                        10_000,
                    )
                    .await?,
                )
            }
            .await
        }
        "groups/create" => {
            async {
                let request: CreateGroupRequest = payload(data)?;
                let uuid = services::groups::create_group_service(
                    context,
                    &request,
                )
                .await?;
                Ok(json!({ "uuid": uuid }))
            }
            .await
        }
        "groups/update" => {
            async {
                let request: UpdateGroupRequest = payload(data)?;
                services::groups::update_group_service(
                    context,
                    &request,
                )
                .await?;
                Ok(Value::Null)
            }
            .await
        }
        "groups/delete" => {
            async {
                let request: UuidRequest = payload(data)?;
                services::groups::delete_group_service(
                    context,
                    request.uuid,
                )
                .await?;
                Ok(Value::Null)
            }
            .await
        }
        "groups/batch-delete" => {
            async {
                let request: BatchUuidRequest = payload(data)?;
                for uuid in request.uuids {
                    services::groups::delete_group_service(
                        context,
                        uuid,
                    )
                    .await?;
                }
                Ok(Value::Null)
            }
            .await
        }

        "tags/list" => {
            async {
                value(
                    services::tags::get_tags_service(context).await?,
                )
            }
            .await
        }
        "tags/create" => {
            async {
                let request: CreateTagRequest = payload(data)?;
                let uuid = services::tags::create_tag_service(
                    context,
                    &request,
                )
                .await?;
                Ok(json!({ "uuid": uuid }))
            }
            .await
        }
        "tags/update" => {
            async {
                let request: UpdateTagRequest = payload(data)?;
                services::tags::update_tag_service(context, &request).await?;
                Ok(Value::Null)
            }
            .await
        }
        "tags/delete" => {
            async {
                let request: UuidRequest = payload(data)?;
                services::tags::delete_tag_service(context, request.uuid).await?;
                Ok(Value::Null)
            }
            .await
        }

        "proxies/list" => {
            async {
                let request: ListProxiesRequest = payload(data)?;
                let (items, total) = services::proxies::get_proxies_service(
                    context,
                    &request,
                )
                .await?;
                value(ProxyListResponse {
                    items,
                    total,
                    page: request.pagination.page,
                    page_size: request.pagination.page_size,
                })
            }
            .await
        }
        "proxies/detail" => {
            async {
                let request: UuidRequest = payload(data)?;
                value(services::proxies::get_proxy_service(context, request.uuid).await?)
            }
            .await
        }
        "proxies/create" => {
            async {
                let request: CreateProxyRequest = payload(data)?;
                let uuid = services::proxies::create_proxy_service(
                    context,
                    &request,
                )
                .await?;
                Ok(json!({ "uuid": uuid }))
            }
            .await
        }
        "proxies/update" => {
            async {
                let request: UpdateProxyRequest = payload(data)?;
                services::proxies::update_proxy_service(context, &request).await?;
                Ok(Value::Null)
            }
            .await
        }
        "proxies/delete" => {
            async {
                let request: UuidRequest = payload(data)?;
                services::proxies::delete_proxy_service(context, request.uuid).await?;
                Ok(Value::Null)
            }
            .await
        }
        "proxies/batch-delete" => {
            async {
                let request: BatchUuidRequest = payload(data)?;
                value(
                    services::proxies::batch_delete_proxies_service(context, &request.uuids)
                        .await?,
                )
            }
            .await
        }
        "proxies/batch-import" => {
            async {
                let request: BatchImportProxiesRequest = payload(data)?;
                value(
                    services::proxies::batch_import_proxies_service(
                        context,
                        &request,
                    )
                    .await?,
                )
            }
            .await
        }

        "accounts/list" => {
            async {
                let request: ListAccountsRequest = payload(data)?;
                let (items, total) = services::accounts::get_accounts_service(
                    context,
                    &request,
                )
                .await?;
                value(AccountListResponse {
                    items,
                    total,
                    page: request.pagination.page,
                    page_size: request.pagination.page_size,
                })
            }
            .await
        }
        "accounts/detail" => {
            async {
                let request: UuidRequest = payload(data)?;
                value(services::accounts::get_account_service(context, request.uuid).await?)
            }
            .await
        }
        "accounts/create" => {
            async {
                let request: CreateAccountRequest = payload(data)?;
                let uuid = services::accounts::create_account_service(
                    context,
                    &request,
                )
                .await?;
                Ok(json!({ "uuid": uuid }))
            }
            .await
        }
        "accounts/update" => {
            async {
                let request: UpdateAccountRequest = payload(data)?;
                services::accounts::update_account_service(context, &request).await?;
                Ok(Value::Null)
            }
            .await
        }
        "accounts/delete" => {
            async {
                let request: UuidRequest = payload(data)?;
                services::accounts::delete_account_service(context, request.uuid).await?;
                Ok(Value::Null)
            }
            .await
        }
        "accounts/batch-delete" => {
            async {
                let request: BatchUuidRequest = payload(data)?;
                value(
                    services::accounts::batch_delete_accounts_service(context, &request.uuids)
                        .await?,
                )
            }
            .await
        }
        "accounts/batch-import" => {
            async {
                let request: BatchImportAccountsRequest = payload(data)?;
                value(
                    services::accounts::batch_import_accounts_service(
                        context,
                        &request,
                    )
                    .await?,
                )
            }
            .await
        }

        "environments/list" => {
            async {
                let request: ListEnvironmentsRequest = payload(data)?;
                let (items, total) = services::environments::get_environments_service(
                    context,
                    &request,
                )
                .await?;
                value(EnvironmentListResponse {
                    items,
                    total,
                    page: request.pagination.page,
                    page_size: request.pagination.page_size,
                })
            }
            .await
        }
        "environments/detail" => {
            async {
                let request: UuidRequest = payload(data)?;
                value(
                    services::environments::get_environment_detail_service(
                        context,
                        request.uuid,
                    )
                    .await?,
                )
            }
            .await
        }
        "environments/batch-detail" => {
            async {
                let request: BatchUuidRequest = payload(data)?;
                let mut items = std::collections::HashMap::new();
                for uuid in request.uuids {
                    if let Ok(detail) = services::environments::get_environment_detail_service(context, uuid)
                        .await
                    {
                        items.insert(uuid.to_string(), detail);
                    }
                }
                value(items)
            }
            .await
        }
        "environments/create" => {
            async {
                let request: CreateEnvironmentRequest = payload(data)?;
                let uuid = services::environments::create_environment_service(
                    context,
                    &request,
                )
                .await?;
                Ok(json!({ "uuid": uuid }))
            }
            .await
        }
        "environments/batch-create" => {
            async {
                let request: BatchCreateEnvironmentRequest = payload(data)?;
                value(
                    services::environments::batch_create_environments_service(
                        context,
                        &request,
                    )
                    .await?,
                )
            }
            .await
        }
        "environments/update" => {
            async {
                let request: UpdateEnvironmentRequest = payload(data)?;
                services::environments::update_environment_service(
                    context,
                    &request,
                )
                .await?;
                Ok(Value::Null)
            }
            .await
        }
        "environments/delete" => {
            async {
                let request: UuidRequest = payload(data)?;
                services::environments::delete_environment_service(
                    context,
                    request.uuid,
                )
                .await?;
                Ok(Value::Null)
            }
            .await
        }
        "environments/batch-delete" => {
            async {
                let request: BatchUuidRequest = payload(data)?;
                value(
                    services::environments::batch_delete_environments_service(
                        context,
                        &request.uuids,
                    )
                    .await?,
                )
            }
            .await
        }
        "environments/set-proxy" => {
            async {
                let request: SetEnvironmentProxyRequest = payload(data)?;
                services::environments::set_environment_proxy_service(context, &request).await?;
                Ok(Value::Null)
            }
            .await
        }
        "environments/set-accounts" => {
            async {
                let request: SetEnvironmentAccountsRequest = payload(data)?;
                services::accounts::set_environment_accounts_service(
                    context,
                    request.uuid,
                    &request.account_uuids,
                )
                .await?;
                Ok(Value::Null)
            }
            .await
        }
        "environments/assign-tags" => {
            async {
                let request: AssignTagsRequest = payload(data)?;
                services::environments::assign_tags_service(context, &request).await?;
                Ok(Value::Null)
            }
            .await
        }
        "environments/remove-tag" => {
            async {
                let request: RemoveTagRequest = payload(data)?;
                services::environments::remove_tag_service(context, request.uuid, request.tag_uuid)
                    .await?;
                Ok(Value::Null)
            }
            .await
        }
        "environments/batch-assign-tags" => {
            async {
                let request: BatchAssignTagRequest = payload(data)?;
                services::environments::batch_assign_tags_service(context, &request).await?;
                Ok(Value::Null)
            }
            .await
        }
        "environments/batch-remove-tags" => {
            async {
                let request: BatchRemoveTagsRequest = payload(data)?;
                services::environments::batch_remove_tags_service(context, &request).await?;
                Ok(Value::Null)
            }
            .await
        }
        "environments/move-to-group" => {
            async {
                let request: MoveToGroupRequest = payload(data)?;
                services::environments::move_to_group_service(context, &request).await?;
                Ok(Value::Null)
            }
            .await
        }
        "environments/batch-move-to-group" => {
            async {
                let request: BatchMoveToGroupRequest = payload(data)?;
                services::environments::batch_move_to_group_service(context, &request).await?;
                Ok(Value::Null)
            }
            .await
        }
        "environments/recycle-bin/list" => {
            async {
                let request: ListEnvironmentsRequest = payload(data)?;
                let (items, total) = services::environments::get_recycle_bin_environments_service(
                    context,
                    &request,
                )
                .await?;
                value(EnvironmentListResponse {
                    items,
                    total,
                    page: request.pagination.page,
                    page_size: request.pagination.page_size,
                })
            }
            .await
        }
        "environments/recycle-bin/restore" => {
            async {
                let request: UuidRequest = payload(data)?;
                services::environments::restore_environment_service(context, request.uuid).await?;
                Ok(Value::Null)
            }
            .await
        }
        "environments/recycle-bin/batch-restore" => {
            async {
                let request: BatchUuidRequest = payload(data)?;
                services::environments::batch_restore_environments_service(context, &request.uuids)
                    .await?;
                Ok(Value::Null)
            }
            .await
        }
        "environments/recycle-bin/permanent-delete" => {
            async {
                let request: UuidRequest = payload(data)?;
                services::environments::permanent_delete_environment_service(
                    context,
                    request.uuid,
                )
                .await?;
                Ok(Value::Null)
            }
            .await
        }
        "environments/recycle-bin/batch-permanent-delete" => {
            async {
                let request: BatchUuidRequest = payload(data)?;
                services::environments::batch_permanent_delete_environments_service(
                    context,
                    &request.uuids,
                )
                .await?;
                Ok(Value::Null)
            }
            .await
        }
        "environments/urls/list" => {
            async {
                let request: UuidRequest = payload(data)?;
                value(
                    services::environments::get_environment_urls_service(context, request.uuid)
                        .await?,
                )
            }
            .await
        }
        "environments/urls/add" => {
            async {
                let request: AddEnvironmentUrlRequest = payload(data)?;
                let id =
                    services::environments::add_environment_url_service(context, &request).await?;
                Ok(json!({ "id": id }))
            }
            .await
        }
        "environments/urls/delete" => {
            async {
                let request: DeleteEnvironmentUrlRequest = payload(data)?;
                services::environments::delete_environment_url_service(context, request.id).await?;
                Ok(Value::Null)
            }
            .await
        }
        "environments/urls/clear" => {
            async {
                let request: ClearEnvironmentUrlsRequest = payload(data)?;
                value(
                    services::environments::clear_environment_urls_service(
                        context,
                        request.environment_uuid,
                    )
                    .await?,
                )
            }
            .await
        }
        "environments/cookies/list" => {
            async {
                let request: UuidRequest = payload(data)?;
                value(
                    services::environments::get_environment_cookies_service(context, request.uuid)
                        .await?,
                )
            }
            .await
        }
        "environments/cookies/add" => {
            async {
                let request: AddEnvironmentCookieRequest = payload(data)?;
                let id = services::environments::add_environment_cookie_service(context, &request)
                    .await?;
                Ok(json!({ "id": id }))
            }
            .await
        }
        "environments/cookies/delete" => {
            async {
                let request: DeleteEnvironmentCookieRequest = payload(data)?;
                services::environments::delete_environment_cookie_service(context, request.id)
                    .await?;
                Ok(Value::Null)
            }
            .await
        }
        "environments/cookies/clear" => {
            async {
                let request: ClearEnvironmentCookiesRequest = payload(data)?;
                value(
                    services::environments::clear_environment_cookies_service(
                        context,
                        request.environment_uuid,
                    )
                    .await?,
                )
            }
            .await
        }

        "templates/list" => {
            async {
                let request: ListTemplatesRequest = payload(data)?;
                let (items, total) = services::templates::get_templates_service(
                    context,
                    request.is_public,
                    request.pagination.page,
                    request.pagination.page_size,
                )
                .await?;
                value(TemplateListResponse {
                    items,
                    total,
                    page: request.pagination.page,
                    page_size: request.pagination.page_size,
                })
            }
            .await
        }
        "templates/detail" => {
            async {
                let request: GetTemplateRequest = payload(data)?;
                value(
                    services::templates::get_template_service(
                        context,
                        request.uuid,
                        request.for_create.unwrap_or(false),
                    )
                    .await?,
                )
            }
            .await
        }
        "templates/create" => {
            async {
                let request: CreateTemplateRequest = payload(data)?;
                let uuid = services::templates::create_template_service(
                    context,
                    &request,
                )
                .await?;
                Ok(json!({ "uuid": uuid }))
            }
            .await
        }
        "templates/update" => {
            async {
                let request: UpdateTemplateRequest = payload(data)?;
                services::templates::update_template_service(context, &request).await?;
                Ok(Value::Null)
            }
            .await
        }
        "templates/delete" => {
            async {
                let request: UuidRequest = payload(data)?;
                services::templates::delete_template_service(context, request.uuid).await?;
                Ok(Value::Null)
            }
            .await
        }
        "templates/apply" => {
            async {
                let request: ApplyTemplateRequest = payload(data)?;
                services::templates::apply_template_service(
                    context,
                    &request,
                )
                .await?;
                Ok(Value::Null)
            }
            .await
        }
        "templates/create-from" => {
            async {
                let request: CreateFromTemplateRequest = payload(data)?;
                let uuid = services::templates::create_from_template_service(
                    context,
                    &request,
                )
                .await?;
                Ok(json!({ "uuid": uuid }))
            }
            .await
        }

        "rpa/tasks" => {
            async {
                let request: ListRpaTasksRequest = payload(data)?;
                let (items, total) = services::rpa::get_rpa_tasks_service(
                    context,
                    &request,
                )
                .await?;
                value(RpaTaskListResponse {
                    items,
                    total,
                    page: request.pagination.page,
                    page_size: request.pagination.page_size,
                })
            }
            .await
        }
        "rpa/tasks/detail" => {
            async {
                let request: UuidRequest = payload(data)?;
                let (task, steps, environment_uuids) =
                    services::rpa::get_rpa_task_service(context, request.uuid).await?;
                value(RpaTaskDetailResponse {
                    task,
                    steps,
                    environment_uuids,
                })
            }
            .await
        }
        "rpa/tasks/create" => {
            async {
                let request: CreateRpaTaskRequest = payload(data)?;
                let uuid = services::rpa::create_rpa_task_service(
                    context,
                    &request,
                )
                .await?;
                Ok(json!({ "uuid": uuid }))
            }
            .await
        }
        "rpa/tasks/update" => {
            async {
                let request: UpdateRpaTaskRequest = payload(data)?;
                services::rpa::update_rpa_task_service(context, &request).await?;
                Ok(Value::Null)
            }
            .await
        }
        "rpa/tasks/delete" => {
            async {
                let request: UuidRequest = payload(data)?;
                services::rpa::delete_rpa_task_service(context, request.uuid).await?;
                Ok(Value::Null)
            }
            .await
        }
        "rpa/tasks/batch-delete" => {
            async {
                let request: BatchUuidRequest = payload(data)?;
                services::rpa::batch_delete_rpa_tasks_service(context, &request.uuids).await?;
                Ok(Value::Null)
            }
            .await
        }
        "rpa/tasks/duplicate" => {
            async {
                let request: DuplicateRpaTaskRequest = payload(data)?;
                let uuid = services::rpa::duplicate_rpa_task_service(
                    context,
                    &request,
                )
                .await?;
                Ok(json!({ "uuid": uuid }))
            }
            .await
        }

        _ => return None,
    };

    Some(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::utils::DatabaseConfig;

    #[tokio::test]
    async fn migrated_routes_use_the_embedded_database() {
        let mut config = DatabaseConfig::embedded("sqlite::memory:");
        config.max_connections = 1;
        config.min_connections = 1;
        let context = SvcCtx::new(&config).await.expect("context should initialize");

        let kernels = dispatch_post(
            &context,
            "browser-kernels/list",
            &json!({
                "platform": "windows",
                "type_code": "MZ_KERNEL_CHROMIUM"
            }),
        )
        .await
        .unwrap()
        .expect("browser kernels should be queried from the local registry");
        assert_eq!(
            kernels["MZ_KERNEL_CHROMIUM"][0]["kernel_id"].as_str().map(str::len),
            Some(64)
        );

        let group = dispatch_post(
            &context,
            "groups/create",
            &json!({ "name": "Local Group", "description": null }),
        )
        .await
        .unwrap()
        .expect("group creation should succeed");
        assert!(group["uuid"].as_str().is_some());

        dispatch_post(
            &context,
            "proxies/create",
            &json!({
                "name": "Local Proxy",
                "host": "127.0.0.1",
                "port": 8080,
                "proxy_type": "http",
                "password": "secret"
            }),
        )
        .await
        .unwrap()
        .expect("proxy creation should succeed");
        let proxies = dispatch_post(
            &context,
            "proxies/list",
            &json!({ "page": 1, "page_size": 20 }),
        )
        .await
        .unwrap()
        .expect("proxy list should succeed");
        assert_eq!(proxies["total"], 1);


        assert!(dispatch_post(&context, "auth/login", &json!({})).await.is_none());
        // 用户、团队、工作空间已经不存在，对应的路由也不再属于本地业务服务
        for gone in ["workspaces/list", "teams/my-teams", "messages/list", "audit/logs", "preferences/get"] {
            assert!(dispatch_post(&context, gone, &json!({})).await.is_none(), "{gone}");
        }
    }

    /// 用户、团队、工作空间删除之后，每个业务模块都要能走通完整流程（建、查、改、关联、删、回收站）。
    #[tokio::test]
    async fn every_business_module_works_without_users_teams_or_workspaces() {
        let mut config = DatabaseConfig::embedded("sqlite::memory:");
        config.max_connections = 1;
        config.min_connections = 1;
        let context = SvcCtx::new(&config).await.expect("context should initialize");

        async fn call(context: &SvcCtx, route: &str, body: Value) -> Value {
            dispatch_post(context, route, &body)
                .await
                .unwrap_or_else(|| panic!("{route} should be a local route"))
                .unwrap_or_else(|error| panic!("{route} failed: {error}"))
        }

        // 分组 / 标签 / 代理 / 账号
        let group = call(&context, "groups/create", json!({ "name": "G1", "description": "d" })).await["uuid"]
            .as_str()
            .unwrap()
            .to_string();
        let groups = call(&context, "groups/list", json!({})).await;
        assert_eq!(groups.as_array().unwrap().len(), 1);
        assert!(groups[0].get("team_uuid").is_none() && groups[0].get("created_by").is_none());
        call(&context, "groups/update", json!({ "uuid": group, "name": "G1b" })).await;

        let tag = call(&context, "tags/create", json!({ "name": "T1", "color": "blue" })).await["uuid"]
            .as_str()
            .unwrap()
            .to_string();
        assert_eq!(call(&context, "tags/list", json!({})).await.as_array().unwrap().len(), 1);

        let proxy = call(
            &context,
            "proxies/create",
            json!({ "name": "P1", "host": "127.0.0.1", "port": 1080, "proxy_type": "http" }),
        )
        .await["uuid"]
            .as_str()
            .unwrap()
            .to_string();
        let found = call(
            &context,
            "proxies/list",
            json!({ "page": 1, "page_size": 20, "filters": { "keyword": "P1", "proxy_type": "http" } }),
        )
        .await;
        assert_eq!(found["total"], 1);
        let none = call(
            &context,
            "proxies/list",
            json!({ "page": 1, "page_size": 20, "filters": { "keyword": "nothing-like-this" } }),
        )
        .await;
        assert_eq!(none["total"], 0);
        call(
            &context,
            "proxies/batch-import",
            json!({ "proxies": [{ "name": "P2", "host": "127.0.0.2", "port": 1081, "proxy_type": "http" }] }),
        )
        .await;
        assert_eq!(call(&context, "proxies/list", json!({ "page": 1, "page_size": 20 })).await["total"], 2);

        let account = call(
            &context,
            "accounts/create",
            json!({ "platform_url": "https://example.com", "account": "me" }),
        )
        .await["uuid"]
            .as_str()
            .unwrap()
            .to_string();
        assert_eq!(call(&context, "accounts/list", json!({ "page": 1, "page_size": 20 })).await["total"], 1);

        // 环境：建、查、改、关联、删、回收站
        let kernels = call(&context, "browser-kernels/list", json!({ "platform": "windows" })).await;
        let kernel = kernels["MZ_KERNEL_CHROMIUM"][0].clone();
        let environment = call(
            &context,
            "environments/create",
            json!({
                "name": "E1",
                "group_uuid": group,
                "tag_uuids": [tag],
                "account_uuids": [account],
                "proxy_uuid": proxy,
                "config": {
                    "window_info": { "system": "Windows", "kernel": kernel["resource_name"], "kernel_id": kernel["kernel_id"] },
                    "basic_settings": {},
                    "fingerprint_settings": {},
                    "device_settings": {},
                    "preference_settings": {}
                }
            }),
        )
        .await["uuid"]
            .as_str()
            .unwrap()
            .to_string();
        let listed = call(&context, "environments/list", json!({ "page": 1, "page_size": 20 })).await;
        assert_eq!(listed["total"], 1);
        let env = &listed["items"][0]["environment"];
        for owner in ["user_uuid", "team_uuid", "workspace_uuid"] {
            assert!(env.get(owner).is_none(), "{owner} should not be in the environment payload");
        }
        let detail = call(&context, "environments/detail", json!({ "uuid": environment })).await;
        assert_eq!(detail["group"]["name"], "G1b");
        assert_eq!(detail["tags"].as_array().unwrap().len(), 1);
        assert_eq!(detail["proxy"]["name"], "P1");
        assert_eq!(detail["accounts"].as_array().unwrap().len(), 1);
        // 更新会按请求里的分组覆盖环境的分组，所以要带上
        call(&context, "environments/update", json!({ "uuid": environment, "name": "E1b", "group_uuid": group })).await;
        let filtered = call(
            &context,
            "environments/list",
            json!({ "page": 1, "page_size": 20, "filters": { "keyword": "E1b", "group_uuid": group } }),
        )
        .await;
        assert_eq!(filtered["total"], 1);

        // 模板：由环境生成、再从模板创建环境
        let template = call(
            &context,
            "templates/create",
            json!({ "name": "TPL", "environment_uuid": environment }),
        )
        .await["uuid"]
            .as_str()
            .unwrap()
            .to_string();
        assert_eq!(call(&context, "templates/list", json!({ "page": 1, "page_size": 20 })).await["total"], 1);
        let from_template = call(
            &context,
            "templates/create-from",
            json!({ "template_uuid": template, "name": "E2" }),
        )
        .await["uuid"]
            .as_str()
            .unwrap()
            .to_string();
        assert_eq!(call(&context, "environments/list", json!({ "page": 1, "page_size": 20 })).await["total"], 2);

        // RPA
        let task = call(
            &context,
            "rpa/tasks/create",
            json!({ "name": "R1", "trigger_type": "manual", "run_mode": "sequential", "environment_uuids": [environment] }),
        )
        .await["uuid"]
            .as_str()
            .unwrap()
            .to_string();
        assert_eq!(call(&context, "rpa/tasks", json!({ "page": 1, "page_size": 20 })).await["total"], 1);
        call(&context, "rpa/tasks/duplicate", json!({ "uuid": task })).await;
        assert_eq!(call(&context, "rpa/tasks", json!({ "page": 1, "page_size": 20 })).await["total"], 2);

        // 回收站：删除、列出、恢复；删除后其余关联数据不能被连带清掉
        call(&context, "environments/delete", json!({ "uuid": from_template })).await;
        let bin = call(&context, "environments/recycle-bin/list", json!({ "page": 1, "page_size": 20 })).await;
        assert_eq!(bin["total"], 1);
        call(&context, "environments/recycle-bin/restore", json!({ "uuid": from_template })).await;
        assert_eq!(call(&context, "environments/list", json!({ "page": 1, "page_size": 20 })).await["total"], 2);
        call(&context, "environments/delete", json!({ "uuid": from_template })).await;
        call(&context, "environments/recycle-bin/permanent-delete", json!({ "uuid": from_template })).await;
        assert_eq!(call(&context, "environments/recycle-bin/list", json!({ "page": 1, "page_size": 20 })).await["total"], 0);

        // 清理
        call(&context, "tags/delete", json!({ "uuid": tag })).await;
        call(&context, "groups/delete", json!({ "uuid": group })).await;
        call(&context, "accounts/delete", json!({ "uuid": account })).await;
        call(&context, "proxies/delete", json!({ "uuid": proxy })).await;
        call(&context, "templates/delete", json!({ "uuid": template })).await;
        call(&context, "rpa/tasks/delete", json!({ "uuid": task })).await;
    }
}
