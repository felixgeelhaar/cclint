# Custom Rules Example

This directory demonstrates how to create and use custom rules with cclint.

## Files

- `no-swearing-plugin.js` - Example plugin with two custom rules
- `.cclintrc.json` - Configuration file that loads the plugin
- `CLAUDE.md` - Sample file with issues that trigger custom rules

## Custom Rules Included

### 1. No Swearing Rule (`no-swearing`)
- **Purpose**: Detects inappropriate language
- **Severity**: Warning
- **Auto-fix**: Suggests better alternatives

### 2. Link Checker Rule (`check-links`)  
- **Purpose**: Ensures HTTP links use HTTPS
- **Severity**: Error
- **Auto-fix**: Replaces HTTP with HTTPS

## Usage

```bash
# Run linting with custom rules
cclint lint CLAUDE.md -c .cclintrc.json

# Run with auto-fix
cclint lint CLAUDE.md -c .cclintrc.json --fix
```

## Expected Output

Without `--fix`:
```
📦 Loaded 1 plugin(s): example-content-rules
📝 Linting results for CLAUDE.md:

⚠️ warning: Inappropriate language detected: "damn" at 3:17 [no-swearing]
❌ error: Insecure HTTP link detected: http://example.com at 4:23 [check-links]  
⚠️ warning: Inappropriate language detected: "crap" at 13:5 [no-swearing]
❌ error: Insecure HTTP link detected: http://insecure-site.com at 13:67 [check-links]

Summary: 2 errors, 2 warnings
```

With `--fix`:
- "damn" → "darn"  
- "crap" → "stuff"
- "http://example.com" → "https://example.com"
- "http://insecure-site.com" → "https://insecure-site.com"

## Creating Your Own Custom Rules

1. **Extend CustomRule class**
2. **Implement validateInternal method** 
3. **Implement generateFixes method**
4. **Export plugin object with rules array**
5. **Configure in .cclintrc.json**

See `no-swearing-plugin.js` for implementation details.