function randomPick(arr:any[]):any {
  if (arr.length === 0) {
    return undefined;
  }
  return arr[Math.round(Math.random() * (arr.length - 1))];
}

function arrayUnion(arr1:any[], arr2:any[]):any[] {
  return arr1.concat(arrayDifference(arr2, arr1));
}

function arrayDifference(arr1:any[], arr2:any[]):any[] {
  return arr1.filter((val) => arr2.indexOf(val) === -1);
}

function arrayIntersection(arr1:any[], arr2:any[]):any[] {
  return arr1.filter((val) => arr2.indexOf(val) >= 0);
}

function arrayUnique(arr:string[]):string[] {
  var elems = {};
  return arr.filter((val) => {
    if (val in elems) {
      return false;
    }
    elems[val] = true;
    return true;
  });
}

function isObjectEmpty(obj:Object) {
  for (var key in obj) {
    return false;
  }
  return true;
}

