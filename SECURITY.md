# Security policy

IssueProof processes logs that may contain credentials or private paths. Treat every generated receipt as sensitive until a human has inspected it.

Please do not open a public issue for a suspected secret-redaction bypass. Send a private report through the repository's GitHub Security Advisory page once the public repository is configured.

Version 0.1 does not upload data or read environment-variable values into reports. Redaction is defense in depth and cannot recognize every application-specific secret format.
