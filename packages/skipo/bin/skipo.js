#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { argv, exit } from "node:process";
import { request } from "node:https";
import { readdir } from "node:fs/promises";

const args=argv.slice(2);
const refArg=args.find(a=>a.startsWith("--skipo-ref="));
const ref=refArg?refArg.split("=",2)[1]:"main";
const url="https://codeload.github.com/dinilmusick/Skipo/tar.gz/refs/heads/"+encodeURIComponent(ref);
const temp=mkdtempSync(join(tmpdir(),"skipo-cli-")), archive=join(temp,"skipo.tar.gz");
function download(u,d){return new Promise((ok,bad)=>{const q=request(u,r=>{if(r.statusCode>=300&&r.statusCode<400&&r.headers.location)return download(r.headers.location,d).then(ok,bad);if(r.statusCode!==200)return bad(new Error("Skipo download failed: HTTP "+r.statusCode));const c=[];r.on("data",x=>c.push(x));r.on("end",()=>{writeFileSync(d,Buffer.concat(c));ok();});});q.on("error",bad);q.end();});}
try{
  await download(url,archive);
  const extract=join(temp,"extract"); mkdirSync(extract);
  execFileSync("tar",["-xzf",archive,"-C",extract]);
  const [rootName]=await readdir(extract);
  const root=join(extract,rootName);
  if(!existsSync(join(root,"scripts","skipo_cli.py"))) throw new Error("Downloaded Skipo framework is incomplete.");
  execFileSync("python3",[join(root,"scripts","skipo_cli.py"),...args.filter(a=>a!==refArg)],{stdio:"inherit"});
}catch(e){console.error(e.message);exit(1)}finally{rmSync(temp,{recursive:true,force:true})}
