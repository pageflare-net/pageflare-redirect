#!/usr/bin/env python3
"""Build an isolated immutable frontend/backend pair without touching live dist files."""
import datetime,json,os,pathlib,subprocess
root=pathlib.Path(__file__).resolve().parents[1]
name='release-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d%H%M%S')
output=root/'.releases'/name;output.mkdir(parents=True)
env={**os.environ,'PATH':'/root/.bun/bin:/root/pageflare-overhaul/tools/node/bin:'+os.environ.get('PATH','')}
try:
 for command,cwd in [(['bun','--bun','vite','build','--outDir',str(output/'frontend')],root/'frontend'),(['bun','--bun','tsc','--outDir',str(output/'backend')],root/'backend')]:
  subprocess.run(command,cwd=cwd,env=env,check=True)
 assert (output/'frontend/index.html').is_file() and (output/'backend/index.js').is_file()
 (output/'release.json').write_text(json.dumps({'name':name,'builtAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceCommit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip(),'sourceModified':bool(subprocess.check_output(['git','status','--porcelain'],cwd=root,text=True).strip())},indent=2)+'\n')
 print('Isolated release built:',name)
except BaseException:
 (output/'FAILED').write_text('Build incomplete; do not activate\n')
 raise
