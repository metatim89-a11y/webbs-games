#!/usr/bin/env python3
"""Expand the shorthand words in rules.src.json into real Realtime Database rules.

Usage: python3 firebase/build-rules.py   -> writes firebase/database.rules.json
Deploy: firebase/deploy-rules.sh
"""
import json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))

ME = "root.child('uids/' + auth.uid).val()"
WORDS = {
    # Tim (the admin) is listed under /admins/<uid>; only set by hand with an admin token
    "ADMIN": "(auth != null && root.child('admins/' + auth.uid).val() === true)",
    # Signed in and approved by Tim
    "APPROVED": "(auth != null && root.child('players/' + " + ME + " + '/approved').val() === true)",
    # Signed in as the owner of player $id (their sign-in email is the one saved for $id)
    "OWNS_TO": "(auth != null && root.child('logins/' + $to + '/email').val() === auth.token.email)",
    "OWNS": "(auth != null && root.child('logins/' + $id + '/email').val() === auth.token.email)",
    "ME": ME,
}

def expand(value):
    if isinstance(value, dict):
        return {k: expand(v) for k, v in value.items() if not k.startswith('//')}
    if isinstance(value, str):
        for word in ["OWNS_TO", "ADMIN", "APPROVED", "OWNS", "ME"]:
            value = re.sub(r'\b' + word + r'\b', lambda m: WORDS[word], value)
        return value
    return value

src = json.load(open(os.path.join(HERE, 'rules.src.json')))
out = expand(src)
path = os.path.join(HERE, 'database.rules.json')
json.dump(out, open(path, 'w'), indent=2)
print('wrote', path)
