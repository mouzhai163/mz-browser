use chrono::{DateTime, Duration, Local, Utc};
use croner::Cron;
use uuid::Uuid;

use crate::dto::{RpaTaskDto, RpaTaskRunDto, RpaTaskStatsDto, RpaTaskStepDto};
use crate::entitys::{
    CreateRpaTaskRequest, DuplicateRpaTaskRequest, FinishRpaRunRequest, ListRpaRunsRequest,
    ListRpaTasksRequest, StartRpaRunRequest, StartRpaRunResponse, UpdateRpaTaskRequest,
};
use crate::models;
use crate::svc_ctx::SvcCtx;

/// cron 表达式无效时返回给前端的错误码
const INVALID_CRON: &str = "INVALID_CRON";

/// 到期超过这个时间还没触发，说明软件没开或电脑睡眠过，这次不补跑
const MISSED_RUN_GRACE_SECONDS: i64 = 120;

/// List RPA tasks.
pub async fn get_rpa_tasks_service(
    svc_ctx: &SvcCtx,
    payload: &ListRpaTasksRequest,
) -> Result<(Vec<RpaTaskDto>, i64), String> {
    let offset = (payload.pagination.page - 1) * payload.pagination.page_size;

    let keyword = payload.filters.as_ref().and_then(|f| f.keyword.as_deref());
    let status = payload.filters.as_ref().and_then(|f| f.status.as_deref());
    let trigger_type = payload.filters.as_ref().and_then(|f| f.trigger_type.as_deref());

    let tasks = models::rpa::fetch_rpa_tasks(
        &svc_ctx.db,
        keyword,
        status,
        trigger_type,
        offset,
        payload.pagination.page_size,
    )
    .await
    .map_err(|e| e.to_string())?;

    let total = models::rpa::fetch_rpa_tasks_count(
        &svc_ctx.db,
        keyword,
        status,
        trigger_type,
    )
    .await
    .map_err(|e| e.to_string())?;

    Ok((tasks, total))
}

/// Get RPA task detail.
pub async fn get_rpa_task_service(
    svc_ctx: &SvcCtx,
    task_uuid: Uuid,
) -> Result<(RpaTaskDto, Vec<RpaTaskStepDto>, Vec<Uuid>), String> {
    let task = models::rpa::fetch_rpa_task_by_uuid(&svc_ctx.db, task_uuid)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "RPA task not found".to_string())?;

    let steps = models::rpa::fetch_rpa_task_steps(&svc_ctx.db, task_uuid)
        .await
        .map_err(|e| e.to_string())?;

    let environments = models::rpa::fetch_rpa_task_environments(&svc_ctx.db, task_uuid)
        .await
        .map_err(|e| e.to_string())?;

    let environment_uuids: Vec<Uuid> =
        environments.into_iter().map(|e| e.environment_uuid).collect();

    Ok((task, steps, environment_uuids))
}

/// 把"每小时/每天/每周/自定义"转成 cron 表达式
fn cron_for(schedule: Option<&str>, cron_expression: Option<&str>) -> Option<String> {
    match schedule? {
        "hourly" => Some("0 * * * *".to_string()),
        "daily" => Some("0 9 * * *".to_string()),
        "weekly" => Some("0 9 * * 1".to_string()),
        "custom" => cron_expression
            .map(str::trim)
            .filter(|expression| !expression.is_empty())
            .map(str::to_string),
        _ => None,
    }
}

/// 计算下一次运行时间（按本机时区解释 cron）。非定时任务或没选计划时返回 None。
pub fn compute_next_run(
    trigger_type: &str,
    schedule: Option<&str>,
    cron_expression: Option<&str>,
    after: DateTime<Utc>,
) -> Result<Option<DateTime<Utc>>, String> {
    if trigger_type != "scheduled" {
        return Ok(None);
    }
    let Some(expression) = cron_for(schedule, cron_expression) else {
        return Ok(None);
    };
    let cron = expression
        .parse::<Cron>()
        .map_err(|_| INVALID_CRON.to_string())?;
    let next = cron
        .find_next_occurrence(&after.with_timezone(&Local), false)
        .map_err(|_| INVALID_CRON.to_string())?;
    Ok(Some(next.with_timezone(&Utc)))
}

