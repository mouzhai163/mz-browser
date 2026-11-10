//! Client Hints 里的 Chrome 完整版本号。
//!
//! UA 字符串只写 `主版本.0.0.0`（和真 Chrome 一样，所有用户相同），完整版本只在 Client Hints
//! （fullVersionList、uaFullVersion、Sec-CH-UA-Full-Version-List）里出现，真实用户之间的差别也在这里。
//! 版本号 `156.0.8078.96`：主版本跟内核走，次版本永远是 0，构建号每个主版本固定，只有最后的补丁号
//! 在真实用户之间不同。所以这里只从 Google 真实发布过的 Windows 版本里挑
//! （resources/chrome-windows-releases.json，由 cr-tools/make-chrome-releases.py 从 chromiumdash 生成）。
//!
//! 环境创建时挑一个写进 `window_info.uaFullVersion`，之后每次启动都用它；只有换成别的主版本的内核时
//! 才重新挑。编出来的号码（次版本非 0、构建号不对）能和发布记录比对出来，所以从不使用。

use std::collections::HashMap;
use std::sync::OnceLock;

use serde::Deserialize;
use serde_json::{Map, Value};

/// window_info 里保存完整版本号的字段
pub const FULL_VERSION_KEY: &str = "uaFullVersion";

const RELEASES_JSON: &str = include_str!("../../resources/chrome-windows-releases.json");

/// 最新的几个版本的权重（从新到旧），更旧的不再选；和真实用户的升级分布一致
const WEIGHTS: [u64; 6] = [6, 5, 4, 3, 2, 1];

#[derive(Deserialize)]
struct ReleaseList {
    releases: HashMap<String, Vec<String>>,
}

fn releases() -> &'static HashMap<u32, Vec<String>> {
    static RELEASES: OnceLock<HashMap<u32, Vec<String>>> = OnceLock::new();
    RELEASES.get_or_init(|| {
        let list: ReleaseList =
            serde_json::from_str(RELEASES_JSON).expect("chrome-windows-releases.json is valid");
        list.releases
            .into_iter()
            .filter_map(|(major, versions)| Some((major.parse().ok()?, versions)))
            .collect()
    })
}

/// 版本号里的主版本，例如 "156.0.8078.96" -> 156
pub fn major_of(version: &str) -> Option<u32> {
    version.split('.').next()?.trim().parse().ok()
}

/// 是不是一个完整的发布版本号（主版本.0.构建号.补丁号，构建号不为 0）且属于这个主版本
pub fn is_full_release_of(version: &str, major: u32) -> bool {
    let parts: Vec<&str> = version.split('.').collect();
    parts.len() == 4
        && parts.iter().all(|part| !part.is_empty() && part.bytes().all(|b| b.is_ascii_digit()))
        && parts[0].parse::<u32>().ok() == Some(major)
        && parts[1] == "0"
        && parts[2] != "0"
}

/// 按 ticket 从这个主版本最新的几个真实版本里挑一个；清单里没有这个主版本时返回 None
pub fn pick_with_ticket(major: u32, ticket: u64) -> Option<String> {
    let versions = releases().get(&major)?;
    let candidates = versions.len().min(WEIGHTS.len());
    if candidates == 0 {
        return None;
    }
    let total: u64 = WEIGHTS[..candidates].iter().sum();
    let mut ticket = ticket % total;
    for (index, weight) in WEIGHTS[..candidates].iter().enumerate() {
        if ticket < *weight {
            return Some(versions[index].clone());
        }
        ticket -= weight;
    }
    None
}

/// 新环境用：随机挑一个
pub fn pick_random(major: u32) -> Option<String> {
    pick_with_ticket(major, uuid::Uuid::new_v4().as_u128() as u64)
}

/// 确保 window_info 里有一个属于这个主版本的完整版本号：已有且主版本一致就保留（环境的版本不变），
/// 没有或主版本对不上（换了内核）就重新挑。返回是否改动。
pub fn ensure_full_version(window_info: &mut Map<String, Value>, major: u32) -> bool {
    let current = window_info.get(FULL_VERSION_KEY).and_then(Value::as_str);
    if current.is_some_and(|version| is_full_release_of(version, major)) {
        return false;
    }
    match pick_random(major) {
        Some(version) => {
            window_info.insert(FULL_VERSION_KEY.to_string(), Value::String(version));
            true
        }
        None => window_info.remove(FULL_VERSION_KEY).is_some(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_listed_version_is_a_full_release_of_its_major() {
        for (major, versions) in releases() {
            assert!(!versions.is_empty());
            for version in versions {
                assert!(is_full_release_of(version, *major), "{version}");
            }
        }
    }

    #[test]
    fn the_shipped_kernel_majors_are_covered() {
        for major in [155, 156, 157] {
            assert!(releases().contains_key(&major), "no real releases listed for {major}");
        }
    }

    #[test]
    fn reduced_or_invented_versions_are_not_full_releases() {
        assert!(is_full_release_of("156.0.8078.96", 156));
        assert!(!is_full_release_of("156.0.0.0", 156));
        assert!(!is_full_release_of("156.8.5.2", 156));
        assert!(!is_full_release_of("157.0.8103.51", 156));
        assert!(!is_full_release_of("156.0.8078", 156));
    }

    #[test]
    fn a_stored_version_is_kept_and_a_kernel_change_picks_again() {
        let mut info = Map::new();
        assert!(ensure_full_version(&mut info, 156));
        let first = info[FULL_VERSION_KEY].as_str().unwrap().to_string();
        assert!(first.starts_with("156.0.8078."));
        for _ in 0..20 {
            assert!(!ensure_full_version(&mut info, 156), "the version must never change by itself");
        }
        assert_eq!(info[FULL_VERSION_KEY], first.as_str());

        assert!(ensure_full_version(&mut info, 157));
        assert!(info[FULL_VERSION_KEY].as_str().unwrap().starts_with("157.0.8103."));

        assert!(ensure_full_version(&mut info, 999), "an unknown major drops the stale version");
        assert!(!info.contains_key(FULL_VERSION_KEY));
    }

    #[test]
    fn picks_spread_over_the_newest_releases_with_the_newest_most_common() {
        let mut counts: HashMap<String, usize> = HashMap::new();
        for ticket in 0..6000u64 {
            *counts.entry(pick_with_ticket(156, ticket.wrapping_mul(0x9E37_79B9_7F4A_7C15)).unwrap()).or_default() += 1;
        }
        let newest = &releases()[&156];
        assert_eq!(counts.len(), WEIGHTS.len().min(newest.len()));
        let share = |i: usize| counts.get(&newest[i]).copied().unwrap_or(0);
        assert!(share(0) > share(2) && share(2) > share(5), "{counts:?}");
    }
}
