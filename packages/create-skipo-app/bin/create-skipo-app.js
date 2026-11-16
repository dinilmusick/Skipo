#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { argv, exit } from "node:process";
import { request } from "node:https";
import { readdir } from "node:fs/promises";

const args=argv.slice(2), i=args.findIndex(a=>!a.startsWith("--")), name=i>=0?args[i]:"";
const framework=args.includes("--nextjs")?"nextjs":"vite";
const next=args[i+1], target=resolve(next&&!next.startsWith("--")?next:name||".");
const refArg=args.find(a=>a.startsWith("--skipo-ref=")), ref=refArg?refArg.split("=",2)[1]:"main";
if(!name){console.error("Usage: npx create-skipo-app@latest <name> [target] [--nextjs] [--skipo-ref=<ref>]");exit(2);}
const url="https://codeload.github.com/dinilmusick/Skipo/tar.gz/refs/heads/"+encodeURIComponent(ref);
const temp=mkdtempSync(join(tmpdir(),"skipo-")), archive=join(temp,"skipo.tar.gz");
function download(u,d){return new Promise((ok,bad)=>{const q=request(u,r=>{if(r.statusCode>=300&&r.statusCode<400&&r.headers.location)return download(r.headers.location,d).then(ok,bad);if(r.statusCode!==200)return bad(new Error("Skipo download failed: HTTP "+r.statusCode));const c=[];r.on("data",x=>c.push(x));r.on("end",()=>{writeFileSync(d,Buffer.concat(c));ok();});});q.on("error",bad);q.end();});}
async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){const p=join(dir,e.name);if(e.isDirectory())await walk(p);else if([".json",".md",".ts",".tsx",".js",".mjs",".toml",".yml",".yaml"].some(s=>p.endsWith(s))){let t=readFileSync(p,"utf8");t=t.split("MyApp").join(name).split("my-app").join(name.toLowerCase().replaceAll(" ","-"));writeFileSync(p,t);}}}
try{await download(url,archive);const extract=join(temp,"extract");mkdirSync(extract);execFileSync("tar",["-xzf",archive,"-C",extract]);const [rootName]=await readdir(extract);const scaffold=join(extract,rootName,"scaffolds",framework);if(!existsSync(scaffold))throw new Error("Skipo scaffold '"+framework+"' is unavailable.");if(existsSync(target)&&(await readdir(target)).length)throw new Error("Target is not empty: "+target);mkdirSync(target,{recursive:true});cpSync(scaffold,target,{recursive:true});await walk(target);mkdirSync(join(target,".skipo"),{recursive:true});writeFileSync(join(target,".skipo","project.json"),JSON.stringify({framework:"skipo",scaffold:framework,generated_by:"create-skipo-app",skipo_ref:ref},null,2)+"\n");console.log("Created Skipo "+framework+" project '"+name+"' from Skipo "+ref+".");}catch(e){console.error(e.message);exit(1)}finally{rmSync(temp,{recursive:true,force:true})}
