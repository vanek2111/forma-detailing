(() => {
  function prefill(){
    try {
      const raw=sessionStorage.getItem('forma-config-selection');if(!raw)return;
      const selection=JSON.parse(raw);
      if(typeof selection.text!=='string'||selection.text.length>4000||typeof selection.created!=='number'||Date.now()-selection.created>3600000){sessionStorage.removeItem('forma-config-selection');return;}
      const message=document.querySelector('#client-message');if(!message)return;
      if(!message.value.includes('FORMA · подбор услуг'))message.value=message.value?message.value+'\n\n'+selection.text:selection.text;
      else message.value=selection.text;
      message.dispatchEvent(new Event('input',{bubbles:true}));
      sessionStorage.removeItem('forma-config-selection');
    }catch{}
  }
  window.addEventListener('forma-config-picked',prefill);prefill();
})();
