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
}
