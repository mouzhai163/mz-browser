/**
 * 根据分组名称获取颜色
 */
export function getGroupColor(groupName: string): string {
  if (groupName.includes('广告')) return 'green';
  if (groupName.includes('账号')) return 'orange';
  if (groupName.includes('社交') || groupName.includes('社媒')) return 'green';
  return '';
}
