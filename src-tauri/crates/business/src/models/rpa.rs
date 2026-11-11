use chrono::{DateTime, Utc};
use sqlx::{Error, Executor};
use uuid::Uuid;

use crate::database::{Db, Pool, placeholders};

use crate::dto::{RpaTaskDto, RpaTaskEnvironmentDto, RpaTaskRunDto, RpaTaskStatsDto, RpaTaskStepDto};

// ============ RPA Tasks ============

/// 创建 RPA 任务
pub async fn insert_rpa_task<'e, E: Executor<'e, Database = Db>>(
    pool: E,
    name: &str,
    description: Option<&str>,
    tags: Option<&serde_json::Value>,
    trigger_type: &str,
    schedule: Option<&str>,
    cron_expression: Option<&str>,
    run_mode: &str,
    retry_count: Option<i32>,
    retry_interval: Option<i32>,
    timeout: Option<i32>,
    concurrency: Option<i32>,
    stop_on_error: Option<bool>,
    notify_on_complete: Option<bool>,
    notify_on_error: Option<bool>,
) -> Result<Uuid, Error> {
    let uuid: Uuid = sqlx::query_scalar(
        r#"
        INSERT INTO rpa_tasks (name, description, tags, trigger_type,
                                schedule, cron_expression, run_mode, retry_count, retry_interval,
                                timeout, concurrency, stop_on_error, notify_on_complete, notify_on_error)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING uuid;
        "#,
    )
    .bind(name)
    .bind(description)
    .bind(tags)
    .bind(trigger_type)
    .bind(schedule)
    .bind(cron_expression)
    .bind(run_mode)
    .bind(retry_count)
    .bind(retry_interval)
    .bind(timeout)
    .bind(concurrency)
    .bind(stop_on_error)
    .bind(notify_on_complete)
    .bind(notify_on_error)
    .fetch_one(pool)
    .await?;

    Ok(uuid)
}

/// 查询 RPA 任务列表
pub async fn fetch_rpa_tasks(
    pool: &Pool<Db>,
    keyword: Option<&str>,
    status: Option<&str>,
    trigger_type: Option<&str>,
    offset: i64,
    limit: i64,
) -> Result<Vec<RpaTaskDto>, Error> {
    let recs = sqlx::query_as::<_, RpaTaskDto>(
        r#"
        SELECT id, uuid, name, description, tags, trigger_type,
               schedule, cron_expression, run_mode, retry_count, retry_interval, timeout,
               concurrency, stop_on_error, notify_on_complete, notify_on_error, status,
               run_count, success_count, last_run_at, next_run_at, created_at, updated_at, deleted_at
             , (SELECT COUNT(*) FROM rpa_task_environments rte WHERE rte.task_uuid = rpa_tasks.uuid) AS environment_count
        FROM rpa_tasks
        WHERE ($1 IS NULL OR name LIKE $1 OR COALESCE(description, '') LIKE $1)
          AND ($2 IS NULL OR status = $2)
          AND ($3 IS NULL OR trigger_type = $3)
          AND deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT $4 OFFSET $5
        "#,
    )
    .bind(keyword.map(|k| format!("%{}%", k)))
    .bind(status)
    .bind(trigger_type)
    .bind(limit)
    .bind(offset)
    .fetch_all(pool)
    .await?;

    Ok(recs)
}

/// 查询 RPA 任务总数
pub async fn fetch_rpa_tasks_count(
    pool: &Pool<Db>,
    keyword: Option<&str>,
    status: Option<&str>,
    trigger_type: Option<&str>,
) -> Result<i64, Error> {
    let count: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*) FROM rpa_tasks
        WHERE ($1 IS NULL OR status = $1)
          AND ($2 IS NULL OR trigger_type = $2)
          AND ($3 IS NULL OR name LIKE $3 OR COALESCE(description, '') LIKE $3)
          AND deleted_at IS NULL
        "#,
    )
    .bind(status)
    .bind(trigger_type)
    .bind(keyword.map(|k| format!("%{}%", k)))
    .fetch_one(pool)
    .await?;

    Ok(count)
}

