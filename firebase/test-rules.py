"""Attack the real database rules with throwaway accounts, then clean everything up."""
import json, subprocess, sys, urllib.request, urllib.error, secrets

KEY = sys.argv[1]
DB = 'https://x300-506418-default-rtdb.firebaseio.com'
REF = {'Referer': 'http://localhost:8123/'}
ADMIN_TOKEN = subprocess.check_output(['gcloud', 'auth', 'print-access-token']).decode().strip()
TS = {'.sv': 'timestamp'}

def http(method, url, body=None, headers=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={'Content-Type': 'application/json', **(headers or {})})
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read() or 'null')
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:200]

def signup(email, pw):
    s, d = http('POST', f'https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={KEY}', {'email': email, 'password': pw, 'returnSecureToken': True}, REF)
    assert s == 200, d
    return d

def db(method, path, tok, body=None):
    auth = f'access_token={ADMIN_TOKEN}' if tok == 'ADMIN' else (f'auth={tok}' if tok else '')
    return http(method, f'{DB}/{path}.json?{auth}', body)[0]

results = []
def check(name, status, want_ok):
    ok = (status == 200) == want_ok
    results.append(ok)
    print(('PASS' if ok else 'FAIL'), f'[{status}]', ('allowed' if want_ok else 'blocked') + ':', name)

users = {}
try:
    for pid in ['zzta', 'zztb', 'zztc']:
        email = f'{pid}.{secrets.token_hex(4)}@webbs-games.app'
        u = signup(email, f'webbs-{pid}-1234-games')
        users[pid] = {'tok': u['idToken'], 'uid': u['localId'], 'email': email}
        t = u['idToken']
        check(f'{pid} claims its name', db('PUT', f'logins/{pid}', t, {'email': email}), True)
        check(f'{pid} links its account', db('PUT', f'uids/{u["localId"]}', t, pid), True)
        check(f'{pid} creates profile (not approved)', db('PUT', f'players/{pid}', t, {'name': pid, 'approved': False, 'uid': u['localId'], 'createdAt': 1}), True)

    A, B, C = users['zzta']['tok'], users['zztb']['tok'], users['zztc']['tok']
    check('stranger approves itself', db('PATCH', 'players/zztc', C, {'approved': True}), False)
    check('player creates itself already approved', db('PUT', 'players/zztc', C, {'name': 'x', 'approved': True, 'uid': users['zztc']['uid']}), False)
    check('stranger steals the name zzta', db('PUT', 'logins/zzta', C, {'email': users['zztc']['email']}), False)
    check('stranger links itself to zzta', db('PUT', f'uids/{users["zztc"]["uid"]}', C, 'zzta'), False)
    check('stranger edits zzta profile', db('PATCH', 'players/zzta', C, {'name': 'hacked'}), False)
    for pid in ['zzta', 'zztb']:
        db('PATCH', f'players/{pid}', 'ADMIN', {'approved': True})

    conv = 'zzta__zztb'
    check('A messages B', db('POST', f'dms/{conv}', A, {'from': 'zzta', 'text': 'hi B', 'ts': TS}), True)
    check('B reads the conversation', db('GET', f'dms/{conv}', B), True)
    check('stranger reads A+B conversation', db('GET', f'dms/{conv}', C), False)
    check('nobody signed in reads it', db('GET', f'dms/{conv}', None), False)
    check('A sends pretending to be B', db('POST', f'dms/{conv}', A, {'from': 'zztb', 'text': 'fake', 'ts': TS}), False)
    check('stranger messages A', db('POST', 'dms/zzta__zztc', C, {'from': 'zztc', 'text': 'hey', 'ts': TS}), False)
    check('A messages unapproved stranger', db('POST', 'dms/zzta__zztc', A, {'from': 'zzta', 'text': 'hey', 'ts': TS}), False)
    check('A writes into a chat it is not in', db('POST', 'dms/zztb__zztc', A, {'from': 'zzta', 'text': 'x', 'ts': TS}), False)
    check('message over 500 letters', db('POST', f'dms/{conv}', A, {'from': 'zzta', 'text': 'x' * 501, 'ts': TS}), False)
    check('message with a fake time', db('POST', f'dms/{conv}', A, {'from': 'zzta', 'text': 'x', 'ts': 1}), False)
    s, msgs = http('GET', f'{DB}/dms/{conv}.json?auth={B}')
    mid = list(msgs)[0]
    check('A edits a sent message', db('PUT', f'dms/{conv}/{mid}/text', A, 'changed'), False)
    check('A deletes a sent message', db('DELETE', f'dms/{conv}/{mid}', A), False)
    check('admin (Tim) reads any conversation', db('GET', f'dms/{conv}', 'ADMIN'), True)

    check('stranger reads the player list', db('GET', 'players', C), False)
    check('stranger reads its own profile', db('GET', 'players/zztc', C), True)
    check('approved player reads the player list', db('GET', 'players', A), True)

    check('A opens a table', db('PUT', 'tables/1234', A, {'game': 'sorry', 'host': 'zzta', 'ts': 1}), True)
    check('B takes over A\'s table', db('PUT', 'tables/1234', B, {'game': 'uno', 'host': 'zztb', 'ts': 1}), False)
    check('stranger sees open tables', db('GET', 'tables', C), False)
    check('B sees open tables', db('GET', 'tables', B), True)
    check('A closes its table', db('DELETE', 'tables/1234', A), True)

    check('A invites B', db('POST', 'invites/zztb', A, {'from': 'zzta', 'game': 'sorry', 'pin': '1234', 'ts': TS}), True)
    check('A reads B\'s invites', db('GET', 'invites/zztb', A), False)
    check('B reads its invites', db('GET', 'invites/zztb', B), True)
    check('stranger invites B', db('POST', 'invites/zztb', C, {'from': 'zztc', 'game': 'sorry', 'pin': '1234', 'ts': TS}), False)
    s, inv = http('GET', f'{DB}/invites/zztb.json?auth={B}')
    check('B dismisses the invite', db('DELETE', f'invites/zztb/{list(inv)[0]}', B), True)

    check('A posts on family chat', db('POST', 'board', A, {'from': 'zzta', 'text': 'hello all', 'ts': TS}), True)
    check('stranger reads family chat', db('GET', 'board', C), False)
    check('stranger posts on family chat', db('POST', 'board', C, {'from': 'zztc', 'text': 'spam', 'ts': TS}), False)
    check('A reads admin list entry of B', db('GET', f'admins/{users["zztb"]["uid"]}', A), False)
    check('A makes itself admin', db('PUT', f'admins/{users["zzta"]["uid"]}', A, True), False)
finally:
    for path in ['dms/zzta__zztb', 'dms/zzta__zztc', 'invites/zztb', 'tables/1234'] + \
                [f'{p}/{pid}' for p in ['logins', 'players', 'reads', 'history'] for pid in ['zzta', 'zztb', 'zztc']] + \
                [f'uids/{u["uid"]}' for u in users.values()]:
        db('DELETE', path, 'ADMIN')
    s, board = http('GET', f'{DB}/board.json?access_token={ADMIN_TOKEN}')
    for k, v in (board or {}).items():
        if str(v.get('from', '')).startswith('zzt'):
            db('DELETE', f'board/{k}', 'ADMIN')
    for u in users.values():
        http('POST', f'https://identitytoolkit.googleapis.com/v1/accounts:delete?key={KEY}', {'idToken': u['tok']}, REF)
    print('cleaned up test accounts and data')

print(f'{sum(results)}/{len(results)} checks passed')
sys.exit(0 if all(results) else 1)
