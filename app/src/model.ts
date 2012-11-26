interface CardPrinting {
  edition_id: string;
  edition: string;
  rarity: string;
  collectorsNumber: number;
  flavorText: string;
  illustrator: string;
};

class Card {
  rawHtml : string;
  name: string;
  printings: CardPrinting[] = [];
  abilities: string[];
  castingCost: string;
  cmc: number;
  type: string;

  constructor(name:string, private CardFetcher:CardFetcher) {
    this.name = name;
  }

  get image() {
    if (!('_image' in this)) {
      this['_image'] = this.CardFetcher.getCardImage(this);
    }
    return this['_image'];
  }

  get link() {
    var printing = this.printings[0];
    return "http://magiccards.info/" + printing.edition_id + "/en/" + printing.collectorsNumber;
  }

  toJson() {
    var obj = angular.copy(this);
    delete obj.rawHtml;
    console.log(obj);
    return JSON.stringify(obj, null, 2);
  }
}

class Query {
  static parse(query:string):QueryPart {
    if (!query || query === "") {
      return new MatchAllQuery();
    }
    var r = /t\:("([^"]+)"|\S+)/g;
    var match = query.match(r);
    if (match) {
      query.replace()
    }
  }
}

interface QueryPart {
  match(card:Card):bool;
}

class MatchAllQuery implements QueryPart {
  match(card:Card) {
    return true;
  }
}

class RegexQuery implements QueryPart {
  regexp : RegExp;
  constructor(regex:string) {
    this.regexp = new RegExp(regex, 'i');
  }
  match(card:Card) {
    return !!card.rawHtml.match(this.regexp);
  }
}

function matchAll(needle:RegExp, haystack:string):string[][] {
  var searcher = new RegExp(needle.source,
                            'g' +
                            (needle.ignoreCase ? 'i' : '') +
                            (needle.multiline ? 'm' : ''));
  var results = [];

}
