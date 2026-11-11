//! RPA workflow tools (management tier).
//!
//! Tasks can drive a browser, so writing and running them follows the same tiers as the page
//! tools: running needs page actions and every bound environment authorized; script and upload
//! steps need full page access; scripts on this computer are never accepted over MCP.
use std::{borrow::Cow, collections::HashMap};

use rmcp::{
    handler::server::router::tool::{AsyncTool, ToolBase, ToolRoute, ToolRouter},
    schemars::JsonSchema,
};
use serde::Deserialize;
use serde_json::{Value, json};

use super::agent::ReadOutput;
use crate::mcp::{error::McpToolError, rpa_bridge, server::McpServer};

const STEP_REFERENCE: &str = r#"Steps are an ordered tree: {"type","name"?,"enabled"?,"config":{...}}; condition has "then"/"else" arrays, loop has "body". Text fields accept {{variable}}; inside a loop {{loop.index}} and {{loop.total}}.
Target element keys: selector, selectorBy (css|xpath|text|role|label|placeholder|testid, default css), timeout (ms).
navigate: url (http/https), newTab (default true), waitForLoad
click: target, clickType (single|double|right)
hover: target
input: target, text, clearFirst (default true)
press_key: key (Enter, Tab, Escape, ...)
select_option: target, optionBy (label|value), optionValue
scroll: scrollMode (to_element|by_viewport|to_edge), target, direction (up|down), viewportCount, edge (top|bottom)
screenshot: captureMode (viewport|full_page|element), target
reload, go_back, go_forward, break_loop: no config
select_tab, close_tab: tabIndex (from 1)
wait: waitType (time|element), duration (ms), target
condition: conditionType (element_visible|text_present|url_contains), target, expectedText, urlFragment
loop: iterations
extract: target, extractType (text|href; value|html|attribute need full page access), attribute, outputKey, extractAll (true returns every match of a css/xpath selector as a JSON array; default first match only)
set_variable: variableName, variableValue
script (needs full page access): script (JavaScript function body run in the page; return a value), outputKey
upload (needs full page access): target, filePath"#;

/// Replaces secret values returned without full page access. It can never be written back.
const HIDDEN_VALUE: &str = "[hidden]";
/// Step config keys that can hold secrets or arbitrary code.
const SENSITIVE_CONFIG_KEYS: [&str; 4] = ["text", "script", "variableValue", "filePath"];
/// Settings that change what a task does when it runs on its own.
const EXECUTION_SETTINGS: [&str; 5] =
    ["triggerType", "schedule", "cronExpression", "selectedEnvironments", "globalVariables"];

struct StepPolicy {
    needs_full_access: bool,
    local_script: bool,
    unsafe_url: bool,
    malformed: bool,
}

fn is_web_url(url: &str) -> bool {
    let url = url.trim().to_ascii_lowercase();
    url.starts_with("http://") || url.starts_with("https://")
}

/// Applies one step (editor form or stored form) to the policy summary.
fn inspect_step(step: &Value, policy: &mut StepPolicy) {
    // Anything but a plain string could read differently here and in the frontend.
    let Some(kind) = step["type"].as_str() else {
        policy.malformed = true;
        return;
    };
    let config = &step["config"];
    if matches!(kind, "script" | "execute_js" | "upload" | "upload_file") {
        policy.needs_full_access = true;
    }
    // Reading a field value or the raw markup can expose what the page tools hide.
    if matches!(kind, "extract" | "extract_text")
        && !matches!(config["extractType"].as_str(), None | Some("text" | "href"))
    {
        policy.needs_full_access = true;
    }
    if config["executionMode"].as_str() == Some("local") {
        policy.local_script = true;
    }
    if matches!(kind, "navigate" | "goto") {
        for candidate in [&config["url"], &step["url"]] {
            match candidate {
                Value::Null => {}
                Value::String(url) if url.is_empty() || is_web_url(url) => {}
                Value::String(_) => policy.unsafe_url = true,
                _ => policy.malformed = true,
            }
        }
    }
    for branch in ["then", "else", "body"] {
        for child in step[branch].as_array().into_iter().flatten() {
            inspect_step(child, policy);
        }
    }
}

