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

    var tagSearch = withAction(
      sequence([token("tag:"), search_token]),
      function(ast) {return new TagQuery(ast[1])}
    );

    var artistSearch = withAction(
      sequence([token("a:"), search_token]),
      function(ast) {return new ArtistQuery(ast[1])}
    );

    var normalSearch = withAction(search_token, function(str) {
      return new RegexQuery(str);
    });

    var basicSearchTerm = choice([artistSearch,
                                  typeSearch,
                                  tagSearch,
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

    return searchCombiner(ps(search)).ast;
  }

  static and(queries:QueryPart[]):QueryPart {
    return new AndQuery(queries);
  }

  static not(query:QueryPart):QueryPart {
    return new NotQuery(query);
  }
}




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
