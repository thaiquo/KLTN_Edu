import{B as e,F as t,K as n,M as r,U as i,V as a,b as o,g as s,i as c,j as l,l as ee,r as u,rt as d,t as f,v as p,w as m,y as h}from"./ModalController-DLyGHbfk.js";import{_ as g,c as _,f as v,l as y,m as b,o as x,s as S,w as C,x as w,y as T}from"./wui-text-BTwUa-zK.js";import{n as E,t as D}from"./ref-BkVckqZm.js";import{E as O,d as k,y as A}from"./index-fSQaSaNY.js";var j=C`
  div {
    width: 100%;
  }

  [data-ready='false'] {
    transform: scale(1.05);
  }

  @media (max-width: 430px) {
    [data-ready='false'] {
      transform: translateY(-50px);
    }
  }
`,M=function(e,t,n,r){var i=arguments.length,a=i<3?t:r===null?r=Object.getOwnPropertyDescriptor(t,n):r,o;if(typeof Reflect==`object`&&typeof Reflect.decorate==`function`)a=Reflect.decorate(e,t,n,r);else for(var s=e.length-1;s>=0;s--)(o=e[s])&&(a=(i<3?o(a):i>3?o(t,n,a):o(t,n))||a);return i>3&&a&&Object.defineProperty(t,n,a),a},N=600,P=360,F=64,I=class extends T{constructor(){super(),this.bodyObserver=void 0,this.unsubscribe=[],this.iframe=document.getElementById(`w3m-iframe`),this.ready=!1,this.unsubscribe.push(f.subscribeKey(`open`,e=>{e||this.onHideIframe()}),f.subscribeKey(`shake`,e=>{e?this.iframe.style.animation=`w3m-shake 500ms var(--apkt-easings-ease-out-power-2)`:this.iframe.style.animation=`none`}))}disconnectedCallback(){this.onHideIframe(),this.unsubscribe.forEach(e=>e()),this.bodyObserver?.unobserve(window.document.body)}async firstUpdated(){await this.syncTheme(),this.iframe.style.display=`block`;let e=this?.renderRoot?.querySelector(`div`);this.bodyObserver=new ResizeObserver(t=>{let n=(t?.[0]?.contentBoxSize)?.[0]?.inlineSize;this.iframe.style.height=`${N}px`,e.style.height=`${N}px`,r.state.enableEmbedded?this.updateFrameSizeForEmbeddedMode():n&&n<=430?(this.iframe.style.width=`100%`,this.iframe.style.left=`0px`,this.iframe.style.bottom=`0px`,this.iframe.style.top=`unset`,this.onShowIframe()):(this.iframe.style.width=`${P}px`,this.iframe.style.left=`calc(50% - ${P/2}px)`,this.iframe.style.top=`calc(50% - ${N/2}px + ${F/2}px)`,this.iframe.style.bottom=`unset`,this.onShowIframe())}),this.bodyObserver.observe(window.document.body)}render(){return w`<div data-ready=${this.ready} id="w3m-frame-container"></div>`}onShowIframe(){let e=window.innerWidth<=430;this.ready=!0,this.iframe.style.animation=e?`w3m-iframe-zoom-in-mobile 200ms var(--apkt-easings-ease-out-power-2)`:`w3m-iframe-zoom-in 200ms var(--apkt-easings-ease-out-power-2)`}onHideIframe(){this.iframe.style.display=`none`,this.iframe.style.animation=`w3m-iframe-fade-out 200ms var(--apkt-easings-ease-out-power-2)`}async syncTheme(){let e=p.getAuthConnector();if(e){let t=h.getSnapshot().themeMode,r=h.getSnapshot().themeVariables;await e.provider.syncTheme({themeVariables:r,w3mThemeVariables:n(r,t)})}}async updateFrameSizeForEmbeddedMode(){let e=this?.renderRoot?.querySelector(`div`);await new Promise(e=>{setTimeout(e,300)});let t=this.getBoundingClientRect();e.style.width=`100%`,this.iframe.style.left=`${t.left}px`,this.iframe.style.top=`${t.top}px`,this.iframe.style.width=`${t.width}px`,this.iframe.style.height=`${t.height}px`,this.onShowIframe()}};I.styles=j,M([S()],I.prototype,`ready`,void 0),I=M([y(`w3m-approve-transaction-view`)],I);var L=g`
  a {
    border: none;
    border-radius: ${({borderRadius:e})=>e[20]};
    display: flex;
    flex-direction: row;
    align-items: center;
    padding: ${({spacing:e})=>e[1]};
    transition:
      background-color ${({durations:e})=>e.lg}
        ${({easings:e})=>e[`ease-out-power-2`]},
      box-shadow ${({durations:e})=>e.lg}
        ${({easings:e})=>e[`ease-out-power-2`]},
      border ${({durations:e})=>e.lg} ${({easings:e})=>e[`ease-out-power-2`]};
    will-change: background-color, box-shadow, border;
  }

  /* -- Variants --------------------------------------------------------------- */
  a[data-type='success'] {
    background-color: ${({tokens:e})=>e.core.backgroundSuccess};
    color: ${({tokens:e})=>e.core.textSuccess};
  }

  a[data-type='error'] {
    background-color: ${({tokens:e})=>e.core.backgroundError};
    color: ${({tokens:e})=>e.core.textError};
  }

  a[data-type='warning'] {
    background-color: ${({tokens:e})=>e.core.backgroundWarning};
    color: ${({tokens:e})=>e.core.textWarning};
  }

  /* -- Sizes --------------------------------------------------------------- */
  a[data-size='sm'] {
    height: 24px;
  }

  a[data-size='md'] {
    height: 28px;
  }

  a[data-size='lg'] {
    height: 32px;
  }

  a[data-size='sm'] > wui-image,
  a[data-size='sm'] > wui-icon {
    width: 16px;
    height: 16px;
  }

  a[data-size='md'] > wui-image,
  a[data-size='md'] > wui-icon {
    width: 20px;
    height: 20px;
  }

  a[data-size='lg'] > wui-image,
  a[data-size='lg'] > wui-icon {
    width: 24px;
    height: 24px;
  }

  wui-text {
    padding-left: ${({spacing:e})=>e[1]};
    padding-right: ${({spacing:e})=>e[1]};
  }

  wui-image {
    border-radius: ${({borderRadius:e})=>e[3]};
    overflow: hidden;
    user-drag: none;
    user-select: none;
    -moz-user-select: none;
    -webkit-user-drag: none;
    -webkit-user-select: none;
    -ms-user-select: none;
  }

  /* -- States --------------------------------------------------------------- */
  @media (hover: hover) and (pointer: fine) {
    a[data-type='success']:not(:disabled):hover {
      background-color: ${({tokens:e})=>e.theme.foregroundPrimary};
      box-shadow: 0px 0px 0px 1px ${({tokens:e})=>e.core.borderSuccess};
    }

    a[data-type='error']:not(:disabled):hover {
      background-color: ${({tokens:e})=>e.theme.foregroundPrimary};
      box-shadow: 0px 0px 0px 1px ${({tokens:e})=>e.core.borderError};
    }

    a[data-type='warning']:not(:disabled):hover {
      background-color: ${({tokens:e})=>e.theme.foregroundPrimary};
      box-shadow: 0px 0px 0px 1px ${({tokens:e})=>e.core.borderWarning};
    }
  }

  a[data-type='success']:not(:disabled):focus-visible {
    box-shadow:
      0px 0px 0px 1px ${({tokens:e})=>e.core.backgroundAccentPrimary},
      0px 0px 0px 4px ${({tokens:e})=>e.core.foregroundAccent020};
  }

  a[data-type='error']:not(:disabled):focus-visible {
    box-shadow:
      0px 0px 0px 1px ${({tokens:e})=>e.core.backgroundAccentPrimary},
      0px 0px 0px 4px ${({tokens:e})=>e.core.foregroundAccent020};
  }

  a[data-type='warning']:not(:disabled):focus-visible {
    box-shadow:
      0px 0px 0px 1px ${({tokens:e})=>e.core.backgroundAccentPrimary},
      0px 0px 0px 4px ${({tokens:e})=>e.core.foregroundAccent020};
  }

  a:disabled {
    opacity: 0.5;
  }
`,R=function(e,t,n,r){var i=arguments.length,a=i<3?t:r===null?r=Object.getOwnPropertyDescriptor(t,n):r,o;if(typeof Reflect==`object`&&typeof Reflect.decorate==`function`)a=Reflect.decorate(e,t,n,r);else for(var s=e.length-1;s>=0;s--)(o=e[s])&&(a=(i<3?o(a):i>3?o(t,n,a):o(t,n))||a);return i>3&&a&&Object.defineProperty(t,n,a),a},te={sm:`md-regular`,md:`lg-regular`,lg:`lg-regular`},ne={success:`sealCheck`,error:`warning`,warning:`exclamationCircle`},z=class extends T{constructor(){super(...arguments),this.type=`success`,this.size=`md`,this.imageSrc=void 0,this.disabled=!1,this.href=``,this.text=void 0}render(){return w`
      <a
        rel="noreferrer"
        target="_blank"
        href=${this.href}
        class=${this.disabled?`disabled`:``}
        data-type=${this.type}
        data-size=${this.size}
      >
        ${this.imageTemplate()}
        <wui-text variant=${te[this.size]} color="inherit">${this.text}</wui-text>
      </a>
    `}imageTemplate(){return this.imageSrc?w`<wui-image src=${this.imageSrc} size="inherit"></wui-image>`:w`<wui-icon
      name=${ne[this.type]}
      weight="fill"
      color="inherit"
      size="inherit"
      class="image-icon"
    ></wui-icon>`}};z.styles=[b,v,L],R([_()],z.prototype,`type`,void 0),R([_()],z.prototype,`size`,void 0),R([_()],z.prototype,`imageSrc`,void 0),R([_({type:Boolean})],z.prototype,`disabled`,void 0),R([_()],z.prototype,`href`,void 0),R([_()],z.prototype,`text`,void 0),z=R([y(`wui-semantic-chip`)],z);var B=function(e,t,n,r){var i=arguments.length,a=i<3?t:r===null?r=Object.getOwnPropertyDescriptor(t,n):r,o;if(typeof Reflect==`object`&&typeof Reflect.decorate==`function`)a=Reflect.decorate(e,t,n,r);else for(var s=e.length-1;s>=0;s--)(o=e[s])&&(a=(i<3?o(a):i>3?o(t,n,a):o(t,n))||a);return i>3&&a&&Object.defineProperty(t,n,a),a},V=class extends T{render(){return w`
      <wui-flex flexDirection="column" alignItems="center" gap="5" padding="5">
        <wui-text variant="md-regular" color="primary">Follow the instructions on</wui-text>
        <wui-semantic-chip
          icon="externalLink"
          variant="fill"
          text=${i.SECURE_SITE_DASHBOARD}
          href=${i.SECURE_SITE_DASHBOARD}
          imageSrc=${i.SECURE_SITE_FAVICON}
          data-testid="w3m-secure-website-button"
        >
        </wui-semantic-chip>
        <wui-text variant="sm-regular" color="secondary">
          You will have to reconnect for security reasons
        </wui-text>
      </wui-flex>
    `}};V=B([y(`w3m-upgrade-wallet-view`)],V);var H=function(e,t,n,r){var i=arguments.length,a=i<3?t:r===null?r=Object.getOwnPropertyDescriptor(t,n):r,o;if(typeof Reflect==`object`&&typeof Reflect.decorate==`function`)a=Reflect.decorate(e,t,n,r);else for(var s=e.length-1;s>=0;s--)(o=e[s])&&(a=(i<3?o(a):i>3?o(t,n,a):o(t,n))||a);return i>3&&a&&Object.defineProperty(t,n,a),a},U=class extends T{constructor(){super(...arguments),this.loading=!1,this.switched=!1,this.text=``,this.network=u.state.activeCaipNetwork}render(){return w`
      <wui-flex flexDirection="column" gap="2" .padding=${[`6`,`4`,`3`,`4`]}>
        ${this.togglePreferredAccountTypeTemplate()} ${this.toggleSmartAccountVersionTemplate()}
      </wui-flex>
    `}toggleSmartAccountVersionTemplate(){return w`
      <w3m-tooltip-trigger text="Changing the smart account version will reload the page">
        <wui-list-item
          icon=${this.isV6()?`arrowTop`:`arrowBottom`}
          ?rounded=${!0}
          ?chevron=${!0}
          data-testid="account-toggle-smart-account-version"
          @click=${this.toggleSmartAccountVersion.bind(this)}
        >
          <wui-text variant="lg-regular" color="primary"
            >Force Smart Account Version ${this.isV6()?`7`:`6`}</wui-text
          >
        </wui-list-item>
      </w3m-tooltip-trigger>
    `}isV6(){return(t.get(`dapp_smart_account_version`)||`v6`)===`v6`}toggleSmartAccountVersion(){t.set(`dapp_smart_account_version`,this.isV6()?`v7`:`v6`),typeof window<`u`&&window?.location?.reload()}togglePreferredAccountTypeTemplate(){let t=this.network?.chainNamespace,n=u.checkIfSmartAccountEnabled(),r=p.getConnectorId(t);return!p.getAuthConnector()||r!==d.CONNECTOR_ID.AUTH||!n?null:(this.switched||(this.text=s(t)===e.ACCOUNT_TYPES.SMART_ACCOUNT?`Switch to your EOA`:`Switch to your Smart Account`),w`
      <wui-list-item
        icon="swapHorizontal"
        ?rounded=${!0}
        ?chevron=${!0}
        ?loading=${this.loading}
        @click=${this.changePreferredAccountType.bind(this)}
        data-testid="account-toggle-preferred-account-type"
      >
        <wui-text variant="lg-regular" color="primary">${this.text}</wui-text>
      </wui-list-item>
    `)}async changePreferredAccountType(){let t=this.network?.chainNamespace,n=u.checkIfSmartAccountEnabled(),r=s(t)===e.ACCOUNT_TYPES.SMART_ACCOUNT||!n?e.ACCOUNT_TYPES.EOA:e.ACCOUNT_TYPES.SMART_ACCOUNT;p.getAuthConnector()&&(this.loading=!0,await ee.setPreferredAccountType(r,t),this.text=r===e.ACCOUNT_TYPES.SMART_ACCOUNT?`Switch to your EOA`:`Switch to your Smart Account`,this.switched=!0,c.resetSend(),this.loading=!1,this.requestUpdate())}};H([S()],U.prototype,`loading`,void 0),H([S()],U.prototype,`switched`,void 0),H([S()],U.prototype,`text`,void 0),H([S()],U.prototype,`network`,void 0),U=H([y(`w3m-smart-account-settings-view`)],U);var W=g`
  :host {
    width: 100%;
  }

  button {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background-color: ${({tokens:e})=>e.theme.foregroundPrimary};
    border-radius: ${({borderRadius:e})=>e[4]};
    padding: ${({spacing:e})=>e[4]};
  }

  .name {
    max-width: 75%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  @media (hover: hover) and (pointer: fine) {
    button:hover:enabled {
      cursor: pointer;
      background-color: ${({tokens:e})=>e.theme.foregroundSecondary};
      border-radius: ${({borderRadius:e})=>e[6]};
    }
  }

  button:disabled {
    opacity: 0.5;
    cursor: default;
  }

  button:focus-visible:enabled {
    box-shadow: 0 0 0 4px ${({tokens:e})=>e.core.foregroundAccent040};
    background-color: ${({tokens:e})=>e.theme.foregroundSecondary};
  }
`,G=function(e,t,n,r){var i=arguments.length,a=i<3?t:r===null?r=Object.getOwnPropertyDescriptor(t,n):r,o;if(typeof Reflect==`object`&&typeof Reflect.decorate==`function`)a=Reflect.decorate(e,t,n,r);else for(var s=e.length-1;s>=0;s--)(o=e[s])&&(a=(i<3?o(a):i>3?o(t,n,a):o(t,n))||a);return i>3&&a&&Object.defineProperty(t,n,a),a},K=class extends T{constructor(){super(...arguments),this.name=``,this.registered=!1,this.loading=!1,this.disabled=!1}render(){return w`
      <button ?disabled=${this.disabled}>
        <wui-text class="name" color="primary" variant="md-regular">${this.name}</wui-text>
        ${this.templateRightContent()}
      </button>
    `}templateRightContent(){return this.loading?w`<wui-loading-spinner size="lg" color="primary"></wui-loading-spinner>`:this.registered?w`<wui-tag variant="info" size="sm">Registered</wui-tag>`:w`<wui-tag variant="success" size="sm">Available</wui-tag>`}};K.styles=[b,v,W],G([_()],K.prototype,`name`,void 0),G([_({type:Boolean})],K.prototype,`registered`,void 0),G([_({type:Boolean})],K.prototype,`loading`,void 0),G([_({type:Boolean})],K.prototype,`disabled`,void 0),K=G([y(`wui-account-name-suggestion-item`)],K);var q=g`
  :host {
    position: relative;
    width: 100%;
    display: inline-block;
  }

  :host([disabled]) {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .base-name {
    position: absolute;
    right: ${({spacing:e})=>e[4]};
    top: 50%;
    transform: translateY(-50%);
    text-align: right;
    padding: ${({spacing:e})=>e[1]};
    background-color: ${({tokens:e})=>e.theme.foregroundSecondary};
    border-radius: ${({borderRadius:e})=>e[1]};
  }
`,J=function(e,t,n,r){var i=arguments.length,a=i<3?t:r===null?r=Object.getOwnPropertyDescriptor(t,n):r,o;if(typeof Reflect==`object`&&typeof Reflect.decorate==`function`)a=Reflect.decorate(e,t,n,r);else for(var s=e.length-1;s>=0;s--)(o=e[s])&&(a=(i<3?o(a):i>3?o(t,n,a):o(t,n))||a);return i>3&&a&&Object.defineProperty(t,n,a),a},Y=class extends T{constructor(){super(...arguments),this.disabled=!1,this.loading=!1}render(){return w`
      <wui-input-text
        value=${x(this.value)}
        ?disabled=${this.disabled}
        .value=${this.value||``}
        data-testid="wui-ens-input"
        icon="search"
        inputRightPadding="5xl"
        .onKeyDown=${this.onKeyDown}
      ></wui-input-text>
    `}};Y.styles=[b,q],J([_()],Y.prototype,`errorMessage`,void 0),J([_({type:Boolean})],Y.prototype,`disabled`,void 0),J([_()],Y.prototype,`value`,void 0),J([_({type:Boolean})],Y.prototype,`loading`,void 0),J([_({attribute:!1})],Y.prototype,`onKeyDown`,void 0),Y=J([y(`wui-ens-input`)],Y);var X=g`
  wui-flex {
    width: 100%;
  }

  .suggestion {
    background-color: ${({tokens:e})=>e.theme.foregroundPrimary};
    border-radius: ${({borderRadius:e})=>e[4]};
  }

  .suggestion:hover:not(:disabled) {
    cursor: pointer;
    border: none;
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background-color: ${({tokens:e})=>e.theme.foregroundSecondary};
    border-radius: ${({borderRadius:e})=>e[6]};
    padding: ${({spacing:e})=>e[4]};
  }

  .suggestion:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .suggestion:focus-visible:not(:disabled) {
    box-shadow: 0 0 0 4px ${({tokens:e})=>e.core.foregroundAccent040};
    background-color: ${({tokens:e})=>e.theme.foregroundSecondary};
  }

  .suggested-name {
    max-width: 75%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  form {
    width: 100%;
    position: relative;
  }

  .input-submit-button,
  .input-loading-spinner {
    position: absolute;
    top: 22px;
    transform: translateY(-50%);
    right: 10px;
  }
`,Z=function(e,t,n,r){var i=arguments.length,a=i<3?t:r===null?r=Object.getOwnPropertyDescriptor(t,n):r,o;if(typeof Reflect==`object`&&typeof Reflect.decorate==`function`)a=Reflect.decorate(e,t,n,r);else for(var s=e.length-1;s>=0;s--)(o=e[s])&&(a=(i<3?o(a):i>3?o(t,n,a):o(t,n))||a);return i>3&&a&&Object.defineProperty(t,n,a),a},Q=class extends T{constructor(){super(),this.formRef=D(),this.usubscribe=[],this.name=``,this.error=``,this.loading=A.state.loading,this.suggestions=A.state.suggestions,this.profileName=u.getAccountData()?.profileName,this.onDebouncedNameInputChange=a.debounce(e=>{e.length<4?this.error=`Name must be at least 4 characters long`:k.isValidReownName(e)?(this.error=``,A.getSuggestions(e)):this.error=`The value is not a valid username`}),this.usubscribe.push(A.subscribe(e=>{this.suggestions=e.suggestions,this.loading=e.loading}),u.subscribeChainProp(`accountState`,e=>{this.profileName=e?.profileName,e?.profileName&&(this.error=`You already own a name`)}))}firstUpdated(){this.formRef.value?.addEventListener(`keydown`,this.onEnterKey.bind(this))}disconnectedCallback(){super.disconnectedCallback(),this.usubscribe.forEach(e=>e()),this.formRef.value?.removeEventListener(`keydown`,this.onEnterKey.bind(this))}render(){return w`
      <wui-flex
        flexDirection="column"
        alignItems="center"
        gap="4"
        .padding=${[`1`,`3`,`4`,`3`]}
      >
        <form ${E(this.formRef)} @submit=${this.onSubmitName.bind(this)}>
          <wui-ens-input
            @inputChange=${this.onNameInputChange.bind(this)}
            .errorMessage=${this.error}
            .value=${this.name}
            .onKeyDown=${this.onKeyDown.bind(this)}
          >
          </wui-ens-input>
          ${this.submitButtonTemplate()}
          <input type="submit" hidden />
        </form>
        ${this.templateSuggestions()}
      </wui-flex>
    `}submitButtonTemplate(){let e=this.suggestions.find(e=>e.name?.split(`.`)?.[0]===this.name&&e.registered);if(this.loading)return w`<wui-loading-spinner
        class="input-loading-spinner"
        color="secondary"
      ></wui-loading-spinner>`;let t=`${this.name}${d.WC_NAME_SUFFIX}`;return w`
      <wui-icon-link
        ?disabled=${!!e}
        class="input-submit-button"
        size="sm"
        icon="chevronRight"
        iconColor=${e?`default`:`accent-primary`}
        @click=${()=>this.onSubmitName(t)}
      >
      </wui-icon-link>
    `}onNameInputChange(e){let t=k.validateReownName(e.detail||``);this.name=t,this.onDebouncedNameInputChange(t)}onKeyDown(e){e.key.length===1&&!k.isValidReownName(e.key)&&e.preventDefault()}templateSuggestions(){return!this.name||this.name.length<4||this.error?null:w`<wui-flex flexDirection="column" gap="1" alignItems="center">
      ${this.suggestions.map(e=>w`<wui-account-name-suggestion-item
            name=${e.name}
            ?registered=${e.registered}
            ?loading=${this.loading}
            ?disabled=${e.registered||this.loading}
            data-testid="account-name-suggestion"
            @click=${()=>this.onSubmitName(e.name)}
          ></wui-account-name-suggestion-item>`)}
    </wui-flex>`}isAllowedToSubmit(e){let t=e.split(`.`)?.[0],n=this.suggestions.find(e=>e.name?.split(`.`)?.[0]===t&&e.registered);return!this.loading&&!this.error&&!this.profileName&&t&&A.validateName(t)&&!n}async onSubmitName(t){try{if(!this.isAllowedToSubmit(t))return;m.sendEvent({type:`track`,event:`REGISTER_NAME_INITIATED`,properties:{isSmartAccount:s(u.state.activeChain)===e.ACCOUNT_TYPES.SMART_ACCOUNT,ensName:t}}),await A.registerName(t),m.sendEvent({type:`track`,event:`REGISTER_NAME_SUCCESS`,properties:{isSmartAccount:s(u.state.activeChain)===e.ACCOUNT_TYPES.SMART_ACCOUNT,ensName:t}})}catch(n){l.showError(n.message),m.sendEvent({type:`track`,event:`REGISTER_NAME_ERROR`,properties:{isSmartAccount:s(u.state.activeChain)===e.ACCOUNT_TYPES.SMART_ACCOUNT,ensName:t,error:a.parseError(n)}})}}onEnterKey(e){if(e.key===`Enter`&&this.name&&this.isAllowedToSubmit(this.name)){let e=`${this.name}${d.WC_NAME_SUFFIX}`;this.onSubmitName(e)}}};Q.styles=X,Z([_()],Q.prototype,`errorMessage`,void 0),Z([S()],Q.prototype,`name`,void 0),Z([S()],Q.prototype,`error`,void 0),Z([S()],Q.prototype,`loading`,void 0),Z([S()],Q.prototype,`suggestions`,void 0),Z([S()],Q.prototype,`profileName`,void 0),Q=Z([y(`w3m-register-account-name-view`)],Q);var re=C`
  .continue-button-container {
    width: 100%;
  }
`,ie=function(e,t,n,r){var i=arguments.length,a=i<3?t:r===null?r=Object.getOwnPropertyDescriptor(t,n):r,o;if(typeof Reflect==`object`&&typeof Reflect.decorate==`function`)a=Reflect.decorate(e,t,n,r);else for(var s=e.length-1;s>=0;s--)(o=e[s])&&(a=(i<3?o(a):i>3?o(t,n,a):o(t,n))||a);return i>3&&a&&Object.defineProperty(t,n,a),a},$=class extends T{render(){return w`
      <wui-flex
        flexDirection="column"
        alignItems="center"
        gap="6"
        .padding=${[`0`,`0`,`4`,`0`]}
      >
        ${this.onboardingTemplate()} ${this.buttonsTemplate()}
        <wui-link
          @click=${()=>{a.openHref(O.URLS.FAQ,`_blank`)}}
        >
          Learn more
          <wui-icon color="inherit" slot="iconRight" name="externalLink"></wui-icon>
        </wui-link>
      </wui-flex>
    `}onboardingTemplate(){return w` <wui-flex
      flexDirection="column"
      gap="6"
      alignItems="center"
      .padding=${[`0`,`6`,`0`,`6`]}
    >
      <wui-flex gap="3" alignItems="center" justifyContent="center">
        <wui-icon-box size="xl" color="success" icon="checkmark"></wui-icon-box>
      </wui-flex>
      <wui-flex flexDirection="column" alignItems="center" gap="3">
        <wui-text align="center" variant="md-medium" color="primary">
          Account name chosen successfully
        </wui-text>
        <wui-text align="center" variant="md-regular" color="primary">
          You can now fund your account and trade crypto
        </wui-text>
      </wui-flex>
    </wui-flex>`}buttonsTemplate(){return w`<wui-flex
      .padding=${[`0`,`4`,`0`,`4`]}
      gap="3"
      class="continue-button-container"
    >
      <wui-button fullWidth size="lg" borderRadius="xs" @click=${this.redirectToAccount.bind(this)}
        >Let's Go!
      </wui-button>
    </wui-flex>`}redirectToAccount(){o.replace(`Account`)}};$.styles=re,$=ie([y(`w3m-register-account-name-success-view`)],$);export{I as W3mApproveTransactionView,$ as W3mRegisterAccountNameSuccess,Q as W3mRegisterAccountNameView,U as W3mSmartAccountSettingsView,V as W3mUpgradeWalletView};