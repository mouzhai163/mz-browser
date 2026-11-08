use uuid::Uuid;

use crate::dto::ProxyDto;
use crate::entitys::{
    BatchImportProxiesRequest, CreateProxyRequest, ListProxiesRequest, UpdateProxyRequest,
};
use crate::models;
use crate::svc_ctx::SvcCtx;

/// 创建代理
pub async fn create_proxy_service(
    svc_ctx: &SvcCtx,
    payload: &CreateProxyRequest,
) -> Result<Uuid, String> {
    let proxy_uuid = models::insert_proxy(
        &svc_ctx.db,
        &payload.name,
        &payload.host,
        payload.port,
        &payload.proxy_type,
        payload.username.as_deref(),
        payload.password.as_deref(),
        payload.country.as_deref(),
        payload.city.as_deref(),
    )
    .await
    .map_err(|e| e.to_string())?;

    Ok(proxy_uuid)
}

/// 获取代理列表
pub async fn get_proxies_service(
    svc_ctx: &SvcCtx,
    payload: &ListProxiesRequest,
) -> Result<(Vec<ProxyDto>, i64), String> {
    let filters = payload.filters.as_ref();
    let keyword = filters
        .and_then(|f| f.keyword.as_deref())
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let proxy_type = filters
        .and_then(|f| f.proxy_type.as_deref())
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let status = filters
        .and_then(|f| f.status.as_deref())
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let country = filters
        .and_then(|f| f.country.as_deref())
        .map(str::trim)
        .filter(|value| !value.is_empty());

    let page = payload.pagination.page.max(1);
    let page_size = payload.pagination.page_size.max(1);
    let offset = (page - 1) * page_size;

    let proxies = models::fetch_proxies(
        &svc_ctx.db,
        keyword,
        proxy_type,
        status,
        country,
        offset,
        page_size,
    )
    .await
    .map_err(|e| e.to_string())?;

    let total = models::fetch_proxies_count(
        &svc_ctx.db,
        keyword,
        proxy_type,
        status,
        country,
    )
    .await
    .map_err(|e| e.to_string())?;

    Ok((proxies, total))
}

/// 获取代理详情
pub async fn get_proxy_service(svc_ctx: &SvcCtx, proxy_uuid: Uuid) -> Result<ProxyDto, String> {
    models::fetch_proxy_by_uuid(&svc_ctx.db, proxy_uuid)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "代理不存在".to_string())
}

/// 更新代理
pub async fn update_proxy_service(
    svc_ctx: &SvcCtx,
    payload: &UpdateProxyRequest,
) -> Result<(), String> {
    models::update_proxy(
        &svc_ctx.db,
        payload.uuid,
        payload.name.as_deref(),
        payload.host.as_deref(),
        payload.port,
        payload.proxy_type.as_deref(),
        payload.username.as_deref(),
        payload.password.as_deref(),
        payload.country.as_deref(),
        payload.city.as_deref(),
    )
    .await
    .map_err(|e| e.to_string())
}

/// 删除代理
pub async fn delete_proxy_service(svc_ctx: &SvcCtx, proxy_uuid: Uuid) -> Result<(), String> {
    // 先确认代理存在，再删除
    models::fetch_proxy_by_uuid(&svc_ctx.db, proxy_uuid)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "代理不存在".to_string())?;

    models::delete_proxy(&svc_ctx.db, proxy_uuid).await.map_err(|e| e.to_string())
}

/// 批量删除代理
pub async fn batch_delete_proxies_service(
    svc_ctx: &SvcCtx,
    proxy_uuids: &[Uuid],
) -> Result<u64, String> {
    models::batch_delete_proxies(&svc_ctx.db, proxy_uuids)
        .await
        .map_err(|e| e.to_string())
}

/// 批量导入代理
///
/// 接收客户端已解析好的代理列表，直接保存到数据库
pub async fn batch_import_proxies_service(
    svc_ctx: &SvcCtx,
    payload: &BatchImportProxiesRequest,
) -> Result<crate::entitys::BatchImportResponse, String> {
    let mut success_count = 0;
    let mut failed_count = 0;
    let mut errors: Vec<String> = vec![];
    for (index, proxy) in payload.proxies.iter().enumerate() {
        let result = models::insert_proxy(
            &svc_ctx.db,
            &proxy.name,
            &proxy.host,
            proxy.port,
            &proxy.proxy_type,
            proxy.username.as_deref(),
            proxy.password.as_deref(),
            proxy.country.as_deref(),
            proxy.city.as_deref(),
        )
        .await;

        match result {
            Ok(_) => {
                success_count += 1;
            }
            Err(e) => {
                failed_count += 1;
                errors.push(format!("第 {} 项: {}", index + 1, e));
            }
        }
    }

    Ok(crate::entitys::BatchImportResponse {
        success_count,
        failed_count,
        errors,
    })
}
