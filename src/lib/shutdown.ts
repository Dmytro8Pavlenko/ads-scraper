export function installShutdown(): { stopping: () => boolean } {
  let stop = false;
  const halt = () => {
    stop = true;
  };
  process.on("SIGINT", halt);
  process.on("SIGTERM", halt);
  return { stopping: () => stop };
}
