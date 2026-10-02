// Entry point. node:sqlite prints an "experimental" warning on Node 22; hide only that one.
process.removeAllListeners("warning");
process.on("warning", (w) => {
  if (w.name !== "ExperimentalWarning") console.warn(w);
});

const { start } = await import("./server");
await start();

export {};