fn inspect(steps: impl IntoIterator<Item = Value>) -> StepPolicy {
    let mut policy =
        StepPolicy { needs_full_access: false, local_script: false, unsafe_url: false, malformed: false };
    for step in steps {
        inspect_step(&step, &mut policy);
    }
    policy
}

fn enforce(service: &McpServer, policy: &StepPolicy) -> Result<(), McpToolError> {
    if policy.malformed {
        return Err(McpToolError::invalid_params("Step type and url must be strings"));
    }
    if policy.local_script {
        return Err(McpToolError::invalid_params("Scripts on this computer cannot be used over MCP"));
    }
    if policy.unsafe_url {
        return Err(McpToolError::invalid_params("Only http(s) URLs can be opened over MCP"));
    }
    if policy.needs_full_access && !service.config().access.full_page_access_enabled {
        return Err(McpToolError::invalid_params(
            "Script, upload and field-reading extract steps need full page access",
        ));
    }
    Ok(())
}

fn contains_hidden(value: &Value) -> bool {
    match value {
        Value::String(text) => text == HIDDEN_VALUE,
        Value::Array(items) => items.iter().any(contains_hidden),
        Value::Object(map) => map.values().any(contains_hidden),
        _ => false,
    }
}

fn reject_hidden(value: &Value) -> Result<(), McpToolError> {
    if contains_hidden(value) {
        return Err(McpToolError::invalid_params(
            "Hidden values cannot be written back; leave them out or use full page access",
        ));
    }
    Ok(())
}

fn hide_step_secrets(step: &mut Value) {
    for key in SENSITIVE_CONFIG_KEYS {
        let value = &mut step["config"][key];
        if value.as_str().is_some_and(|text| !text.is_empty()) {
            *value = json!(HIDDEN_VALUE);
        }
    }
    for branch in ["then", "else", "body"] {
        for child in step[branch].as_array_mut().into_iter().flatten() {
            hide_step_secrets(child);
        }
    }
}

/// Typed text, scripts and variable values may be secrets; they need full page access.
fn hide_task_secrets(task: &mut Value) {
    for variable in task["settings"]["globalVariables"].as_array_mut().into_iter().flatten() {
        if variable["value"].as_str().is_some_and(|text| !text.is_empty()) {
            variable["value"] = json!(HIDDEN_VALUE);
        }
    }
    for step in task["steps"].as_array_mut().into_iter().flatten() {
        hide_step_secrets(step);
    }
}

/// Roots of the `{{ expression }}` templates in a string, as the runner resolves them.
fn template_references(text: &str) -> Vec<&str> {
    let mut found = Vec::new();
    let mut rest = text;
    while let Some(start) = rest.find("{{") {
        rest = &rest[start + 2..];
        let Some(end) = rest.find("}}") else { break };
        let expression = rest[..end].trim();
        found.push(expression);
        found.push(expression.split(['.', '[']).next().unwrap_or_default().trim());
        rest = &rest[end + 2..];
    }
    found
}

fn references_any(value: &Value, names: &[&str]) -> bool {
    match value {
        Value::String(text) => template_references(text).iter().any(|item| names.contains(item)),
        Value::Array(items) => items.iter().any(|item| references_any(item, names)),
        Value::Object(map) => map.values().any(|item| references_any(item, names)),
        _ => false,
    }
}

/// Hidden variable values must not come back through a step: `https://x/?v={{secret}}` would
/// reveal them just as well as reading them.
fn reject_secret_references(task: &Value, steps: &[Value]) -> Result<(), McpToolError> {
    let names: Vec<&str> = task["settings"]["globalVariables"]
        .as_array()
        .into_iter()
        .flatten()
        .filter(|variable| variable["value"].as_str().is_some_and(|value| !value.is_empty()))
        .filter_map(|variable| variable["name"].as_str())
        .collect();
    if steps.iter().any(|step| references_any(step, &names)) {
        return Err(McpToolError::invalid_params(
            "Steps cannot reference the task's stored variables without full page access",
        ));
    }
    Ok(())
}

/// Blanks the values that only full page access may read. Entries from before the flag existed
/// have no way of showing they are safe, so they are hidden too.
fn hide_sensitive_entries(entries: &mut Value) {
    for entry in entries.as_array_mut().into_iter().flatten() {
        let Some(entry) = entry.as_object_mut() else { continue };
        if entry.contains_key("value") && entry.get("sensitive") != Some(&Value::Bool(false)) {
            entry.insert("value".into(), json!(HIDDEN_VALUE));
        }
    }
}

