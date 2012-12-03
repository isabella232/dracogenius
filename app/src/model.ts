interface CardPrinting {
  edition_id: string;
  edition: string;
  rarity: string;
  collectorsNumber: string; // two sided cards have an 'a' and a 'b' side
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
  tags: string[] = [];

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

  get colors() {
    // Note: currently missing Color Indicators. Blargh.
    if (!this.castingCost) {
      return [];
    }
    return ['W','U','B','R','G'].filter((color:string) {
      return this.castingCost.match(color);
    });
  }

  toJson() {
    var obj = angular.copy(this);
    delete obj.rawHtml;
    console.log(obj);
    return JSON.stringify(obj, null, 2);
  }

  static parseCardHtml(cardHtml:string, CardFetcher:CardFetcher):Card {
    var r = /<span style="font-size: 1.2em;"><a href="\/(.*?)\/en\/(\d+[ab]?)\.html">(.*?)<\/a><\/span>/;
    var match = cardHtml.match(r);
    var name = match[3];
    var edition_id = match[1];
    var collectorsNumber = match[2];
    r = /<p><img src="http:\/\/magiccards.info\/images\/en.gif" alt="English" width="16" height="11" class="flag2"> (.*?), <i>(.*?)<\/i><\/p>/;
    match = cardHtml.match(r);
    var edition = match[1];
    var rarity = match[2];
    r = /<p>(.*?),[\s\n]+ (X*[\d\{\}\/BWUGR]+)?( \((\d+)\))?<\/p>/;
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
    var card = new Card(name, CardFetcher);
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

class Query {
  static parser : Parser;
  static initializeParser() {
    var word = withJoin(repeat1(negate(choice([" ", "\t", "\n"].map(ch)))));

    var quoted = withAction(
      sequence([ch('"'), withJoin(repeat(negate(ch('"')))), ch('"')]),
      function(ast) { return ast[1]; });

    var search_token = choice([quoted, word]);

    var typeSearch = withAction(
      sequence([token("t:"), search_token]),
      function(ast) {return new TypeQuery(ast[1])}
    );

    var tagSearch = withAction(
      sequence([token("tag:"), search_token]),
      function(ast) {return new TagQuery(ast[1])}
    );

    var artistSearch = withAction(
      sequence([token("a:"), search_token]),
      function(ast) {return new ArtistQuery(ast[1])}
    );

    var cmcSearch = withAction(
      sequence([token("cmc"),
                choice(['=', '>=', '<=', ':', '>', '<'].map(token)),
                search_token]),
      (ast) => new CMCQuery(parseInt(ast[2], 10), ast[1])
    );

    var normalSearch = withAction(search_token, function(str) {
      return new RegexQuery(str);
    });

    var basicSearchTerm = choice([artistSearch,
                                  typeSearch,
                                  tagSearch,
                                  cmcSearch,
                                  normalSearch]);

    var negatedSearchTerm = withAction(
      sequence([token('-'), basicSearchTerm]),
      (ast) => Query.not(ast[1]));

    var searchTerm = whitespace(choice([negatedSearchTerm, basicSearchTerm]));

    var searchCombiner = withAction(repeat(searchTerm),
      function (queries:QueryPart[]):QueryPart {
        if (!queries) {
          return new MatchAllQuery();
        }
        if (queries.length === 1) {
          return queries[0];
        }
        return Query.and(queries);
      }
    );

    Query.parser = searchCombiner;
  }
  static parse(search:string):QueryPart {
    return Query.parser(ps(search)).ast;
  }

  static and(queries:QueryPart[]):QueryPart {
    return new AndQuery(queries);
  }

  static not(query:QueryPart):QueryPart {
    return new NotQuery(query);
  }
}

Query.initializeParser();


interface QueryPart {
  match(card:Card):bool;
}

class AndQuery implements QueryPart {
  kind = 'and';
  constructor(public queries:QueryPart[]) {};

  match(card:Card):bool {
    var matched = true;
    this.queries.forEach((query:QueryPart) => {
      matched = matched && query.match(card);
    });
    return matched;
  }
}

class NotQuery implements QueryPart {
  kind = 'not';
  constructor(public query:QueryPart) { }

  match(card:Card):bool {
    return !this.query.match(card);
  }
}

class MatchAllQuery implements QueryPart {
  kind = 'match everything';
  match(card:Card) {
    return true;
  }
}

class RegexQuery implements QueryPart {
  kind = 'regex';
  regexp : RegExp;
  constructor(regex:string) {
    this.regexp = new RegExp(regex, 'i');
  }
  match(card:Card) {
    return this.regexp.test(card.rawHtml + " " + card.tags.join(", "));
  }
}

class TypeQuery implements QueryPart {
  regexp : RegExp;
  kind = 'type';
  constructor(typeStr:string) {
    this.regexp = new RegExp(typeStr, 'i');
  };

  match(card:Card) {
    return this.regexp.test(card.type);
  }
}

class TagQuery implements QueryPart {
  regexp : RegExp;
  kind = 'tag';
  constructor(typeStr:string) {
    this.regexp = new RegExp(typeStr, 'i');
  };

  match(card:Card) {
    var result = false;
    card.tags.forEach((tag:string) => {
      if (this.regexp.test(tag)) {
        result = true;
      }
    })
    return result;
  }
}

class ArtistQuery implements QueryPart {
  regexp : RegExp;
  kind = 'artist';
  constructor(typeStr:string) {
    this.regexp = new RegExp(typeStr, 'i');
  };

  match(card:Card) {
    var result = false;
    card.printings.forEach((printing:CardPrinting) => {
      if (this.regexp.test(printing.illustrator)) {
        result = true;
      }
    });
    return result;
  }
}

class CMCQuery implements QueryPart {
  kind = 'CMC';
  constructor(public value:number, public operator:string) {}

  match(card:Card) {
    if (this.operator === '=') {
      return card.cmc === this.value;
    } else if ((this.operator === '>=') || (this.operator === ':')) {
      return card.cmc >= this.value;
    } else if (this.operator === '>') {
      return card.cmc > this.value;
    } else if (this.operator === '<') {
      return card.cmc < this.value;
    } else if (this.operator === '<=') {
      return card.cmc <= this.value;
    } else {
      throw Error("unknown cmc operator '" + this.operator + "'");
    }
  }
}

class Facet {
  getHistogram(cards:Card[]):any[][] {
    var map = {};
    cards.forEach((card:Card) => {
      this.getField(card).forEach((value) => {
        if (!(value in map)) {
          map[value] = 0;
        }
        map[value]++;
      });
    });
    var keyValues = objectToKeyValues(map);
    keyValues.sort((a,b) => {
      return this.sortBy(a[0], a[1]) - this.sortBy(b[0], b[1]);
    });
    return keyValues;
  }

  getField(card:Card):string[] {
    throw Error("Not implemented");
  };
  sortBy(value:string, count:number):number {
    return -count;
  };

}

class CMCFacet extends Facet {
  getField(card:Card):string[] {
    return ["" + (card.cmc || 0)];
  }
  sortBy(cmc:string, count:number) {
    return parseInt(cmc, 10) || -1;
  }
}

class RarityFacet extends Facet {
  rarities = ["Land", "Common", "Uncommon", "Rare", "Mythic Rare"];
  getField(card:Card):string[] {
    return card.printings.map((printing:CardPrinting) => printing.rarity);
  }
  sortBy(rarity:string, count:number) {
    return this.rarities.indexOf(rarity);
  }
}

class TagFacet extends Facet {
  getField(card:Card):string[] {
    return card.tags;
  }
}

class ColorFacet extends Facet {
  getField(card:Card):string[] {
    var colors = card.colors;
    if (colors.length > 1) {
      return colors.concat(['multi']);
    } if (colors.length === 0 && !/Land/.test(card.type)) {
      console.log(card.name);

      return ['colorless'];
    }
    return colors;
  }
}
