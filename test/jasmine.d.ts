class JasmineExpectation {
  toBe(val:bool):void;
  toBe(val:string):void;
  toBe(val:number):void;

  toEqual(val:any):void;

  not:JasmineExpectation;

  shouldMatch(cardName:string):void;
}


declare var describe: (name:string, f:()=>void)=>void;
declare var it: (name:string, f:()=>void)=>void;
declare var beforeEach: (f:()=>void)=>void;

declare var expect: (val:any)=>JasmineExpectation;

