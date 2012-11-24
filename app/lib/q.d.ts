module Q {
  export class Defer {
    resolve(arg:any);
    promise:Q.Promise;
  }
  export class Promise {
    then(f:(arg:any)=>any):Q.Promise;
    get(property: string): Q.Promise;
    done();
  }
  export function defer():Q.Defer;
  export function resolve(val:any):Q.Promise;
}