/// Create an RPA task.
pub async fn create_rpa_task_service(
    svc_ctx: &SvcCtx,
    payload: &CreateRpaTaskRequest,
) -> Result<Uuid, String> {
    let tags_json = payload.tags.as_ref().map(|t| serde_json::json!(t));
    let next_run_at = compute_next_run(
        &payload.trigger_type,
        payload.schedule.as_deref(),
        payload.cron_expression.as_deref(),
        Utc::now(),
    )?;

    let mut tx = svc_ctx.db.begin().await.map_err(|e| e.to_string())?;

    let task_uuid = models::rpa::insert_rpa_task(
        &mut *tx,
        &payload.name,
        payload.description.as_deref(),
        tags_json.as_ref(),
        &payload.trigger_type,
        payload.schedule.as_deref(),
        payload.cron_expression.as_deref(),
        &payload.run_mode,
        payload.retry_count,
        payload.retry_interval,
        payload.timeout,
        payload.concurrency,
        payload.stop_on_error,
        payload.notify_on_complete,
        payload.notify_on_error,
    )
    .await
    .map_err(|e| e.to_string())?;

    models::rpa::set_rpa_task_next_run(&mut *tx, task_uuid, next_run_at)
        .await
        .map_err(|e| e.to_string())?;

    // Persist ordered steps.
    if let Some(steps) = &payload.steps {
        for (i, step) in steps.iter().enumerate() {
            models::rpa::insert_rpa_task_step(
                &mut *tx,
                task_uuid,
                &step.step_type,
                &step.name,
                &step.config,
                step.enabled,
                step.position_x,
                step.position_y,
                Some(step.sort_order.unwrap_or(i as i32)),
                step.next_step_uuid,
                step.branch_config.as_ref(),
            )
            .await
            .map_err(|e| e.to_string())?;
        }
    }

    // Persist environment bindings.
    if let Some(env_uuids) = &payload.environment_uuids {
        for (i, env_uuid) in env_uuids.iter().enumerate() {
            models::rpa::insert_rpa_task_environment(&mut *tx, task_uuid, *env_uuid, Some(i as i32))
                .await
                .map_err(|e| e.to_string())?;
        }
    }

    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(task_uuid)
}

/// Update an RPA task. 任务、步骤、环境在同一个事务里更新，失败时不会只改一半。
pub async fn update_rpa_task_service(
    svc_ctx: &SvcCtx,
    payload: &UpdateRpaTaskRequest,
) -> Result<(), String> {
    let tags_json = payload.tags.as_ref().map(|t| serde_json::json!(t));

    let mut tx = svc_ctx.db.begin().await.map_err(|e| e.to_string())?;

    models::rpa::update_rpa_task(
        &mut *tx,
        payload.uuid,
        payload.name.as_deref(),
        payload.description.as_deref(),
        tags_json.as_ref(),
        payload.trigger_type.as_deref(),
        payload.schedule.as_deref(),
        payload.cron_expression.as_deref(),
        payload.run_mode.as_deref(),
        payload.retry_count,
        payload.retry_interval,
        payload.timeout,
        payload.concurrency,
        payload.stop_on_error,
        payload.notify_on_complete,
        payload.notify_on_error,
    )
    .await
    .map_err(|e| e.to_string())?;

    let task = models::rpa::fetch_rpa_task_by_uuid(&mut *tx, payload.uuid)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "RPA task not found".to_string())?;
    let next_run_at = compute_next_run(
        &task.trigger_type,
        task.schedule.as_deref(),
        task.cron_expression.as_deref(),
        Utc::now(),
    )?;
    models::rpa::set_rpa_task_next_run(&mut *tx, payload.uuid, next_run_at)
        .await
        .map_err(|e| e.to_string())?;

    // Replace stored steps when the caller sends a full step list.
    if let Some(steps) = &payload.steps {
        models::rpa::delete_rpa_task_steps(&mut *tx, payload.uuid)
            .await
            .map_err(|e| e.to_string())?;

        for (i, step) in steps.iter().enumerate() {
            models::rpa::insert_rpa_task_step(
                &mut *tx,
                payload.uuid,
                &step.step_type,
                &step.name,
                &step.config,
                step.enabled,
                step.position_x,
                step.position_y,
                Some(step.sort_order.unwrap_or(i as i32)),
                step.next_step_uuid,
                step.branch_config.as_ref(),
            )
            .await
            .map_err(|e| e.to_string())?;
        }
    }

    // Replace environment bindings when provided (an empty list clears them).
    if let Some(env_uuids) = &payload.environment_uuids {
        models::rpa::delete_rpa_task_environments(&mut *tx, payload.uuid)
            .await
            .map_err(|e| e.to_string())?;

        for (i, env_uuid) in env_uuids.iter().enumerate() {
            models::rpa::insert_rpa_task_environment(&mut *tx, payload.uuid, *env_uuid, Some(i as i32))
                .await
                .map_err(|e| e.to_string())?;
        }
    }

    tx.commit().await.map_err(|e| e.to_string())
}

