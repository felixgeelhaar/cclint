# CLAUDE.md

## Project Overview

This is a test project for demonstrating CC Linter's code block validation capabilities.

## Development Commands

```bash
npm install
npm test
npm run build
```

## Architecture

The project uses TypeScript and follows best practices.

## Code Examples

### JavaScript Example

```javascript
var x = 5;  // Should use const or let
if (x == 5) {  // Should use ===
  console.log('equal');
}

async function getData() {
  const response = await fetch('/api');
  return response.json();  // Missing error handling
}
```

### Python Example

```python
def process_data(input):  # Missing type hints
    try:
        result = calculate(input)
    except:  # Bare except clause
        pass
    return result
```

### Go Example

```go
package main

func readFile() {
    data, err := ioutil.ReadFile("config.json")
    // Missing error check!
    fmt.Println(string(data))
}
```

### SQL Example (Anti-pattern)

This is a bad example - don't do this:

```sql
SELECT * FROM users WHERE id = ${userId};  -- SQL injection vulnerability
```

### Bash Script

```bash
FILE=$1
echo $FILE  # Should quote variable
rm -rf /tmp/*  # Dangerous!
```

### JSON Configuration

```json
{
  "name": "test",
  "value": 123,  // Invalid - trailing comma
}
```

### YAML Configuration

```yaml
server:
	host: localhost  # Uses tabs instead of spaces
  port: 3000
```

## TypeScript Best Practices

```typescript
const app = express();  // Missing import statement
app.use(cors());

interface User {
  id: number;
  name: string;
}

const getUser = async (id: number): Promise<User> => {
  const response = await fetch(`/api/users/${id}`);
  return response.json();  // Should handle errors
};
```

## Complete Example

```javascript
// A complete example with imports
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```