/// 根据 UUID 查询 RPA 任务
pub async fn fetch_rpa_task_by_uuid<'e, E: Executor<'e, Database = Db>>(
    pool: E,
    task_uuid: Uuid,
) -> Result<Option<RpaTaskDto>, Error> {
    let rec = sqlx::query_as::<_, RpaTaskDto>(
        r#"
        SELECT id, uuid, name, description, tags, trigger_type,
               schedule, cron_expression, run_mode, retry_count, retry_interval, timeout,
               concurrency, stop_on_error, notify_on_complete, notify_on_error, status,
               run_count, success_count, last_run_at, next_run_at, created_at, updated_at, deleted_at
             , (SELECT COUNT(*) FROM rpa_task_environments rte WHERE rte.task_uuid = rpa_tasks.uuid) AS environment_count
        FROM rpa_tasks
        WHERE uuid = $1 AND deleted_at IS NULL
        "#,
    )
    .bind(task_uuid)
    .fetch_optional(pool)
    .await?;

    Ok(rec)
}

/// 更新 RPA 任务
pub async fn update_rpa_task<'e, E: Executor<'e, Database = Db>>(
    pool: E,
    task_uuid: Uuid,
    name: Option<&str>,
    description: Option<&str>,
    tags: Option<&serde_json::Value>,
    trigger_type: Option<&str>,
    schedule: Option<&str>,
    cron_expression: Option<&str>,
    run_mode: Option<&str>,
    retry_count: Option<i32>,
    retry_interval: Option<i32>,
    timeout: Option<i32>,
    concurrency: Option<i32>,
    stop_on_error: Option<bool>,
    notify_on_complete: Option<bool>,
    notify_on_error: Option<bool>,
) -> Result<(), Error> {
    sqlx::query(
        r#"
        UPDATE rpa_tasks
        SET name = COALESCE($1, name),
            description = COALESCE($2, description),
            tags = COALESCE($3, tags),
            trigger_type = COALESCE($4, trigger_type),
            schedule = COALESCE($5, schedule),
            cron_expression = COALESCE($6, cron_expression),
            run_mode = COALESCE($7, run_mode),
            retry_count = COALESCE($8, retry_count),
            retry_interval = COALESCE($9, retry_interval),
            timeout = COALESCE($10, timeout),
            concurrency = COALESCE($11, concurrency),
            stop_on_error = COALESCE($12, stop_on_error),
            notify_on_complete = COALESCE($13, notify_on_complete),
            notify_on_error = COALESCE($14, notify_on_error),
            updated_at = CURRENT_TIMESTAMP
        WHERE uuid = $15 AND deleted_at IS NULL
        "#,
    )
    .bind(name)
    .bind(description)
    .bind(tags)
    .bind(trigger_type)
    .bind(schedule)
    .bind(cron_expression)
    .bind(run_mode)
    .bind(retry_count)
    .bind(retry_interval)
    .bind(timeout)
    .bind(concurrency)
    .bind(stop_on_error)
    .bind(notify_on_complete)
    .bind(notify_on_error)
    .bind(task_uuid)
    .execute(pool)
    .await?;

    Ok(())
}

/// 更新任务状态
pub async fn update_rpa_task_status(
    pool: &Pool<Db>,
    task_uuid: Uuid,
    status: &str,
) -> Result<(), Error> {
    sqlx::query(
        r#"
        UPDATE rpa_tasks
        SET status = $1, updated_at = CURRENT_TIMESTAMP
        WHERE uuid = $2 AND deleted_at IS NULL
        "#,
    )
    .bind(status)
    .bind(task_uuid)
    .execute(pool)
    .await?;

    Ok(())
}

/// 软删除 RPA 任务
pub async fn delete_rpa_task(pool: &Pool<Db>, task_uuid: Uuid) -> Result<(), Error> {
    sqlx::query(
        r#"
        UPDATE rpa_tasks SET deleted_at = CURRENT_TIMESTAMP
        WHERE uuid = $1 AND deleted_at IS NULL
        "#,
    )
    .bind(task_uuid)
    .execute(pool)
    .await?;

    Ok(())
}

/// 批量软删除 RPA 任务
pub async fn batch_delete_rpa_tasks(pool: &Pool<Db>, task_uuids: &[Uuid]) -> Result<u64, Error> {
    if task_uuids.is_empty() {
        return Ok(0);
    }

    let statement = format!(
        r#"
        UPDATE rpa_tasks SET deleted_at = CURRENT_TIMESTAMP
        WHERE uuid IN ({}) AND deleted_at IS NULL
        "#,
        placeholders(1, task_uuids.len())
    );
    let mut query = sqlx::query(&statement);
    for uuid in task_uuids {
        query = query.bind(uuid);
    }
    let result = query.execute(pool).await?;

    Ok(result.rows_affected())
}

