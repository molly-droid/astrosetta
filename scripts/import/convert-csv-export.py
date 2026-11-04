"""Base44 dashboard CSV export -> import-base44.mjs JSON input.

Usage: python3 -I convert.py <export_dir> <users_csv> <schema_dir> <out_dir>

- Types every column from base44/entities/<Entity>.jsonc (CSV flattens
  numbers, booleans, objects and arrays to text).
- Rebuilds User.json with Base44 ids: the users CSV has no id column, so each
  user's LIVE id is the ObjectId (from created_by_id in their own records)
  whose embedded timestamp matches the user's created_date.
- Drops records owned by DELETED accounts (owner id that is a Base44 user id
  but not any live user's id): those people deleted their accounts.
"""
import csv, json, os, re, sys, collections, hashlib, datetime as dt

csv.field_size_limit(sys.maxsize)
export_dir, users_csv, schema_dir, out_dir = sys.argv[1:5]
os.makedirs(out_dir, exist_ok=True)

SYSTEM = {'id', 'created_date', 'updated_date', 'created_by', 'created_by_id', 'is_sample'}
OID = re.compile(r'^[0-9a-f]{24}$')


def load_schema(entity):
    p = os.path.join(schema_dir, f'{entity}.jsonc')
    if not os.path.exists(p):
        return {}
    txt = re.sub(r'^\s*//.*$', '', open(p).read(), flags=re.M)
    return json.loads(txt).get('properties', {})


def coerce(val, spec, problems, where):
    if val is None or val == '':
        return None
    t = (spec or {}).get('type')
    if isinstance(t, list):
        t = next((x for x in t if x != 'null'), None)
    try:
        if t in ('object', 'array'):
            return json.loads(val)
        if t == 'boolean':
            low = val.strip().lower()
            if low in ('true', '1', 'yes'): return True
            if low in ('false', '0', 'no'): return False
            raise ValueError(val)
        if t == 'integer':
            f = float(val)
            return int(f) if f == int(f) else f
        if t == 'number':
            return float(val)
    except (ValueError, json.JSONDecodeError) as e:
        problems[where] += 1
        return val
    return val


def read_csv(path):
    if os.path.getsize(path) == 0:
        return []
    return list(csv.DictReader(open(path, newline='', encoding='utf-8-sig')))


# ---- users: live ids via ObjectId timestamp --------------------------------
users = {r['email'].strip().lower(): r for r in read_csv(users_csv)}
cands = collections.defaultdict(set)
tables = {}
for f in sorted(os.listdir(export_dir)):
    if not f.endswith('_export.csv'):
        continue
    ent = f[:-len('_export.csv')]
    rows = read_csv(os.path.join(export_dir, f))
    tables[ent] = rows
    for r in rows:
        e = (r.get('created_by') or '').strip().lower()
        cid = (r.get('created_by_id') or '').strip()
        if e in users and OID.match(cid):
            cands[e].add(cid)

oid_time = lambda i: dt.datetime.fromtimestamp(int(i[:8], 16), dt.timezone.utc)
live = {}  # email -> live base44 id
for e, ids in cands.items():
    created = dt.datetime.fromisoformat(users[e]['created_date'].replace('Z', '+00:00'))
    best = min(ids, key=lambda i: abs((oid_time(i) - created).total_seconds()))
    if abs((oid_time(best) - created).total_seconds()) <= 5:
        live[e] = best
live_ids = set(live.values())

problems = collections.Counter()
user_schema = load_schema('User')
user_out = []
for e, r in users.items():
    rec = {'id': live.get(e) or 'nodata-' + hashlib.sha1(e.encode()).hexdigest()[:16], 'email': r['email'].strip()}
    for k, v in r.items():
        if k in ('email', 'status'):
            continue
        rec[k] = v if k in SYSTEM else coerce(v, user_schema.get(k), problems, f'User.{k}')
        if rec[k] is None:
            del rec[k]
    user_out.append(rec)
json.dump(user_out, open(os.path.join(out_dir, 'User.json'), 'w'))

# ---- entities --------------------------------------------------------------
report = []
dropped_by_table = collections.Counter()
for ent, rows in tables.items():
    schema = load_schema(ent)
    out = []
    for r in rows:
        owner = (r.get('user_id') or '').strip() or (r.get('created_by_id') or '').strip()
        if OID.match(owner) and owner not in live_ids:
            dropped_by_table[ent] += 1
            continue
        rec = {}
        for k, v in r.items():
            if k is None:
                continue
            if k in SYSTEM:
                if v not in (None, ''):
                    rec[k] = v
                continue
            c = coerce(v, schema.get(k), problems, f'{ent}.{k}')
            if c is not None:
                rec[k] = c
        out.append(rec)
    json.dump(out, open(os.path.join(out_dir, f'{ent}.json'), 'w'))
    report.append((ent, len(rows), len(out)))

print(f'users: {len(user_out)} ({len(live)} with a resolved live id, {len(user_out) - len(live)} with no records)')
print(f"{'entity':28} {'csv rows':>9} {'kept':>7} {'dropped (deleted accts)':>24}")
for ent, total, kept in sorted(report):
    print(f'{ent:28} {total:9} {kept:7} {dropped_by_table[ent]:24}')
print('type-coercion problems:', dict(problems) or 'none')
