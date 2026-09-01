import{H as e,r as t,rt as n,v as r}from"./ModalController-DLyGHbfk.js";import{C as i,_ as a,c as o,d as s,f as c,l,m as u,o as d,x as f,y as p}from"./wui-text-BTwUa-zK.js";import{t as m}from"./ConstantsUtil-DREhlVIn.js";import"./wui-image-JtJDXoLK.js";import"./wui-icon-box-aoX7RuOP.js";var h={getCaipTokens(e){if(!e)return;let t={};return Object.entries(e).forEach(([e,n])=>{t[`${m.EIP155}:${e}`]=n}),t},isLowerCaseMatch(e,t){return e?.toLowerCase()===t?.toLowerCase()},getActiveNamespaceConnectedToAuth(){let e=t.state.activeChain;return n.AUTH_CONNECTOR_SUPPORTED_CHAINS.find(t=>r.getConnectorId(t)===n.CONNECTOR_ID.AUTH&&t===e)},withRetry({conditionFn:e,intervalMs:t,maxRetries:n}){let r=0;return new Promise(i=>{async function a(){return r+=1,await e()?i(!0):r>=n?i(!1):(setTimeout(a,t),null)}a()})},userChainIdToChainNamespace(e){if(typeof e==`number`)return n.CHAIN.EVM;let[t]=e.split(`:`);return t},getOtherAuthNamespaces(e){return e?n.AUTH_CONNECTOR_SUPPORTED_CHAINS.filter(t=>t!==e):[]},getConnectorStorageInfo(t,n){let r=e.getConnections()[n]??[];return{hasDisconnected:e.isConnectorDisconnected(t,n),hasConnected:r.some(e=>h.isLowerCaseMatch(e.connectorId,t))}}},g=a`
  button {
    display: flex;
    align-items: center;
    height: 40px;
    padding: ${({spacing:e})=>e[2]};
    border-radius: ${({borderRadius:e})=>e[4]};
    column-gap: ${({spacing:e})=>e[1]};
    background-color: transparent;
    transition: background-color ${({durations:e})=>e.lg}
      ${({easings:e})=>e[`ease-out-power-2`]};
    will-change: background-color;
  }

  wui-image,
  .icon-box {
    width: ${({spacing:e})=>e[6]};
    height: ${({spacing:e})=>e[6]};
    border-radius: ${({borderRadius:e})=>e[4]};
  }

  wui-text {
    flex: 1;
  }

  .icon-box {
    position: relative;
  }

  .icon-box[data-active='true'] {
    background-color: ${({tokens:e})=>e.theme.foregroundSecondary};
  }

  .circle {
    position: absolute;
    left: 16px;
    top: 15px;
    width: 8px;
    height: 8px;
    background-color: ${({tokens:e})=>e.core.textSuccess};
    box-shadow: 0 0 0 2px ${({tokens:e})=>e.theme.foregroundPrimary};
    border-radius: 50%;
  }

  /* -- Hover & Active states ----------------------------------------------------------- */
  @media (hover: hover) {
    button:hover:enabled,
    button:active:enabled {
      background-color: ${({tokens:e})=>e.theme.foregroundPrimary};
    }
  }
`,_=function(e,t,n,r){var i=arguments.length,a=i<3?t:r===null?r=Object.getOwnPropertyDescriptor(t,n):r,o;if(typeof Reflect==`object`&&typeof Reflect.decorate==`function`)a=Reflect.decorate(e,t,n,r);else for(var s=e.length-1;s>=0;s--)(o=e[s])&&(a=(i<3?o(a):i>3?o(t,n,a):o(t,n))||a);return i>3&&a&&Object.defineProperty(t,n,a),a},v=class extends p{constructor(){super(...arguments),this.address=``,this.profileName=``,this.alt=``,this.imageSrc=``,this.icon=void 0,this.iconSize=`md`,this.enableGreenCircle=!0,this.loading=!1,this.charsStart=4,this.charsEnd=6}render(){return f`
      <button>
        ${this.leftImageTemplate()} ${this.textTemplate()} ${this.rightImageTemplate()}
      </button>
    `}leftImageTemplate(){let e=this.icon?f`<wui-icon
          size=${d(this.iconSize)}
          color="default"
          name=${this.icon}
          class="icon"
        ></wui-icon>`:f`<wui-image src=${this.imageSrc} alt=${this.alt}></wui-image>`;return f`
      <wui-flex
        alignItems="center"
        justifyContent="center"
        class="icon-box"
        data-active=${!!this.icon}
      >
        ${e}
        ${this.enableGreenCircle?f`<wui-flex class="circle"></wui-flex>`:null}
      </wui-flex>
    `}textTemplate(){return f`
      <wui-text variant="lg-regular" color="primary">
        ${s.getTruncateString({string:this.profileName||this.address,charsStart:this.profileName?16:this.charsStart,charsEnd:this.profileName?0:this.charsEnd,truncate:this.profileName?`end`:`middle`})}
      </wui-text>
    `}rightImageTemplate(){return f`<wui-icon name="chevronBottom" size="sm" color="default"></wui-icon>`}};v.styles=[u,c,g],_([o()],v.prototype,`address`,void 0),_([o()],v.prototype,`profileName`,void 0),_([o()],v.prototype,`alt`,void 0),_([o()],v.prototype,`imageSrc`,void 0),_([o()],v.prototype,`icon`,void 0),_([o()],v.prototype,`iconSize`,void 0),_([o({type:Boolean})],v.prototype,`enableGreenCircle`,void 0),_([o({type:Boolean})],v.prototype,`loading`,void 0),_([o({type:Number})],v.prototype,`charsStart`,void 0),_([o({type:Number})],v.prototype,`charsEnd`,void 0),v=_([l(`wui-wallet-switch`)],v);var y=a`
  :host {
    position: relative;
    background-color: ${({tokens:e})=>e.theme.foregroundTertiary};
    display: flex;
    justify-content: center;
    align-items: center;
    border-radius: inherit;
    border-radius: var(--local-border-radius);
  }

  :host([data-image='true']) {
    background-color: transparent;
  }

  :host > wui-flex {
    overflow: hidden;
    border-radius: inherit;
    border-radius: var(--local-border-radius);
  }

  :host([data-size='sm']) {
    width: 32px;
    height: 32px;
  }

  :host([data-size='md']) {
    width: 40px;
    height: 40px;
  }

  :host([data-size='lg']) {
    width: 56px;
    height: 56px;
  }

  :host([name='Extension'])::after {
    border: 1px solid ${({colors:e})=>e.accent010};
  }

  :host([data-wallet-icon='allWallets'])::after {
    border: 1px solid ${({colors:e})=>e.accent010};
  }

  wui-icon[data-parent-size='inherit'] {
    width: 75%;
    height: 75%;
    align-items: center;
  }

  wui-icon {
    color: ${({tokens:e})=>e.theme.iconDefault};
  }

  wui-icon[data-parent-size='sm'] {
    width: 24px;
    height: 24px;
  }

  wui-icon[data-parent-size='md'] {
    width: 32px;
    height: 32px;
  }

  :host > wui-icon-box {
    position: absolute;
    overflow: hidden;
    right: -1px;
    bottom: -2px;
    z-index: 1;
    border: 2px solid ${({tokens:e})=>e.theme.backgroundPrimary};
    padding: 1px;
  }
`,b=function(e,t,n,r){var i=arguments.length,a=i<3?t:r===null?r=Object.getOwnPropertyDescriptor(t,n):r,o;if(typeof Reflect==`object`&&typeof Reflect.decorate==`function`)a=Reflect.decorate(e,t,n,r);else for(var s=e.length-1;s>=0;s--)(o=e[s])&&(a=(i<3?o(a):i>3?o(t,n,a):o(t,n))||a);return i>3&&a&&Object.defineProperty(t,n,a),a},x=class extends p{constructor(){super(...arguments),this.size=`md`,this.name=``,this.installed=!1,this.badgeSize=`xs`}render(){let e=`1`;return this.size===`lg`?e=`4`:this.size===`md`?e=`2`:this.size===`sm`&&(e=`1`),this.style.cssText=`
       --local-border-radius: var(--apkt-borderRadius-${e});
   `,this.dataset.size=this.size,this.imageSrc&&(this.dataset.image=`true`),this.walletIcon&&(this.dataset.walletIcon=this.walletIcon),f`
      <wui-flex justifyContent="center" alignItems="center"> ${this.templateVisual()} </wui-flex>
    `}templateVisual(){return this.imageSrc?f`<wui-image src=${this.imageSrc} alt=${this.name}></wui-image>`:this.walletIcon?f`<wui-icon size="md" color="default" name=${this.walletIcon}></wui-icon>`:f`<wui-icon
      data-parent-size=${this.size}
      size="inherit"
      color="inherit"
      name="wallet"
    ></wui-icon>`}};x.styles=[u,y],b([o()],x.prototype,`size`,void 0),b([o()],x.prototype,`name`,void 0),b([o()],x.prototype,`imageSrc`,void 0),b([o()],x.prototype,`walletIcon`,void 0),b([o({type:Boolean})],x.prototype,`installed`,void 0),b([o()],x.prototype,`badgeSize`,void 0),x=b([l(`wui-wallet-image`)],x);var S=i`<svg  viewBox="0 0 48 54" fill="none">
  <path
    d="M43.4605 10.7248L28.0485 1.61089C25.5438 0.129705 22.4562 0.129705 19.9515 1.61088L4.53951 10.7248C2.03626 12.2051 0.5 14.9365 0.5 17.886V36.1139C0.5 39.0635 2.03626 41.7949 4.53951 43.2752L19.9515 52.3891C22.4562 53.8703 25.5438 53.8703 28.0485 52.3891L43.4605 43.2752C45.9637 41.7949 47.5 39.0635 47.5 36.114V17.8861C47.5 14.9365 45.9637 12.2051 43.4605 10.7248Z"
  />
</svg>`,C=i`<svg width="86" height="96" fill="none">
  <path
    d="M78.3244 18.926L50.1808 2.45078C45.7376 -0.150261 40.2624 -0.150262 35.8192 2.45078L7.6756 18.926C3.23322 21.5266 0.5 26.3301 0.5 31.5248V64.4752C0.5 69.6699 3.23322 74.4734 7.6756 77.074L35.8192 93.5492C40.2624 96.1503 45.7376 96.1503 50.1808 93.5492L78.3244 77.074C82.7668 74.4734 85.5 69.6699 85.5 64.4752V31.5248C85.5 26.3301 82.7668 21.5266 78.3244 18.926Z"
  />
</svg>`,w=i`
  <svg fill="none" viewBox="0 0 36 40">
    <path
      d="M15.4 2.1a5.21 5.21 0 0 1 5.2 0l11.61 6.7a5.21 5.21 0 0 1 2.61 4.52v13.4c0 1.87-1 3.59-2.6 4.52l-11.61 6.7c-1.62.93-3.6.93-5.22 0l-11.6-6.7a5.21 5.21 0 0 1-2.61-4.51v-13.4c0-1.87 1-3.6 2.6-4.52L15.4 2.1Z"
    />
  </svg>
`,T=a`
  :host {
    position: relative;
    border-radius: inherit;
    display: flex;
    justify-content: center;
    align-items: center;
    width: var(--local-width);
    height: var(--local-height);
  }

  :host([data-round='true']) {
    background: ${({tokens:e})=>e.theme.foregroundPrimary};
    border-radius: 100%;
    outline: 1px solid ${({tokens:e})=>e.core.glass010};
  }

  svg {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 1;
  }

  svg > path {
    stroke: var(--local-stroke);
  }

  wui-image {
    width: 100%;
    height: 100%;
    -webkit-clip-path: var(--local-path);
    clip-path: var(--local-path);
    background: ${({tokens:e})=>e.theme.foregroundPrimary};
  }

  wui-icon {
    transform: translateY(-5%);
    width: var(--local-icon-size);
    height: var(--local-icon-size);
  }
`,E=function(e,t,n,r){var i=arguments.length,a=i<3?t:r===null?r=Object.getOwnPropertyDescriptor(t,n):r,o;if(typeof Reflect==`object`&&typeof Reflect.decorate==`function`)a=Reflect.decorate(e,t,n,r);else for(var s=e.length-1;s>=0;s--)(o=e[s])&&(a=(i<3?o(a):i>3?o(t,n,a):o(t,n))||a);return i>3&&a&&Object.defineProperty(t,n,a),a},D=class extends p{constructor(){super(...arguments),this.size=`md`,this.name=`uknown`,this.networkImagesBySize={sm:w,md:S,lg:C},this.selected=!1,this.round=!1}render(){let e={sm:`4`,md:`6`,lg:`10`};return this.round?(this.dataset.round=`true`,this.style.cssText=`
      --local-width: var(--apkt-spacing-10);
      --local-height: var(--apkt-spacing-10);
      --local-icon-size: var(--apkt-spacing-4);
    `):this.style.cssText=`

      --local-path: var(--apkt-path-network-${this.size});
      --local-width:  var(--apkt-width-network-${this.size});
      --local-height:  var(--apkt-height-network-${this.size});
      --local-icon-size:  var(--apkt-spacing-${e[this.size]});
    `,f`${this.templateVisual()} ${this.svgTemplate()} `}svgTemplate(){return this.round?null:this.networkImagesBySize[this.size]}templateVisual(){return this.imageSrc?f`<wui-image src=${this.imageSrc} alt=${this.name}></wui-image>`:f`<wui-icon size="inherit" color="default" name="networkPlaceholder"></wui-icon>`}};D.styles=[u,T],E([o()],D.prototype,`size`,void 0),E([o()],D.prototype,`name`,void 0),E([o({type:Object})],D.prototype,`networkImagesBySize`,void 0),E([o()],D.prototype,`imageSrc`,void 0),E([o({type:Boolean})],D.prototype,`selected`,void 0),E([o({type:Boolean})],D.prototype,`round`,void 0),D=E([l(`wui-network-image`)],D);export{h as n,S as t};