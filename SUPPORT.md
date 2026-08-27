# Support

IssueProof is a public alpha maintained on a best-effort basis. There is no guaranteed response or resolution time.

## Usage questions and bug reports

Search the [existing issues](https://github.com/meryemsakin/issueproof/issues) first. If the problem is new, open a GitHub issue with:

- the IssueProof version and installation method;
- operating system, architecture, and runtime version;
- the exact argv-style command or a minimal `.issueproof.json`;
- the observed and expected verdict;
- a minimal repository or inspected receipt when it is safe to share; and
- whether the behavior reproduces with the latest published version.

Remove credentials, private source, customer data, and identifying paths before posting. A receipt's built-in redaction is defense in depth, not approval to publish it unchanged.

## Security reports

Do not file a public issue for a suspected secret-redaction bypass, command-injection path, or unsafe cleanup behavior. Follow [SECURITY.md](SECURITY.md) and use a private GitHub Security Advisory.

## Current product limits

IssueProof verifies repeatability for an exact command and environment. It does not establish root cause, prove a repair, reproduce GUI or production-only incidents, isolate external services and global caches, or cryptographically prove receipt authorship. The detailed boundary is maintained in the [README](README.md#current-scope) and [architecture notes](docs/architecture.md).