// ============ RPA Task Steps ============

/// 插入任务步骤
pub async fn insert_rpa_task_step<'e, E: Executor<'e, Database = Db>>(
    pool: E,
    task_uuid: Uuid,
    step_type: &str,
    name: &str,
    config: &serde_json::Value,
    enabled: Option<bool>,
    position_x: Option<i32>,
    position_y: Option<i32>,
    sort_order: Option<i32>,
    next_step_uuid: Option<Uuid>,
    branch_config: Option<&serde_json::Value>,
) -> Result<Uuid, Error> {
    let uuid: Uuid = sqlx::query_scalar(
        r#"
        INSERT INTO rpa_task_steps (task_uuid, step_type, name, config, enabled,
                                     position_x, position_y, sort_order,
                                     next_step_uuid, branch_config)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING uuid;
        "#,
    )
    .bind(task_uuid)
    .bind(step_type)
    .bind(name)
    .bind(config)
    .bind(enabled.unwrap_or(true))
    .bind(position_x)
    .bind(position_y)
    .bind(sort_order)
    .bind(next_step_uuid)
    .bind(branch_config)
    .fetch_one(pool)
    .await?;

    Ok(uuid)
}

/// 查询任务步骤列表
pub async fn fetch_rpa_task_steps(
    pool: &Pool<Db>,
    task_uuid: Uuid,
) -> Result<Vec<RpaTaskStepDto>, Error> {
    let recs = sqlx::query_as::<_, RpaTaskStepDto>(
        r#"
        SELECT id, uuid, task_uuid, step_type, name, config, enabled,
               position_x, position_y, sort_order, next_step_uuid, branch_config,
               created_at, updated_at
        FROM rpa_task_steps
        WHERE task_uuid = $1
        ORDER BY sort_order ASC, id ASC
        "#,
    )
    .bind(task_uuid)
    .fetch_all(pool)
    .await?;

    Ok(recs)
}

/// 删除任务所有步骤
pub async fn delete_rpa_task_steps<'e, E: Executor<'e, Database = Db>>(pool: E, task_uuid: Uuid) -> Result<(), Error> {
    sqlx::query("DELETE FROM rpa_task_steps WHERE task_uuid = $1")
        .bind(task_uuid)
        .execute(pool)
        .await?;

    Ok(())
}

// ============ RPA Task Environments ============

/// 添加任务环境关联
pub async fn insert_rpa_task_environment<'e, E: Executor<'e, Database = Db>>(
    pool: E,
    task_uuid: Uuid,
    environment_uuid: Uuid,
    sort_order: Option<i32>,
) -> Result<i32, Error> {
    let id: i32 = sqlx::query_scalar(
        r#"
        INSERT INTO rpa_task_environments (task_uuid, environment_uuid, sort_order)
        VALUES ($1, $2, $3)
        RETURNING id;
        "#,
    )
    .bind(task_uuid)
    .bind(environment_uuid)
    .bind(sort_order)
    .fetch_one(pool)
    .await?;

    Ok(id)
}

/// 查询任务环境关联
pub async fn fetch_rpa_task_environments(
    pool: &Pool<Db>,
    task_uuid: Uuid,
) -> Result<Vec<RpaTaskEnvironmentDto>, Error> {
    let recs = sqlx::query_as::<_, RpaTaskEnvironmentDto>(
        r#"
        SELECT id, task_uuid, environment_uuid, sort_order, created_at
        FROM rpa_task_environments
        WHERE task_uuid = $1
        ORDER BY sort_order ASC, id ASC
        "#,
    )
    .bind(task_uuid)
    .fetch_all(pool)
    .await?;

    Ok(recs)
}

/// 删除任务所有环境关联
pub async fn delete_rpa_task_environments<'e, E: Executor<'e, Database = Db>>(pool: E, task_uuid: Uuid) -> Result<(), Error> {
    sqlx::query("DELETE FROM rpa_task_environments WHERE task_uuid = $1")
        .bind(task_uuid)
        .execute(pool)
        .await?;

    Ok(())
}

// ============ RPA Task Runs ============

/// 每个任务保留的运行记录条数
const MAX_RUNS_PER_TASK: i64 = 200;

