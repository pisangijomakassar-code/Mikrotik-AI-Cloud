# librouteros v4 API Reference

Reference for writing MCP tools in `mikrotik_mcp/server.py`. All code MUST follow these patterns.

## Connection

```python
import librouteros
from librouteros.query import Key, Or

# Plaintext (port 8728)
api = librouteros.connect(host='192.168.88.1', port=8728, username='admin', password='pass', timeout=15)

# Context manager (our pattern in server.py)
with connect_router(host, port, username, password) as api:
    ...
```

## Path Creation

```python
# v4 style — separate string arguments (preferred)
api.path('ip', 'hotspot', 'user')
api.path('ip', 'firewall', 'nat')
api.path('ip', 'hotspot', 'user', 'profile')

# Slash-separated also works but is legacy v3 style
api.path('/ip/hotspot/user')  # functional but not idiomatic v4

# Traverse deeper from existing path
interfaces = api.path('interface')
ethernet = interfaces.join('ethernet')
```

## Read: Iterate / List All

```python
resource = api.path('ip', 'hotspot', 'user')

# Iterate
for item in resource:
    print(item['name'])

# Get all as list
all_items = list(resource)

# List comprehension
names = [item['name'] for item in resource]
```

## Field Selection: `select()`

`select()` controls WHICH FIELDS are returned — like SQL `SELECT column1, column2`.

```python
name = Key('name')
profile = Key('profile')

# Only return name and profile fields
for row in resource.select(name, profile):
    print(row)  # {'name': 'budi', 'profile': 'Free-partner'}

# select() without args = all fields
for row in resource.select():
    print(row)  # returns all fields
```

> **CRITICAL**: `select()` is NOT a filter. It selects columns, not rows.

## Filtering: `where()`

`where()` filters WHICH ROWS are returned — like SQL `WHERE condition`.

```python
name = Key('name')
disabled = Key('disabled')

# Filter by exact match
users = list(resource.select(name).where(name == 'budi'))
# -> [{'name': 'budi'}]

# Filter all fields
users = list(resource.select().where(name == 'budi'))
# -> [{'name': 'budi', '.id': '*992', 'profile': 'Free-partner', ...}]

# Multiple conditions (AND by default)
result = list(resource.select().where(disabled == 'false', name == 'budi'))

# OR conditions
result = list(resource.select(name).where(Or(name == 'ether1', name == 'ether2')))
```

### Comparison Operators

| Operator | Example                  | Description    |
|----------|--------------------------|----------------|
| `==`     | `Key('name') == 'budi'`  | Equals         |
| `!=`     | `Key('name') != 'admin'` | Not equals     |
| `>`      | `Key('mtu') > '1500'`    | Greater than   |
| `<`      | `Key('mtu') < '1400'`    | Less than      |
| `.In()`  | `Key('name').In('a','b')`| In set         |

### Logical Operators

| Operator | Usage                                          |
|----------|-------------------------------------------------|
| `And`    | Default when multiple conditions in `where()`   |
| `Or`     | `Or(condition1, condition2)` — explicit OR       |

## CRUD Operations

### Add (Create)

```python
resource = api.path('ip', 'hotspot', 'user')

# Returns the new .id string
new_id = resource.add(name='budi', password='pass123', profile='Free-partner')
# new_id = '*994'
```

### Update

```python
# Must include .id
resource.update(**{'.id': '*994', 'comment': 'updated'})

# Or with variables
resource.update(**{'.id': user['.id'], 'disabled': 'true'})
```

### Remove (Delete)

```python
# Pass .id as argument
resource.remove('*994')

# Multiple at once
resource.remove('*1', '*2', '*3')
```

> **Note**: `.id` values can change on router reboot. Always read current IDs before operating.

## Common MCP Patterns

### Find and operate on a single user

```python
name_key = Key('name')
resource = api.path('ip', 'hotspot', 'user')

# Find user — returns all fields for .id access
users = list(resource.select().where(name_key == username))
if not users:
    return {"error": f"User '{username}' not found."}

# Remove
resource.remove(users[0]['.id'])

# Update
resource.update(**{'.id': users[0]['.id'], 'disabled': 'true'})
```

### Bulk operations (fetch all once, look up by name)

```python
name_key = Key('name')
resource = api.path('ip', 'hotspot', 'user')

# Build lookup dict — one API call for all users
all_users = {u['name']: u for u in resource.select(Key('name'), Key('.id'))}

for uname in name_list:
    user = all_users.get(uname)
    if not user:
        errors.append(f"{uname}: not found")
        continue
    resource.remove(user['.id'])
```

### Find by profile (filter on different field)

```python
profile_key = Key('profile')
users_in_profile = list(resource.select().where(profile_key == 'Free-partner'))
```

## v3 to v4 Migration — Breaking Changes

### select() is NO LONGER a filter

```python
# v3 (WRONG in v4) — passing condition to select
users = list(resource.select(Key('name') == 'budi'))     # RETURNS EMPTY!

# v4 (CORRECT) — select fields, where filters
users = list(resource.select().where(Key('name') == 'budi'))  # WORKS
```

This was the root cause of the "user not found" bug that broke all hotspot user operations (remove, enable, disable, update).

### Path creation syntax

```python
# v3 style (still works but legacy)
api.path('/ip/hotspot/user')

# v4 style (preferred)
api.path('ip', 'hotspot', 'user')
```

### Key import location

```python
# v4
from librouteros.query import Key, Or, And
```

## Error Handling

```python
from librouteros.exceptions import TrapError

try:
    resource.add(name='existing_user', password='test')
except TrapError as e:
    # RouterOS returned an error (e.g., "already have user with same name")
    return {"error": str(e)}
except Exception as e:
    # Connection/transport error
    return {"error": f"Failed: {e}"}
```

## RouterOS Value Types

All values from the API are **strings**, even booleans and numbers:
- Boolean: `'true'` / `'false'` (not Python `True`/`False`)
- Numbers: `'1500'` (not `1500`)
- Compare with string values in `where()` conditions
