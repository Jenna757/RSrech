(() => {
 const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const safe=value=>Array.isArray(value)?value.map(safe):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,safe(v)])):escape(value);
 let content;
 function apply(){if(!content)return;for(const t of content.text){const el=document.querySelector('[data-cms="'+t.id+'"]');if(el){el.dataset.zh=t.zh;el.dataset.en=t.en;el.textContent=t[document.documentElement.lang==='en'?'en':'zh'];el.style.whiteSpace='pre-line';}}
 content.services.forEach((s,i)=>Object.assign(services[i],safe(s)));content.csr.forEach((s,i)=>Object.assign(csr[i],safe(s)));renderServices();renderCSR();}
 fetch('/api/content').then(r=>{if(!r.ok)throw new Error();return r.json()}).then(data=>{content=data.content;apply()}).catch(()=>{});
 document.querySelector('#language').addEventListener('click',apply);
 document.querySelector('#quote-form').addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget,button=form.querySelector('[type=submit]'),status=document.querySelector('#form-status');if(button.disabled)return;button.disabled=true;status.textContent=document.documentElement.lang==='en'?'Sending…':'正在提交…';
 try{const r=await fetch('/api/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(form)))});const data=await r.json();if(!r.ok)throw new Error(data.error);status.textContent=document.documentElement.lang==='en'?'Thank you. Your enquiry has been received.':'謝謝，已收到您的查詢，我們會盡快跟進。';form.reset();}catch(err){status.textContent=err.message||'提交失敗，請稍後再試。';}finally{button.disabled=false;}});
})();