const RUN_COLUMNS: &str = "id, uuid, task_uuid, environment_uuid, environment_name, trigger_source, \
    status, total_steps, completed_steps, failed_steps, started_at, finished_at, duration_ms";

/// 创建一条运行记录（一个环境一条），同时更新任务状态，并清理超出保留条数的旧记录。
/// 返回新记录的 uuid 和被清理记录的 uuid（调用方要删掉它们的截图文件）。
pub async fn insert_rpa_task_run(
    pool: &Pool<Db>,
    task_uuid: Uuid,
    environment_uuid: Uuid,
    environment_name: Option<&str>,
    trigger_source: &str,
    total_steps: i32,
) -> Result<(Uuid, Vec<Uuid>), Error> {
    let mut tx = pool.begin().await?;

    let uuid: Uuid = sqlx::query_scalar(
        r#"
        INSERT INTO rpa_task_runs (task_uuid, environment_uuid, environment_name, trigger_source,
                                   status, total_steps, completed_steps, failed_steps)
        VALUES ($1, $2, $3, $4, 'running', $5, 0, 0)
        RETURNING uuid;
        "#,
    )
    .bind(task_uuid)
    .bind(environment_uuid)
    .bind(environment_name)
    .bind(trigger_source)
    .bind(total_steps)
    .fetch_one(&mut *tx)
    .await?;

    sqlx::query(
        r#"
        UPDATE rpa_tasks
        SET status = 'running',
            last_run_at = CURRENT_TIMESTAMP,
            run_count = COALESCE(run_count, 0) + 1
        WHERE uuid = $1
        "#,
    )
    .bind(task_uuid)
    .execute(&mut *tx)
    .await?;

    let pruned: Vec<Uuid> = sqlx::query_scalar(
        r#"
        DELETE FROM rpa_task_runs
        WHERE task_uuid = $1
          AND status != 'running'
          AND id NOT IN (
            SELECT id FROM rpa_task_runs WHERE task_uuid = $1 ORDER BY id DESC LIMIT $2
          )
        RETURNING uuid;
        "#,
    )
    .bind(task_uuid)
    .bind(MAX_RUNS_PER_TASK)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok((uuid, pruned))
}

/// 结束一条运行记录。只有还在运行的记录才会被更新，重复调用不会重复计数。
#[allow(clippy::too_many_arguments)]
pub async fn finish_rpa_task_run(
    pool: &Pool<Db>,
    run_uuid: Uuid,
    status: &str,
    completed_steps: i32,
    failed_steps: i32,
    duration_ms: i64,
    result_summary: Option<&str>,
    error_message: Option<&str>,
    logs: &serde_json::Value,
) -> Result<(), Error> {
    let mut tx = pool.begin().await?;

    let task_uuid: Option<Uuid> = sqlx::query_scalar(
        r#"
        UPDATE rpa_task_runs
        SET status = $1,
            completed_steps = $2,
            failed_steps = $3,
            duration_ms = $4,
            result_summary = $5,
            error_message = $6,
            logs = $7,
            finished_at = CURRENT_TIMESTAMP
        WHERE uuid = $8 AND status = 'running'
        RETURNING task_uuid;
        "#,
    )
    .bind(status)
    .bind(completed_steps)
    .bind(failed_steps)
    .bind(duration_ms)
    .bind(result_summary)
    .bind(error_message)
    .bind(logs)
    .bind(run_uuid)
    .fetch_optional(&mut *tx)
    .await?;

    if let (Some(task_uuid), "completed") = (task_uuid, status) {
        sqlx::query("UPDATE rpa_tasks SET success_count = COALESCE(success_count, 0) + 1 WHERE uuid = $1")
            .bind(task_uuid)
            .execute(&mut *tx)
            .await?;
    }

    tx.commit().await
}

/// 查询任务运行记录列表（列表不带日志和提取数据，详情里才有）
pub async fn fetch_rpa_task_runs(
    pool: &Pool<Db>,
    task_uuid: Uuid,
    status: Option<&str>,
    offset: i64,
    limit: i64,
) -> Result<Vec<RpaTaskRunDto>, Error> {
    let statement = format!(
        r#"
        SELECT {RUN_COLUMNS}, NULL AS result_summary, error_message, NULL AS logs
        FROM rpa_task_runs
        WHERE task_uuid = $1
          AND ($2 IS NULL OR status = $2)
        ORDER BY id DESC
        LIMIT $3 OFFSET $4
        "#
    );
    sqlx::query_as::<_, RpaTaskRunDto>(&statement)
        .bind(task_uuid)
        .bind(status)
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await
}

