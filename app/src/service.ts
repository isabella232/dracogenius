class CachingHttp {
  constructor(private $http : angular.$http, private $q : angular.$q, private $rootScope) {};

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
    chrome.storage.local.get(key, (result) => { this.$rootScope.$apply(()=>{
      if (key in result) {
        deferred.resolve(result[key]);
      } else {
        deferred.reject();
      }
    })});
    return deferred.promise;
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