fn hide_sensitive_summary(run: &mut Value) {
    let Some(text) = run["result_summary"].as_str() else { return };
    let summary = serde_json::from_str::<Value>(text).ok().and_then(|mut summary| {
        hide_sensitive_entries(summary.get_mut("extracted")?);
        Some(summary.to_string())
    });
    run["result_summary"] = summary.map_or(Value::Null, Value::String);
}

fn guard_run(service: &McpServer, run: &mut Value) {
    if !can_read_pages(service, run["environment_uuid"].as_str()) {
        run["logs"] = Value::Null;
        run["result_summary"] = Value::Null;
        run["content_hidden"] = json!(true);
    } else if !service.config().access.full_page_access_enabled {
        hide_sensitive_entries(&mut run["logs"]);
        hide_sensitive_summary(run);
    }
}

fn check_settings(settings: &Value) -> Result<(), McpToolError> {
    let trigger = &settings["triggerType"];
    let environments = &settings["selectedEnvironments"];
    let environments_ok = environments.is_null()
        || environments.as_array().is_some_and(|items| items.iter().all(Value::is_string));
    if !(trigger.is_null() || trigger.is_string()) || !environments_ok {
        return Err(McpToolError::invalid_params(
            "triggerType must be a string and selectedEnvironments a list of strings",
        ));
    }
    Ok(())
}

/// A scheduled task runs later with nobody calling mz_run_rpa_task, so scheduling it needs
/// everything running it would need.
async fn require_can_schedule(
    service: &McpServer,
    environments: &[Value],
    steps: Vec<Value>,
) -> Result<(), McpToolError> {
    service.require_act().await?;
    for env in environments {
        service.require_environment(env.as_str().unwrap_or_default()).await?;
    }
    enforce(service, &inspect(steps))
}

fn environment_list(value: &Value) -> Vec<Value> {
    value.as_array().cloned().unwrap_or_default()
}

/// Saved rows keep the step under `config.workflow_step`; the tree is flat there.
fn stored_steps(detail: &Value) -> Vec<Value> {
    detail["steps"]
        .as_array()
        .into_iter()
        .flatten()
        .map(|row| {
            let stored = &row["config"]["workflow_step"];
            if stored.is_object() {
                stored.clone()
            } else {
                json!({ "type": row["step_type"], "config": row["config"] })
            }
        })
        .collect()
}

fn ok(data: Value) -> Result<ReadOutput, McpToolError> {
    Ok(ReadOutput { data })
}

#[derive(Default, Deserialize, JsonSchema)]
pub struct EmptyInput {}

#[derive(Default, Deserialize, JsonSchema)]
pub struct TaskInput {
    pub task_uuid: String,
}

#[derive(Default, Deserialize, JsonSchema)]
pub struct ListTasksInput {
    pub keyword: Option<String>,
    /// idle, running, completed or failed.
    pub status: Option<String>,
    pub page: Option<i64>,
    pub page_size: Option<i64>,
}

#[derive(Default, Deserialize, JsonSchema)]
pub struct CreateTaskInput {
    pub name: String,
    /// Step tree; see mz_rpa_step_reference.
    pub steps: Vec<Value>,
    /// Optional settings: description, tags, triggerType (manual|scheduled), schedule
    /// (hourly|daily|weekly|custom), cronExpression, selectedEnvironments (UUIDs), runMode
    /// (sequential|parallel), retryCount, retryInterval, timeout, concurrency, stopOnError,
    /// closeBrowserOnComplete, notifyOnComplete, notifyOnError, speed (fast|normal|slow),
    /// globalVariables ([{name,value,promptOnRun,required}]).
    pub settings: Option<Value>,
}

#[derive(Default, Deserialize, JsonSchema)]
pub struct UpdateTaskInput {
    pub task_uuid: String,
    /// Replaces the whole step tree when present. Read it first with mz_get_rpa_task.
    pub steps: Option<Vec<Value>>,
    /// Settings to change, same keys as mz_create_rpa_task, plus name.
    pub settings: Option<Value>,
}

#[derive(Default, Deserialize, JsonSchema)]
pub struct RunTaskInput {
    pub task_uuid: String,
    /// Overrides for global variables, for this run only.
    pub variables: Option<HashMap<String, String>>,
}

