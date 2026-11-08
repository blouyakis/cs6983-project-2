// Installs the Git hooks on `npm install` (#101). CI and Vercel set these
// variables, and neither commits, so the hooks are skipped there. The line it
// prints shows in their install logs that the skip happened.
if (process.env.CI || process.env.VERCEL) {
  console.log("husky: skipped, CI or VERCEL is set");
  process.exit(0);
}

const { default: husky } = await import("husky");
const message = husky();
if (message) {
  console.log(message);
}
