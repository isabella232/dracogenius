class CachingHttp {
  constructor(private $http : angular.$http, private $q : angular.$q, private $rootScope) {};

  get(url:string, options={}) {
    var cacheKey = "cache:" + url;
    console.log("trying from storage")
    console.log(cacheKey);
    return this.getFromStorage(cacheKey).then(
      (val)=>{
        console.log("retrieved from storage");
        return val;
      },
      ()=> {
        console.log("not found in storage");
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
        console.log("got image from cache");
        return val;
      },
      () => {
        console.log("could not get image from cache");
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
    console.log("fetching from storage")
    chrome.storage.local.get(key, (result) => { this.$rootScope.$apply(()=>{
      console.log("got ", result, " from storage");
      if (key in result) {
        console.log("resolving! with data of length", result[key].length);
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
    console.log("trying to get raw html");
    return this.CachingHttp.get(url).then((html) => {
        console.log("Got raw html")
        return html
          // split into cards
          .match(/<td valign="top" width="25%">[^]+?<\/td>/gm)
          // parse into Card objects
          .map((card) => this.parseCardHtml(card));
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

  private parseCardHtml(cardHtml:string):Card {
    var r = /<span style="font-size: 1.2em;"><a href="\/(.*?)\/en\/(\d+)\.html">(.*?)<\/a><\/span>/;
    var match = cardHtml.match(r);
    var name = match[3];
    var edition_id = match[1];
    var collectorsNumber = parseInt(match[2]);
    r = /<p><img src="http:\/\/magiccards.info\/images\/en.gif" alt="English" width="16" height="11" class="flag2"> (.*?), <i>(.*?)<\/i><\/p>/;
    match = cardHtml.match(r);
    var edition = match[1];
    var rarity = match[2];
    r = /<p>(.*?), [\s\n]+ (X*[\dBWUGR]+)?( \((\d+)\))?<\/p>/;
    match = cardHtml.match(r);
    var type = match[1];
    var castingCost = match[2];
    var cmc = parseInt(match[4], 10);
    if (isNaN(cmc)) {
      cmc = null;
    }
    r = /<p class="ctext"><b>(.*?)<\/b><\/p>/;
    match = cardHtml.match(r);
    var abilities = [];
    if (match) {
      abilities = match[1].split("<br><br>");
    }
    r = /<p><i>(.*?)<\/i><\/p>/
    match = cardHtml.match(r);
    var flavorText = match[1];
    r = /<p>Illus. (.*?)<\/p>/
    match = cardHtml.match(r);
    var illustrator = match[1];
    var card = new Card(name, this);
    card.rawHtml = cardHtml;
    card.abilities = abilities;
    card.castingCost = castingCost;
    card.cmc = cmc;
    card.type = type;
    card.printings.push({
      edition: edition,
      edition_id: edition_id,
      rarity: rarity,
      flavorText: flavorText,
      illustrator: illustrator,
      collectorsNumber: collectorsNumber
    });
    return card;
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

var DracoGenius = angular.module('DG', ['DG.service']);

