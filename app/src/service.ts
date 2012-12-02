class PermanantStorage {
  private asyncQueue : Object = {};
  private timeout = null;

  constructor(private $q : angular.$q, private $rootScope) {};

  getFromStorage(key:string) {
    var deferred = this.$q.defer();
    if (!(key in this.asyncQueue)) {
      this.asyncQueue[key] = [];
    }
    this.asyncQueue[key].push(deferred);

    this.ensureWillGetFromStorage();
    return deferred.promise;
  }

  ensureWillGetFromStorage() {
    if (this.timeout === null) {
      this.timeout = setTimeout(() => this.reallyGetFromStorage(), 30);
    }
  }

  reallyGetFromStorage() {
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

  setInStorage(key, value) {
    var setObj = {};
    setObj[key] = value;
    chrome.storage.local.set(setObj);
  }
}

class CachingHttp {
  constructor(private $http : angular.$http, private $q : angular.$q, private $rootScope, private PermanantStorage : PermanantStorage) {
  };

  get(url:string, options={}) {
    var cacheKey = "cache:" + url;
    return this.PermanantStorage.getFromStorage(cacheKey).then(
      (val)=> val ,
      ()=> {
        var p = this.$http.get(url, options).then((resp) => resp.data);
        p.then((text) => this.PermanantStorage.setInStorage(cacheKey, text))
        return p;
      }
    );
  }

  getImage(url:string) {
    var cacheKey = "cache:" + url;
    return this.PermanantStorage.getFromStorage(cacheKey).then(
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
          this.PermanantStorage.setInStorage(cacheKey, result);
          deferred.resolve(result);
        })};
        img.src = url;
        return deferred.promise;
      }
    )
  }
}

class CardFetcher {
  constructor(private CachingHttp : CachingHttp,
              private PermanantStorage : PermanantStorage,
              private $q : angular.$q) {};

  tags = {};

  // Returns a promise of a Card[]
  getCards(set="m13"):angular.$q.promise {
    var url = "http://magiccards.info/query?q=e%3A" + set + "%2Fen&v=spoiler";

    var htmlPromise = this.CachingHttp.get(url);
    var tagsPromise = pOr(this.PermanantStorage.getFromStorage("tags"), {}, this.$q);
    return this.$q.all([htmlPromise, tagsPromise]).then((values) => {
        var html = values[0];
        for (var name in values[1]) {
          this.tags[name] = values[1][name];
        }
        return html
          // split into cards
          .match(/<td valign="top" width="25%">[^]+?<\/td>/gm)
          // parse into Card objects
          .map((card) => {
            try {
              var card = Card.parseCardHtml(card, this)
              if (card.name in this.tags) {
                card.tags = this.tags[card.name];
              }
              return card;
            } catch(e) {
              console.log("can't parse card", JSON.stringify(card), " got error", e);
              throw e;
            }
          })
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

  updatedTags(card:Card) {
    this.updatedMultipleTags([card]);
  }

  updatedMultipleTags(cards:Card[]) {
    cards.forEach((card:Card) {
      if (card.tags.length === 0) {
        delete this.tags[card.name];
      } else {
        this.tags[card.name] = card.tags;
      }
    });
    this.PermanantStorage.setInStorage("tags", this.tags);
  }
}


var DGservice = angular.module('DG.service', []);
DGservice.factory('CachingHttp',
  ($http:angular.$http, $q:angular.$q, $rootScope, PermanantStorage:PermanantStorage) => {
    return new CachingHttp($http, $q, $rootScope, PermanantStorage);
  }
);
DGservice.factory('CardFetcher', (CachingHttp:CachingHttp, PermanantStorage:PermanantStorage, $q) => {
  return new CardFetcher(CachingHttp, PermanantStorage, $q);
});
DGservice.factory('PermanantStorage', ($q, $rootScope) => {
  return new PermanantStorage($q, $rootScope);
});
//TODO(rictic): this doesn't seem to be working
DGservice.filter("pretty", () => (obj) => JSON.stringify(obj, null, 2));

var DracoGenius = angular.module('DG', ['DG.service', 'scroll', 'ui']);

function isObjectEmpty(obj:Object) {
  for (var key in obj) {
    return false;
  }
  return true;
}

function pOr(p:angular.$q.promise, fallback:any, $q):angular.$q.promise {
  var deferred = $q.defer();
  p.then((value) => {
    deferred.resolve(value);
  }, () => {
    deferred.resolve(fallback);
  })
  return deferred.promise;
}