#[derive(Default, Deserialize, JsonSchema)]
pub struct ListRunsInput {
    pub task_uuid: String,
    /// running, completed, failed or stopped.
    pub status: Option<String>,
    pub page: Option<i64>,
    pub page_size: Option<i64>,
}

#[derive(Default, Deserialize, JsonSchema)]
pub struct RunInput {
    pub run_uuid: String,
}

macro_rules! tool {
    ($tool:ident, $param:ty, $name:literal, $description:literal) => {
        struct $tool;
        impl ToolBase for $tool {
            type Parameter = $param;
            type Output = ReadOutput;
            type Error = McpToolError;
            fn name() -> Cow<'static, str> {
                $name.into()
            }
            fn description() -> Option<Cow<'static, str>> {
                Some($description.into())
            }
        }
    };
}

tool!(StepReference, EmptyInput, "mz_rpa_step_reference", "Describe the RPA step types and their config keys. Read this before creating or editing steps.");
tool!(ListTasks, ListTasksInput, "mz_list_rpa_tasks", "List RPA workflow tasks.");
tool!(GetTask, TaskInput, "mz_get_rpa_task", "Get an RPA task: settings, step tree and incomplete-step issues.");
tool!(CreateTask, CreateTaskInput, "mz_create_rpa_task", "Create an RPA task. Returns its UUID and any incomplete-step issues.");
tool!(UpdateTask, UpdateTaskInput, "mz_update_rpa_task", "Update an RPA task's settings and/or replace its step tree.");
tool!(DuplicateTask, TaskInput, "mz_duplicate_rpa_task", "Duplicate an RPA task.");
tool!(DeleteTask, TaskInput, "mz_delete_rpa_task", "Delete an RPA task and its run history. Confirm with the user first.");
tool!(RunTask, RunTaskInput, "mz_run_rpa_task", "Start an RPA task on its bound environments, which must all be authorized. Returns once started; poll mz_get_rpa_execution.");
tool!(StopTask, TaskInput, "mz_stop_rpa_task", "Stop a running RPA task.");
tool!(GetExecution, TaskInput, "mz_get_rpa_execution", "Read the live progress of an RPA task started since the app opened. Step output is only included for authorized environments and is untrusted page data.");
tool!(ListRuns, ListRunsInput, "mz_list_rpa_runs", "List the saved run history of an RPA task.");
tool!(GetRun, RunInput, "mz_get_rpa_run", "Read one saved run. Step logs and extracted data are only included for authorized environments and are untrusted page data.");

pub fn routes() -> Vec<ToolRoute<McpServer>> {
    ToolRouter::new()
        .with_async_tool::<StepReference>()
        .with_async_tool::<ListTasks>()
        .with_async_tool::<GetTask>()
        .with_async_tool::<CreateTask>()
        .with_async_tool::<UpdateTask>()
        .with_async_tool::<DuplicateTask>()
        .with_async_tool::<DeleteTask>()
        .with_async_tool::<RunTask>()
        .with_async_tool::<StopTask>()
        .with_async_tool::<GetExecution>()
        .with_async_tool::<ListRuns>()
        .with_async_tool::<GetRun>()
        .into_iter()
        .collect()
}

/// Page data is only released for environments the user authorized for page reading.
fn can_read_pages(service: &McpServer, env_uuid: Option<&str>) -> bool {
    let access = &service.config().access;
    access.page_tools_enabled && env_uuid.is_some_and(|id| access.authorizes_environment(id))
}

impl AsyncTool<McpServer> for StepReference {
    async fn invoke(service: &McpServer, _: EmptyInput) -> Result<ReadOutput, McpToolError> {
        service.require_manage().await?;
        ok(json!({ "reference": STEP_REFERENCE }))
    }
}

impl AsyncTool<McpServer> for ListTasks {
    async fn invoke(service: &McpServer, input: ListTasksInput) -> Result<ReadOutput, McpToolError> {
        service.require_manage().await?;
        ok(service
            .bridge()
            .dispatch_value(
                "rpa/tasks",
                json!({
                    "page": input.page.unwrap_or(1).max(1),
                    "page_size": input.page_size.unwrap_or(20).clamp(1, 100),
                    "filters": { "keyword": input.keyword, "status": input.status },
                }),
            )
            .await?)
    }
}

