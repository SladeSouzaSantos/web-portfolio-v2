export default {
  extends: ['@commitlint/config-conventional'],
  // Ignore only integration commits generated with the "Merge PR #N" title.
  // The individual feature/fix commits remain subject to Conventional Commits.
  ignores: [(message) => /^Merge PR #\d+:\s/.test(message)],
};
