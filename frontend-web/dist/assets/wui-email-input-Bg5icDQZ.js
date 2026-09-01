import{c as e,l as t,m as n,o as r,w as i,x as a,y as o}from"./wui-text-BTwUa-zK.js";import"./wui-input-text-Ggm3_OBp.js";var s=i`
  :host {
    position: relative;
    display: inline-block;
    width: 100%;
  }
`,c=function(e,t,n,r){var i=arguments.length,a=i<3?t:r===null?r=Object.getOwnPropertyDescriptor(t,n):r,o;if(typeof Reflect==`object`&&typeof Reflect.decorate==`function`)a=Reflect.decorate(e,t,n,r);else for(var s=e.length-1;s>=0;s--)(o=e[s])&&(a=(i<3?o(a):i>3?o(t,n,a):o(t,n))||a);return i>3&&a&&Object.defineProperty(t,n,a),a},l=class extends o{constructor(){super(...arguments),this.disabled=!1}render(){return a`
      <wui-input-text
        type="email"
        placeholder="Email"
        icon="mail"
        size="lg"
        .disabled=${this.disabled}
        .value=${this.value}
        data-testid="wui-email-input"
        tabIdx=${r(this.tabIdx)}
      ></wui-input-text>
      ${this.templateError()}
    `}templateError(){return this.errorMessage?a`<wui-text variant="sm-regular" color="error">${this.errorMessage}</wui-text>`:null}};l.styles=[n,s],c([e()],l.prototype,`errorMessage`,void 0),c([e({type:Boolean})],l.prototype,`disabled`,void 0),c([e()],l.prototype,`value`,void 0),c([e()],l.prototype,`tabIdx`,void 0),l=c([t(`wui-email-input`)],l);