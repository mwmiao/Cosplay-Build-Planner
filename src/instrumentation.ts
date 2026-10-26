// Runs once when the server starts (Next.js instrumentation hook). The import
// sits inside the runtime check so it's only bundled for the Node.js server.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startJobs } = await import("./lib/jobs");
    startJobs();
  }
}
