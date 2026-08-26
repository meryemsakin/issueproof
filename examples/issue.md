# Parser accepts an incomplete assignment until evaluation

## Observed behavior

Running the parser test fails with `Error: parser rejected an empty expression` in `src/parser.js:42`.

## Expected behavior

The parser should return a structured syntax error before evaluation.

## Steps to reproduce

1. Start from a clean checkout.
2. Run `node examples/stable-failure.js`.
3. Observe exit code 1 and the parser error.

## Environment and frequency

Observed on Node.js 20+ on macOS and Linux. It happens every time (3/3 attempts).

## Possible repair direction

The root cause may be a missing empty-right-hand-side guard in the `parseExpression` function. This is a hypothesis, not a confirmed diagnosis.
