declare module angular {
  export var copy : (val:any)=>any;
  export var module : (name:string, deps:string[])=>Module;
  export interface Module {
    factory(name:string, factImpl:Function);
    directive(name:string, impl:Function);
  }

  export interface $http {
    get(options:{}):$q.promise;
  };

  export module $q {
    interface promise {
      then(onSuccess:(arg:any)=>any, onFailure?:()=>any):promise;
      get(property: string): promise;
      done():void;
    }
    interface deferred {
      resolve(arg:any);
      reject(arg?:any);
      promise:promise;
    }
  }

  interface $q {
    defer():$q.deferred;
    resolve(val:any):$q.promise;
  }
}
