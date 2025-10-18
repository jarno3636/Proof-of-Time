// app/mini/head.tsx
export default function Head() {
  return (
    <>
      <script
        id="fc-miniapp-ready-head"
        dangerouslySetInnerHTML={{
          __html: `
(function(){
  function ready(){
    try{ window.farcaster?.actions?.ready?.(); }catch(_){}
    try{ window.farcaster?.miniapp?.sdk?.actions?.ready?.(); }catch(_){}
    try{ window.Farcaster?.mini?.sdk?.actions?.ready?.(); }catch(_){}
  }
  ready();
  document.addEventListener('DOMContentLoaded', ready);
  var i=0, iv=setInterval(function(){ i++; ready(); if(i>50) clearInterval(iv); }, 120);
})();
          `,
        }}
      />
    </>
  );
}
