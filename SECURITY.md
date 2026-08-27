# Security policy

IssueProof processes logs that may contain credentials or private paths. Treat every generated receipt as sensitive until a human has inspected it.

Please do not open a public issue for a suspected secret-redaction bypass. Send a private report through the repository's GitHub Security Advisory page once the public repository is configured.

Version 0.2 performs no upload and does not persist environment-variable values. It records a small runtime/operating-system inventory and redacts collected command output before persistence. Redaction is defense in depth and cannot recognize every application-specific secret format.
