const now = new Date().toISOString();
const fakeToken = "demo-token-not-a-real-secret";

console.error(`[${now}] Error: parser rejected an empty expression`);
console.error(`at parseExpression (${process.cwd()}/src/parser.js:42:7)`);
console.error(`token=${fakeToken}`);
process.exitCode = 1;
