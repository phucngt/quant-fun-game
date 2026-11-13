import json, sys, importlib.util, os
sys.dont_write_bytecode = True
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
RUN = str(ROOT / 'reference')
sys.path.insert(0, os.environ.get('QF_REFERENCE_ROOT', str(ROOT / '.python-deps')))
sys.path.insert(0, RUN)
spec = importlib.util.spec_from_file_location('run', RUN + '/run.py')
run = importlib.util.module_from_spec(spec); spec.loader.exec_module(run)
HERE = os.path.dirname(os.path.abspath(__file__))
bars = json.load(open(HERE + '/../assets/bars.json', encoding='utf-8'))
scen = json.load(open(HERE + '/scenarios.json', encoding='utf-8'))

def step(desk, name, data, out):
    try:
        desk.action(name, data)
        out.append({'do': name, 'data': data, 'snap': json.loads(json.dumps(desk.snapshot()))})
        return True
    except ValueError as e:
        out.append({'do': name, 'data': data, 'error': str(e)})
        return False

result = {}
for s in scen:
    desk = run.Desk(bars); out = [{'do': 'init', 'snap': json.loads(json.dumps(desk.snapshot()))}]
    for op in s['ops']:
        a = op['a']
        if a == 'next':
            for _ in range(op.get('n', 1)): step(desk, 'next', {}, out)
        elif a == 'until_proposal':
            for _ in range(400):
                if not step(desk, 'next', {}, out) or desk.proposal or (out[-1].get('snap') and 'blocked' == 'x'): break
                if desk.log and desk.log[-1].get('blocked'): break
        elif a == 'auto':
            for _ in range(800):
                if desk.proposal:
                    step(desk, op['policy'] == 'approve' and 'approve' or 'skip', {}, out)
                elif not step(desk, 'next', {}, out): break
        elif a == 'allocation': step(desk, 'allocation', {'value': op['v']}, out)
        elif a == 'raw': step(desk, op['name'], {}, out)
        else: step(desk, a, {}, out)
    result[s['name']] = out
json.dump(result, open(HERE + '/py_snapshots.json', 'w'))
print('python steps', sum(len(v) for v in result.values()))
