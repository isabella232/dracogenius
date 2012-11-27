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

  static parseCardHtml(cardHtml:string, CardFetcher:CardFetcher):Card {
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
  static parse(search:string):QueryPart {
    var word = withJoin(repeat1(negate(choice([" ", "\t", "\n"].map(ch)))));

    var quoted = withAction(
      sequence([ch('"'), withJoin(repeat(negate(ch('"')))), ch('"')]),
      function(ast) { return ast[1]; });

    var search_token = choice([quoted, word]);

    var typeSearch = withAction(
      sequence([token("t:"), search_token]),
      function(ast) {return new TypeQuery(ast[1])}
    );

    var normalSearch = withAction(search_token, function(str) {
      return new RegexQuery(str);
    });

    var singleSearchTerm = whitespace(choice([typeSearch, normalSearch]));

    var searchCombiner = withAction(repeat(singleSearchTerm),
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

    return searchCombiner(ps(search)).ast;
  }

  static and(queries:QueryPart[]):QueryPart {
    return {
      match: (card:Card) {
        var matched = true;
        queries.forEach((query) => {
          matched = matched && query.match(card);
        });
        return matched;
      }
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
    return this.regexp.test(card.rawHtml);
  }
}

class TypeQuery implements QueryPart {
  regexp : RegExp;
  constructor(typeStr:string) {
    this.regexp = new RegExp(typeStr, 'i');
  };

  match(card:Card) {
    return this.regexp.test(card.type);
  }
}