/// 查询任务运行记录总数
pub async fn fetch_rpa_task_runs_count(
    pool: &Pool<Db>,
    task_uuid: Uuid,
    status: Option<&str>,
) -> Result<i64, Error> {
    sqlx::query_scalar(
        r#"
        SELECT COUNT(*) FROM rpa_task_runs
        WHERE task_uuid = $1
          AND ($2 IS NULL OR status = $2)
        "#,
    )
    .bind(task_uuid)
    .bind(status)
    .fetch_one(pool)
    .await
}

/// 根据 UUID 查询运行记录
pub async fn fetch_rpa_task_run_by_uuid(
    pool: &Pool<Db>,
    run_uuid: Uuid,
) -> Result<Option<RpaTaskRunDto>, Error> {
    let statement = format!(
        "SELECT {RUN_COLUMNS}, result_summary, error_message, logs FROM rpa_task_runs WHERE uuid = $1"
    );
    sqlx::query_as::<_, RpaTaskRunDto>(&statement)
        .bind(run_uuid)
        .fetch_optional(pool)
        .await
}

/// 软件启动时收尾：上次没跑完的记录标记为中断，任务回到空闲
pub async fn mark_interrupted_rpa_runs(pool: &Pool<Db>) -> Result<(), Error> {
    let mut tx = pool.begin().await?;
    sqlx::query(
        r#"
        UPDATE rpa_task_runs
        SET status = 'failed', error_message = 'INTERRUPTED', finished_at = CURRENT_TIMESTAMP
        WHERE status = 'running'
        "#,
    )
    .execute(&mut *tx)
    .await?;
    sqlx::query("UPDATE rpa_tasks SET status = 'idle' WHERE status = 'running'")
        .execute(&mut *tx)
        .await?;
    tx.commit().await
}

/// 删除任务的全部运行记录
pub async fn delete_rpa_task_runs(pool: &Pool<Db>, task_uuid: Uuid) -> Result<(), Error> {
    sqlx::query("DELETE FROM rpa_task_runs WHERE task_uuid = $1")
        .bind(task_uuid)
        .execute(pool)
        .await?;
    Ok(())
}

// ============ 统计和定时 ============

/// 全部任务的统计（不受分页和筛选影响）
pub async fn fetch_rpa_task_stats(pool: &Pool<Db>) -> Result<RpaTaskStatsDto, Error> {
    sqlx::query_as::<_, RpaTaskStatsDto>(
        r#"
        SELECT COUNT(*) AS total,
               COALESCE(SUM(status = 'running'), 0) AS running,
               COALESCE(SUM(status = 'completed'), 0) AS completed,
               COALESCE(SUM(status = 'failed'), 0) AS failed,
               COALESCE(SUM(trigger_type = 'scheduled'), 0) AS scheduled
        FROM rpa_tasks
        WHERE deleted_at IS NULL
        "#,
    )
    .fetch_one(pool)
    .await
}

/// 查询全部定时任务
pub async fn fetch_scheduled_rpa_tasks(pool: &Pool<Db>) -> Result<Vec<RpaTaskDto>, Error> {
    sqlx::query_as::<_, RpaTaskDto>(
        r#"
        SELECT id, uuid, name, description, tags, trigger_type,
               schedule, cron_expression, run_mode, retry_count, retry_interval, timeout,
               concurrency, stop_on_error, notify_on_complete, notify_on_error, status,
               run_count, success_count, last_run_at, next_run_at, created_at, updated_at, deleted_at
             , (SELECT COUNT(*) FROM rpa_task_environments rte WHERE rte.task_uuid = rpa_tasks.uuid) AS environment_count
        FROM rpa_tasks
        WHERE trigger_type = 'scheduled' AND deleted_at IS NULL
        "#,
    )
    .fetch_all(pool)
    .await
}

/// 写入下次运行时间
pub async fn set_rpa_task_next_run<'e, E: Executor<'e, Database = Db>>(
    pool: E,
    task_uuid: Uuid,
    next_run_at: Option<DateTime<Utc>>,
) -> Result<(), Error> {
    sqlx::query("UPDATE rpa_tasks SET next_run_at = $1 WHERE uuid = $2")
        .bind(next_run_at)
        .bind(task_uuid)
        .execute(pool)
        .await?;
    Ok(())
}
