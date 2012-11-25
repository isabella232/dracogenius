class CachingHttp {
  constructor(private $http : angular.$http, private $q : angular.$q) {};

  get(options) {
    var cacheKey = "cache:" + options.url;
    return getFromStorage(cacheKey).then(
      (val)=>val,
      ()=> {
        var p = this.$http.get(options);
        p.then((text) => setInStorage(cacheKey, text))
        return p;
      }
    );
  }

  private getFromStorage(key:string) {
    var deferred = this.$q.defer();
    chrome.storage.local.get(key, function(result) {
      if (key in result) {
        deferred.resolve(result[key]);
      } else {
        deferred.reject();
      }
    });
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

  getNum() {
    return 10;
  }

  // Returns a promise of a Card[]
  getCards(set="m13"):angular.$q.promise {
    var url = "http://magiccards.info/query?q=e%3A" + set + "%2Fen&v=spoiler";
    return this.CachingHttp.get({url:url}).then((html) => {
        return html
          // split into cards
          .match(/<td valign="top" width="25%">[^]+?<\/td>/gm)
          // parse into Card objects
          .map(this.parseCardHtml)
    });
  }

  private parseCardHtml(cardHtml:string):Card {
    var r = /<span style="font-size: 1.2em;"><a href="(.*?(\d+))\.html">(.*?)<\/a><\/span>/;
    var match = cardHtml.match(r);
    var name = match[3];
    var id = match[1];
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
    var card = new Card(name);
    card.rawHtml = cardHtml;
    card.abilities = abilities;
    card.castingCost = castingCost;
    card.cmc = cmc;
    card.type = type;
    card.printings.push({
      id: id,
      edition: edition,
      rarity: rarity,
      flavorText: flavorText,
      illustrator: illustrator,
      collectorsNumber: collectorsNumber
    });
    return card;
  }
}

class Card {
  rawHtml : string;
  name: string;
  printings: {
    edition: string;
    rarity: string;
    collectorsNumber: number;
    id: string;
    flavorText: string;
    illustrator: string;
  }[] = [];
  abilities: string[];
  castingCost: string;
  cmc: number;
  type: string;

  constructor(name:string) {
    this.name = name;
  }

  toJson() {
    var obj = angular.copy(this);
    delete obj.rawHtml;
    console.log(obj);
    return JSON.stringify(obj, null, 2);
  }
}

var DGservice = angular.module('DG.service', []);
DGservice.factory('CachingHttp', ($http:angular.$http, $q:angular.$q) => {
  return new CachingHttp($http, $q);
});
DGservice.factory('CardFetcher', (CachingHttp) => {
  return new CardFetcher(CachingHttp);
});

function SimpleCont(CardFetcher, $scope) {
  $scope.cards = CardFetcher.getCards();
}

var DracoGenius = angular.module('DG', ['DG.service']);

