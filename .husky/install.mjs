// Installs the Git hooks on `npm install` (#101). CI and Vercel set these
// variables, and neither commits, so the hooks are skipped there.
if (process.env.CI || process.env.VERCEL) {
  process.exit(0);
}

const { default: husky } = await import("husky");
const message = husky();
if (message) {
  console.log(message);
}
