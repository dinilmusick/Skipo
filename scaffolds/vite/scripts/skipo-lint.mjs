// Offline TypeScript architecture lint, distinct from tsc typechecking.
import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const sources = ['src/frontend', 'src/backend'];
const files = [];
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, {withFileTypes:true})) {
    const full=path.join(dir,entry.name);
    if(entry.isDirectory())walk(full);
    else if(entry.isFile() && /\.[jt]sx?$/.test(entry.name))files.push(full);
  }
}
for(const dir of sources)walk(path.join(root,dir));
const problems=[];
for(const file of files.sort()){
  const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,
    file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  for(const diagnostic of source.parseDiagnostics)
    problems.push(file+':'+diagnostic.start+': '+ts.flattenDiagnosticMessageText(diagnostic.messageText,' '));
  function visit(node){
    if(ts.isImportDeclaration(node)&&node.moduleSpecifier&&ts.isStringLiteral(node.moduleSpecifier)){
      const imp=node.moduleSpecifier.text;
      if(file.includes('/frontend/') && /^(?:@aws-sdk\/|@neondatabase\/|@supabase\/|@ultrst-armada\/kloks\/backend|node:)/.test(imp))
        problems.push(file+': frontend cannot import backend/SDK '+imp);
    }
    ts.forEachChild(node,visit);
  }
  visit(source);
}
if(!files.length)problems.push('No application sources found');
if(problems.length){console.error(problems.join('\n'));process.exitCode=1;}
else console.log('TypeScript AST architecture lint passed:',files.length,'files');
