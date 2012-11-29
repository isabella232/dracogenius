var cachingHttp;
class CachingHttp {
  constructor(private $http : angular.$http, private $q : angular.$q, private $rootScope) {
    cachingHttp = this;
  };

  private asyncQueue : Object = {};
  private timeout = null;

  get(url:string, options={}) {
    var cacheKey = "cache:" + url;
    return this.getFromStorage(cacheKey).then(
      (val)=> val ,
      ()=> {
        var p = this.$http.get(url, options).then((resp) => resp.data);
        p.then((text) => this.setInStorage(cacheKey, text))
        return p;
      }
    );
  }

  getImage(url:string) {
    var cacheKey = "cache:" + url;
    return this.getFromStorage(cacheKey).then(
      (val)=> {
        return val;
      },
      () => {
        var deferred = this.$q.defer();
        var img = new Image();

        img.onload = ()=> { this.$rootScope.$apply(() => {
          var canvas = <CanvasElement> document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, img.width, img.height);
          var result : string = canvas.toDataURL("image/jpeg");
          this.setInStorage(cacheKey, result);
          deferred.resolve(result);
        })};
        img.src = url;
        return deferred.promise;
      }
    )

  }

  private getFromStorage(key:string) {
    var deferred = this.$q.defer();
    if (!(key in this.asyncQueue)) {
      this.asyncQueue[key] = [];
    }
    this.asyncQueue[key].push(deferred);

    this.ensureWillGetFromStorage();
    return deferred.promise;
  }

  private ensureWillGetFromStorage() {
    if (this.timeout === null) {
      this.timeout = setTimeout(() => this.reallyGetFromStorage(), 30);
    }
  }

  private reallyGetFromStorage() {
    var query = [];
    var limit = 20;
    for (var key in this.asyncQueue) {
      if (query.length == limit) {
        break;
      }
      query.push(key);
    }
    chrome.storage.local.get(query, (result:Object) => {
                                     this.$rootScope.$apply(()=>{
      query.forEach((key:string) {
        var deferreds = <angular.$q.deferred[]> this.asyncQueue[key];
        if (!deferreds) {
          console.error("wtf, can't find my deferreds!");
          return;
        }
        if (key in result) {
          var value = result[key];
          deferreds.forEach((deferred) => deferred.resolve(value));
        } else {
          deferreds.forEach((deferred) => deferred.reject());
        }
        delete this.asyncQueue[key];
        this.timeout = null;
        if (!isObjectEmpty(this.asyncQueue)) {
          this.ensureWillGetFromStorage();
        }
      });
    })});
  }

  private setInStorage(key, value) {
    var setObj = {};
    setObj[key] = value;
    chrome.storage.local.set(setObj);
  }
}

class CardFetcher {
  constructor(private CachingHttp : CachingHttp) {};

  // Returns a promise of a Card[]
  getCards(set="m13"):angular.$q.promise {
    var url = "http://magiccards.info/query?q=e%3A" + set + "%2Fen&v=spoiler";
    return this.CachingHttp.get(url).then((html) => {
        return html
          // split into cards
          .match(/<td valign="top" width="25%">[^]+?<\/td>/gm)
          // parse into Card objects
          .map((card) => {
            try {
              return Card.parseCardHtml(card, this)
            } catch(e) {
              console.log("can't parse card", JSON.stringify(card), " got error", e);
              throw e;
            }
          });
    });
  }

  // Returns a promise of a URI for the card image
  getCardImage(cardOrPrinting) {
    var printing : CardPrinting;
    if (cardOrPrinting.edition_id) {
      printing = <CardPrinting>cardOrPrinting;
    } else {
      printing = (<Card>cardOrPrinting).printings[0];
    }
    var url = ("http://magiccards.info/scans/en/"
               + printing.edition_id + "/"
               + printing.collectorsNumber + ".jpg");
    return this.CachingHttp.getImage(url);
  }
}


var DGservice = angular.module('DG.service', []);
DGservice.factory('CachingHttp',
  ($http:angular.$http, $q:angular.$q, $rootScope) => {
    return new CachingHttp($http, $q, $rootScope);
  }
);
DGservice.factory('CardFetcher', (CachingHttp) => {
  return new CardFetcher(CachingHttp);
});

var DracoGenius = angular.module('DG', ['DG.service', 'scroll']);

function isObjectEmpty(obj:Object) {
  for (var key in obj) {
    return false;
  }
  return true;
}
