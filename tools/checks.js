// Run the regression suite with inspectable per-suite logs and a short console summary.
const fs=require('node:fs'),path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const requested=process.argv.slice(2);
const suites=requested.length?requested:['smoke','ambient','v4','v5','v6','pantry','v9','navigation'];
fs.mkdirSync(path.join(root,'gen'),{recursive:true});
let failed=false;
for(const suite of suites){
  const result=spawnSync(process.execPath,[path.join(root,'test',suite+'.js')],{cwd:root,encoding:'utf8',timeout:600000,maxBuffer:8*1024*1024});
  const output=(result.stdout||'')+(result.stderr||'')+(result.error?'\n'+result.error.message:'');
  const log=path.join(root,'gen','test-'+suite+'.log');fs.writeFileSync(log,output);
  console.log(suite+': '+(result.status===0?'PASS':'FAIL')+' ('+path.relative(root,log)+')');
  if(result.status!==0){failed=true;console.log(output.slice(-5000));}
}
process.exitCode=failed?1:0;
