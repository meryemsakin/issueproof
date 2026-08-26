const timestamp = new Date().toISOString();

console.error(`[${timestamp}] Error: checkout total mismatch`);
console.error(`pid=${process.pid}`);
process.exitCode = 1;