/// Soft-delete an RPA task.
pub async fn delete_rpa_task_service(svc_ctx: &SvcCtx, task_uuid: Uuid) -> Result<(), String> {
    models::rpa::delete_rpa_task(&svc_ctx.db, task_uuid)
        .await
        .map_err(|e| e.to_string())?;
    models::rpa::delete_rpa_task_runs(&svc_ctx.db, task_uuid)
        .await
        .map_err(|e| e.to_string())
}

/// Soft-delete RPA tasks in batch.
pub async fn batch_delete_rpa_tasks_service(
    svc_ctx: &SvcCtx,
    task_uuids: &[Uuid],
) -> Result<u64, String> {
    let deleted = models::rpa::batch_delete_rpa_tasks(&svc_ctx.db, task_uuids)
        .await
        .map_err(|e| e.to_string())?;
    for task_uuid in task_uuids {
        models::rpa::delete_rpa_task_runs(&svc_ctx.db, *task_uuid)
            .await
            .map_err(|e| e.to_string())?;
    }
    Ok(deleted)
}

/// Duplicate an RPA task.
pub async fn duplicate_rpa_task_service(
    svc_ctx: &SvcCtx,
    payload: &DuplicateRpaTaskRequest,
) -> Result<Uuid, String> {
    // Load source task data.
    let (task, steps, environment_uuids) = get_rpa_task_service(svc_ctx, payload.uuid).await?;

    let new_name = payload.new_name.clone().unwrap_or_else(|| format!("{} (copy)", task.name));

    // Create duplicated task row.
    let new_task_uuid = models::rpa::insert_rpa_task(
        &svc_ctx.db,
        &new_name,
        task.description.as_deref(),
        task.tags.as_ref(),
        &task.trigger_type,
        task.schedule.as_deref(),
        task.cron_expression.as_deref(),
        &task.run_mode,
        task.retry_count,
        task.retry_interval,
        task.timeout,
        task.concurrency,
        task.stop_on_error,
        task.notify_on_complete,
        task.notify_on_error,
    )
    .await
    .map_err(|e| e.to_string())?;

    // Copy steps.
    for step in steps {
        models::rpa::insert_rpa_task_step(
            &svc_ctx.db,
            new_task_uuid,
            &step.step_type,
            &step.name,
            &step.config,
            step.enabled,
            step.position_x,
            step.position_y,
            step.sort_order,
            step.next_step_uuid,
            step.branch_config.as_ref(),
        )
        .await
        .map_err(|e| e.to_string())?;
    }

    // Copy environment bindings.
    for (i, env_uuid) in environment_uuids.iter().enumerate() {
        models::rpa::insert_rpa_task_environment(
            &svc_ctx.db,
            new_task_uuid,
            *env_uuid,
            Some(i as i32),
        )
        .await
        .map_err(|e| e.to_string())?;
    }

    let next_run_at = compute_next_run(
        &task.trigger_type,
        task.schedule.as_deref(),
        task.cron_expression.as_deref(),
        Utc::now(),
    )
    .unwrap_or(None);
    models::rpa::set_rpa_task_next_run(&svc_ctx.db, new_task_uuid, next_run_at)
        .await
        .map_err(|e| e.to_string())?;

    Ok(new_task_uuid)
}

