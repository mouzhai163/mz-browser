use uuid::Uuid;

use crate::dto::GroupDto;
use crate::entitys::{CreateGroupRequest, UpdateGroupRequest};
use crate::models;
use crate::svc_ctx::SvcCtx;

/// 创建分组
pub async fn create_group_service(
    svc_ctx: &SvcCtx,
    payload: &CreateGroupRequest,
) -> Result<Uuid, String> {
    models::insert_group(&svc_ctx.db, &payload.name, payload.description.as_deref())
        .await
        .map_err(|e| e.to_string())
}

/// 获取分组列表
pub async fn get_groups_service(
    svc_ctx: &SvcCtx,
    page: i64,
    page_size: i64,
) -> Result<Vec<GroupDto>, String> {
    let offset = (page - 1) * page_size;
    models::fetch_groups(&svc_ctx.db, offset, page_size)
        .await
        .map_err(|e| e.to_string())
}

/// 获取分组详情
pub async fn get_group_service(svc_ctx: &SvcCtx, group_uuid: Uuid) -> Result<GroupDto, String> {
    models::fetch_group_by_uuid(&svc_ctx.db, group_uuid)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "分组不存在".to_string())
}

/// 更新分组
pub async fn update_group_service(
    svc_ctx: &SvcCtx,
    payload: &UpdateGroupRequest,
) -> Result<(), String> {
    models::fetch_group_by_uuid(&svc_ctx.db, payload.uuid)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "分组不存在".to_string())?;

    models::update_group(
        &svc_ctx.db,
        payload.uuid,
        payload.name.as_deref(),
        payload.description.as_deref(),
        payload.sort_order,
    )
    .await
    .map_err(|e| e.to_string())
}

/// 删除分组
pub async fn delete_group_service(svc_ctx: &SvcCtx, group_uuid: Uuid) -> Result<(), String> {
    models::fetch_group_by_uuid(&svc_ctx.db, group_uuid)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "分组不存在".to_string())?;

    models::delete_group(&svc_ctx.db, group_uuid).await.map_err(|e| e.to_string())
}