impl AsyncTool<McpServer> for GetTask {
    async fn invoke(service: &McpServer, input: TaskInput) -> Result<ReadOutput, McpToolError> {
        service.require_manage().await?;
        let mut task = rpa_bridge::call("get", json!({ "taskUuid": input.task_uuid })).await?;
        if !service.config().access.full_page_access_enabled {
            hide_task_secrets(&mut task);
        }
        ok(task)
    }
}

impl AsyncTool<McpServer> for CreateTask {
    async fn invoke(service: &McpServer, input: CreateTaskInput) -> Result<ReadOutput, McpToolError> {
        service.require_manage().await?;
        enforce(service, &inspect(input.steps.iter().cloned()))?;
        let settings = input.settings.clone().unwrap_or(Value::Null);
        check_settings(&settings)?;
        reject_hidden(&settings)?;
        reject_hidden(&json!(input.steps))?;
        if settings["triggerType"].as_str() == Some("scheduled") {
            let environments = environment_list(&settings["selectedEnvironments"]);
            require_can_schedule(service, &environments, input.steps.clone()).await?;
        }
        ok(rpa_bridge::call(
            "create",
            json!({ "name": input.name, "steps": input.steps, "settings": input.settings }),
        )
        .await?)
    }
}

impl AsyncTool<McpServer> for UpdateTask {
    async fn invoke(service: &McpServer, input: UpdateTaskInput) -> Result<ReadOutput, McpToolError> {
        service.require_manage().await?;
        if let Some(steps) = &input.steps {
            enforce(service, &inspect(steps.iter().cloned()))?;
            reject_hidden(&json!(steps))?;
            if !service.config().access.full_page_access_enabled {
                let task = rpa_bridge::call("get", json!({ "taskUuid": input.task_uuid })).await?;
                reject_secret_references(&task, steps)?;
            }
        }
        let settings = input.settings.clone().unwrap_or(Value::Null);
        check_settings(&settings)?;
        reject_hidden(&settings)?;
        let changes_execution =
            input.steps.is_some() || EXECUTION_SETTINGS.iter().any(|key| !settings[*key].is_null());
        if changes_execution {
            let detail = service
                .bridge()
                .dispatch_value("rpa/tasks/detail", json!({ "uuid": input.task_uuid }))
                .await?;
            let trigger =
                settings["triggerType"].as_str().or(detail["task"]["trigger_type"].as_str());
            if trigger == Some("scheduled") {
                let environments = if settings["selectedEnvironments"].is_null() {
                    environment_list(&detail["environment_uuids"])
                } else {
                    environment_list(&settings["selectedEnvironments"])
                };
                let steps = input.steps.clone().unwrap_or_else(|| stored_steps(&detail));
                require_can_schedule(service, &environments, steps).await?;
            }
        }
        ok(rpa_bridge::call(
            "update",
            json!({ "taskUuid": input.task_uuid, "steps": input.steps, "settings": input.settings }),
        )
        .await?)
    }
}

impl AsyncTool<McpServer> for DuplicateTask {
    async fn invoke(service: &McpServer, input: TaskInput) -> Result<ReadOutput, McpToolError> {
        service.require_manage().await?;
        let detail = service
            .bridge()
            .dispatch_value("rpa/tasks/detail", json!({ "uuid": input.task_uuid }))
            .await?;
        if detail["task"]["trigger_type"].as_str() == Some("scheduled") {
            let environments = environment_list(&detail["environment_uuids"]);
            require_can_schedule(service, &environments, stored_steps(&detail)).await?;
        }
        ok(rpa_bridge::call("duplicate", json!({ "taskUuid": input.task_uuid })).await?)
    }
}

impl AsyncTool<McpServer> for DeleteTask {
    async fn invoke(service: &McpServer, input: TaskInput) -> Result<ReadOutput, McpToolError> {
        service.require_manage().await?;
        ok(rpa_bridge::call("delete", json!({ "taskUuid": input.task_uuid })).await?)
    }
}