/// Export an RPA task.
pub async fn export_rpa_task_service(
    svc_ctx: &SvcCtx,
    task_uuid: Uuid,
) -> Result<(String, String), String> {
    let (task, steps, environment_uuids) = get_rpa_task_service(svc_ctx, task_uuid).await?;

    let export_data = serde_json::json!({
        "name": task.name,
        "description": task.description,
        "tags": task.tags,
        "trigger_type": task.trigger_type,
        "schedule": task.schedule,
        "cron_expression": task.cron_expression,
        "run_mode": task.run_mode,
        "retry_count": task.retry_count,
        "retry_interval": task.retry_interval,
        "timeout": task.timeout,
        "concurrency": task.concurrency,
        "stop_on_error": task.stop_on_error,
        "notify_on_complete": task.notify_on_complete,
        "notify_on_error": task.notify_on_error,
        "steps": steps.iter().map(|s| serde_json::json!({
            "step_type": s.step_type,
            "name": s.name,
            "config": s.config,
            "enabled": s.enabled,
            "position_x": s.position_x,
            "position_y": s.position_y,
            "sort_order": s.sort_order,
            "next_step_uuid": s.next_step_uuid,
            "branch_config": s.branch_config,
        })).collect::<Vec<_>>(),
        "environment_uuids": environment_uuids,
    });

    let content = serde_json::to_string_pretty(&export_data).map_err(|e| e.to_string())?;
    let filename = format!("rpa_task_{}.json", task_uuid);

    Ok((content, filename))
}

/// 全部任务的统计
pub async fn get_rpa_task_stats_service(svc_ctx: &SvcCtx) -> Result<RpaTaskStatsDto, String> {
    models::rpa::fetch_rpa_task_stats(&svc_ctx.db)
        .await
        .map_err(|e| e.to_string())
}

/// 设置任务状态（一次执行全部环境结束后调用）
pub async fn set_rpa_task_status_service(
    svc_ctx: &SvcCtx,
    task_uuid: Uuid,
    status: &str,
) -> Result<(), String> {
    models::rpa::update_rpa_task_status(&svc_ctx.db, task_uuid, status)
        .await
        .map_err(|e| e.to_string())
}

/// 开始一条运行记录
pub async fn start_rpa_run_service(
    svc_ctx: &SvcCtx,
    payload: &StartRpaRunRequest,
) -> Result<StartRpaRunResponse, String> {
    let (uuid, pruned) = models::rpa::insert_rpa_task_run(
        &svc_ctx.db,
        payload.task_uuid,
        payload.environment_uuid,
        payload.environment_name.as_deref(),
        &payload.trigger_source,
        payload.total_steps,
    )
    .await
    .map_err(|e| e.to_string())?;
    Ok(StartRpaRunResponse { uuid, pruned })
}

/// 结束一条运行记录
pub async fn finish_rpa_run_service(
    svc_ctx: &SvcCtx,
    payload: &FinishRpaRunRequest,
) -> Result<(), String> {
    models::rpa::finish_rpa_task_run(
        &svc_ctx.db,
        payload.uuid,
        &payload.status,
        payload.completed_steps,
        payload.failed_steps,
        payload.duration_ms,
        payload.result_summary.as_deref(),
        payload.error_message.as_deref(),
        &payload.logs,
    )
    .await
    .map_err(|e| e.to_string())
}

/// 运行记录列表
pub async fn list_rpa_runs_service(
    svc_ctx: &SvcCtx,
    payload: &ListRpaRunsRequest,
) -> Result<(Vec<RpaTaskRunDto>, i64), String> {
    let offset = (payload.pagination.page - 1) * payload.pagination.page_size;
    let status = payload.status.as_deref();
    let items = models::rpa::fetch_rpa_task_runs(
        &svc_ctx.db,
        payload.task_uuid,
        status,
        offset,
        payload.pagination.page_size,
    )
    .await
    .map_err(|e| e.to_string())?;
    let total = models::rpa::fetch_rpa_task_runs_count(&svc_ctx.db, payload.task_uuid, status)
        .await
        .map_err(|e| e.to_string())?;
    Ok((items, total))
}

