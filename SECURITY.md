# Security Policy

## Supported Versions

We actively support the following versions of CC Linter with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | ✅ Yes            |
| < 1.0   | ❌ No             |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please follow these steps:

### 🔒 Private Disclosure

**DO NOT** create a public GitHub issue for security vulnerabilities. Instead, please:

1. **Email us directly**: Send details to felix@felixgeelhaar.de
2. **Use GitHub Security Advisories**: Create a private security advisory on our GitHub repository
3. **Include the following information**:
   - Description of the vulnerability
   - Steps to reproduce the issue
   - Potential impact assessment
   - Suggested fix (if any)

### 📧 What to Include

Please include as much of the following information as possible:

- **Vulnerability Type**: (e.g., Code Injection, Path Traversal, etc.)
- **Affected Component**: Which part of CC Linter is affected
- **Attack Vector**: How the vulnerability can be exploited
- **Impact**: What an attacker could achieve
- **Proof of Concept**: Steps or code to reproduce the issue
- **Environment**: Operating system, Node.js version, CC Linter version

### 🔄 Response Process

1. **Acknowledgment**: We'll acknowledge receipt within 24 hours
2. **Initial Assessment**: We'll provide an initial assessment within 72 hours
3. **Investigation**: We'll investigate and develop a fix
4. **Coordination**: We'll work with you on disclosure timing
5. **Release**: We'll release a security update and publish an advisory

### 📋 Security Update Process

When we release security updates:

1. **Patch Release**: Security fixes are released as patch versions
2. **Security Advisory**: We publish a GitHub Security Advisory
3. **Release Notes**: Security fixes are clearly marked in release notes
4. **User Notification**: We notify users through multiple channels

## 🛡️ Security Best Practices

### For Users

- **Keep Updated**: Always use the latest version of CC Linter
- **Review Dependencies**: Regularly audit your npm dependencies
- **Limit Permissions**: Run CC Linter with minimal required permissions
- **Validate Input**: Be cautious when linting untrusted files

### For Contributors

- **Security Review**: All PRs undergo security review
- **Dependency Scanning**: We scan dependencies for vulnerabilities
- **Code Analysis**: We use static analysis tools to catch security issues
- **Input Validation**: Always validate and sanitize user inputs

## 🔍 Known Security Considerations

### File System Access

CC Linter reads files from the file system. Consider these security implications:

- **Path Traversal**: We validate file paths to prevent directory traversal attacks
- **File Permissions**: CC Linter respects file system permissions
- **Symlink Handling**: We handle symbolic links safely

### Regular Expressions

CC Linter uses regular expressions for pattern matching:

- **ReDoS Protection**: We avoid complex regex patterns that could cause ReDoS
- **Input Limits**: We limit input size to prevent resource exhaustion
- **Safe Patterns**: All regex patterns are reviewed for security implications

### Command Line Interface

The CLI processes command-line arguments:

- **Argument Validation**: All CLI arguments are validated
- **Shell Injection**: We prevent shell injection attacks
- **Output Sanitization**: Output is sanitized to prevent terminal injection

## 📞 Contact Information

- **Security Email**: felix@felixgeelhaar.de
- **General Issues**: https://github.com/cc-linter/cc-linter/issues
- **GitHub Security**: https://github.com/cc-linter/cc-linter/security

## 🏆 Recognition

We believe in recognizing security researchers who help improve our security:

- **Hall of Fame**: Security researchers will be credited in our security hall of fame
- **Acknowledgment**: With your permission, we'll acknowledge your contribution
- **Responsible Disclosure**: We support responsible disclosure practices

## 📚 Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [npm Security Best Practices](https://docs.npmjs.com/security)

---

Thank you for helping keep CC Linter and our community safe! 🔒