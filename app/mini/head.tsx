// app/mini/head.tsx
export default function Head() {
  return (
    <>
      {/* Tell Warpcast mini-app to hide the splash ASAP */}
      <script
        id="fc-miniapp-ready-head"
        dangerouslySetInnerHTML={{
          __html: `
(function(){
  function ready(){
    try{ window.farcaster?.actions?.ready?.(); }catch(_){}
    try{ window.farcaster?.ready?.(); }catch(_){}
  }
  // try immediately
  ready();
  // then on DOM ready
  document.addEventListener('DOMContentLoaded', ready);
  // and poll briefly in case the injector is late
  var i=0, iv=setInterval(function(){ i++; ready(); if(i>50) clearInterval(iv); }, 120);
})();
          `,
        }}
      />
    </>
  );
}