/// 运行记录详情
pub async fn get_rpa_run_service(
    svc_ctx: &SvcCtx,
    run_uuid: Uuid,
) -> Result<RpaTaskRunDto, String> {
    models::rpa::fetch_rpa_task_run_by_uuid(&svc_ctx.db, run_uuid)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "RPA run not found".to_string())
}

/// 取出已到期的定时任务并排好它们的下一次。
/// 到期太久的（软件没开、电脑睡眠）不补跑，只往后排。
pub async fn take_due_rpa_tasks_service(
    svc_ctx: &SvcCtx,
    now: DateTime<Utc>,
) -> Result<Vec<Uuid>, String> {
    let tasks = models::rpa::fetch_scheduled_rpa_tasks(&svc_ctx.db)
        .await
        .map_err(|e| e.to_string())?;

    let mut due = Vec::new();
    for task in tasks {
        if task.next_run_at.is_some_and(|next| next > now) {
            continue;
        }
        // 表达式已经失效的任务不再排期，也不影响其他任务
        let next = compute_next_run(
            &task.trigger_type,
            task.schedule.as_deref(),
            task.cron_expression.as_deref(),
            now,
        )
        .unwrap_or(None);
        models::rpa::set_rpa_task_next_run(&svc_ctx.db, task.uuid, next)
            .await
            .map_err(|e| e.to_string())?;

        if task
            .next_run_at
            .is_some_and(|at| now - at <= Duration::seconds(MISSED_RUN_GRACE_SECONDS))
        {
            due.push(task.uuid);
        }
    }
    Ok(due)
}

/// 软件启动时收尾：标记上次中断的运行，并跳过错过的定时
pub async fn recover_rpa_runs_service(svc_ctx: &SvcCtx) -> Result<(), String> {
    models::rpa::mark_interrupted_rpa_runs(&svc_ctx.db)
        .await
        .map_err(|e| e.to_string())?;

    let now = Utc::now();
    let tasks = models::rpa::fetch_scheduled_rpa_tasks(&svc_ctx.db)
        .await
        .map_err(|e| e.to_string())?;
    for task in tasks {
        if task.next_run_at.is_some_and(|next| next > now) {
            continue;
        }
        let next = compute_next_run(
            &task.trigger_type,
            task.schedule.as_deref(),
            task.cron_expression.as_deref(),
            now,
        )
        .unwrap_or(None);
        models::rpa::set_rpa_task_next_run(&svc_ctx.db, task.uuid, next)
            .await
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    fn at(hour: u32, minute: u32) -> DateTime<Utc> {
        Local
            .with_ymd_and_hms(2026, 11, 10, hour, minute, 0)
            .unwrap()
            .with_timezone(&Utc)
    }

    #[test]
    fn manual_tasks_have_no_next_run() {
        assert_eq!(compute_next_run("manual", Some("daily"), None, at(8, 0)), Ok(None));
    }

    #[test]
    fn presets_map_to_local_times() {
        assert_eq!(
            compute_next_run("scheduled", Some("hourly"), None, at(8, 30)),
            Ok(Some(at(9, 0)))
        );
        assert_eq!(
            compute_next_run("scheduled", Some("daily"), None, at(8, 0)),
            Ok(Some(at(9, 0)))
        );
    }

    #[test]
    fn custom_cron_is_parsed_and_validated() {
        assert_eq!(
            compute_next_run("scheduled", Some("custom"), Some("15 10 * * *"), at(8, 0)),
            Ok(Some(at(10, 15)))
        );
        assert_eq!(
            compute_next_run("scheduled", Some("custom"), Some("not a cron"), at(8, 0)),
            Err(INVALID_CRON.to_string())
        );
    }

    #[test]
    fn scheduled_without_a_plan_stays_unscheduled() {
        assert_eq!(compute_next_run("scheduled", None, None, at(8, 0)), Ok(None));
        assert_eq!(compute_next_run("scheduled", Some("custom"), Some("  "), at(8, 0)), Ok(None));
    }
}
