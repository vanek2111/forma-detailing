(() => {
  const frame=document.querySelector('#forma-config-frame');if(!frame)return;
  const load=()=>{if(frame.dataset.src){frame.src=frame.dataset.src;delete frame.dataset.src}};
  if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){load();observer.disconnect()}},{rootMargin:'250px'});observer.observe(frame)}else load();
  window.addEventListener('message',event=>{
    if(event.origin!==location.origin||event.source!==frame.contentWindow||!event.data)return;
    if(event.data.type==='forma-config-height'&&Number.isFinite(event.data.height)){frame.style.height=Math.max(440,Math.min(2400,event.data.height))+'px'}
    if(event.data.type==='forma-config-booking'){
      // The existing prefill helper also runs on hash changes.
      location.hash='booking';window.dispatchEvent(new Event('forma-config-picked'));
      document.querySelector('#client-name')?.focus({preventScroll:true});
    }
  });
})();
