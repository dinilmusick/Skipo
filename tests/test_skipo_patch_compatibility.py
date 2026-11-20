import sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from skipo_patch_compatibility import compatible_patch_version as compatible
from skipo_maintenance import build_plan
from skipo_state_registry import load_registry
import json

def test_exact_patch_floor_only():
    assert compatible('2.2.7','2.2.6')
    assert compatible('0.5.30','0.5.27')
    assert compatible('^1.0.30','^1.0.29')
    assert compatible('1.0.30','^1.0.29')
    for actual, required in [
        ('2.2.5','2.2.6'), ('2.3.0','2.2.6'),
        ('3.0.0','2.2.6'), ('^2.2.7','2.2.6'),
        ('~2.2.7','2.2.6'), ('latest','2.2.6'),
        ('2.2.7-beta.1','2.2.6'), ('^1.0.28','^1.0.29')]:
        assert not compatible(actual,required), (actual,required)

def test_recorded_patch_state_is_not_downgraded_by_canonical_update(tmp_path):
    canonical=load_registry()['applicationState']
    base=canonical['dependencies']
    updated={**base,'@ultrst-armada/kloks':'2.2.7'}
    (tmp_path/'package.json').write_text(json.dumps({
        'name':'fixture','engines':{'node':'>=22'},
        'packageManager':'pnpm@10.33.0','dependencies':updated}))
    (tmp_path/'pnpm-lock.yaml').write_text("lockfileVersion: '9.0'\n")
    skipo=tmp_path/'.skipo'
    skipo.mkdir()
    (skipo/'project.json').write_text(json.dumps({'framework':'skipo','skipo_version':'1.3.1'}))
    (skipo/'dependencies.json').write_text(json.dumps(updated))
    (skipo/'capabilities.json').write_text(json.dumps({'schemaVersion':1,'installed':{},'generated':[]}))
    from skipo_maintenance import build_plan
    p=build_plan(tmp_path,'1.3.1',environment={'node':'v22.18.0','pnpm':'10.33.0',
        'npm':'11.0.0','yarn':None},git_status='')
    assert not [a for a in p['actions'] if a.get('package')=='@ultrst-armada/kloks'],p['actions']
    assert not [a for a in p['actions'] if a.get('action')=='reconcile-dependency-state'],p['actions']
