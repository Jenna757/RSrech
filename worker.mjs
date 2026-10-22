const json = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), {status, headers: {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra}});
const digest = async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(x=>x.toString(16).padStart(2,'0')).join('');
const token = () => crypto.randomUUID()+crypto.randomUUID();
const cookie = (value,age) => `__Host-rs_admin=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;
const now = () => Math.floor(Date.now()/1000);
async function readJSON(request){const reader=request.body?.getReader();if(!reader)throw new Error('Empty body');let size=0,parts=[];for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>150000){await reader.cancel();throw new Error('Body too large')}parts.push(value)}const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length}return JSON.parse(new TextDecoder().decode(bytes));}
const schema = [
 `CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, name TEXT NOT NULL, company TEXT NOT NULL, email TEXT NOT NULL, service TEXT NOT NULL, message TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'new', created_at INTEGER NOT NULL)`,
 `CREATE TABLE IF NOT EXISTS content (id INTEGER PRIMARY KEY CHECK(id=1), body TEXT NOT NULL, version INTEGER NOT NULL, updated_at INTEGER NOT NULL)`,
 `CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, csrf TEXT NOT NULL, expires INTEGER NOT NULL)`,
 `CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL)`
];
let ready;
async function initialize(db){if(!ready)ready=db.batch(schema.map(sql=>db.prepare(sql))).catch(e=>{ready=null;throw e});await ready;}
async function rate(db,key,limit,seconds){const expiry=now()+seconds; const row=await db.prepare(`INSERT INTO rate_limits(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires<=? THEN 1 ELSE count+1 END, expires=CASE WHEN expires<=? THEN excluded.expires ELSE expires END RETURNING count`).bind(key,expiry,now(),now()).first();return row.count<=limit;}
function validateContent(value, defaults){
 if(typeof value==='string')return typeof defaults==='string'&&value.length<=6000;
 if(Array.isArray(value))return Array.isArray(defaults)&&value.length===defaults.length&&value.every((v,i)=>validateContent(v,defaults[i]));
 if(value&&typeof value==='object'&&defaults&&typeof defaults==='object')return Object.keys(value).length===Object.keys(defaults).length&&Object.keys(defaults).every(k=>Object.hasOwn(value,k)&&(k==='id'?value[k]===defaults[k]:validateContent(value[k],defaults[k])));
 return false;
}
async function api(request,env){
 const url=new URL(request.url),path=url.pathname,method=request.method;
 if(!env.DB)return json({error:'資料庫尚未連接，請聯絡網站管理員。'},503);
 await initialize(env.DB);
 const defaults=await env.ASSETS.fetch(new Request(new URL('/content-defaults.json',request.url))).then(r=>r.json());
 if(path==='/api/content'&&method==='GET'){const row=await env.DB.prepare('SELECT body,version FROM content WHERE id=1').first();return json({content:row?JSON.parse(row.body):defaults,version:row?.version||0});}
 if(method!=='GET'&&request.headers.get('Origin')!==url.origin)return json({error:'不允許跨網站操作'},403);
 if(method!=='GET'&&!request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'需要 JSON 格式'},415);
 if(Number(request.headers.get('Content-Length')||0)>150000)return json({error:'內容過大'},413);
 const ipHash=await digest(request.headers.get('CF-Connecting-IP')||'unknown');
 if(path==='/api/messages'&&method==='POST'){
  if(!await rate(env.DB,'message:'+ipHash,5,600))return json({error:'提交過於頻繁，請稍後再試。'},429);
  const data=await readJSON(request); if(data.website)return json({ok:true});
  const limits={name:100,company:150,email:200,service:100,message:3000},clean={};
  for(const [k,max]of Object.entries(limits)){if(typeof data[k]!=='string'||data[k].length>max)return json({error:'請檢查表格內容。'},400);clean[k]=data[k].trim();}
  if(!clean.name||!clean.message||!clean.service||!/^\S+@\S+\.\S+$/.test(clean.email))return json({error:'請填寫姓名、有效電郵、服務及需求。'},400);
  const id=crypto.randomUUID();await env.DB.prepare('INSERT INTO messages(id,name,company,email,service,message,created_at) VALUES(?,?,?,?,?,?,?)').bind(id,clean.name,clean.company,clean.email,clean.service,clean.message,now()).run();return json({ok:true,id},201);
 }
 if(path==='/api/admin/login'&&method==='POST'){
  if(!env.ADMIN_PASSWORD)return json({error:'正式環境尚未收到 ADMIN_PASSWORD，請在 Cloudflare 設定 Secret 並部署。'},503);
  if(env.ADMIN_PASSWORD.length<16)return json({error:'已收到管理員密碼設定，但長度少於 16 個字元。請在 Cloudflare 更新為至少 16 個字元，然後部署。'},503);
  if(!await rate(env.DB,'login:'+ipHash,8,900))return json({error:'登入嘗試過多，請 15 分鐘後重試。'},429);
  const data=await readJSON(request); const a=await digest(String(data.password||'')),b=await digest(env.ADMIN_PASSWORD);let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);
  if(diff)return json({error:'密碼不正確。'},401);
  const session=token(),csrf=token();await env.DB.prepare('INSERT INTO sessions(token_hash,csrf,expires) VALUES(?,?,?)').bind(await digest(session),csrf,now()+28800).run();
  await env.DB.batch([env.DB.prepare('DELETE FROM sessions WHERE expires<?').bind(now()),env.DB.prepare('DELETE FROM rate_limits WHERE expires<?').bind(now())]);
  return json({ok:true,csrf},200,{'Set-Cookie':cookie(session,28800)});
 }
 const raw=request.headers.get('Cookie')?.match(/(?:^|;\s*)__Host-rs_admin=([^;]+)/)?.[1];
 const session=raw?await env.DB.prepare('SELECT csrf FROM sessions WHERE token_hash=? AND expires>?').bind(await digest(raw),now()).first():null;
 if(!session)return json({error:'請先登入。'},401);
 if(method!=='GET'&&request.headers.get('X-CSRF-Token')!==session.csrf)return json({error:'登入驗證已失效，請重新登入。'},403);
 if(path==='/api/admin/session'&&method==='GET')return json({csrf:session.csrf});
 if(path==='/api/admin/logout'&&method==='POST'){await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await digest(raw)).run();return json({ok:true},200,{'Set-Cookie':cookie('',0)});}
 if(path==='/api/admin/messages'&&method==='GET'){
  const page=Math.max(0,Math.min(10000,Number(url.searchParams.get('page'))||0));
  const rows=await env.DB.prepare('SELECT * FROM messages ORDER BY created_at DESC,id LIMIT 50 OFFSET ?').bind(page*50).all();const total=await env.DB.prepare('SELECT COUNT(*) AS total FROM messages').first();return json({messages:rows.results,total:total.total,page});
 }
 if(path.startsWith('/api/admin/messages/')&&method==='PATCH'){
  const data=await readJSON(request);if(!['new','progress','done'].includes(data.status))return json({error:'狀態不正確'},400);
  const result=await env.DB.prepare('UPDATE messages SET status=? WHERE id=?').bind(data.status,path.split('/').pop()).run();return result.meta.changes?json({ok:true}):json({error:'找不到留言'},404);
 }
 if(path==='/api/admin/content'&&method==='PUT'){
  const data=await readJSON(request);if(!Number.isSafeInteger(data.version)||data.version<0||!validateContent(data.content,defaults))return json({error:'內容格式不正確或超過字數限制。'},400);
  const result=await env.DB.prepare('INSERT INTO content(id,body,version,updated_at) SELECT 1,?,1,? WHERE ?=0 ON CONFLICT(id) DO UPDATE SET body=excluded.body,version=content.version+1,updated_at=excluded.updated_at WHERE content.version=?').bind(JSON.stringify(data.content),now(),data.version,data.version).run();
  // Existing rows require an UPDATE because the INSERT SELECT predicate only initializes version zero.
  if(!result.meta.changes){const updated=await env.DB.prepare('UPDATE content SET body=?,version=version+1,updated_at=? WHERE id=1 AND version=?').bind(JSON.stringify(data.content),now(),data.version).run();if(!updated.meta.changes)return json({error:'其他管理員已更新內容，請重新載入後再編輯。'},409);}
  return json({ok:true,version:data.version+1});
 }
 return json({error:'找不到此功能'},404);
}
export default {async fetch(request,env){try{
 const url=new URL(request.url);
 if(url.pathname.startsWith('/api/'))return await api(request,env);
 const response=await env.ASSETS.fetch(request);
 const headers=new Headers(response.headers);headers.set('X-Content-Type-Options','nosniff');headers.set('Referrer-Policy','strict-origin-when-cross-origin');
 if(url.pathname.startsWith('/admin')){headers.set('Cache-Control','no-store');headers.set('X-Robots-Tag','noindex, nofollow');headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");}
 return new Response(response.body,{status:response.status,headers});
 }catch(error){console.error('Request failed',error?.name);return json({error:'服務暫時未能完成操作，請稍後再試。'},500);}}};
