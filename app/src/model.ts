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

  toString() {
    return [
      this.name,
      this.abilities.join("\n"),
      this.castingCost,
      this.type,
      this.tags.join(" "),
      this.printings.map((printing:CardPrinting):string => {
        return [
          printing.edition,
          printing.rarity
        ].join("\n");
      }).join("\n")
    ].join("\n");
  }

  static parseCardHtml(cardHtml:string, CardFetcher:CardFetcher):Card {
    var r = /<span style="font-size: 1.2em;"><a href="\/(.*?)\/en\/(\d+[abcdefg]?)\.html">(.*?)<\/a><\/span>/;
    var match = cardHtml.match(r);
    var name = match[3];
    var edition_id = match[1];
    var collectorsNumber = match[2];
    r = /<p><img src="http:\/\/magiccards.info\/images\/en.gif" alt="English" width="16" height="11" class="flag2"> (.*?), <i>(.*?)<\/i><\/p>/;
    match = cardHtml.match(r);
    var edition = match[1];
    var rarity = match[2];
    r = /<p>(.*?),[\s\n]+ (X*Y*Z*[\d\{\}\/BWUGRP]*)?( \((\d+)\))?<\/p>/;
    match = cardHtml.match(r);
    var type = match[1];
    var castingCost = match[2];
    var cmc = parseInt(match[4], 10);
    if (isNaN(cmc)) {
      cmc = 0;
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

    var flavorSearch = withAction(
      sequence([token("ft:"), search_token]),
      function(ast) {return new FlavorQuery(ast[1])}
    );

    var cmcSearch = withAction(
      sequence([token("cmc"),
                choice(['=', '>=', '<=', ':', '>', '<'].map(token)),
                search_token]),
      (ast) => new CMCQuery(parseInt(ast[2], 10), ast[1])
    );

    var colorSearch = withAction(
      sequence([token("c"),
                choice([':', '!'].map(token)),
                search_token]),
      (ast) => new ColorQuery(ast[2], ast[1])
    );



    var normalSearch = withAction(search_token, function(str) {
      return new RegexQuery(str);
    });

    var basicSearchTerm = choice([artistSearch,
                                  flavorSearch,
                                  typeSearch,
                                  tagSearch,
                                  cmcSearch,
                                  colorSearch,
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
    return this.regexp.test(card.toString());
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

class ColorQuery implements QueryPart {
  colors : string[];
  kind = 'color';
  constructor(colorString:string, public operator:string) {
    this.colors = arrayUnique(colorString.toUpperCase().split(''));
  }

  match(card:Card) {
    if (arrayIntersection(this.colors, card.colors).length === 0) {
      return false;
    }
    if (this.operator === '!') {
      if (arrayDifference(card.colors, this.colors).length > 0) {
        return false;
      }
    }
    return true;
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

class FlavorQuery implements QueryPart {
  regexp : RegExp;
  kind = 'flavor';
  constructor(typeStr:string) {
    this.regexp = new RegExp(typeStr, 'i');
  };

  match(card:Card) {
    var result = false;
    card.printings.forEach((printing:CardPrinting) => {
      if (this.regexp.test(printing.flavorText)) {
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
      return ['colorless'];
    }
    return colors;
  }
}


var sets = {
  "Return to Ravnica": [
        ["rtr", "Return to Ravnica"],
  ],
  "Innistrad Cycle": [
        ["avr", "Avacyn Restored"],
        ["dka", "Dark Ascension"],
        ["isd", "Innistrad"],
  ],
  "Scars of Mirrodin": [
        ["nph", "New Phyrexia"],
        ["mbs", "Mirrodin Besieged"],
        ["som", "Scars of Mirrodin"],
  ],
  "Zendikar Cycle": [
        ["roe", "Rise of the Eldrazi"],
        ["wwk", "Worldwake"],
        ["zen", "Zendikar"],
  ],
  "Shards of Alara": [
        ["arb", "Alara Reborn"],
        ["cfx", "Conflux"],
        ["ala", "Shards of Alara"],
  ],
  "Shadowmoor Cycle": [
        ["eve", "Eventide"],
        ["shm", "Shadowmoor"],
  ],
  "Lorwyn Cycle": [
        ["mt", "Morningtide"],
        ["lw", "Lorwyn"],
  ],
  "Time Spiral Cycle": [
        ["fut", "Future Sight"],
        ["pc", "Planar Chaos"],
        ["ts", "Time Spiral"],
        ["tsts", "Time Spiral \"Timeshifted\""],
  ],
  "Ice Age Cycle": [
        ["cs", "Coldsnap"],
        ["ai", "Alliances"],
        ["ia", "Ice Age"],
  ],
  "Ravnica Cycle": [
        ["di", "Dissension"],
        ["gp", "Guildpact"],
        ["rav", "Ravnica: City of Guilds"],
  ],
  "Kamigawa Cycle": [
        ["sok", "Saviors of Kamigawa"],
        ["bok", "Betrayers of Kamigawa"],
        ["chk", "Champions of Kamigawa"],
  ],
  "Mirrodin Cycle": [
        ["5dn", "Fifth Dawn"],
        ["ds", "Darksteel"],
        ["mi", "Mirrodin"],
  ],
  "Onslaught Cycle": [
        ["sc", "Scourge"],
        ["le", "Legions"],
        ["on", "Onslaught"],
  ],
  "Odyssey Cycle": [
        ["ju", "Judgment"],
        ["tr", "Torment"],
        ["od", "Odyssey"],
  ],
  "Invasion Cycle": [
        ["ap", "Apocalypse"],
        ["ps", "Planeshift"],
        ["in", "Invasion"],
  ],
  "Masquerade Cycle": [
        ["pr", "Prophecy"],
        ["ne", "Nemesis"],
        ["mm", "Mercadian Masques"],
  ],
  "Artifacts Cycle": [
        ["ud", "Urza's Destiny"],
        ["ul", "Urza's Legacy"],
        ["us", "Urza's Saga"],
  ],
  "Rath Cycle": [
        ["ex", "Exodus"],
        ["sh", "Stronghold"],
        ["tp", "Tempest"],
  ],
  "Mirage Cycle": [
        ["wl", "Weatherlight"],
        ["vi", "Visions"],
        ["mr", "Mirage"],
  ],
  "Early Sets": [
        ["hl", "Homelands"],
        ["fe", "Fallen Empires"],
        ["dk", "The Dark"],
        ["lg", "Legends"],
        ["aq", "Antiquities"],
        ["an", "Arabian Nights"],
  ],
  "Core Set Editions": [
        ["m13", "Magic 2013"],
        ["m12", "Magic 2012"],
        ["m11", "Magic 2011"],
        ["m10", "Magic 2010"],
        ["10e", "Tenth Edition"],
        ["9e", "Ninth Edition"],
        ["8e", "Eighth Edition"],
        ["7e", "Seventh Edition"],
        ["6e", "Classic Sixth Edition"],
        ["5e", "Fifth Edition"],
        ["4e", "Fourth Edition"],
        ["rv", "Revised Edition"],
        ["un", "Unlimited Edition"],
        ["be", "Limited Edition Beta"],
        ["al", "Limited Edition Alpha"],
  ],
  "Magic Online": [
        ["me4", "MTGO Masters Edition IV"],
        ["me3", "MTGO Masters Edition III"],
        ["me2", "MTGO Masters Edition II"],
        ["med", "MTGO Masters Edition"],
  ],
  "Premium Deck Series": [
        ["pd3", "Premium Deck Series: Graveborn"],
        ["pd2", "Premium Deck Series: Fire and Lightning"],
        ["pds", "Premium Deck Series: Slivers"],
  ],
  "Reprint Sets": [
        ["dpa", "Duels of the Planeswalkers"],
        ["ch", "Chronicles"],
  ],
  "“Command Zone” Series": [
        ["cma", "Commander's Arsenal"],
        ["pc2", "Planechase 2012 Edition"],
        ["cmd", "Commander"],
        ["arc", "Archenemy"],
        ["pch", "Planechase"],
  ],
  "From The Vault": [
        ["v12", "From the Vault: Realms"],
        ["fvl", "From the Vault: Legends"],
        ["fvr", "From the Vault: Relics"],
        ["fve", "From the Vault: Exiled"],
        ["fvd", "From the Vault: Dragons"],
  ],
  "Duel Decks": [
        ["ddj", "Duel Decks: Izzet vs. Golgari"],
        ["ddi", "Duel Decks: Venser vs. Koth"],
        ["ddh", "Duel Decks: Ajani vs. Nicol Bolas"],
        ["ddg", "Duel Decks: Knights vs. Dragons"],
        ["ddf", "Duel Decks: Elspeth vs. Tezzeret"],
        ["pvc", "Duel Decks: Phyrexia vs. The Coalition"],
        ["gvl", "Duel Decks: Garruk vs. Liliana"],
        ["dvd", "Duel Decks: Divine vs. Demonic"],
        ["jvc", "Duel Decks: Jace vs. Chandra"],
        ["evg", "Duel Decks: Elves vs. Goblins"],
  ],
  "Theme Decks": [
        ["cstd", "Coldsnap Theme Decks"],
  ],
  "Independent Box Sets": [
        ["9eb", "Ninth Edition Box Set"],
        ["8eb", "Eighth Edition Box Set"],
        ["dm", "Deckmasters"],
        ["bd", "Beatdown Box Set"],
        ["br", "Battle Royale Box Set"],
        ["at", "Anthologies"],
        ["mgbc", "Multiverse Gift Box Cards"],
  ],
  "Un-Serious Sets": [
        ["uh", "Unhinged"],
        ["ug", "Unglued"],
  ],
  "Alternate Art": [
        ["uhaa", "Unhinged Alternate Foils"],
  ],
  "Beginner Sets": [
        ["st2k", "Starter 2000"],
        ["st", "Starter 1999"],
        ["p3k", "Portal Three Kingdoms"],
        ["po2", "Portal Second Age"],
        ["po", "Portal"],
        ["itp", "Introductory Two-Player Set"],
  ],
  "Not Legal for Tournament Play": [
        ["ced", "Collector's Edition"],
        ["cedi", "International Collectors' Edition"],
  ],
  "Event Incentives": [
        ["15ann", "15th Anniversary"],
        ["gpx", "Grand Prix"],
        ["pro", "Pro Tour"],
        ["mgdc", "Magic Game Day Cards"],
        ["wrl", "Worlds"],
        ["drc", "Dragon Con"],
  ],
  "Tournament Rewards": [
        ["ptc", "Prerelease Events"],
        ["rep", "Release Events"],
        ["mlp", "Magic: The Gathering Launch Parties"],
        ["sum", "Summer of Magic"],
        ["grc", "WPN/Gateway"],
        ["cp", "Champs"],
        ["thgt", "Two-Headed Giant Tournament"],
        ["arena", "Arena League"],
        ["fnmp", "Friday Night Magic"],
        ["mprp", "Magic Player Rewards"],
        ["sus", "Super Series"],
  ],
  "Gifts": [
        ["hho", "Happy Holidays"],
        ["jr", "Judge Gift Program"],
        ["pot", "Portal Demogame"],
  ],
  "Redemption Rewards": [
        ["euro", "European Land Program"],
        ["guru", "Guru"],
        ["apac", "Asia Pacific Land Program"],
        ["wotc", "WotC Online Store"],
  ],
  "Celebration Cards": [
        ["uqc", "Celebration Cards"],
  ],
  "Media Inserts": [
        ["mbp", "Media Inserts"],
  ],
  "Membership Incentives": [
        ["dcilm", "Legend Membership"],
  ],
}

interface DeckEntry {
  count:number;
  name:string;
}

class Deck {
  cards:DeckEntry[];
  sideboard:DeckEntry[] = [];
  name:string;
  static parse(decktext:string):Deck {
    var deck = new Deck();
    var deckTitle = withAction(
      sequence([repeat1(negate(ch('\n'))), token('\n\n')]),
      (ast) => ast[0].join('')
    );
    var deckEntry = withAction(
      sequence([
        repeat1(choice("0123456789".split('').map(ch))),
        repeat1(choice(" \t".split('').map(ch))),
        repeat1(negate(ch('\n'))),
        choice([token('\n'), end_p])
      ]),
      (ast) => {
        return {
          count: parseInt(ast[0].join(''), 10),
          name: ast[2].join('')
        }
      }
    );
    var skipBlanks = function(p) {
      var commentLine : Parser = sequence(
        [whitespace(ch('#')), repeat(negate(ch('\n')))]);
      var blank = choice([ch('\n'), commentLine])
      return withAction(
        sequence([
          repeat(blank),
          p,
          repeat(blank)
        ]),
        (ast) =>  {
          if (ast[0].name) {
            return ast[0];
          } else if (ast[1].name) {
            return ast[1];
          }
          throw new Error("Don't know how to handle " + ast);
        }
      );
    };
    var deckParser = withAction(
      sequence([
        optional(deckTitle),
        repeat1(skipBlanks(deckEntry)),
      ]),
      (ast) => {
        var deck = new Deck();
        if (ast.length == 2) {
          deck.name = ast.shift();
        }
        deck.cards = ast.shift();
        return deck;
      }
    )
    var result = deckParser(ps(decktext));
    if (result) {
      return result.ast;
    }
  }
}
