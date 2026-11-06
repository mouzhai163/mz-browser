/** A development workspace must not replace itself with an upstream release. */
export function appUpdatesAllowed(development: boolean, disabledFlag?: string): boolean {
  return !development && disabledFlag?.trim().toLowerCase() !== 'true';
}
