module chrome {
  export interface EventEmitter {
    addListener: (f:()=>any)=>any;
  }
  export class browserAction {
    static onClicked: EventEmitter;
    static setBadgeBackgroundColor(obj:{color: string;});
    static setBadgeText(obj:{text: string;});
  }
  export var app: {
    runtime: {
      onLaunched: EventEmitter;
    };
  };

  export interface storageArea {
    get(key:string, callback:(value:any)=>void):void;
    set(keyvalues:Object, callback?:()=>void);
  };
  export var storage: {
    local: storageArea;
  }
}


declare interface XMLHttpRequest {
  overrideMimeType(type:string):void;
}

declare var unescape : (val:string)=>string;