impl AsyncTool<McpServer> for RunTask {
    async fn invoke(service: &McpServer, input: RunTaskInput) -> Result<ReadOutput, McpToolError> {
        service.require_manage().await?;
        service.require_act().await?;
        let detail = service
            .bridge()
            .dispatch_value("rpa/tasks/detail", json!({ "uuid": input.task_uuid }))
            .await?;
        for env in detail["environment_uuids"].as_array().into_iter().flatten() {
            service.require_environment(env.as_str().unwrap_or_default()).await?;
        }
        enforce(service, &inspect(stored_steps(&detail)))?;
        ok(rpa_bridge::call(
            "run",
            json!({ "taskUuid": input.task_uuid, "variables": input.variables }),
        )
        .await?)
    }
}

impl AsyncTool<McpServer> for StopTask {
    async fn invoke(service: &McpServer, input: TaskInput) -> Result<ReadOutput, McpToolError> {
        service.require_manage().await?;
        ok(rpa_bridge::call("stop", json!({ "taskUuid": input.task_uuid })).await?)
    }
}

impl AsyncTool<McpServer> for GetExecution {
    async fn invoke(service: &McpServer, input: TaskInput) -> Result<ReadOutput, McpToolError> {
        service.require_manage().await?;
        let mut execution = rpa_bridge::call("execution", json!({ "taskUuid": input.task_uuid })).await?;
        for env in execution["environments"].as_array_mut().into_iter().flatten() {
            if !can_read_pages(service, env["envUuid"].as_str()) {
                env["log"] = json!([]);
            } else if !service.config().access.full_page_access_enabled {
                hide_sensitive_entries(&mut env["log"]);
            }
        }
        ok(execution)
    }
}

impl AsyncTool<McpServer> for ListRuns {
    async fn invoke(service: &McpServer, input: ListRunsInput) -> Result<ReadOutput, McpToolError> {
        service.require_manage().await?;
        let mut runs = service
            .bridge()
            .dispatch_value(
                "rpa/runs/list",
                json!({
                    "task_uuid": input.task_uuid,
                    "status": input.status,
                    "page": input.page.unwrap_or(1).max(1),
                    "page_size": input.page_size.unwrap_or(20).clamp(1, 100),
                }),
            )
            .await?;
        for run in runs["items"].as_array_mut().into_iter().flatten() {
            guard_run(service, run);
        }
        ok(runs)
    }
}

