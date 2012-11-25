module Q {
  export class Defer {
    resolve(arg:any);
    reject(arg?:any);
    promise:Q.Promise;
  }
  export class Promise {
    then(onSuccess:(arg:any)=>any, onFailure?:()=>any):Q.Promise;
    get(property: string): Q.Promise;
    done();
  }
  export function defer():Q.Defer;
  export function resolve(val:any):Q.Promise;
}