impl AsyncTool<McpServer> for GetRun {
    async fn invoke(service: &McpServer, input: RunInput) -> Result<ReadOutput, McpToolError> {
        service.require_manage().await?;
        let mut run = service
            .bridge()
            .dispatch_value("rpa/runs/detail", json!({ "uuid": input.run_uuid }))
            .await?;
        guard_run(service, &mut run);
        ok(run)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn policy(steps: Value) -> StepPolicy {
        inspect(steps.as_array().unwrap().iter().cloned())
    }

    #[test]
    fn plain_browser_steps_need_nothing_extra() {
        let result = policy(json!([
            { "type": "navigate", "config": { "url": "https://{{host}}/a" } },
            { "type": "click", "config": { "selector": "#a" } },
        ]));
        assert!(!result.needs_full_access && !result.local_script && !result.unsafe_url);
    }

    #[test]
    fn scripts_and_uploads_are_found_inside_branches() {
        let nested = json!([{ "type": "loop", "body": [
            { "type": "condition", "then": [{ "type": "script", "config": {} }] }
        ] }]);
        assert!(policy(nested).needs_full_access);
        assert!(policy(json!([{ "type": "upload", "config": {} }])).needs_full_access);
    }

    #[test]
    fn local_scripts_and_non_web_urls_are_flagged() {
        assert!(policy(json!([{ "type": "script", "config": { "executionMode": "local" } }])).local_script);
        for url in ["javascript:alert(1)", "file:///c:/a", "{{url}}", "chrome://settings"] {
            assert!(policy(json!([{ "type": "navigate", "config": { "url": url } }])).unsafe_url, "{url}");
        }
    }

    #[test]
    fn stored_rows_are_checked_the_same_way() {
        let detail = json!({ "steps": [
            { "step_type": "goto", "config": { "workflow_step": { "type": "goto", "url": "file:///x", "config": {} } } },
            { "step_type": "execute_js", "config": { "workflow_step": { "type": "execute_js", "config": { "executionMode": "local" } } } },
        ] });
        let result = inspect(stored_steps(&detail));
        assert!(result.unsafe_url && result.local_script && result.needs_full_access);
    }

    #[test]
    fn a_non_string_type_or_url_is_refused() {
        assert!(policy(json!([{ "type": ["script"], "config": { "script": "x" } }])).malformed);
        assert!(policy(json!([{ "type": "loop", "body": [{ "type": 1 }] }])).malformed);
        assert!(policy(json!([{ "type": "navigate", "config": { "url": ["file:///x"] } }])).malformed);
    }

    #[test]
    fn field_reading_extracts_need_full_access() {
        for kind in ["value", "html", "attribute"] {
            let step = json!([{ "type": "extract", "config": { "extractType": kind } }]);
            assert!(policy(step).needs_full_access, "{kind}");
        }
        for kind in [json!("text"), json!("href"), Value::Null] {
            let step = json!([{ "type": "extract", "config": { "extractType": kind } }]);
            assert!(!policy(step).needs_full_access);
        }
        let stored = json!([{ "type": "extract_text", "config": { "extractType": "value" } }]);
        assert!(policy(stored).needs_full_access);
    }

    #[test]
    fn secrets_are_hidden_and_cannot_be_written_back() {
        let mut task = json!({
            "settings": { "globalVariables": [{ "name": "pw", "value": "secret" }] },
            "steps": [{ "type": "loop", "config": {}, "body": [
                { "type": "input", "config": { "selector": "#a", "text": "secret" } }
            ] }],
        });
        hide_task_secrets(&mut task);
        assert_eq!(task["settings"]["globalVariables"][0]["value"], HIDDEN_VALUE);
        assert_eq!(task["steps"][0]["body"][0]["config"]["text"], HIDDEN_VALUE);
        assert_eq!(task["steps"][0]["body"][0]["config"]["selector"], "#a");
        assert!(contains_hidden(&task["steps"]));
        assert!(!contains_hidden(&json!([{ "config": { "text": "plain" } }])));
    }

    #[test]
    fn stored_variables_cannot_be_referenced_without_full_access() {
        let task = json!({ "settings": { "globalVariables": [
            { "name": "pw", "value": "secret" },
            { "name": "empty", "value": "" },
        ] } });
        let step = |url: &str| vec![json!({ "type": "navigate", "config": { "url": url } })];
        for leaking in ["https://x/?v={{pw}}", "https://x/{{ pw }}", "https://x/{{pw.length}}", "{{pw[0]}}"] {
            assert!(reject_secret_references(&task, &step(leaking)).is_err(), "{leaking}");
        }
        for fine in ["https://x/", "https://x/{{empty}}", "https://x/{{result}}", "https://x/{{pwd}}"] {
            assert!(reject_secret_references(&task, &step(fine)).is_ok(), "{fine}");
        }
        let nested = vec![json!({ "type": "loop", "body": [{ "type": "input", "config": { "text": "{{pw}}" } }] })];
        assert!(reject_secret_references(&task, &nested).is_err());
    }

    #[test]
    fn only_entries_marked_safe_keep_their_values() {
        let mut entries = json!([
            { "value": "visible", "sensitive": false },
            { "value": "field", "sensitive": true },
            { "value": "old record" },
            { "name": "no output" },
        ]);
        hide_sensitive_entries(&mut entries);
        assert_eq!(entries[0]["value"], "visible");
        assert_eq!(entries[1]["value"], HIDDEN_VALUE);
        assert_eq!(entries[2]["value"], HIDDEN_VALUE);
        assert!(entries[3].get("value").is_none());

        let mut run = json!({ "result_summary": r#"{"extracted":[{"value":"pw","sensitive":true}]}"# });
        hide_sensitive_summary(&mut run);
        assert!(!run["result_summary"].as_str().unwrap().contains("\"pw\""));
        let mut broken = json!({ "result_summary": "not json" });
        hide_sensitive_summary(&mut broken);
        assert!(broken["result_summary"].is_null());
    }

    #[test]
    fn settings_shapes_are_checked() {
        assert!(check_settings(&json!({ "triggerType": "scheduled", "selectedEnvironments": ["a"] })).is_ok());
        assert!(check_settings(&Value::Null).is_ok());
        assert!(check_settings(&json!({ "triggerType": ["scheduled"] })).is_err());
        assert!(check_settings(&json!({ "selectedEnvironments": [1] })).is_err());
    }

    #[test]
    fn every_tool_is_registered_once() {
        assert_eq!(routes().len(), 12);
    }
}
